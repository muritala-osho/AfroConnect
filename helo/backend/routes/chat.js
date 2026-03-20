const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Message = require("../models/Message");
const Match = require("../models/Match");
const User = require("../models/User");

// @route   GET /api/chat/conversations
// @desc    Get all conversations for user with pagination (optimized with aggregation)
// @access  Private
router.get("/conversations", protect, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);

    // Get current user's blocked list
    const currentUser = await User.findById(req.user._id)
      .select("blockedUsers")
      .lean();
    const blockedUserIds = (currentUser?.blockedUsers || []).map((id) =>
      id.toString(),
    );

    // Get all matches for the user with pagination using lean for speed
    const matches = await Match.find({ users: req.user._id })
      .populate(
        "users",
        "name photos onlineStatus lastActive blockedUsers verified",
      )
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    if (!matches.length) {
      return res.json({ success: true, conversations: [] });
    }

    // Get all match IDs for batch query
    const matchIds = matches.map((m) => m._id);

    // Batch query: Get last messages for all matches at once using aggregation
    const lastMessagesAgg = await Message.aggregate([
      {
        $match: {
          matchId: { $in: matchIds },
          deletedFor: { $ne: req.user._id },
        },
      },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$matchId", lastMessage: { $first: "$$ROOT" } } },
    ]);
    const lastMessagesMap = new Map(
      lastMessagesAgg.map((m) => [m._id.toString(), m.lastMessage]),
    );

    // Batch query: Get unread counts for all matches at once
    const unreadCountsAgg = await Message.aggregate([
      {
        $match: {
          matchId: { $in: matchIds },
          receiver: req.user._id,
          seen: false,
          deletedFor: { $ne: req.user._id },
        },
      },
      { $group: { _id: "$matchId", count: { $sum: 1 } } },
    ]);
    const unreadCountsMap = new Map(
      unreadCountsAgg.map((m) => [m._id.toString(), m.count]),
    );

    // Build conversations from cached data
    const onlineUsers = req.app.get("onlineUsers");
    const currentUserId = req.user._id.toString();
    const conversations = matches.map((match) => {
      const otherUser = match.users.find(
        (u) => u._id.toString() !== currentUserId,
      );
      if (!otherUser) return null;

      // Filter out blocked users (both directions)
      if (blockedUserIds.includes(otherUser._id.toString())) return null;
      const otherUserBlockedMe = (otherUser.blockedUsers || []).some(
        (id) => id.toString() === req.user._id.toString(),
      );
      if (otherUserBlockedMe) return null;

      // Search filter
      if (
        search &&
        !otherUser.name.toLowerCase().includes(search.toLowerCase())
      )
        return null;

      const matchIdStr = match._id.toString();
      const lastMessage = lastMessagesMap.get(matchIdStr);
      const unreadCount = unreadCountsMap.get(matchIdStr) || 0;

      return {
        id: match._id,
        matchId: match._id,
        user: {
          id: otherUser._id,
          name: otherUser.name,
          photo: otherUser.photos?.[0]?.url || otherUser.photos?.[0],
          online:
            (onlineUsers && onlineUsers.has(otherUser._id.toString())) ||
            otherUser.onlineStatus === "online",
          verified: otherUser.verified || false,
        },
        lastMessage: lastMessage?.content || "",
        lastMessageType: lastMessage?.type || "text",
        timestamp: lastMessage?.createdAt || match.createdAt,
        unreadCount,
      };
    });

    // Filter nulls, deduplicate by user ID, and sort by timestamp
    const seenUserIds = new Set();
    const filteredConversations = conversations
      .filter((c) => c !== null)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .filter((c) => {
        if (seenUserIds.has(c.user.id.toString())) return false;
        seenUserIds.add(c.user.id.toString());
        return true;
      });

    res.json({ success: true, conversations: filteredConversations });
  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   PUT /api/chat/mark-all-read
// @desc    Mark all messages as read
// @access  Private
router.put("/mark-all-read", protect, async (req, res) => {
  try {
    await Message.updateMany(
      { receiver: req.user._id, seen: false },
      { seen: true, seenAt: Date.now(), status: "seen" },
    );
    res.json({ success: true, message: "All messages marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   DELETE /api/chat/delete-all
// @desc    Delete all chats for user (soft delete)
// @access  Private
router.delete("/delete-all", protect, async (req, res) => {
  try {
    await Message.updateMany(
      { $or: [{ sender: req.user._id }, { receiver: req.user._id }] },
      { $addToSet: { deletedFor: req.user._id } },
    );
    res.json({ success: true, message: "All chats deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   GET /api/chat/:matchId
// @desc    Get messages for a match
// @access  Private
// FIX: Increased default limit to 1000 so all messages load, added proper pagination support
router.get("/:matchId", protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { limit = 1000, skip = 0 } = req.query;
    const pageSize = Math.min(parseInt(limit) || 1000, 2000);
    const skipAmount = Math.max(0, parseInt(skip) || 0);

    // Verify user is part of the match
    const match = await Match.findById(matchId);
    if (!match || !match.users.includes(req.user._id)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const messages = await Message.find({
      matchId,
      deletedFor: { $ne: req.user._id },
    })
      .sort({ createdAt: -1 })
      .limit(pageSize)
      .skip(skipAmount)
      .lean()
      .populate("sender", "name photos");

    const total = await Message.countDocuments({
      matchId,
      deletedFor: { $ne: req.user._id },
    });

    res.json({
      success: true,
      messages: messages.reverse(),
      pagination: {
        total,
        limit: pageSize,
        skip: skipAmount,
        hasMore: skipAmount + pageSize < total,
      },
    });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   POST /api/chat/:matchId
// @desc    Send a message (text, image, audio, file)
// @access  Private
router.post("/:matchId", protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const {
      content,
      type = "text",
      imageUrl,
      videoUrl,
      audioUrl,
      audioDuration,
      fileUrl,
      fileName,
      fileSize,
      fileType,
      callStatus,
      callType,
    } = req.body;

    // Direct Messaging Check (Premium Only)
    if (matchId === "direct") {
      if (!req.user.premium?.isActive) {
        return res
          .status(403)
          .json({
            success: false,
            message:
              "Direct messaging without a match is a Premium feature. Upgrade now!",
          });
      }
    }

    // Verify match exists and user is part of it
    const match = await Match.findById(matchId);
    if (!match || !match.users.includes(req.user._id)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const receiver = match.users.find((id) => !id.equals(req.user._id));

    // Create system message for call history
    if (type === "call") {
      const messageData = {
        matchId,
        sender: req.user._id,
        receiver,
        type: "system",
        content: `${callStatus === "missed" ? "Missed" : "Ended"} ${callType || "voice"} call`,
        status: "delivered",
        deliveredAt: new Date(),
        metadata: { callStatus, callType },
      };
      const message = await Message.create(messageData);
      await message.populate("sender", "name photos");
      const io = req.app.get("io");
      if (io) {
        const msgPayload = { message, matchId: matchId.toString() };
        io.to(matchId.toString()).emit("chat:new-message", msgPayload);
      }
      return res.status(201).json({ success: true, message });
    }

    // Check if either user has blocked the other
    const currentUser = await User.findById(req.user._id).select(
      "blockedUsers",
    );
    const receiverUser = await User.findById(receiver).select("blockedUsers");
    if (
      currentUser?.blockedUsers?.includes(receiver.toString()) ||
      receiverUser?.blockedUsers?.includes(req.user._id.toString())
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Cannot send message to this user" });
    }

    const { replyTo } = req.body;

    const messageData = {
      matchId,
      sender: req.user._id,
      receiver,
      type,
      status: "sent",
      deliveredAt: new Date(),
    };

    if (type === "text") messageData.content = content;
    else if (type === "image") {
      messageData.imageUrl = imageUrl;
      messageData.content = "📷 Photo";
    } else if (type === "video") {
      messageData.videoUrl = videoUrl;
      messageData.content = "🎥 Video";
    } else if (type === "audio") {
      messageData.audioUrl = audioUrl;
      messageData.audioDuration = audioDuration || 0;
      messageData.content = "🎤 Voice message";
    } else if (type === "file") {
      messageData.fileUrl = fileUrl;
      messageData.fileName = fileName;
      messageData.fileSize = fileSize;
      messageData.fileType = fileType;
      messageData.content = `📎 ${fileName || "File"}`;
    }

    if (replyTo) {
      messageData.replyTo = {
        messageId: replyTo.messageId,
        content: replyTo.content,
        type: replyTo.type,
        senderName: replyTo.senderName,
      };
    }

    const message = await Message.create(messageData);
    await message.populate("sender", "name photos");

    // Enforce Voice Note Limits for free users
    if (type === "audio") {
      const freeLimit = 30;
      const isPremium = req.user.premium?.isActive;
      if (!isPremium && audioDuration > freeLimit) {
        return res
          .status(403)
          .json({
            success: false,
            message: "Voice notes longer than 30s require Premium",
          });
      }
    }

    const io = req.app.get("io");
    if (io) {
      const msgPayload = { message, matchId: matchId.toString() };
      io.to(matchId.toString()).emit("chat:new-message", msgPayload);
      io.to(receiver.toString()).emit("chat:new-message", msgPayload);
      // Tell the sender their message was delivered to receiver's device
      io.to(receiver.toString()).emit("chat:message-delivered", {
        messageId: message._id,
        chatId: matchId,
        matchId: matchId.toString(),
        status: "delivered",
      });
    }

    // Push notification for offline receiver
    const onlineUsers = req.app.get("onlineUsers");
    const isReceiverOnline =
      onlineUsers && onlineUsers.has(receiver.toString());
    if (!isReceiverOnline) {
      try {
        const {
          sendExpoPushNotification,
        } = require("../utils/pushNotifications");
        const rcvUser = await User.findById(receiver).select(
          "pushToken pushNotificationsEnabled",
        );
        if (rcvUser?.pushToken && rcvUser.pushNotificationsEnabled) {
          const senderName = req.user.name || "Someone";
          let notifBody = content || "";
          if (type === "image") notifBody = "📷 Sent a photo";
          else if (type === "audio") notifBody = "🎵 Sent a voice message";
          else if (type === "location") notifBody = "📍 Shared a location";
          else if (notifBody.length > 100)
            notifBody = notifBody.substring(0, 97) + "...";
          await sendExpoPushNotification(rcvUser.pushToken, {
            title: senderName,
            body: notifBody,
            data: {
              type: "message",
              matchId: matchId.toString(),
              senderId: req.user._id.toString(),
            },
            sound: "default",
            channelId: "messages",
          });
        }
      } catch (err) {
        console.error("Failed to send message push notification:", err);
      }
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   PUT /api/chat/:matchId/read
// @desc    Mark all messages in chat as read
// @access  Private
// FIX: Removed premium gate — read receipts now work for ALL users (free and premium)
router.put("/:matchId/read", protect, async (req, res) => {
  try {
    const { matchId } = req.params;

    const match = await Match.findById(matchId);
    if (!match || !match.users.includes(req.user._id)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const result = await Message.updateMany(
      { matchId, receiver: req.user._id, seen: false },
      { seen: true, seenAt: Date.now(), status: "seen" },
    );

    const io = req.app.get("io");
    // FIX: emit for ALL users regardless of premium status
    // Also emit even if modifiedCount is 0, in case client needs to sync
    if (io) {
      const otherUserId = match.users.find((id) => !id.equals(req.user._id));

      const payload = {
        chatId: matchId,
        matchId: matchId,
        userId: req.user._id.toString(),
        readAt: new Date().toISOString(),
      };

      // Emit to the chat room so sender's open ChatDetailScreen updates instantly
      io.to(matchId.toString()).emit("chat:message-read", payload);

      // Also emit directly to sender's personal socket room
      // so they get it even if they navigated away from the chat
      if (otherUserId) {
        io.to(otherUserId.toString()).emit("chat:message-read", payload);
      }
    }

    res.json({ success: true, readCount: result.modifiedCount });
  } catch (error) {
    console.error("Mark read error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   PUT /api/chat/message/:messageId/seen
// @desc    Mark a single message as seen
// @access  Private
router.put("/message/:messageId/seen", protect, async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message)
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    if (!message.receiver.equals(req.user._id))
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });

    message.seen = true;
    message.seenAt = Date.now();
    message.status = "seen";
    await message.save();

    const io = req.app.get("io");
    if (io) {
      const payload = {
        chatId: message.matchId,
        matchId: message.matchId,
        userId: req.user._id.toString(),
        readAt: new Date().toISOString(),
      };
      io.to(message.matchId.toString()).emit("chat:message-read", payload);
      // Also emit to sender's personal room
      io.to(message.sender.toString()).emit("chat:message-read", payload);
    }

    res.json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   DELETE /api/chat/message/:messageId
// @desc    Delete message for self or everyone
// @access  Private
router.delete("/message/:messageId", protect, async (req, res) => {
  try {
    const { deleteForEveryone } = req.query;
    const message = await Message.findById(req.params.messageId);
    if (!message)
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });

    // Delete for everyone (only sender can do this, within 15 minutes, premium only)
    if (deleteForEveryone === "true") {
      if (!message.sender.equals(req.user._id)) {
        return res
          .status(403)
          .json({
            success: false,
            message: "Only sender can delete for everyone",
          });
      }
      const sender = await User.findById(message.sender).select("premium");
      if (!sender?.premium?.isActive) {
        return res
          .status(403)
          .json({
            success: false,
            message: "Deleting for everyone is a Premium feature",
          });
      }
      const fifteenMinutes = 15 * 60 * 1000;
      if (Date.now() - message.createdAt > fifteenMinutes) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Can only delete for everyone within 15 minutes",
          });
      }
      message.content = "This message was deleted";
      message.type = "system";
      message.deletedForEveryone = true;
      await message.save();
      const io = req.app.get("io");
      if (io) {
        io.to(message.matchId.toString()).emit("chat:message-deleted", {
          messageId: message._id,
          matchId: message.matchId,
        });
      }
      return res.json({
        success: true,
        message: "Message deleted for everyone",
      });
    }

    // Delete for self only
    if (
      !message.sender.equals(req.user._id) &&
      !message.receiver.equals(req.user._id)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }
    if (!message.deletedFor.includes(req.user._id)) {
      message.deletedFor.push(req.user._id);
      await message.save();
    }
    res.json({ success: true, message: "Message deleted" });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   POST /api/chat/:matchId/message
// @desc    Send a message (text, image, audio, location) — used by ChatDetailScreen
// @access  Private
router.post("/:matchId/message", protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const {
      content,
      type = "text",
      imageUrl,
      videoUrl,
      audioUrl,
      audioDuration,
      latitude,
      longitude,
      address,
      replyTo,
    } = req.body;

    const match = await Match.findById(matchId);
    if (!match || !match.users.includes(req.user._id)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const receiver = match.users.find((id) => !id.equals(req.user._id));

    const messageData = {
      matchId,
      sender: req.user._id,
      receiver,
      type,
      content,
      status: "sent",
      deliveredAt: new Date(),
    };

    if (type === "image" && imageUrl) messageData.imageUrl = imageUrl;
    if (type === "video" && videoUrl) messageData.videoUrl = videoUrl;
    if (type === "audio" && audioUrl) {
      messageData.audioUrl = audioUrl;
      messageData.audioDuration = audioDuration || 0;
    }
    if (type === "location") {
      messageData.latitude = latitude;
      messageData.longitude = longitude;
      messageData.address = address;
    }

    if (replyTo) {
      messageData.replyTo = {
        messageId: replyTo.messageId,
        content: replyTo.content,
        type: replyTo.type,
        senderName: replyTo.senderName,
      };
    }

    const message = await Message.create(messageData);
    await message.populate("sender", "name photos");

    const io = req.app.get("io");
    if (io) {
      const msgPayload = { message, matchId: matchId.toString() };
      io.to(matchId.toString()).emit("chat:new-message", msgPayload);
      io.to(receiver.toString()).emit("chat:new-message", msgPayload);
      // Tell sender their message reached receiver's device
      io.to(receiver.toString()).emit("chat:message-delivered", {
        messageId: message._id,
        chatId: matchId,
        matchId: matchId.toString(),
        status: "delivered",
      });
    }

    // Push notification for offline receiver
    const onlineUsers = req.app.get("onlineUsers");
    const isReceiverOnline =
      onlineUsers && onlineUsers.has(receiver.toString());
    if (!isReceiverOnline) {
      try {
        const {
          sendExpoPushNotification,
        } = require("../utils/pushNotifications");
        const rcvUser = await User.findById(receiver).select(
          "pushToken pushNotificationsEnabled",
        );
        if (rcvUser?.pushToken && rcvUser.pushNotificationsEnabled) {
          const senderName = req.user.name || "Someone";
          let notifBody = content || "";
          if (type === "image") notifBody = "📷 Sent a photo";
          else if (type === "audio") notifBody = "🎵 Sent a voice message";
          else if (type === "location") notifBody = "📍 Shared a location";
          else if (notifBody.length > 100)
            notifBody = notifBody.substring(0, 97) + "...";
          await sendExpoPushNotification(rcvUser.pushToken, {
            title: senderName,
            body: notifBody,
            data: {
              type: "message",
              matchId: matchId.toString(),
              senderId: req.user._id.toString(),
            },
            sound: "default",
            channelId: "messages",
          });
        }
      } catch (err) {
        console.error("Failed to send push notification:", err);
      }
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   POST /api/chat/:matchId/location
// @desc    Send location message
// @access  Private
router.post("/:matchId/location", protect, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { latitude, longitude, address } = req.body;

    if (!latitude || !longitude) {
      return res
        .status(400)
        .json({ success: false, message: "Location coordinates required" });
    }

    const match = await Match.findById(matchId);
    if (!match || !match.users.includes(req.user._id)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const receiver = match.users.find((id) => !id.equals(req.user._id));

    const message = await Message.create({
      matchId,
      sender: req.user._id,
      receiver,
      type: "text",
      content: `📍 Location: ${address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}`,
      status: "sent",
      deliveredAt: new Date(),
    });

    await message.populate("sender", "name photos");

    const io = req.app.get("io");
    if (io) {
      const msgPayload = { message, matchId: matchId.toString() };
      io.to(matchId.toString()).emit("chat:new-message", msgPayload);
      io.to(receiver.toString()).emit("chat:new-message", msgPayload);
    }

    res.status(201).json({ success: true, message });
  } catch (error) {
    console.error("Send location error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// @route   DELETE /api/chat/:matchId
// @desc    Delete a specific chat (soft delete for user)
// @access  Private
router.delete("/:matchId", protect, async (req, res) => {
  try {
    const { matchId } = req.params;

    const match = await Match.findById(matchId);
    if (!match)
      return res
        .status(404)
        .json({ success: false, message: "Chat not found" });

    const isUserInMatch = match.users.some((userId) =>
      userId.equals(req.user._id),
    );
    if (!isUserInMatch)
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });

    await Message.updateMany(
      { matchId },
      { $addToSet: { deletedFor: req.user._id } },
    );

    res.json({ success: true, message: "Chat deleted" });
  } catch (error) {
    console.error("Delete chat error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;

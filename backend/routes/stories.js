const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Story = require('../models/Story');
const Match = require('../models/Match');
const User = require('../models/User');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const validate = require('../middleware/validate');
const { uploadLimiter } = require('../middleware/rateLimiter');
const schemas = require('../validators/schemas');
const redis = require('../utils/redis');
const { sendSmartNotification } = require('../utils/pushNotifications');

const STORY_ACTIVE_TTL = 30;   // seconds — active feed refreshes quickly
const STORY_USER_TTL   = 60;   // seconds — single-user story list

router.post('/', protect, uploadLimiter, validate(schemas.stories.createStory), async (req, res) => {
  try {
    const { type, content, textContent, backgroundColor, mediaUrl, thumbnail, durationHours } = req.body;

    let hours = 24;
    
    if (durationHours) {
      const requestedHours = parseInt(durationHours);
      if (!isNaN(requestedHours) && requestedHours > 0 && requestedHours <= 720) {
        hours = requestedHours;
      }
    }

    const story = await Story.create({
      user: req.user._id,
      type,
      content: content || (type === 'text' ? textContent : (type === 'image' ? 'Photo story' : 'Video story')),
      textContent,
      backgroundColor: backgroundColor,
      mediaUrl,
      imageUrl: mediaUrl,
      thumbnail,
      durationHours: hours,
      expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000)
    });

    await story.populate('user', 'name photos');

    await Promise.all([
      redis.del(`stories:active:${req.user._id}`),
      redis.del(`stories:mine:${req.user._id}`),
    ]);

    res.status(201).json({ success: true, story });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/active', protect, async (req, res) => {
  try {
    const cacheKey = `stories:active:${req.user._id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ success: true, stories: cached, fromCache: true });

    const currentUser = await User.findById(req.user._id).select('blockedUsers');
    const blockedUserIds = (currentUser?.blockedUsers || []).map(id => id.toString());
    
    const usersWhoBlockedMe = await User.find({
      blockedUsers: req.user._id
    }).select('_id');
    const allBlockedIds = [...blockedUserIds, ...usersWhoBlockedMe.map(u => u._id.toString())];

    const matches = await Match.find({
      users: req.user._id,
      status: 'active'
    }).lean();

    // Show stories from ALL active matches (not just matches you've chatted
    // with). A new match should be able to see your story right away — having
    // to send a message first felt like a chicken-and-egg restriction.
    const matchedUserIds = matches.map(m =>
      m.users.find(id => id.toString() !== req.user._id.toString())
    ).filter(Boolean);

    const allowedUserIds = [req.user._id, ...matchedUserIds];

    const stories = await Story.find({
      user: { $in: allowedUserIds, $nin: allBlockedIds },
      expiresAt: { $gt: Date.now() }
    })
    .populate('user', 'name photos')
    .sort({ createdAt: -1 });

    const userStoryMap = new Map();
    
    stories.forEach(story => {
      const userId = story.user._id.toString();
      const hasViewed = story.views.some(v => v.user.equals(req.user._id));
      
      if (!userStoryMap.has(userId)) {
        userStoryMap.set(userId, {
          id: userId,
          name: story.user.name,
          photo: story.user.photos?.[0]?.url || story.user.photos?.[0],
          hasStory: true,
          hasNewStory: userId === req.user._id.toString() ? false : !hasViewed,
          storyCount: 1,
          latestStoryAt: story.createdAt,
          isSelf: userId === req.user._id.toString()
        });
      } else {
        const existing = userStoryMap.get(userId);
        existing.storyCount += 1;
        if (userId !== req.user._id.toString() && !hasViewed) existing.hasNewStory = true;
      }
    });

    const result = Array.from(userStoryMap.values()).sort((a, b) => {
      if (a.isSelf) return -1;
      if (b.isSelf) return 1;
      if (a.hasNewStory && !b.hasNewStory) return -1;
      if (!a.hasNewStory && b.hasNewStory) return 1;
      return new Date(b.latestStoryAt).getTime() - new Date(a.latestStoryAt).getTime();
    });

    await redis.set(cacheKey, result, STORY_ACTIVE_TTL);

    res.json({ success: true, stories: result });
  } catch (error) {
    console.error('Get active stories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/friends', protect, async (req, res) => {
  try {
    const matches = await Match.find({
      users: req.user._id,
      status: 'active'
    });

    const friendIds = matches.map(match => 
      match.users.find(id => !id.equals(req.user._id))
    );

    const stories = await Story.find({
      user: { $in: friendIds },
      expiresAt: { $gt: Date.now() }
    })
    .populate('user', 'name photos')
    .sort({ createdAt: -1 });

    const storiesByUser = stories.reduce((acc, story) => {
      const userId = story.user._id.toString();
      if (!acc[userId]) {
        acc[userId] = {
          user: story.user,
          stories: []
        };
      }
      acc[userId].stories.push(story);
      return acc;
    }, {});

    res.json({ 
      success: true, 
      stories: Object.values(storiesByUser)
    });
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my-stories', protect, async (req, res) => {
  try {
    const cacheKey = `stories:mine:${req.user._id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ success: true, stories: cached, fromCache: true });

    const stories = await Story.find({
      user: req.user._id,
      expiresAt: { $gt: Date.now() }
    })
    .populate('views.user', 'name photos')
    .sort({ createdAt: -1 });

    const isPremium = req.user.premium?.isActive;

    const result = stories.map(s => {
      const storyObj = s.toObject();
      const viewCount = s.views ? s.views.length : 0;
      return {
        ...storyObj,
        imageUrl: s.imageUrl || s.mediaUrl,
        mediaUrl: s.mediaUrl || s.imageUrl,
        viewCount,
        viewedBy: s.views.map(v => v.user?._id?.toString()),
        viewers: isPremium ? s.views.map(v => ({
          id: v.user?._id,
          name: v.user?.name,
          photo: v.user?.photos?.[0]?.url || v.user?.photos?.[0],
          viewedAt: v.viewedAt
        })) : []
      };
    });

    await redis.set(cacheKey, result, STORY_ACTIVE_TTL);

    res.json({ success: true, stories: result });
  } catch (error) {
    console.error('Get my stories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const cacheKey = `stories:user:${userId}:viewer:${req.user._id}`;
    const cached = await redis.get(cacheKey);
    if (cached) return res.json({ success: true, stories: cached, fromCache: true });

    const currentUser = await User.findById(req.user._id).select('blockedUsers');
    const targetUserCheck = await User.findById(userId).select('blockedUsers');
    
    if (currentUser?.blockedUsers?.includes(userId) || targetUserCheck?.blockedUsers?.includes(req.user._id.toString())) {
      return res.json({ success: true, stories: [] });
    }
    
    if (userId === req.user._id.toString()) {
      const stories = await Story.find({
        user: req.user._id,
        expiresAt: { $gt: Date.now() }
      })
      .populate('views.user', 'name photos')
      .sort({ createdAt: -1 });

      const result = stories.map(s => ({
        _id: s._id,
        type: s.type,
        imageUrl: s.imageUrl || s.mediaUrl,
        mediaUrl: s.mediaUrl || s.imageUrl,
        textContent: s.textContent,
        backgroundColor: s.backgroundColor ? [s.backgroundColor, s.backgroundColor] : undefined,
        createdAt: s.createdAt,
        viewedBy: s.views.map(v => v.user?._id?.toString())
      }));

      await redis.set(cacheKey, result, STORY_USER_TTL);
      return res.json({ success: true, stories: result });
    }
    
    const stories = await Story.find({
      user: userId,
      expiresAt: { $gt: Date.now() }
    })
    .sort({ createdAt: -1 });

    const result = stories.map(s => ({
      _id: s._id,
      type: s.type,
      imageUrl: s.imageUrl || s.mediaUrl,
      mediaUrl: s.mediaUrl || s.imageUrl,
      textContent: s.textContent,
      backgroundColor: s.backgroundColor ? [s.backgroundColor, s.backgroundColor] : undefined,
      createdAt: s.createdAt,
      viewedBy: s.views.map(v => v.user?.toString())
    }));

    await redis.set(cacheKey, result, STORY_USER_TTL);

    res.json({ success: true, stories: result });
  } catch (error) {
    console.error('Get user stories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/:storyId/view', protect, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    const alreadyViewed = story.views.some(v => v.user.equals(req.user._id));

    if (!alreadyViewed) {
      story.views.push({ user: req.user._id });
      await story.save();

      if (story.user.toString() !== req.user._id.toString()) {
        try {
          const viewer = await User.findById(req.user._id).select('name photos profilePicture');
          const owner = await User.findById(story.user).select('pushToken pushNotificationsEnabled muteSettings notificationPreferences');
          const viewerName = viewer?.name || 'Someone';

          await Notification.create({
            recipient: story.user,
            sender: req.user._id,
            type: 'story',
            title: `${viewerName} viewed your story`,
            body: '',
            data: { type: 'story', screen: 'Stories' },
          });

          if (owner) {
            await sendSmartNotification(
              owner,
              {
                title: `${viewerName} viewed your story`,
                body: '',
                data: { type: 'story', screen: 'Stories' },
              },
              'story',
              req.user._id.toString(),
            );
          }
        } catch (notifErr) {
          console.error('Story view notification error:', notifErr);
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('View story error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/:storyId/react', protect, validate(schemas.stories.storyReact), async (req, res) => {
  try {
    const { emoji } = req.body;
    
    if (!emoji) {
      return res.status(400).json({ success: false, message: 'Emoji is required' });
    }
    
    const story = await Story.findById(req.params.storyId).populate('user', 'name photos');
    
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }
    
    const storyOwnerId = story.user._id.toString();
    const reactorId = req.user._id.toString();
    
    if (storyOwnerId === reactorId) {
      return res.status(400).json({ success: false, message: 'Cannot react to your own story' });
    }
    
    const existingReaction = story.reactions.find(r => r.user.equals(req.user._id));
    const isNewReaction = !existingReaction;
    
    story.reactions = story.reactions.filter(r => !r.user.equals(req.user._id));
    
    story.reactions.push({ user: req.user._id, emoji });
    await story.save();
    
    try {
      const Message = require('../models/Message');
      const reactor = await User.findById(req.user._id).select('name photos');
      
      const match = await Match.findOne({
        users: { $all: [req.user._id, story.user._id] },
        status: 'active'
      });
      
      if (match) {
        const storyPreview = story.type === 'text' ? story.textContent?.substring(0, 50) : 'your story';
        const messageContent = `Reacted ${emoji} to ${storyPreview}`;
        
        await Message.create({
          matchId: match._id,
          sender: req.user._id,
          receiver: story.user._id,
          content: messageContent,
          type: 'story_reaction',
          storyReaction: {
            storyId: story._id,
            emoji: emoji,
            storyType: story.type,
            storyPreview: story.mediaUrl || story.textContent?.substring(0, 100)
          }
        });

        const io = req.app.get('io');
        if (io) {
          io.to(storyOwnerId).emit('chat:new-message', {
            matchId: match._id,
            sender: req.user._id,
            senderName: reactor?.name,
            senderPhoto: reactor?.photos?.[0]?.url || reactor?.photos?.[0],
            content: messageContent,
            type: 'story_reaction',
            storyReaction: { emoji, storyId: story._id },
            createdAt: new Date().toISOString()
          });
        }

        try {
          const reactorName = reactor?.name || 'Someone';
          const notifBody = `Reacted ${emoji} to your story`;
          await Notification.create({
            recipient: story.user._id,
            sender: req.user._id,
            type: 'story',
            title: reactorName,
            body: notifBody,
            data: { type: 'story', screen: 'Stories', matchId: match._id.toString() },
          });
          const ownerForPush = await User.findById(story.user._id).select('pushToken pushNotificationsEnabled muteSettings notificationPreferences');
          if (ownerForPush) {
            await sendSmartNotification(
              ownerForPush,
              { title: reactorName, body: notifBody, data: { type: 'story', screen: 'Stories' } },
              'story',
              req.user._id.toString(),
            );
          }
        } catch (notifErr) {
          console.error('Story reaction notification error:', notifErr);
        }
      }
    } catch (msgError) {
      console.error('Failed to send reaction message:', msgError);
    }
    
    res.json({ success: true, message: 'Reaction added' });
  } catch (error) {
    console.error('React to story error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/:storyId/reply', protect, validate(schemas.stories.storyReply), async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const story = await Story.findById(req.params.storyId).populate('user', 'name photos');

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    const storyOwnerId = story.user._id.toString();
    const replierId = req.user._id.toString();

    if (storyOwnerId === replierId) {
      return res.status(400).json({ success: false, message: 'Cannot reply to your own story' });
    }

    const replier = await User.findById(req.user._id).select('name photos');
    const match = await Match.findOne({
      users: { $all: [req.user._id, story.user._id] },
      status: 'active'
    });

    const io = req.app.get('io');

    if (match) {
      const Message = require('../models/Message');
      const storyPreview = story.type === 'text' ? story.textContent?.substring(0, 50) : 'a story';
      const replyContent = message.trim();

      await Message.create({
        matchId: match._id,
        sender: req.user._id,
        receiver: story.user._id,
        content: replyContent,
        type: 'story_reply',
        storyReaction: {
          storyId: story._id,
          storyType: story.type,
          storyPreview: story.mediaUrl || story.textContent?.substring(0, 100)
        }
      });

      if (io) {
        io.to(storyOwnerId).emit('chat:new-message', {
          matchId: match._id,
          sender: req.user._id,
          senderName: replier?.name,
          senderPhoto: replier?.photos?.[0]?.url || replier?.photos?.[0],
          content: replyContent,
          type: 'story_reply',
          storyReaction: { storyId: story._id },
          createdAt: new Date().toISOString()
        });
      }
    } else {
      if (io) {
        io.to(storyOwnerId).emit('story:reply', {
          senderId: replierId,
          senderName: replier?.name,
          senderPhoto: replier?.photos?.[0]?.url || replier?.photos?.[0],
          storyId: story._id,
          message: message.trim(),
          createdAt: new Date().toISOString()
        });
      }
    }

    try {
      const replierName = replier?.name || 'Someone';
      const notifBody = message.trim().length > 80 ? message.trim().substring(0, 77) + '...' : message.trim();
      await Notification.create({
        recipient: story.user._id,
        sender: req.user._id,
        type: 'story',
        title: replierName,
        body: notifBody,
        data: { type: 'story', screen: 'Stories', matchId: match?._id?.toString() },
      });
      const ownerForPush = await User.findById(story.user._id).select('pushToken pushNotificationsEnabled muteSettings notificationPreferences');
      if (ownerForPush) {
        await sendSmartNotification(
          ownerForPush,
          { title: replierName, body: notifBody, data: { type: 'story', screen: 'Stories' } },
          'story',
          req.user._id.toString(),
        );
      }
    } catch (notifErr) {
      console.error('Story reply notification error:', notifErr);
    }

    res.json({ success: true, message: 'Reply sent', hasMatch: !!match });
  } catch (error) {
    console.error('Reply to story error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:storyId/react', protect, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);
    
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }
    
    story.reactions = story.reactions.filter(r => !r.user.equals(req.user._id));
    await story.save();
    
    res.json({ success: true, message: 'Reaction removed' });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:storyId/reactions', protect, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId)
      .populate('reactions.user', 'name photos');
    
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }
    
    const storyUserId = story.user.toString();
    const currentUserId = req.user._id.toString();
    
    if (storyUserId !== currentUserId) {
      const currentUser = await User.findById(req.user._id).select('blockedUsers');
      const storyOwner = await User.findById(storyUserId).select('blockedUsers privacySettings');
      
      if (currentUser?.blockedUsers?.includes(storyUserId) || storyOwner?.blockedUsers?.includes(currentUserId)) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
      
      const privacySetting = storyOwner?.privacySettings?.whoCanViewStories || 'everyone';
      
      if (privacySetting === 'friends') {
        const FriendRequest = require('../models/FriendRequest');
        const friendship = await FriendRequest.findOne({
          $or: [
            { from: req.user._id, to: storyUserId, status: 'accepted' },
            { from: storyUserId, to: req.user._id, status: 'accepted' }
          ]
        });
        if (!friendship) {
          return res.status(403).json({ success: false, message: 'Not authorized' });
        }
      } else if (privacySetting === 'matches') {
        const match = await Match.findOne({
          users: { $all: [req.user._id, storyUserId] },
          status: 'active'
        });
        if (!match) {
          return res.status(403).json({ success: false, message: 'Not authorized' });
        }
      }
    }
    
    const userReaction = story.reactions.find(r => r.user._id.toString() === currentUserId);
    
    res.json({ 
      success: true, 
      userReaction: userReaction?.emoji || null,
      reactions: story.reactions.map(r => ({
        userId: r.user._id,
        userName: r.user.name,
        userPhoto: r.user.photos?.[0]?.url || r.user.photos?.[0],
        emoji: r.emoji,
        createdAt: r.createdAt
      }))
    });
  } catch (error) {
    console.error('Get reactions error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/:storyId', protect, async (req, res) => {
  try {
    const { textContent, backgroundColor } = req.body;
    const story = await Story.findById(req.params.storyId);

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    if (!story.user.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (story.type !== 'text') {
      return res.status(400).json({ success: false, message: 'Only text stories can be edited' });
    }

    story.textContent = textContent || story.textContent;
    if (backgroundColor) {
      story.backgroundColor = Array.isArray(backgroundColor) ? backgroundColor[0] : backgroundColor;
    }

    await story.save();

    res.json({ success: true, message: 'Story updated', story });
  } catch (error) {
    console.error('Update story error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.delete('/:storyId', protect, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    if (!story.user.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await story.deleteOne();

    await Promise.all([
      redis.del(`stories:active:${req.user._id}`),
      redis.del(`stories:mine:${req.user._id}`),
      redis.del(`stories:user:${req.user._id}:viewer:${req.user._id}`),
    ]);

    res.json({ success: true, message: 'Story deleted' });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/block/:userId', protect, async (req, res) => {
  try {
    const isPremium = req.user.premium?.isActive;
    if (!isPremium) {
      return res.status(403).json({ success: false, message: 'Status blocking is a Premium feature' });
    }

    const user = await User.findById(req.user._id);
    if (!user.storyPrivacy) {
      user.storyPrivacy = { blockedUsers: [], whoCanSee: 'matches' };
    }

    if (!user.storyPrivacy.blockedUsers.includes(req.params.userId)) {
      user.storyPrivacy.blockedUsers.push(req.params.userId);
      await user.save();
    }

    res.json({ success: true, message: 'User blocked from stories' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.put('/unblock/:userId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.storyPrivacy?.blockedUsers) {
      user.storyPrivacy.blockedUsers = user.storyPrivacy.blockedUsers.filter(
        id => id.toString() !== req.params.userId
      );
      await user.save();
    }
    res.json({ success: true, message: 'User unblocked from stories' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

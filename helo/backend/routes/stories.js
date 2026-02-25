const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Story = require('../models/Story');
const Match = require('../models/Match');
const User = require('../models/User');
const Message = require('../models/Message');

// @route   POST /api/stories
// @desc    Create a new story
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { type, content, textContent, backgroundColor, mediaUrl, thumbnail, durationHours } = req.body;

    // Default 24 hours
    let hours = 24;
    
    // Custom duration (up to 30 days)
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

    res.status(201).json({ success: true, story });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/stories/active
// @desc    Get stories from matched users who have chatted + self
// @access  Private
router.get('/active', protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id).select('blockedUsers');
    const blockedUserIds = (currentUser?.blockedUsers || []).map(id => id.toString());
    
    const usersWhoBlockedMe = await User.find({
      blockedUsers: req.user._id
    }).select('_id');
    const allBlockedIds = [...blockedUserIds, ...usersWhoBlockedMe.map(u => u._id.toString())];

    // Get active matches for this user
    const matches = await Match.find({
      users: req.user._id,
      status: 'active'
    }).lean();

    const matchedUserIds = matches.map(m =>
      m.users.find(id => id.toString() !== req.user._id.toString())
    ).filter(Boolean);

    // Check which matches have at least one message exchanged
    const matchIds = matches.map(m => m._id);
    const matchesWithMessages = await Message.aggregate([
      { $match: { matchId: { $in: matchIds } } },
      { $group: { _id: '$matchId' } }
    ]);
    const matchIdsWithChat = new Set(matchesWithMessages.map(m => m._id.toString()));

    // Filter to only matched users who have chatted
    const chattedUserIds = [];
    for (const match of matches) {
      if (matchIdsWithChat.has(match._id.toString())) {
        const otherUserId = match.users.find(id => id.toString() !== req.user._id.toString());
        if (otherUserId) chattedUserIds.push(otherUserId);
      }
    }

    // Include self + chatted matched users, exclude blocked
    const allowedUserIds = [req.user._id, ...chattedUserIds];

    const stories = await Story.find({
      user: { $in: allowedUserIds, $nin: allBlockedIds },
      expiresAt: { $gt: Date.now() }
    })
    .populate('user', 'name photos')
    .sort({ createdAt: -1 });

    // Group by user and check if current user viewed them
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
          isSelf: userId === req.user._id.toString()
        });
      } else {
        const existing = userStoryMap.get(userId);
        existing.storyCount += 1;
        if (userId !== req.user._id.toString() && !hasViewed) existing.hasNewStory = true;
      }
    });

    res.json({ 
      success: true, 
      stories: Array.from(userStoryMap.values()).sort((a, b) => {
        if (a.isSelf) return -1;
        if (b.isSelf) return 1;
        return 0;
      })
    });
  } catch (error) {
    console.error('Get active stories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/stories/friends
// @desc    Get stories from friends (matched users)
// @access  Private
router.get('/friends', protect, async (req, res) => {
  try {
    // Get user's matches to find friends
    const matches = await Match.find({
      users: req.user._id,
      status: 'active'
    });

    const friendIds = matches.map(match => 
      match.users.find(id => !id.equals(req.user._id))
    );

    // Get active stories from friends
    const stories = await Story.find({
      user: { $in: friendIds },
      expiresAt: { $gt: Date.now() }
    })
    .populate('user', 'name photos')
    .sort({ createdAt: -1 });

    // Group stories by user
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

// @route   GET /api/stories/my-stories
// @desc    Get current user's active stories with full viewer details
// @access  Private
router.get('/my-stories', protect, async (req, res) => {
  try {
    const stories = await Story.find({
      user: req.user._id,
      expiresAt: { $gt: Date.now() }
    })
    .populate('views.user', 'name photos')
    .sort({ createdAt: -1 });

    // Premium feature: see who viewed story
    const isPremium = req.user.premium?.isActive;

    res.json({ 
      success: true, 
      stories: stories.map(s => {
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
      })
    });
  } catch (error) {
    console.error('Get my stories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/stories/user/:userId
// @desc    Get a specific user's active stories
// @access  Private
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user is blocked
    const currentUser = await User.findById(req.user._id).select('blockedUsers');
    const targetUserCheck = await User.findById(userId).select('blockedUsers');
    
    if (currentUser?.blockedUsers?.includes(userId) || targetUserCheck?.blockedUsers?.includes(req.user._id.toString())) {
      return res.json({ success: true, stories: [] });
    }
    
    // If viewing own stories
    if (userId === req.user._id.toString()) {
      const stories = await Story.find({
        user: req.user._id,
        expiresAt: { $gt: Date.now() }
      })
      .populate('views.user', 'name photos')
      .sort({ createdAt: -1 });

      return res.json({ 
        success: true, 
        stories: stories.map(s => ({
          _id: s._id,
          type: s.type,
          imageUrl: s.imageUrl || s.mediaUrl,
          mediaUrl: s.mediaUrl || s.imageUrl,
          textContent: s.textContent,
          backgroundColor: s.backgroundColor ? [s.backgroundColor, s.backgroundColor] : undefined,
          createdAt: s.createdAt,
          viewedBy: s.views.map(v => v.user?._id?.toString())
        }))
      });
    }
    
    const stories = await Story.find({
      user: userId,
      expiresAt: { $gt: Date.now() }
    })
    .sort({ createdAt: -1 });

    res.json({ 
      success: true, 
      stories: stories.map(s => ({
        _id: s._id,
        type: s.type,
        imageUrl: s.imageUrl || s.mediaUrl,
        mediaUrl: s.mediaUrl || s.imageUrl,
        textContent: s.textContent,
        backgroundColor: s.backgroundColor ? [s.backgroundColor, s.backgroundColor] : undefined,
        createdAt: s.createdAt,
        viewedBy: s.views.map(v => v.user?.toString())
      }))
    });
  } catch (error) {
    console.error('Get user stories error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/stories/:storyId/view
// @desc    Mark story as viewed
// @access  Private
router.post('/:storyId/view', protect, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId);

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }

    // Check if already viewed
    const alreadyViewed = story.views.some(v => v.user.equals(req.user._id));

    if (!alreadyViewed) {
      story.views.push({ user: req.user._id });
      await story.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error('View story error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/stories/:storyId/react
// @desc    Add reaction to a story
// @access  Private
router.post('/:storyId/react', protect, async (req, res) => {
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
    
    // Don't allow reacting to own story
    if (storyOwnerId === reactorId) {
      return res.status(400).json({ success: false, message: 'Cannot react to your own story' });
    }
    
    // Check if this is a new reaction (not just changing emoji)
    const existingReaction = story.reactions.find(r => r.user.equals(req.user._id));
    const isNewReaction = !existingReaction;
    
    // Remove existing reaction from this user if any
    story.reactions = story.reactions.filter(r => !r.user.equals(req.user._id));
    
    // Add new reaction
    story.reactions.push({ user: req.user._id, emoji });
    await story.save();
    
    // Send a chat message to the story owner about the reaction
    try {
      const Message = require('../models/Message');
      const reactor = await User.findById(req.user._id).select('name photos');
      
      // Find the match between reactor and story owner
      const match = await Match.findOne({
        users: { $all: [req.user._id, story.user._id] },
        status: 'active'
      });
      
      if (match) {
        // Create a story reaction message
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

        // Emit socket event for real-time notification
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
      }
    } catch (msgError) {
      console.error('Failed to send reaction message:', msgError);
      // Don't fail the reaction if message fails
    }
    
    res.json({ success: true, message: 'Reaction added' });
  } catch (error) {
    console.error('React to story error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/stories/:storyId/reply
// @desc    Reply to a story
// @access  Private
router.post('/:storyId/reply', protect, async (req, res) => {
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

    res.json({ success: true, message: 'Reply sent', hasMatch: !!match });
  } catch (error) {
    console.error('Reply to story error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/stories/:storyId/react
// @desc    Remove reaction from a story
// @access  Private
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

// @route   GET /api/stories/:storyId/reactions
// @desc    Get reactions for a story
// @access  Private
router.get('/:storyId/reactions', protect, async (req, res) => {
  try {
    const story = await Story.findById(req.params.storyId)
      .populate('reactions.user', 'name photos');
    
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found' });
    }
    
    // Check if user has permission to view this story
    const storyUserId = story.user.toString();
    const currentUserId = req.user._id.toString();
    
    // Allow story owner to see reactions
    if (storyUserId !== currentUserId) {
      // Check if viewer is blocked
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
    
    // Find current user's reaction
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

// @route   PUT /api/stories/:storyId
// @desc    Update own story
// @access  Private
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

// @route   DELETE /api/stories/:storyId
// @desc    Delete own story
// @access  Private
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

    res.json({ success: true, message: 'Story deleted' });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/stories/block/:userId
// @desc    Block a user from viewing stories
// @access  Private
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

// @route   PUT /api/stories/unblock/:userId
// @desc    Unblock a user from viewing stories
// @access  Private
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

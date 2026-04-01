const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Match = require('../models/Match');
const Boost = require('../models/Boost');
const auth = protect;

// @route   GET /api/match/who-likes-me
// @desc    Get list of users who liked current user (pending friend requests)
// @access  Private
router.get('/who-likes-me', protect, async (req, res) => {
  try {
    const FriendRequest = require('../models/FriendRequest');
    const isPremium = req.user.premium?.isActive;
    
    // Find pending friend requests where this user is the receiver
    const pendingRequests = await FriendRequest.find({
      receiver: req.user._id,
      status: 'pending'
    }).populate('sender', 'name age bio photos location onlineStatus lastActive interests verified lifestyle gender');
    
    // Extract the users who sent requests (already plain objects from populate)
    const usersWhoLikedMe = pendingRequests
      .filter(req => req.sender)
      .map(req => req.sender.toObject ? req.sender.toObject() : req.sender);

    let processedUsers = usersWhoLikedMe.map(u => {
      const userObj = typeof u.toObject === 'function' ? u.toObject() : u;
      let score = 0;
      
      // Compatibility scoring (Worldwide Focus)
      if (req.user.lifestyle?.personalityType && userObj.lifestyle?.personalityType === req.user.lifestyle?.personalityType) {
        score += 100;
      }
      
      const sharedInterests = (userObj.interests || []).filter(i => (req.user.interests || []).includes(i));
      score += sharedInterests.length * 20;
      
      return { ...userObj, compatibilityScore: score };
    });

    // Sort by compatibility (Worldwide Priority)
    processedUsers.sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    if (!isPremium) {
      processedUsers = processedUsers.map(u => {
        const userObj = typeof u.toObject === 'function' ? u.toObject() : u;
        let distance = null;
        if (req.user.location?.coordinates && userObj.location?.coordinates) {
          distance = calculateDistance(
            req.user.location.coordinates,
            userObj.location.coordinates
          );
        }

        return {
          _id: userObj._id,
          name: userObj.name,
          age: userObj.age,
          photos: userObj.photos ? [userObj.photos[0]] : [],
          isBlurred: true,
          bio: undefined,
          interests: [],
          location: undefined,
          distance: distance,
          verified: userObj.verified,
          gender: userObj.gender,
          personalityType: userObj.personalityType
        };
      });
    }

    res.json({ success: true, users: processedUsers });
  } catch (error) {
    console.error('Who likes me error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/match/swipe
// @desc    Swipe right/left/super on a user
// @access  Private
router.post('/swipe', protect, async (req, res) => {
  try {
    const { targetUserId, action } = req.body;

    if (!req.user.premium?.isActive) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastReset = new Date(req.user.dailySwipes.lastReset);
      lastReset.setHours(0, 0, 0, 0);

      if (lastReset < today) {
        req.user.dailySwipes.count = 0;
        req.user.dailySwipes.lastReset = new Date();
      }

      if (req.user.dailySwipes.count >= 10) {
        return res.status(403).json({ success: false, message: 'Daily swipe limit reached (10/day). Upgrade to Premium!' });
      }
      req.user.dailySwipes.count += 1;
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' });

    const currentUser = await User.findById(req.user._id);

    if (action === 'like' || action === 'superlike') {
      if (action === 'superlike' && !req.user.premium?.isActive) {
        return res.status(403).json({ success: false, message: 'Super Like is a Premium feature!' });
      }

      if (!currentUser.swipedRight.includes(targetUserId)) {
        currentUser.swipedRight.push(targetUserId);
      }

      if (action === 'superlike') {
        if (!currentUser.superLiked.includes(targetUserId)) {
          currentUser.superLiked.push(targetUserId);
        }
      }

      if (targetUser.swipedRight.includes(currentUser._id)) {
        const existingMatch = await Match.findOne({
          users: { $all: [currentUser._id, targetUser._id] },
          status: 'active'
        });
        
        if (existingMatch) {
          await currentUser.save();
          return res.json({ success: true, isMatch: true, match: existingMatch });
        }
        
        const match = await Match.create({
          users: [currentUser._id, targetUser._id],
          isSuperLike: action === 'superlike'
        });

        await currentUser.save();

        // Send match notification emails to both users (non-blocking)
        try {
          const { sendNewMatchEmail } = require('../utils/emailService');
          const currentUserPhoto = currentUser.photos?.[0] || null;
          const targetUserPhoto  = targetUser.photos?.[0] || null;
          await Promise.all([
            sendNewMatchEmail(currentUser.email, currentUser.name, targetUser.name, targetUserPhoto),
            sendNewMatchEmail(targetUser.email,  targetUser.name,  currentUser.name, currentUserPhoto),
          ]);
        } catch (emailErr) {
          console.error('Match email error (non-critical):', emailErr.message);
        }

        return res.json({ success: true, isMatch: true, match });
      }
    } else if (action === 'pass') {
      if (!currentUser.swipedLeft.includes(targetUserId)) {
        currentUser.swipedLeft.push(targetUserId);
      }
      const FriendRequest = require('../models/FriendRequest');
      await FriendRequest.updateMany(
        { sender: targetUserId, receiver: currentUser._id, status: 'pending' },
        { status: 'rejected' }
      );
    }

    await currentUser.save();
    res.json({ success: true, isMatch: false, message: 'Swipe recorded' });
  } catch (error) {
    console.error('Swipe error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my-matches', protect, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    const matches = await Match.find({ users: req.user._id, status: 'active' })
      .populate('users', 'name age bio photos location onlineStatus lastActive interests lookingFor gender lifestyle verified')
      .sort({ matchedAt: -1 });

    const seenUserIds = new Set();
    const uniqueMatches = matches.filter(match => {
      const otherUser = match.users.find(u => u._id.toString() !== req.user._id.toString());
      if (!otherUser || seenUserIds.has(otherUser._id.toString())) return false;
      seenUserIds.add(otherUser._id.toString());
      return true;
    });

    res.json({ success: true, matches: uniqueMatches });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/boost', protect, async (req, res) => {
  try {
    if (!req.user.premium?.isActive) {
      return res.status(403).json({ success: false, message: 'Boost is a Premium feature!' });
    }
    const boost = await Boost.create({ user: req.user._id, expiresAt: Date.now() + 30 * 60 * 1000 });
    res.json({ success: true, message: 'Profile boosted!', expiresAt: boost.expiresAt });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/rewind', protect, async (req, res) => {
  try {
    if (!req.user.premium?.isActive) {
      return res.status(403).json({ success: false, message: 'Rewind is a Premium feature!' });
    }
    const user = await User.findById(req.user._id);
    const lastSwipedId = user.swipedRight.pop() || user.swipedLeft.pop();
    if (!lastSwipedId) return res.status(400).json({ success: false, message: 'No swipes to rewind' });
    await user.save();
    res.json({ success: true, message: 'Last swipe rewound!' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

function calculateDistance(coords1, coords2) {
  const [lon1, lat1] = coords1;
  const [lon2, lat2] = coords2;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 10) / 10;
}

module.exports = router;

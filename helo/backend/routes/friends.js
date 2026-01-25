
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const FriendRequest = require('../models/FriendRequest');
const Match = require('../models/Match');
const User = require('../models/User');

// @route   POST /api/friends/request
// @desc    Send friend/match request (auto-accepts if reverse request exists)
// @access  Private
router.post('/request', protect, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    console.log('[MATCH] User', req.user._id, 'liking user', receiverId);

    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot send request to yourself' });
    }

    // Check if current user already sent a request to this person
    const existingRequest = await FriendRequest.findOne({
      sender: req.user._id,
      receiver: receiverId
    });

    if (existingRequest) {
      console.log('[MATCH] Request already exists, status:', existingRequest.status);
      
      // If the request is already accepted, check if there's an existing match
      if (existingRequest.status === 'accepted') {
        const existingMatch = await Match.findOne({
          users: { $all: [req.user._id, receiverId] },
          status: 'active'
        });
        
        if (existingMatch) {
          // Get matched user info
          const matchedUser = await User.findById(receiverId).select('name photos age');
          console.log('[MATCH] Already matched! Returning match info');
          return res.status(200).json({ 
            success: true, 
            isMatch: true,
            match: existingMatch,
            matchedUser,
            message: "You're already matched!"
          });
        }
      }
      
      return res.status(400).json({ success: false, message: 'Match request already sent' });
    }

    // Check if target user already sent a pending request to current user (mutual like!)
    const reverseRequest = await FriendRequest.findOne({
      sender: receiverId,
      receiver: req.user._id,
      status: 'pending'
    }).populate('sender', 'name photos age');

    if (reverseRequest) {
      // Auto-accept the reverse request - it's a match!
      console.log('[MATCH] Mutual like detected! Creating match between', req.user._id, 'and', receiverId);
      reverseRequest.status = 'accepted';
      await reverseRequest.save();

      // Convert to ObjectIds for comparison
      const userId1 = req.user._id.toString();
      const userId2 = receiverId.toString();

      // Check if match already exists
      const existingMatch = await Match.findOne({
        users: { $all: [req.user._id, receiverId] },
        status: 'active'
      });

      let match = existingMatch;
      if (!existingMatch) {
        try {
          // Create a match
          match = await Match.create({
            users: [req.user._id, receiverId],
            isSuperLike: false,
            status: 'active'
          });
          console.log('Match created successfully:', match._id, 'between', userId1, 'and', userId2);
        } catch (matchError) {
          console.error('Error creating match:', matchError);
          // Return success for the mutual like even if match creation fails
          return res.status(200).json({ 
            success: true, 
            isMatch: true,
            matchedUser: reverseRequest.sender,
            message: "It's a match!"
          });
        }
      }

      return res.status(200).json({ 
        success: true, 
        isMatch: true,
        match,
        matchedUser: reverseRequest.sender,
        message: "It's a match!"
      });
    }

    // No reverse request exists, create a new pending request
    const friendRequest = await FriendRequest.create({
      sender: req.user._id,
      receiver: receiverId,
      message
    });

    await friendRequest.populate('sender', 'name photos age');

    res.status(201).json({ success: true, friendRequest, isMatch: false });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/friends/requests
// @desc    Get received friend requests
// @access  Private
router.get('/requests', protect, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      receiver: req.user._id,
      status: 'pending'
    })
    .populate('sender', 'name photos age bio')
    .sort({ createdAt: -1 });

    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/friends/request/:requestId
// @desc    Accept or reject friend request (creates match on accept)
// @access  Private
router.put('/request/:requestId', protect, async (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    
    const friendRequest = await FriendRequest.findById(req.params.requestId)
      .populate('sender', 'name photos age');

    if (!friendRequest) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    if (!friendRequest.receiver.equals(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    friendRequest.status = action === 'accept' ? 'accepted' : 'rejected';
    await friendRequest.save();

    let match = null;
    if (action === 'accept') {
      // Check if match already exists
      const existingMatch = await Match.findOne({
        users: { $all: [friendRequest.sender._id, friendRequest.receiver] },
        status: 'active'
      });

      if (!existingMatch) {
        // Create a match when request is accepted
        match = await Match.create({
          users: [friendRequest.sender._id, friendRequest.receiver],
          isSuperLike: false
        });
      } else {
        match = existingMatch;
      }
    }

    res.json({ 
      success: true, 
      friendRequest,
      match,
      isMatch: action === 'accept'
    });
  } catch (error) {
    console.error('Accept/reject request error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/friends/sent-requests
// @desc    Get sent friend requests (requests you sent)
// @access  Private
router.get('/sent-requests', protect, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      sender: req.user._id,
      status: 'pending'
    })
    .populate('receiver', 'name photos age bio')
    .sort({ createdAt: -1 });

    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

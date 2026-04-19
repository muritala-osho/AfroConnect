
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const FriendRequest = require('../models/FriendRequest');
const Match = require('../models/Match');
const User = require('../models/User');

router.post('/request', protect, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    console.log('[MATCH] User', req.user._id, 'liking user', receiverId);

    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot send request to yourself' });
    }

    const existingRequest = await FriendRequest.findOne({
      sender: req.user._id,
      receiver: receiverId
    });

    if (existingRequest) {
      console.log('[MATCH] Request already exists, status:', existingRequest.status);
      
      if (existingRequest.status === 'accepted') {
        let existingMatch = await Match.findOne({
          users: { $all: [req.user._id, receiverId] },
          status: 'active'
        });
        
        if (!existingMatch) {
          try {
            existingMatch = await Match.create({
              users: [req.user._id, receiverId],
              isSuperLike: false,
              status: 'active'
            });
            console.log('[MATCH] Created missing match document:', existingMatch._id);
          } catch (createErr) {
            console.error('[MATCH] Error creating match:', createErr);
          }
        }
        
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
      
      if (existingRequest.status === 'pending') {
        console.log('[MATCH] Request still pending');
        return res.status(200).json({ success: true, isMatch: false, message: 'Request already sent, waiting for response' });
      }
      
      return res.status(400).json({ success: false, message: 'Match request already sent' });
    }

    const reverseRequest = await FriendRequest.findOne({
      sender: receiverId,
      receiver: req.user._id,
      status: 'pending'
    }).populate('sender', 'name photos age');

    if (reverseRequest) {
      console.log('[MATCH] Mutual like detected! Creating match between', req.user._id, 'and', receiverId);
      reverseRequest.status = 'accepted';
      await reverseRequest.save();

      const userId1 = req.user._id.toString();
      const userId2 = receiverId.toString();

      const existingMatch = await Match.findOne({
        users: { $all: [req.user._id, receiverId] },
        status: 'active'
      });

      let match = existingMatch;
      if (!existingMatch) {
        try {
          match = await Match.create({
            users: [req.user._id, receiverId],
            isSuperLike: false,
            status: 'active'
          });
          console.log('Match created successfully:', match._id, 'between', userId1, 'and', userId2);
        } catch (matchError) {
          console.error('Error creating match:', matchError);
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
      const existingMatch = await Match.findOne({
        users: { $all: [friendRequest.sender._id, friendRequest.receiver] },
        status: 'active'
      });

      if (!existingMatch) {
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

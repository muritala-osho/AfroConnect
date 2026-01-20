
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const CallHistory = require('../models/CallHistory');
const Match = require('../models/Match');

// @route   POST /api/call/initiate
// @desc    Initiate a call (create call history entry)
// @access  Private
router.post('/initiate', protect, async (req, res) => {
  try {
    const { receiverId, type } = req.body; // type: 'video' or 'audio'

    const callHistory = await CallHistory.create({
      caller: req.user._id,
      receiver: receiverId,
      type,
      status: 'ongoing',
      startedAt: new Date()
    });

    res.status(201).json({ success: true, callHistory });
  } catch (error) {
    console.error('Initiate call error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/call/decline
// @desc    Record a declined call
// @access  Private
router.post('/decline', protect, async (req, res) => {
  try {
    const { callerId, type } = req.body;

    const callHistory = await CallHistory.create({
      caller: callerId,
      receiver: req.user._id,
      type,
      status: 'rejected'
    });

    res.status(201).json({ success: true, callHistory });
  } catch (error) {
    console.error('Decline call error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/call/missed
// @desc    Record a missed call
// @access  Private
router.post('/missed', protect, async (req, res) => {
  try {
    const { callerId, type } = req.body;

    const callHistory = await CallHistory.create({
      caller: callerId,
      receiver: req.user._id,
      type,
      status: 'missed'
    });

    res.status(201).json({ success: true, callHistory });
  } catch (error) {
    console.error('Missed call error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/call/:callId/end
// @desc    End a call and update duration
// @access  Private
router.put('/:callId/end', protect, async (req, res) => {
  try {
    const { duration, status } = req.body;

    const call = await CallHistory.findById(req.params.callId);
    if (!call) {
      return res.status(404).json({ success: false, message: 'Call not found' });
    }

    call.duration = duration;
    call.status = status || 'completed';
    call.endedAt = Date.now();
    await call.save();

    res.json({ success: true, call });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/call/history
// @desc    Get call history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const calls = await CallHistory.find({
      $or: [
        { caller: req.user._id },
        { receiver: req.user._id }
      ]
    })
    .populate('caller', 'name photos')
    .populate('receiver', 'name photos')
    .sort({ createdAt: -1 })
    .limit(50);

    res.json({ success: true, calls });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;

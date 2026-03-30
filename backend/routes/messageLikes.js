const express = require('express');
const router = express.Router();
const MessageLike = require('../models/MessageLike');
const auth = require('../middleware/auth');

router.post('/:messageId', auth, async (req, res) => {
  try {
    const existingLike = await MessageLike.findOne({ messageId: req.params.messageId, userId: req.user.id });
    if (existingLike) {
      await MessageLike.deleteOne({ _id: existingLike._id });
      return res.json({ success: true, liked: false });
    }
    await MessageLike.create({ messageId: req.params.messageId, userId: req.user.id });
    res.json({ success: true, liked: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:messageId', async (req, res) => {
  try {
    const likes = await MessageLike.countDocuments({ messageId: req.params.messageId });
    res.json({ success: true, likes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

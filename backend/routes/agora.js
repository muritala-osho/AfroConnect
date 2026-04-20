const logger = require('../utils/logger');
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const AGORA_APP_ID = process.env.AGORA_APP_ID;
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

logger.log('Agora Routes Loaded. ID:', !!AGORA_APP_ID, 'Cert:', !!AGORA_APP_CERTIFICATE);

router.get('/token', protect, async (req, res) => {
  try {
    const { channelName, uid = 0, role = 'publisher' } = req.query;
    
    if (!channelName) {
      return res.status(400).json({ success: false, message: 'Channel name is required' });
    }
    
    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
      return res.status(500).json({ success: false, message: 'Agora credentials not configured' });
    }

    const rtcRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTimestamp + expirationTimeInSeconds;
    
    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      parseInt(uid) || 0,
      rtcRole,
      privilegeExpireTime
    );

    const isPremium = req.user.premium?.isActive;
    
    res.json({
      success: true,
      token,
      appId: AGORA_APP_ID,
      channel: channelName,
      uid: parseInt(uid) || 0,
      isLimited: !isPremium, // Flag for frontend to enforce duration
      maxDuration: isPremium ? 0 : 300 // 5 minutes for free users
    });
  } catch (error) {
    logger.error('Agora token error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate token' });
  }
});

router.post('/call/initiate', protect, async (req, res) => {
  try {
    const { targetUserId, callType } = req.body;
    
    if (!targetUserId || !callType) {
      return res.status(400).json({ success: false, message: 'Target user and call type required' });
    }
    
    if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
      return res.status(500).json({ success: false, message: 'Agora credentials not configured' });
    }
    
    const channelName = `c${String(req.user._id).slice(-8)}${String(targetUserId).slice(-8)}${Date.now().toString(36)}`;
    const uid = Math.floor(Math.random() * 100000);
    
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTimestamp + expirationTimeInSeconds;
    
    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpireTime
    );

    res.json({
      success: true,
      callData: {
        channelName,
        token,
        appId: AGORA_APP_ID,
        uid,
        callType,
        callerId: req.user._id,
        targetUserId,
        isLimited: !req.user.premium?.isActive,
        maxDuration: req.user.premium?.isActive ? 0 : 300
      }
    });
  } catch (error) {
    logger.error('Call initiation error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate call' });
  }
});

router.get('/config', protect, (req, res) => {
  res.json({
    success: true,
    appId: AGORA_APP_ID || null,
    configured: !!(AGORA_APP_ID && AGORA_APP_CERTIFICATE),
  });
});

module.exports = router;

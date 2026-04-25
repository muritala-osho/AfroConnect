const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const Match = require('../models/Match');
const User = require('../models/User');
const { logAudit } = require('../utils/auditHelper');

const ALLOWED_REASONS = new Set([
  'Phone number',
  'Email address',
  'Web link',
  'Social handle',
  'Street address',
  'Off-platform messaging app',
  'Other social platform',
  'Request to move off-app',
  'Financial / sensitive credentials',
  'In-person meetup proposal',
]);

const HIGH_RISK_REASONS = new Set([
  'Financial / sensitive credentials',
  'Off-platform messaging app',
  'Request to move off-app',
]);

router.post('/warning-bypassed', protect, async (req, res) => {
  try {
    const { matchId, reasons, contentLength } = req.body || {};

    if (!Array.isArray(reasons) || reasons.length === 0) {
      return res.status(400).json({ success: false, message: 'reasons array required' });
    }

    const cleanReasons = reasons
      .filter((r) => typeof r === 'string' && ALLOWED_REASONS.has(r))
      .slice(0, 10);

    if (cleanReasons.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid reasons supplied' });
    }

    const sender = req.user;
    let recipient = null;
    let matchDoc = null;

    if (matchId && /^[a-fA-F0-9]{24}$/.test(matchId)) {
      matchDoc = await Match.findById(matchId).select('users').lean();
      if (matchDoc && Array.isArray(matchDoc.users)) {
        const otherId = matchDoc.users.find(
          (uid) => String(uid) !== String(sender._id),
        );
        if (otherId) {
          recipient = await User.findById(otherId).select('name email').lean();
        }
      }
    }

    const severity = cleanReasons.some((r) => HIGH_RISK_REASONS.has(r)) ? 'high' : 'medium';

    const ipAddress =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      undefined;

    const contentHash =
      typeof contentLength === 'number'
        ? crypto
            .createHash('sha256')
            .update(`${sender._id}:${matchId || ''}:${Date.now()}`)
            .digest('hex')
            .slice(0, 16)
        : undefined;

    await logAudit({
      action: 'SAFETY_WARNING_BYPASSED',
      category: 'USER_SAFETY',
      severity,
      adminId: sender._id,
      adminName: sender.name || 'Unknown',
      adminEmail: sender.email,
      targetUserId: recipient?._id,
      targetUserName: recipient?.name,
      targetUserEmail: recipient?.email,
      details: `Sent message after dismissing safety warning (${cleanReasons.join(', ')})`,
      metadata: {
        reasons: cleanReasons,
        matchId: matchId || null,
        contentLength: typeof contentLength === 'number' ? contentLength : null,
        contentRef: contentHash,
      },
      ipAddress,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[safetyAudit] failed:', error);
    res.status(500).json({ success: false, message: 'Failed to log safety event' });
  }
});

module.exports = router;

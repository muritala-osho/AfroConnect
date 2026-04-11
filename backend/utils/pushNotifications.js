const { Expo } = require('expo-server-sdk');
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
  useFcmV1: true,
});

/**
 * Clears an invalid push token from the database so we stop sending to it.
 * Called automatically when Expo returns DeviceNotRegistered.
 */
async function clearInvalidToken(pushToken) {
  try {
    const User = require('../models/User');
    await User.updateOne({ pushToken }, { $unset: { pushToken: '' }, pushNotificationsEnabled: false });
    console.warn(`[Push] Cleared invalid/unregistered token: ${pushToken}`);
  } catch (err) {
    console.error('[Push] Failed to clear invalid token from DB:', err.message);
  }
}

/**
 * Polls Expo's receipt endpoint for a batch of ticket IDs.
 * Cleans up DeviceNotRegistered tokens automatically.
 * Should be called ~15–30 minutes after sending (Expo's recommendation).
 */
async function checkPushReceipts(ticketIdMap) {
  if (!ticketIdMap || ticketIdMap.size === 0) return;

  const receiptIds = [...ticketIdMap.keys()];
  if (receiptIds.length === 0) return;

  try {
    const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
    for (const chunk of receiptIdChunks) {
      let receipts;
      try {
        receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      } catch (err) {
        console.error('[Push] Receipt fetch error:', err.message);
        continue;
      }

      for (const [receiptId, receipt] of Object.entries(receipts)) {
        if (receipt.status === 'error') {
          console.error(`[Push] Receipt error for ${receiptId}: ${receipt.message}`, receipt.details);
          if (receipt.details?.error === 'DeviceNotRegistered') {
            const token = ticketIdMap.get(receiptId);
            if (token) await clearInvalidToken(token);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Push] Receipt check failed:', err.message);
  }
}

async function sendExpoPushNotification(pushToken, { title, body, data, priority, sound, channelId, ttl, badge }) {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.warn(`[Push] Invalid Expo push token — skipping: ${pushToken}`);
    return null;
  }

  const message = {
    to: pushToken,
    sound: sound || 'default',
    title,
    body,
    data: data || {},
    priority: priority || 'high',
    channelId: channelId || 'default',
    ...(ttl !== undefined ? { ttl } : {}),
    ...(badge !== undefined ? { badge } : {}),
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }

    // Build a map of receiptId → pushToken for later receipt lookup.
    // Also handle immediate ticket-level errors (e.g. DeviceNotRegistered at send time).
    const ticketIdMap = new Map();
    for (const ticket of tickets) {
      if (ticket.status === 'error') {
        console.error(`[Push] Ticket error: ${ticket.message}`, ticket.details);
        if (ticket.details?.error === 'DeviceNotRegistered') {
          await clearInvalidToken(pushToken);
        }
      } else if (ticket.id) {
        ticketIdMap.set(ticket.id, pushToken);
      }
    }

    // Schedule a delayed receipt check (~20 minutes) — fire and forget.
    // Expo receipts are not available immediately; 15–30 min is recommended.
    if (ticketIdMap.size > 0) {
      setTimeout(() => checkPushReceipts(ticketIdMap), 20 * 60 * 1000);
    }

    console.log(`[Push] Sent: "${title}" → ${pushToken.slice(0, 30)}…`);
    return tickets;
  } catch (error) {
    console.error('[Push] Error sending notification:', error);
    return null;
  }
}

/**
 * Smart notification dispatcher — checks all user preferences before sending.
 *
 * @param {Object} user  - Mongoose user doc (must include pushToken, pushNotificationsEnabled,
 *                         muteSettings, notificationPreferences)
 * @param {Object} payload - { title, body, data, channelId }
 * @param {string} type  - 'message' | 'match' | 'like' | 'voice_call' | 'video_call' | 'support' | 'system'
 * @param {string|null} mutedByUserId - Optional: sender's userId to check per-user mute list
 * @returns {Promise<boolean>} true if sent, false if suppressed
 */
async function sendSmartNotification(user, payload, type = 'system', mutedByUserId = null) {
  const userId = user?._id?.toString() || 'unknown';

  if (!user?.pushToken || !Expo.isExpoPushToken(user.pushToken)) {
    console.log(`[Push] Suppressed (no valid token) — user ${userId}, type: ${type}`);
    return false;
  }

  if (user.pushNotificationsEnabled === false) {
    console.log(`[Push] Suppressed (notifications disabled) — user ${userId}, type: ${type}`);
    return false;
  }

  const prefs = user.notificationPreferences || {};
  const mute  = user.muteSettings || {};

  const isCall = type === 'voice_call' || type === 'video_call';

  // Per-type preference check
  if (type === 'message'    && prefs.messagesEnabled   === false) {
    console.log(`[Push] Suppressed (messages disabled) — user ${userId}`);
    return false;
  }
  if (type === 'match'      && prefs.matchesEnabled    === false) {
    console.log(`[Push] Suppressed (matches disabled) — user ${userId}`);
    return false;
  }
  if (type === 'like'       && prefs.likesEnabled      === false) {
    console.log(`[Push] Suppressed (likes disabled) — user ${userId}`);
    return false;
  }
  if (type === 'voice_call' && prefs.voiceCallsEnabled === false) {
    console.log(`[Push] Suppressed (voice calls disabled) — user ${userId}`);
    return false;
  }
  if (type === 'video_call' && prefs.videoCallsEnabled === false) {
    console.log(`[Push] Suppressed (video calls disabled) — user ${userId}`);
    return false;
  }

  // Per-user mute check
  if (mutedByUserId && mute.mutedUsers?.length) {
    const muteEntry = mute.mutedUsers.find(
      (m) => m.userId?.toString() === mutedByUserId.toString()
    );
    if (muteEntry) {
      if (muteEntry.muteAll) {
        console.log(`[Push] Suppressed (user muted sender) — user ${userId}`);
        return false;
      }
      if (type === 'message'    && muteEntry.muteMessages) {
        console.log(`[Push] Suppressed (messages muted for sender) — user ${userId}`);
        return false;
      }
      if (type === 'voice_call' && muteEntry.muteVoiceCalls) {
        console.log(`[Push] Suppressed (voice calls muted for sender) — user ${userId}`);
        return false;
      }
      if (type === 'video_call' && muteEntry.muteVideoCalls) {
        console.log(`[Push] Suppressed (video calls muted for sender) — user ${userId}`);
        return false;
      }
    }
  }

  // Global quiet-hours check — use UTC consistently so comparisons
  // are not skewed by the server's local timezone offset.
  if (mute.globalMute?.enabled) {
    if (isCall && mute.globalMute.allowCalls) {
      // calls are allowed to break through quiet hours — continue
    } else {
      const now    = new Date();
      const pad    = (n) => String(n).padStart(2, '0');
      const nowStr = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}`;
      const start  = mute.globalMute.startTime || '22:00';
      const end    = mute.globalMute.endTime   || '08:00';

      const inQuietHours =
        start <= end
          ? nowStr >= start && nowStr < end
          : nowStr >= start || nowStr < end; // spans midnight

      if (inQuietHours) {
        console.log(`[Push] Suppressed (quiet hours ${start}–${end} UTC, now ${nowStr}) — user ${userId}`);
        return false;
      }
    }
  }

  const sound = prefs.soundEnabled === false ? null : 'default';

  const priorityMap = {
    message:    'high',
    match:      'high',
    like:       'normal',
    voice_call: 'high',
    video_call: 'high',
    support:    'normal',
    system:     'normal',
  };

  const ttlMap = {
    voice_call: 86400,
    video_call: 86400,
    message:    86400,
    match:      86400,
    like:       86400,
    support:    86400,
    system:     86400,
  };

  const channelMap = {
    message:    'messages',
    match:      'matches',
    like:       'likes',
    voice_call: 'calls',
    video_call: 'calls',
    support:    'support',
    system:     'default',
  };

  await sendExpoPushNotification(user.pushToken, {
    ...payload,
    priority: priorityMap[type] || 'high',
    sound,
    channelId: payload.channelId || channelMap[type] || 'default',
    ttl: ttlMap[type] ?? 86400,
    ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
  });

  return true;
}

module.exports = { sendExpoPushNotification, sendSmartNotification, expo };

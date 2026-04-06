const { Expo } = require('expo-server-sdk');
const expo = new Expo();

async function sendExpoPushNotification(pushToken, { title, body, data, priority, sound, channelId }) {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.log(`Invalid Expo push token: ${pushToken}`);
    return null;
  }

  const message = {
    to: pushToken,
    sound: sound || 'default',
    title,
    body,
    data: data || {},
    priority: priority || 'high',
    channelId: channelId || 'default'
  };

  try {
    const chunks = expo.chunkPushNotifications([message]);
    const tickets = [];
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }
    console.log(`Push notification sent: ${title} - ${body}`);
    return tickets;
  } catch (error) {
    console.error('Error sending push notification:', error);
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
  if (!user?.pushToken || !Expo.isExpoPushToken(user.pushToken)) return false;
  if (user.pushNotificationsEnabled === false) return false;

  const prefs = user.notificationPreferences || {};
  const mute  = user.muteSettings || {};

  const isCall = type === 'voice_call' || type === 'video_call';

  // Per-type preference check
  if (type === 'message'    && prefs.messagesEnabled   === false) return false;
  if (type === 'match'      && prefs.matchesEnabled    === false) return false;
  if (type === 'like'       && prefs.likesEnabled      === false) return false;
  if (type === 'voice_call' && prefs.voiceCallsEnabled === false) return false;
  if (type === 'video_call' && prefs.videoCallsEnabled === false) return false;

  // Per-user mute check
  if (mutedByUserId && mute.mutedUsers?.length) {
    const muteEntry = mute.mutedUsers.find(
      (m) => m.userId?.toString() === mutedByUserId.toString()
    );
    if (muteEntry) {
      if (muteEntry.muteAll)                                           return false;
      if (type === 'message'    && muteEntry.muteMessages)            return false;
      if (type === 'voice_call' && muteEntry.muteVoiceCalls)          return false;
      if (type === 'video_call' && muteEntry.muteVideoCalls)          return false;
    }
  }

  // Global quiet-hours check
  if (mute.globalMute?.enabled) {
    if (isCall && mute.globalMute.allowCalls) {
      // calls are allowed to break through quiet hours — continue
    } else {
      const now  = new Date();
      const pad  = (n) => String(n).padStart(2, '0');
      const nowStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const start = mute.globalMute.startTime || '22:00';
      const end   = mute.globalMute.endTime   || '08:00';

      const inQuietHours =
        start <= end
          ? nowStr >= start && nowStr < end
          : nowStr >= start || nowStr < end; // spans midnight

      if (inQuietHours) return false;
    }
  }

  const sound = prefs.soundEnabled === false ? null : 'default';

  const priorityMap = {
    message:    'high',
    match:      'high',
    like:       'high',
    voice_call: 'high',
    video_call: 'high',
    support:    'normal',
    system:     'normal',
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
  });

  return true;
}

module.exports = { sendExpoPushNotification, sendSmartNotification, expo };

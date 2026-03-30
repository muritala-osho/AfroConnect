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
    priority: priority || 'default',
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

module.exports = { sendExpoPushNotification, expo };

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Always show notifications when app is in foreground.
// Do NOT make API calls here — it's too slow and can drop notifications.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const isExpoGo = Constants.appOwnership === 'expo';

export async function registerForPushNotificationsAsync() {
  let token;

  if (isExpoGo) {
    console.log('Push notifications not available on Expo Go. Use a development build.');
    return;
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted.');
      return;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId || 'your-project-id',
      })).data;
      await AsyncStorage.setItem('pushToken', token);

      const authToken = await AsyncStorage.getItem('token');
      if (authToken && token) {
        const { getApiBaseUrl } = require('../constants/config');
        const apiUrl = getApiBaseUrl();
        await fetch(`${apiUrl}/api/notifications/register-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({ pushToken: token }),
        });
      }
    } catch (error) {
      console.error('Error getting or registering push token:', error);
    }
  } else {
    console.log('Must use physical device for push notifications.');
  }

  if (Platform.OS === 'android') {
    await setupAndroidChannels();
  }

  return token;
}

async function setupAndroidChannels() {
  // General / default
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B9D',
    sound: 'default',
  });

  // Messages
  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B9D',
    sound: 'default',
  });

  // Matches & Likes
  await Notifications.setNotificationChannelAsync('matches', {
    name: 'Matches & Likes',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 400, 200, 400],
    lightColor: '#FF6B9D',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('likes', {
    name: 'Likes',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250],
    lightColor: '#FF6B9D',
  });

  // Incoming calls — maximum priority, bypasses DND, visible on lock screen
  await Notifications.setNotificationChannelAsync('calls', {
    name: 'Incoming Calls',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 1000, 500, 1000, 500, 1000],
    lightColor: '#4CAF50',
    sound: 'default',
    bypassDnd: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });

  // Support
  await Notifications.setNotificationChannelAsync('support', {
    name: 'Support',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B9D',
  });
}

export async function sendLocalNotification(title: string, body: string, data?: any) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null,
  });
}

export function setupNotificationListeners(
  onNotificationReceived: (notification: any) => void,
  onNotificationResponse: (response: any) => void
) {
  try {
    const receivedSubscription = Notifications.addNotificationReceivedListener(onNotificationReceived);
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(onNotificationResponse);

    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  } catch (error) {
    console.log('Notification listeners not available:', error);
    return () => {};
  }
}

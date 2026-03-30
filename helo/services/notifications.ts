import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => {
    // Check if notifications are disabled in storage
    const authToken = await AsyncStorage.getItem('token');
    if (authToken) {
      try {
        const { getApiBaseUrl } = require('../constants/config');
        const apiUrl = getApiBaseUrl();
        const response = await fetch(`${apiUrl}/api/users/me`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await response.json();
        
        // If pushNotifications is explicitly false, do not show notification
        if (data?.user?.settings?.pushNotifications === false) {
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: false,
          };
        }
      } catch (e) {
        console.log('Error checking notification settings:', e);
      }
    }

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

// Check if running on Expo Go (vs development build)
const isExpoGo = Constants.appOwnership === 'expo';

export async function registerForPushNotificationsAsync() {
  let token;

  // Skip push notifications on Expo Go - not supported in SDK 53+
  if (isExpoGo) {
    console.log('Push notifications not available on Expo Go. Use a development build for remote push notifications.');
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
      console.log('Failed to get push token for push notification!');
      return;
    }

    try {
      token = (await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId || 'your-project-id'
      })).data;
      await AsyncStorage.setItem('pushToken', token);

      // Register token with backend
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
    console.log('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FE3C72',
    });
  }

  return token;
}

export async function sendLocalNotification(title: string, body: string, data?: any) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: true,
    },
    trigger: null, // Show immediately
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
    console.log('Notification listeners not available in this environment');
    return () => {}; // Return empty cleanup function
  }
}

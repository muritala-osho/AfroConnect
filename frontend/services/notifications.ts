import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => {
    try {
      const prefsRaw = await AsyncStorage.getItem('notificationPreferences');
      const prefs = prefsRaw ? JSON.parse(prefsRaw) : {};
      const pushEnabled = await AsyncStorage.getItem('pushNotificationsEnabled');

      if (pushEnabled === 'false') {
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }

      const soundEnabled = prefs.soundEnabled !== false;

      return {
        shouldShowAlert: true,
        shouldPlaySound: soundEnabled,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    } catch {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    }
  },
});

const isExpoGo = Constants.executionEnvironment === 'storeClient';

export async function registerForPushNotificationsAsync(authTokenOverride?: string) {
  console.log('\n[Notifications] ─── registerForPushNotificationsAsync ───');
  console.log('[Notifications] Platform:', Platform.OS);
  console.log('[Notifications] Is physical device:', Device.isDevice);
  console.log('[Notifications] Is Expo Go:', isExpoGo);

  let token: string | undefined;

  if (Platform.OS === 'android') {
    console.log('[Notifications] Setting up Android channels…');
    await setupAndroidChannels();
    console.log('[Notifications] Android channels ready.');
  }

  if (isExpoGo) {
    console.warn('[Notifications] ⚠️  Running in Expo Go — token is for TESTING ONLY via expo.dev/notifications');
  }

  if (!Device.isDevice) {
    console.warn('[Notifications] ⚠️  Must use a physical device for push notifications (not a simulator).');
    return;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log('[Notifications] Existing permission status:', existingStatus);
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    console.log('[Notifications] Requesting permission…');
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log('[Notifications] Permission response:', finalStatus);
  }

  if (finalStatus !== 'granted') {
    console.error('[Notifications] ❌ Permission denied — user did not grant notification permission.');
    return;
  }

  console.log('[Notifications] ✅ Permission granted.');

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    console.log('[Notifications] EAS projectId:', projectId || 'NOT FOUND');

    console.log('[Notifications] Fetching Expo push token from Expo servers…');
    if (projectId && !isExpoGo) {
      try {
        token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      } catch (tokenErr: any) {
        const errMsg = tokenErr?.message || String(tokenErr);
        if (
          errMsg.includes('SERVICE_NOT_AVAILABLE') ||
          errMsg.includes('MISSING_INSTANCEID') ||
          errMsg.includes('Google Play services') ||
          errMsg.includes('FirebaseApp') ||
          errMsg.includes('GMS')
        ) {
          console.error(
            '[Notifications] ❌ GMS (Google Play Services) error — this device may have outdated or missing GMS.',
            '\n  Device brand:', Platform.OS === 'android' ? 'Android' : Platform.OS,
            '\n  Error:', errMsg,
            '\n  Fix: Update Google Play Services in the Play Store and disable battery optimisation for this app.'
          );
        } else {
          console.warn('[Notifications] ⚠️  getExpoPushTokenAsync with projectId failed, retrying without it:', errMsg);
        }
        try {
          token = (await Notifications.getExpoPushTokenAsync()).data;
        } catch (retryErr: any) {
          console.error('[Notifications] ❌ Retry also failed:', retryErr?.message || retryErr);
          return;
        }
      }
    } else {
      token = (await Notifications.getExpoPushTokenAsync()).data;
    }
    console.log('[Notifications] ✅ Token obtained:', token);
    if (isExpoGo) {
      console.log('[Notifications] 👉 COPY THIS TOKEN and paste it at: https://expo.dev/notifications to send a test push');
    }

    if (!token) {
      console.error('[Notifications] ❌ Token came back empty — Expo server issue or misconfigured projectId.');
      return;
    }

    const storedToken = await AsyncStorage.getItem('pushToken');
    console.log('[Notifications] Previously stored token:', storedToken ? storedToken.slice(0, 40) + '…' : 'none');

    await AsyncStorage.setItem('pushToken', token);

    const tokenChanged = token !== storedToken;
    console.log('[Notifications] Registering token with backend (changed:', tokenChanged, ')…');

    const authToken = authTokenOverride || await AsyncStorage.getItem('auth_token');

    if (!authToken) {
      console.warn('[Notifications] ⚠️  No auth token available — user may not be logged in yet. Skipping backend registration.');
      return token;
    }

    const { getApiBaseUrl } = require('../constants/config');
    const apiUrl = getApiBaseUrl();
    const registerUrl = `${apiUrl}/api/notifications/register-token`;
    console.log('[Notifications] Registering token at:', registerUrl);

    let registered = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`[Notifications] Registration attempt ${attempt}/3…`);
      try {
        const res = await fetch(registerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({ pushToken: token }),
        });

        const responseText = await res.text();
        console.log(`[Notifications] Attempt ${attempt} — status: ${res.status}, body: ${responseText}`);

        if (res.ok) {
          console.log('[Notifications] ✅ Push token registered with backend successfully.');
          registered = true;
          break;
        } else {
          console.warn(`[Notifications] ⚠️  Registration attempt ${attempt} failed — HTTP ${res.status}: ${responseText}`);
        }
      } catch (fetchErr: any) {
        console.error(`[Notifications] ❌ Registration attempt ${attempt} network error:`, fetchErr?.message || fetchErr);
      }
      if (attempt < 3) {
        const delay = 2000 * attempt;
        console.log(`[Notifications] Retrying in ${delay}ms…`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

    if (!registered) {
      console.error('[Notifications] ❌ Failed to register push token after 3 attempts. Clearing stored token so next launch retries.');
      await AsyncStorage.removeItem('pushToken');
    }
  } catch (error: any) {
    console.error('[Notifications] ❌ Unexpected error during token setup:', error?.message || error);
  }

  console.log('[Notifications] ─────────────────────────────────────────────\n');
  return token;
}

async function setupAndroidChannels() {
  await Notifications.setNotificationChannelAsync('default', {
    name: 'General',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B9D',
    sound: 'default',
  });

  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B9D',
    sound: 'default',
  });

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

  await Notifications.setNotificationChannelAsync('support', {
    name: 'Support',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B9D',
  });

  await Notifications.setNotificationChannelAsync('engagement', {
    name: 'Activity & Updates',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B9D',
    sound: 'default',
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
  console.log('[Notifications] Setting up notification listeners…');
  try {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[Notifications] 📩 Notification received in foreground:', JSON.stringify(notification?.request?.content));
      onNotificationReceived(notification);
    });

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[Notifications] 👆 User tapped notification:', JSON.stringify(response?.notification?.request?.content?.data));
      onNotificationResponse(response);
    });

    console.log('[Notifications] ✅ Listeners active.');
    return () => {
      receivedSubscription.remove();
      responseSubscription.remove();
    };
  } catch (error) {
    console.error('[Notifications] ❌ Failed to set up listeners:', error);
    return () => {};
  }
}

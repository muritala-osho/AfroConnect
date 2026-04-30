import logger from '@/utils/logger';
/**
 * Firebase Cloud Messaging background handler
 *
 * This file MUST be imported at the very top of index.js (before registerRootComponent)
 * because React Native Firebase registers its background/killed-state message
 * handler at import time — before the JS bundle fully evaluates.
 *
 * How it works:
 *  • Android (app killed): FCM delivers a high-priority DATA message.
 *    Firebase wakes the app in a headless JS context and calls this handler.
 *    We call CallKeep.displayIncomingCall() to show the native ConnectionService
 *    incoming call screen without needing the React UI to be rendered.
 *
 *  • iOS (app killed): Firebase messaging on iOS does NOT wake a killed app for
 *    data-only messages. iOS requires PushKit (VoIP) push via APNs to wake a
 *    killed app. That is handled separately by voipPush.ts + the backend's
 *    voipPush.js utility.
 *
 *  • Foreground / background: The app is running; the socket handles the
 *    call:incoming event directly via IncomingCallHandler.tsx.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { initCallKeep, displayIncomingCall } from './callkeep';

/** Returns true when running inside the standard Expo Go app, which does not
 *  bundle Firebase native modules (RNFBAppModule). */
function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

let _messaging: any = null;

function getMessaging() {
  if (isExpoGo()) return null;
  if (_messaging) return _messaging;
  try {
    _messaging = require('@react-native-firebase/messaging').default;
    return _messaging;
  } catch (err) {
    logger.warn('[FCM] @react-native-firebase/messaging not available:', err);
    return null;
  }
}

/**
 * Register the headless background message handler.
 * Must be called before registerRootComponent in index.js.
 */
export function registerFirebaseBackgroundHandler() {
  if (Platform.OS === 'web') return;

  const messaging = getMessaging();
  if (!messaging) return;

  messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
    const data = remoteMessage?.data;
    logger.log('[FCM] Background/killed message received:', data);

    if (data?.type !== 'call' && data?.type !== 'voice_call' && data?.type !== 'video_call') {
      return;
    }

    const callerId   = data.callerId   || data.caller_id;
    const callerName = data.callerName || data.caller_name || 'Unknown';
    const callType   = data.callType   || data.call_type   || 'voice';

    if (!callerId) return;

    try {
      await initCallKeep('AfroConnect');
      await displayIncomingCall(callerId, callerName, callType === 'video');
    } catch (err) {
      logger.error('[FCM] Failed to show CallKeep incoming UI:', err);
    }

    (global as any).__pendingVoipCall = {
      callerId,
      callerName,
      callType,
      callData: data.callData ? JSON.parse(data.callData) : {},
    };
  });

  logger.log('[FCM] Background message handler registered.');
}

/**
 * Request notification permission (iOS) and return the FCM token.
 * On Android permission is auto-granted.
 */
export async function requestFCMPermissionAndGetToken(): Promise<string | null> {
  const messaging = getMessaging();
  if (!messaging) return null;

  try {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const granted =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (!granted) {
        logger.warn('[FCM] iOS permission denied.');
        return null;
      }
    }

    const token = await messaging().getToken();
    logger.log('[FCM] Token:', token);
    return token;
  } catch (err) {
    logger.warn('[FCM] Failed to get token:', err);
    return null;
  }
}

/**
 * Listen for FCM messages while the app is in the foreground.
 * Returns an unsubscribe function.
 */
export function onForegroundMessage(
  handler: (message: any) => void,
): () => void {
  const messaging = getMessaging();
  if (!messaging) return () => {};
  return messaging().onMessage(handler);
}

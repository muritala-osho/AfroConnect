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
 *    We use Notifee's fullScreenAction to show a native incoming call overlay
 *    without needing an Activity context — react-native-callkeep.setup()
 *    requires an Activity and fails silently in a headless JS task, so Notifee
 *    is the correct approach here (same pattern as WhatsApp / Signal).
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
import { displayIncomingCallNotification, cancelIncomingCallNotification } from './notifeeService';

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

    // ── Chat message: show a MessagingStyle notification via Notifee ──────────
    if (data?.type === 'message') {
      try {
        const { displayMessageNotification } = require('./notifeeService');
        await displayMessageNotification({
          matchId:     data.matchId    || '',
          messageId:   data.messageId  || '',
          senderName:  data.senderName || 'New message',
          senderPhoto: data.senderPhoto || '',
          body:        data.body       || '',
        });
      } catch (err) {
        logger.error('[FCM] Failed to show MessagingStyle notification:', err);
      }
      return;
    }

    // ── Cancel call: dismiss the full-screen incoming call notification ───────
    // The backend sends this when the caller hangs up before the callee answers,
    // so the Notifee full-screen notification is removed and the user isn't
    // taken into a dead call if they tap "Answer".
    if (data?.type === 'cancel_call') {
      const cancelCallerId = data.callerId || data.caller_id;
      try {
        if (cancelCallerId) {
          await cancelIncomingCallNotification(cancelCallerId);
        }
      } catch (err) {
        logger.warn('[FCM] Failed to dismiss call notification on cancel_call:', err);
      }
      // Clear any pending cold-start call data so the app doesn't navigate to
      // the call screen when it eventually opens.
      if ((global as any).__pendingVoipCall) {
        (global as any).__pendingVoipCall = null;
      }
      return;
    }

    // ── VoIP call: show native full-screen call UI via Notifee ───────────────
    // react-native-callkeep.setup() requires an Android Activity context and
    // cannot be called from a headless JS background handler (killed app).
    // Notifee's fullScreenAction works without an Activity — it posts a
    // high-priority notification that Android raises as a full-screen overlay
    // (same pattern used by WhatsApp / Signal on Android).
    if (data?.type !== 'call' && data?.type !== 'voice_call' && data?.type !== 'video_call') {
      return;
    }

    const callerId   = data.callerId   || data.caller_id;
    const callerName = data.callerName || data.caller_name || 'Unknown';
    const callerPhoto = data.callerPhoto || data.caller_photo || '';
    const callType   = data.callType   || data.call_type   || 'voice';
    let callData: any = {};
    try { callData = data.callData ? JSON.parse(data.callData) : {}; } catch {}

    if (!callerId) return;

    try {
      await displayIncomingCallNotification({ callerId, callerName, callerPhoto, callType, callData });
    } catch (err) {
      logger.error('[FCM] Failed to show Notifee incoming call notification:', err);
    }

    // Store call data globally so IncomingCallHandler can pick it up on cold
    // start (when the user taps the notification body to open the app).
    (global as any).__pendingVoipCall = {
      callerId,
      callerName,
      callerPhoto,
      callType,
      callData,
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

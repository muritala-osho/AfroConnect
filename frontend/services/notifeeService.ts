/**
 * notifeeService.ts
 *
 * Handles Android MessagingStyle push notifications with:
 *  - Circular sender avatar (fetched as bitmap by Notifee)
 *  - Threaded message grouping — multiple messages from the same conversation
 *    stack into one expandable notification thread (like WhatsApp).
 *  - Inline "Reply" action so the user can respond from the notification shade
 *  - "Mark as Read" action to dismiss and clear the thread without opening app
 *
 * Architecture:
 *  1. Backend sends a data-only FCM message (type='message') in addition to the
 *     regular Expo push notification.
 *  2. The Firebase background handler (firebaseMessaging.ts) intercepts the
 *     data-only message and calls displayMessageNotification() here.
 *  3. Notifee renders a MessagingStyle notification on Android with all buffered
 *     messages for that conversation; iOS is handled by the regular Expo push
 *     (which shows on the lock screen via APNs).
 *  4. When the user taps "Reply", Notifee fires onBackgroundEvent here, which
 *     reads the typed text, calls POST /api/chat/inline-reply, then clears the
 *     thread and cancels the notification.
 *  5. When the chat screen is opened, call clearConversationThread(matchId) to
 *     wipe the persisted thread and cancel the notification.
 *
 * This file is safe to import on iOS — all paths that call Notifee APIs are
 * guarded with Platform.OS === 'android'.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

let _notifee: any = null;
let _EventType: any = null;
let _AndroidImportance: any = null;
let _AndroidStyle: any = null;

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

function getNotifee() {
  if (isExpoGo()) return null;
  if (_notifee) return _notifee;
  try {
    const mod = require('@notifee/react-native');
    _notifee = mod.default;
    _EventType = mod.EventType;
    _AndroidImportance = mod.AndroidImportance;
    _AndroidStyle = mod.AndroidStyle;
    return _notifee;
  } catch {
    return null;
  }
}

const CHANNEL_ID = 'afroconnect_messages';
const MISSED_CALLS_CHANNEL_ID = 'afroconnect_missed_calls';
const INCOMING_CALLS_CHANNEL_ID = 'afroconnect_incoming_calls';
const MAX_THREAD_MESSAGES = 6;

async function ensureChannel() {
  const notifee = getNotifee();
  if (!notifee) return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Messages',
    importance: _AndroidImportance?.HIGH ?? 4,
    vibration: true,
    sound: 'default',
  });
}

async function ensureMissedCallsChannel() {
  const notifee = getNotifee();
  if (!notifee) return;
  await notifee.createChannel({
    id: MISSED_CALLS_CHANNEL_ID,
    name: 'Missed Calls',
    importance: _AndroidImportance?.HIGH ?? 4,
    vibration: true,
    sound: 'default',
  });
}

async function ensureIncomingCallsChannel() {
  const notifee = getNotifee();
  if (!notifee) return;
  // URGENT importance (5) is required for fullScreenAction to work reliably
  // on Android 10+. HIGH (4) also works but some OEMs need URGENT.
  await notifee.createChannel({
    id: INCOMING_CALLS_CHANNEL_ID,
    name: 'Incoming Calls',
    importance: _AndroidImportance?.HIGH ?? 4,
    vibration: true,
    sound: 'default',
    lights: true,
  });
}

// ─── Thread persistence helpers ───────────────────────────────────────────────

interface ThreadMessage {
  text: string;
  timestamp: number;
  senderName: string;
  senderPhoto: string;
}

function threadKey(matchId: string): string {
  return `notifee_thread_${matchId}`;
}

async function loadThread(matchId: string): Promise<ThreadMessage[]> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const raw = await AsyncStorage.getItem(threadKey(matchId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveThread(matchId: string, messages: ThreadMessage[]): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(threadKey(matchId), JSON.stringify(messages));
  } catch {
    // non-fatal
  }
}

async function clearThread(matchId: string): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.removeItem(threadKey(matchId));
  } catch {
    // non-fatal
  }
}

// ─── Public clear helper — call this when the chat screen is opened ───────────

/**
 * Cancel the notification and wipe the persisted thread for a conversation.
 * Call this from the ChatDetail screen when the user opens the conversation.
 */
export async function clearConversationThread(matchId: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  await clearThread(matchId);
  const notifee = getNotifee();
  if (!notifee) return;
  await notifee.cancelNotification(`msg_${matchId}`).catch(() => {});
}

// ─── Message notifications ────────────────────────────────────────────────────

/**
 * Display a threaded MessagingStyle notification for a new chat message.
 *
 * Each call appends to the persisted thread for this conversation so that
 * multiple messages from the same sender stack into one expandable notification
 * instead of replacing each other.
 *
 * @param matchId     MongoDB match ID — used as the notification ID so all
 *                    messages from the same conversation share one notification.
 * @param messageId   MongoDB message ID (stored in notification data).
 * @param senderName  Display name shown in the notification header.
 * @param senderPhoto HTTPS URL of the sender's circular avatar.
 * @param body        Message preview text.
 */
export async function displayMessageNotification({
  matchId,
  messageId,
  senderName,
  senderPhoto,
  body,
}: {
  matchId: string;
  messageId: string;
  senderName: string;
  senderPhoto: string;
  body: string;
}) {
  if (Platform.OS !== 'android') return;
  const notifee = getNotifee();
  if (!notifee) return;

  await ensureChannel();

  const previous = await loadThread(matchId);

  const updated: ThreadMessage[] = [
    ...previous,
    {
      text: body,
      timestamp: Date.now(),
      senderName,
      senderPhoto,
    },
  ].slice(-MAX_THREAD_MESSAGES);

  await saveThread(matchId, updated);

  const threadMessages = updated.map((m) => ({
    text: m.text,
    timestamp: m.timestamp,
    person: {
      name: m.senderName,
      icon: m.senderPhoto || undefined,
    },
  }));

  const unreadCount = updated.length;
  const notificationTitle =
    unreadCount > 1
      ? `${senderName}  (${unreadCount} messages)`
      : senderName;

  await notifee.displayNotification({
    id: `msg_${matchId}`,
    title: notificationTitle,
    body,
    android: {
      channelId: CHANNEL_ID,
      importance: _AndroidImportance?.HIGH ?? 4,
      /*
       * smallIcon — AfroConnect logo, shown in the status bar and as a badge
       * on the bottom-right of the sender's circular avatar.
       * Generated from assets/images/android-icon-monochrome.png at build time
       * by the expo-notifications plugin.
       */
      smallIcon: 'ic_notification',
      color: '#1A0A2E',
      style: {
        type: _AndroidStyle?.MESSAGING ?? 1,
        person: {
          name: senderName,
          icon: senderPhoto || undefined,
        },
        messages: threadMessages,
      },
      largeIcon: senderPhoto || undefined,
      circularLargeIcon: true,
      pressAction: {
        id: 'open_chat',
        launchActivity: 'default',
      },
      actions: [
        {
          title: '💬 Reply',
          pressAction: { id: 'reply', launchActivity: 'default' },
          input: {
            allowFreeFormInput: true,
            placeholder: 'Type a reply…',
          },
        },
        {
          title: '✓ Mark as Read',
          pressAction: { id: 'mark_read' },
        },
      ],
      data: {
        matchId,
        messageId,
        senderName,
        senderPhoto,
        type: 'message',
      },
    },
  });
}

// ─── Missed call notifications ────────────────────────────────────────────────

/**
 * Display a styled "Missed call from X" notification on Android.
 *
 * Shows the caller's circular photo, the AfroConnect logo badge,
 * and a "Call Back" action button.
 */
export async function displayMissedCallNotification({
  callerId,
  callerName,
  callerPhoto,
  callType,
}: {
  callerId: string;
  callerName: string;
  callerPhoto: string;
  callType: string;
}) {
  if (Platform.OS !== 'android') return;
  const notifee = getNotifee();
  if (!notifee) return;

  await ensureMissedCallsChannel();

  const isVideo = callType === 'video';

  await notifee.displayNotification({
    id: `missed_${callerId}`,
    title: `Missed ${isVideo ? 'video' : 'voice'} call`,
    body: `from ${callerName}`,
    android: {
      channelId: MISSED_CALLS_CHANNEL_ID,
      importance: _AndroidImportance?.HIGH ?? 4,
      smallIcon: 'ic_notification',
      color: '#1A0A2E',
      largeIcon: callerPhoto || undefined,
      circularLargeIcon: true,
      pressAction: {
        id: 'open_chat',
        launchActivity: 'default',
      },
      actions: [
        {
          title: '📞 Call Back',
          pressAction: { id: 'call_back', launchActivity: 'default' },
        },
      ],
      data: {
        callerId,
        callerName,
        callerPhoto,
        callType,
        type: 'missed_call',
        screen: 'ChatDetail',
        senderId: callerId,
        senderName: callerName,
        senderPhoto: callerPhoto,
      },
    },
  });
}

// ─── Incoming call notifications ──────────────────────────────────────────────

/**
 * Display a full-screen incoming call notification on Android.
 *
 * Uses Notifee's fullScreenAction so Android raises this as an overlay even
 * on the lock screen — exactly like WhatsApp/Signal. This works from a headless
 * JS context (killed app) unlike react-native-callkeep which requires an
 * Activity for setup().
 *
 * The notification shows "Answer" and "Decline" action buttons.
 * - "Answer"  → launchActivity opens the app cold-start; IncomingCallHandler
 *               reads global.__pendingVoipCall.answeredFromNotification and
 *               navigates directly to the call screen.
 * - "Decline" → handled in the Notifee background event handler without
 *               launching the app; calls POST /api/call/decline.
 */
export async function displayIncomingCallNotification({
  callerId,
  callerName,
  callerPhoto,
  callType,
  callData,
}: {
  callerId: string;
  callerName: string;
  callerPhoto: string;
  callType: string;
  callData?: any;
}) {
  if (Platform.OS !== 'android') return;
  const notifee = getNotifee();
  if (!notifee) return;

  await ensureIncomingCallsChannel();

  const isVideo = callType === 'video';

  await notifee.displayNotification({
    id: `call_${callerId}`,
    title: callerName,
    body: isVideo ? 'Incoming video call' : 'Incoming voice call',
    android: {
      channelId: INCOMING_CALLS_CHANNEL_ID,
      importance: _AndroidImportance?.HIGH ?? 4,
      smallIcon: 'ic_notification',
      color: '#1A0A2E',
      largeIcon: callerPhoto || undefined,
      circularLargeIcon: true,
      // fullScreenAction shows this notification as a full-screen overlay
      // even when the device is locked — the system calls the Activity via
      // Intent.FLAG_ACTIVITY_NEW_TASK so no Activity context is needed here.
      fullScreenAction: {
        id: 'default',
        launchActivity: 'default',
      },
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
      actions: [
        {
          title: '✓ Answer',
          pressAction: { id: 'answer_call', launchActivity: 'default' },
        },
        {
          title: '✕ Decline',
          pressAction: { id: 'decline_call' },
        },
      ],
      // Store all call data so the background handler and the app can
      // reconstruct the call context without needing the socket.
      data: {
        type: 'call',
        callerId,
        callerName,
        callerPhoto,
        callType,
        callData: callData ? JSON.stringify(callData) : '{}',
        screen: 'ChatDetail',
        senderId: callerId,
        senderName: callerName,
        senderPhoto: callerPhoto,
      },
      // Auto-cancel after 30 s so a stale notification doesn't linger if the
      // caller hangs up and the cancel_call FCM message is missed.
      timeoutAfter: 30000,
      vibrationPattern: [0, 500, 1000, 500],
    },
  });
}

/**
 * Cancel the full-screen incoming call notification for a given caller.
 * Call this when a cancel_call FCM message is received (caller hung up).
 */
export async function cancelIncomingCallNotification(callerId: string) {
  if (Platform.OS !== 'android') return;
  const notifee = getNotifee();
  if (!notifee) return;
  await notifee.cancelNotification(`call_${callerId}`).catch(() => {});
}

// ─── Background event handler ─────────────────────────────────────────────────

/**
 * Register the Notifee background event handler.
 *
 * Must be called before registerRootComponent in index.js.
 * Handles the "Reply" and "Mark as Read" inline actions when the app is in
 * background or killed state, and the "Answer" / "Decline" call actions.
 */
export function registerNotifeeBackgroundHandler() {
  if (Platform.OS !== 'android') return;
  const notifee = getNotifee();
  if (!notifee || !_EventType) return;

  notifee.onBackgroundEvent(async ({ type, detail }: any) => {
    const { notification, pressAction, input } = detail;
    const data = notification?.android?.data ?? notification?.data ?? {};
    const matchId = data?.matchId;
    const notifId = `msg_${matchId}`;

    // ── Inline reply ─────────────────────────────────────────────────────────
    if (type === _EventType.ACTION_PRESS && pressAction?.id === 'reply' && input && matchId) {
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const { getApiBaseUrl } = require('../constants/config');

        const authToken = await AsyncStorage.getItem('auth_token');
        if (!authToken) return;

        const apiUrl = getApiBaseUrl();
        await fetch(`${apiUrl}/api/chat/inline-reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ matchId, text: input }),
        });

        await clearThread(matchId);
        await notifee.cancelNotification(notifId);
      } catch {
        // swallow — do not crash the headless handler
      }
      return;
    }

    // ── Mark as Read ─────────────────────────────────────────────────────────
    if (type === _EventType.ACTION_PRESS && pressAction?.id === 'mark_read') {
      if (matchId) {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const { getApiBaseUrl } = require('../constants/config');
          const authToken = await AsyncStorage.getItem('auth_token');
          if (authToken) {
            const apiUrl = getApiBaseUrl();
            await fetch(`${apiUrl}/api/chat/${matchId}/read`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
            });
          }
        } catch {
          // swallow — do not crash the headless handler
        }
        await clearThread(matchId);
      }
      await notifee.cancelNotification(notifId).catch(() => {});
      return;
    }

    // ── Answer incoming call ──────────────────────────────────────────────────
    // The user pressed "Answer" on the full-screen call notification.
    // Mark the call as pre-answered so IncomingCallHandler skips the in-app
    // ringing UI and navigates directly to the call screen on cold start.
    if (type === _EventType.ACTION_PRESS && pressAction?.id === 'answer_call') {
      const callerId    = data?.callerId;
      const callerName  = data?.callerName  || 'Unknown';
      const callerPhoto = data?.callerPhoto || '';
      const callType    = data?.callType    || 'voice';
      let callData: any = {};
      try { callData = data?.callData ? JSON.parse(data.callData) : {}; } catch {}

      if (callerId) {
        (global as any).__pendingVoipCall = {
          callerId,
          callerName,
          callerPhoto,
          callType,
          callData,
          answeredFromNotification: true,
        };
      }
      await notifee.cancelNotification(`call_${callerId}`).catch(() => {});
      return;
    }

    // ── Decline incoming call ─────────────────────────────────────────────────
    // The user pressed "Decline" without opening the app.
    // Call the backend REST endpoint so the caller is notified, and cancel the
    // notification — no need to launch the Activity.
    if (type === _EventType.ACTION_PRESS && pressAction?.id === 'decline_call') {
      const callerId = data?.callerId;
      if (callerId) {
        try {
          const AsyncStorage = require('@react-native-async-storage/async-storage').default;
          const { getApiBaseUrl } = require('../constants/config');
          const authToken = await AsyncStorage.getItem('auth_token');
          if (authToken) {
            const apiUrl = getApiBaseUrl();
            await fetch(`${apiUrl}/api/call/decline`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({ callerId, type: data?.callType || 'voice' }),
            });
          }
        } catch {
          // swallow — do not crash the headless handler
        }
        await notifee.cancelNotification(`call_${callerId}`).catch(() => {});
      }
      return;
    }

    // ── Notification dismissed ────────────────────────────────────────────────
    if (type === _EventType.DISMISSED) {
      if (matchId) await clearThread(matchId);
      await notifee.cancelNotification(notifId).catch(() => {});
    }

    /*
     * "Call Back" button on missed-call notifications.
     * We can only cancel the notification here — actual navigation to the call
     * screen must happen in the foreground via the notification tap
     * (launchActivity: 'default' opens the app and handleNotificationResponse
     * reads data.type === 'missed_call' to navigate to ChatDetail).
     */
    if (type === _EventType.ACTION_PRESS && pressAction?.id === 'call_back') {
      const missedData = notification?.android?.data ?? notification?.data ?? {};
      const missedNotifId = `missed_${missedData?.callerId}`;
      await notifee.cancelNotification(missedNotifId).catch(() => {});
    }
  });
}

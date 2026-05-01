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

// ─── Background event handler ─────────────────────────────────────────────────

/**
 * Register the Notifee background event handler.
 *
 * Must be called before registerRootComponent in index.js.
 * Handles the "Reply" and "Mark as Read" inline actions when the app is in
 * background or killed state.
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

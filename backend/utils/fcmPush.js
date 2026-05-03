const logger = require('./logger');
/**
 * Firebase Cloud Messaging (FCM) — direct push via Firebase Admin SDK
 *
 * This is used for CALL-SPECIFIC high-priority data messages that wake a
 * killed Android app and trigger the Firebase background message handler,
 * which then calls react-native-callkeep to show the native ConnectionService
 * incoming call screen.
 *
 * Why not use Expo's push gateway?
 *   Expo sends FCM notification messages. Firebase's setBackgroundMessageHandler
 *   fires only for FCM DATA-ONLY messages (no notification key). We send the
 *   data message directly via the Admin SDK alongside the Expo notification.
 *
 * Required setup:
 *   Set the FIREBASE_SERVICE_ACCOUNT environment variable to the full JSON
 *   contents of your Firebase service account key file.
 *   Download it from: Firebase Console → Project Settings → Service Accounts
 *                    → Generate New Private Key
 *
 * If FIREBASE_SERVICE_ACCOUNT is not set, this module logs a warning and
 * skips gracefully — the regular Expo notification will still be sent.
 */

let admin = null;
let _initialized = false;

function getAdmin() {
  if (_initialized) return admin;
  _initialized = true;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    logger.warn(
      '[FCM] FIREBASE_SERVICE_ACCOUNT env var not set. ' +
      'Direct FCM data messages (Android killed-app CallKeep) will be skipped. ' +
      'Download your service account key from Firebase Console → Project Settings → Service Accounts.',
    );
    return null;
  }

  try {
    const firebaseAdmin = require('firebase-admin');
    if (firebaseAdmin.apps.length === 0) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
      });
    }
    admin = firebaseAdmin;
    logger.log('[FCM] Firebase Admin initialized.');
  } catch (err) {
    logger.error('[FCM] Failed to initialize Firebase Admin:', err.message);
    admin = null;
  }

  return admin;
}

/**
 * Sends a high-priority FCM DATA message directly to an Android device.
 *
 * @param {string} fcmToken  - The device FCM token (from messaging().getToken())
 * @param {object} data      - String key-value pairs (FCM data payload)
 * @param {object} options   - Optional { type: 'call' | 'message', ttl: ms }
 */
async function sendFcmDataMessage(fcmToken, data, options = {}) {
  if (!fcmToken) return;

  const firebaseAdmin = getAdmin();
  if (!firebaseAdmin) return;

  const stringData = {};
  for (const [k, v] of Object.entries(data)) {
    stringData[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }

  // Context-aware Android config for different message types
  const messageType = options.type || 'call';
  let collapseKey;
  let ttl;

  if (messageType === 'call') {
    // Incoming calls: collapse key by caller so 2nd ring replaces 1st
    // 30s TTL because if device doesn't answer in 35s, call is missed anyway
    collapseKey = `call_${data.callerId || 'unknown'}`;
    ttl = options.ttl || 30000;
  } else if (messageType === 'message') {
    // Chat messages: collapse key by conversation so rapid messages don't collapse
    // 24h TTL so offline devices still get messages when they reconnect
    collapseKey = `msg_${data.matchId || 'unknown'}`;
    ttl = options.ttl || 86400000; // 24 hours
  } else {
    // Generic default
    collapseKey = `generic_${data.senderId || data.callerId || 'unknown'}`;
    ttl = options.ttl || 86400000;
  }

  try {
    const result = await firebaseAdmin.messaging().send({
      token: fcmToken,
      data: stringData,
      android: {
        // priority:'high' tells FCM to deliver immediately and bypass Doze for
        // a short window — applies to all message types.
        priority: 'high',
        // ttl (Time To Live): how long FCM should try to deliver the message.
        // - Calls: 30s (if not answered in 35s, call is missed anyway)
        // - Messages: 24h (user may be offline for hours, still want delivery)
        ttl,
        // collapseKey: if a 2nd message arrives before the 1st is delivered,
        // the behavior depends on type:
        // - Calls: collapse by callerId so rapid rings from same person don't queue
        // - Messages: collapse by matchId so all messages in a thread don't collapse
        //   (each message should be its own notification)
        collapseKey,
      },
      // APNs config is for fallback only — the real iOS killed-app wake comes
      // from the separate VoIP push in voipPush.js.
      apns: {
        headers: {
          'apns-priority': '10',
          'apns-push-type': 'alert',
        },
      },
    });
    logger.log(`[FCM] ✅ ${messageType} message sent:`, result);
    return result;
  } catch (err) {
    logger.error(`[FCM] Failed to send ${messageType} message:`, err.message);
  }
}

/**
 * Convenience wrapper — sends a call-specific FCM data message.
 *
 * @param {string} fcmToken
 * @param {object} params
 * @param {string} params.callerId
 * @param {string} params.callerName
 * @param {string} params.callType  'voice' | 'video'
 * @param {object} params.callData
 */
async function sendCallDataMessage(fcmToken, { callerId, callerName, callerPhoto, callType, callData } = {}) {
  return sendFcmDataMessage(
    fcmToken,
    {
      type:        'call',
      callerId:    callerId    || '',
      callerName:  callerName  || '',
      callerPhoto: callerPhoto || '',
      callType:    callType    || 'voice',
      callData:    callData    || {},
    },
    { type: 'call' }
  );
}

/**
 * Sends a high-priority FCM DATA message to dismiss a stale CallKeep
 * incoming-call notification when the caller cancels before the callee answers.
 * The Firebase background handler on the callee's device calls reportCallEnded()
 * which removes the native ConnectionService / CallKit call UI.
 *
 * @param {string} fcmToken
 * @param {object} params
 * @param {string} params.callerId
 */
async function sendCancelCallDataMessage(fcmToken, { callerId } = {}) {
  return sendFcmDataMessage(fcmToken, {
    type:     'cancel_call',
    callerId: callerId || '',
  });
}

/**
 * Sends a data-only FCM message for a chat message to an Android device.
 * This wakes the app's background handler (setBackgroundMessageHandler) which
 * then displays a MessagingStyle notification with the sender's avatar and an
 * inline "Reply" action — no big-picture expansion, just a clean thumbnail.
 *
 * iOS does NOT fire setBackgroundMessageHandler for data-only messages (APNs
 * delivers them with content-available which only wakes the app when unlocked).
 * So we send this alongside the regular Expo push; the iOS Expo push provides
 * the lock-screen display while the Android data message drives the notifee UI.
 *
 * @param {string} fcmToken
 * @param {object} params
 * @param {string} params.matchId
 * @param {string} params.messageId
 * @param {string} params.senderId
 * @param {string} params.senderName
 * @param {string} params.senderPhoto  HTTPS URL or ''
 * @param {string} params.body         message preview text
 * @param {number} params.badge        unread count
 */
async function sendMessageDataMessage(fcmToken, { matchId, messageId, senderId, senderName, senderPhoto, body, badge } = {}) {
  return sendFcmDataMessage(
    fcmToken,
    {
      type:        'message',
      matchId:     matchId     || '',
      messageId:   messageId   || '',
      senderId:    senderId    || '',
      senderName:  senderName  || '',
      senderPhoto: senderPhoto || '',
      body:        body        || '',
      badge:       String(badge ?? 0),
    },
    { type: 'message' }
  );
}

module.exports = { sendFcmDataMessage, sendCallDataMessage, sendCancelCallDataMessage, sendMessageDataMessage };

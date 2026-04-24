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
 */
async function sendFcmDataMessage(fcmToken, data) {
  if (!fcmToken) return;

  const firebaseAdmin = getAdmin();
  if (!firebaseAdmin) return;

  const stringData = {};
  for (const [k, v] of Object.entries(data)) {
    stringData[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }

  try {
    const result = await firebaseAdmin.messaging().send({
      token: fcmToken,
      data: stringData,
      android: {
        priority: 'high',
        ttl: 30000,
      },
    });
    logger.log('[FCM] ✅ Data message sent:', result);
    return result;
  } catch (err) {
    logger.error('[FCM] Failed to send data message:', err.message);
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
async function sendCallDataMessage(fcmToken, { callerId, callerName, callType, callData } = {}) {
  return sendFcmDataMessage(fcmToken, {
    type:       'call',
    callerId:   callerId   || '',
    callerName: callerName || '',
    callType:   callType   || 'voice',
    callData:   callData   || {},
  });
}

module.exports = { sendFcmDataMessage, sendCallDataMessage };

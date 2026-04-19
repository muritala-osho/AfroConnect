/**
 * VoIP Push Notification Sender
 *
 * Sends PushKit (VoIP) push notifications directly to APNs on iOS.
 * VoIP pushes can wake a completely killed app and trigger the CallKit UI
 * via react-native-callkeep running in the JavaScript thread.
 *
 * Required environment variables:
 *   APNS_KEY_ID   — 10-character key ID from Apple Developer portal
 *   APNS_TEAM_ID  — 10-character team ID from Apple Developer portal
 *   APNS_KEY      — Contents of the .p8 AuthKey file (newlines as \n)
 *   APNS_BUNDLE_ID — iOS bundle identifier (default: com.afroconnect.app)
 */

const apn = require('node-apn');

let _provider = null;

function getProvider() {
  if (_provider) return _provider;

  const keyId    = process.env.APNS_KEY_ID;
  const teamId   = process.env.APNS_TEAM_ID;
  const keyValue = process.env.APNS_KEY;

  if (!keyId || !teamId || !keyValue) {
    return null;
  }

  _provider = new apn.Provider({
    token: {
      key:    keyValue,
      keyId,
      teamId,
    },
    production: process.env.NODE_ENV === 'production',
  });

  return _provider;
}

/**
 * Sends a VoIP push to an iOS device.
 *
 * @param {string} voipToken - The VoIP push token registered via PushKit
 * @param {object} payload   - Call data to include in the push payload
 * @param {string} payload.callerId
 * @param {string} payload.callerName
 * @param {string} payload.callType   - 'voice' | 'video'
 * @param {object} payload.callData   - Raw call data from Agora / socket
 */
async function sendVoipPush(voipToken, { callerId, callerName, callType, callData } = {}) {
  if (!voipToken) {
    console.warn('[VoIP Push] No VoIP token provided — skipping.');
    return;
  }

  const provider = getProvider();
  if (!provider) {
    console.warn(
      '[VoIP Push] APNs credentials not configured (APNS_KEY_ID / APNS_TEAM_ID / APNS_KEY missing). ' +
      'Set these env vars to enable iOS VoIP push for killed-app call ringing.',
    );
    return;
  }

  const bundleId = process.env.APNS_BUNDLE_ID || 'com.afroconnect.app';
  const voipTopic = `${bundleId}.voip`;

  const notification = new apn.Notification();
  notification.topic       = voipTopic;
  notification.priority    = 10;
  notification.pushType    = 'voip';
  notification.expiry      = Math.floor(Date.now() / 1000) + 30;
  notification.payload     = { callerId, callerName, callType, callData };

  try {
    const result = await provider.send(notification, voipToken);
    if (result.failed?.length) {
      console.error('[VoIP Push] Failed to deliver to some devices:', result.failed);
    } else {
      console.log(`[VoIP Push] ✅ Sent to ${voipToken.slice(0, 20)}…`);
    }
    return result;
  } catch (err) {
    console.error('[VoIP Push] Error sending push:', err);
  }
}

function shutdown() {
  if (_provider) {
    _provider.shutdown();
    _provider = null;
  }
}

module.exports = { sendVoipPush, shutdown };

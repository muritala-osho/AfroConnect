/**
 * Expo Config Plugin: react-native-callkeep
 *
 * Injects the required AndroidManifest.xml entries for ConnectionService
 * (Android) and ensures the VoIP background mode is present in the iOS
 * Info.plist (Expo already handles backgroundModes in app.json, but this
 * plugin adds the <uses-feature> tag needed for phone accounts on Android).
 */

const { withAndroidManifest } = require('@expo/config-plugins');

function withCallKeepAndroid(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest.application[0];

    if (!app.service) {
      app.service = [];
    }

    const serviceExists = app.service.some(
      (s) =>
        s.$?.['android:name'] ===
        'io.wazo.callkeep.RNCallKeepConnectionService',
    );

    if (!serviceExists) {
      app.service.push({
        $: {
          'android:name': 'io.wazo.callkeep.RNCallKeepConnectionService',
          'android:label': 'AfroConnect',
          'android:permission': 'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: { 'android:name': 'android.telecom.ConnectionService' },
              },
            ],
          },
        ],
      });
    }

    if (!manifest.manifest['uses-feature']) {
      manifest.manifest['uses-feature'] = [];
    }

    const featureExists = manifest.manifest['uses-feature'].some(
      (f) => f.$?.['android:name'] === 'android.hardware.telephony',
    );

    if (!featureExists) {
      manifest.manifest['uses-feature'].push({
        $: {
          'android:name': 'android.hardware.telephony',
          'android:required': 'false',
        },
      });
    }

    return config;
  });
}

module.exports = withCallKeepAndroid;

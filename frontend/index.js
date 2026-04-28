import * as Sentry from '@sentry/react-native';
import { registerRootComponent } from "expo";
import { AppRegistry, Platform } from 'react-native';

// Polyfill Platform globally to fix ReferenceError: Property 'Platform' doesn't exist
if (typeof global !== 'undefined') {
  global.Platform = Platform;
}

// Sentry init — must be the very first thing in the JS bundle so the SDK can
// attach native crash handlers and instrument all subsequent module loads.
// The DSN is read from EXPO_PUBLIC_SENTRY_DSN (set in eas.json or .env).
const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: __DEV__ ? 'development' : 'production',
    enabled: !__DEV__,
    tracesSampleRate: 0.15,
    profilesSampleRate: 0.1,
    attachStacktrace: true,
    normalizeDepth: 6,
  });
}

// ── Firebase background message handler (Android killed-state calls) ─────────
// Must be imported BEFORE registerRootComponent so Firebase can register its
// headless handler before the bundle finishes evaluating.
import { registerFirebaseBackgroundHandler } from "@/services/firebaseMessaging";
if (Platform.OS !== 'web') {
  registerFirebaseBackgroundHandler();
}

import App from "@/App";

// Wrap App with Sentry so the SDK can capture JS exceptions from the root
// component tree and enrich reports with component name breadcrumbs.
registerRootComponent(sentryDsn ? Sentry.wrap(App) : App);

// ── Android: legacy headless task (fallback if Firebase is not available) ──────
// The BackgroundCallTask can also be triggered by custom native code.
if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask('BackgroundCallTask', () => {
    return async (taskData) => {
      try {
        const { displayIncomingCall, initCallKeep } = require('@/services/callkeep');
        initCallKeep('AfroConnect');
        const { callerId, callerName, callType } = taskData || {};
        if (callerId) {
          displayIncomingCall(callerId, callerName || 'Unknown', callType === 'video');
          global.__pendingVoipCall = {
            callerId,
            callerName: callerName || 'Unknown',
            callType:   callType || 'voice',
            callData:   taskData?.callData || {},
          };
        }
      } catch (err) {
        console.error('[BackgroundCallTask] Error:', err);
      }
    };
  });
}

import { registerRootComponent } from "expo";
import { AppRegistry, Platform } from 'react-native';

// ── Initialize Sentry early, before any other code ──
// Sentry must be initialized before importing App and other modules
// so it can instrument React Native, networking, and other integrations.
if (Platform.OS !== 'web' && process.env.EXPO_PUBLIC_SENTRY_DSN) {
  try {
    const Sentry = require('@sentry/react-native');
    Sentry.init({
      dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0.2,
      integrations: [
        new Sentry.ReactNavigationIntegration(),
      ],
      attachStacktrace: true,
      maxBreadcrumbs: 100,
    });
  } catch (err) {
    console.warn('[Sentry] Failed to initialize:', err);
  }
}

if (typeof global !== 'undefined') {
  global.Platform = Platform;
}

import { registerFirebaseBackgroundHandler } from "@/services/firebaseMessaging";
if (Platform.OS !== 'web') {
  registerFirebaseBackgroundHandler();
}

// Notifee background event handler MUST be registered before registerRootComponent.
// It fires when the user interacts with a notification action (e.g. inline Reply,
// Mark as Read) while the app is in background/killed state.
import { registerNotifeeBackgroundHandler } from "@/services/notifeeService";
if (Platform.OS === 'android') {
  registerNotifeeBackgroundHandler();
}

import App from "@/App";

registerRootComponent(App);

if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask('BackgroundCallTask', () => {
    return async (taskData) => {
      try {
        const { displayIncomingCall, initCallKeep } = require('@/services/callkeep');
        await initCallKeep('AfroConnect');
        const { callerId, callerName, callType } = taskData || {};
        if (callerId) {
          await displayIncomingCall(callerId, callerName || 'Unknown', callType === 'video');
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

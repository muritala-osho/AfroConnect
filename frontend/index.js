import { registerRootComponent, AppRegistry } from "expo";
import { Platform } from 'react-native';

// Polyfill Platform globally to fix ReferenceError: Property 'Platform' doesn't exist
if (typeof global !== 'undefined') {
  global.Platform = Platform;
}

// ── Firebase background message handler (Android killed-state calls) ─────────
// Must be imported BEFORE registerRootComponent so Firebase can register its
// headless handler before the bundle finishes evaluating.
import { registerFirebaseBackgroundHandler } from "@/services/firebaseMessaging";
if (Platform.OS !== 'web') {
  registerFirebaseBackgroundHandler();
}

import App from "@/App";

registerRootComponent(App);

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

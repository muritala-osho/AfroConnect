import { registerRootComponent, AppRegistry } from "expo";
import { Platform } from 'react-native';

// Polyfill Platform globally to fix ReferenceError: Property 'Platform' doesn't exist
if (typeof global !== 'undefined') {
  global.Platform = Platform;
}

import App from "@/App";

registerRootComponent(App);

// ── Android: headless task for incoming calls when app is killed ──────────────
// This task is invoked by the native side (e.g. Firebase Messaging background
// handler or a custom native module) when a high-priority FCM data message
// arrives while the app is completely killed.
// The task calls react-native-callkeep to display the native ConnectionService
// incoming call screen without needing the JS UI to be rendered.
if (Platform.OS === 'android') {
  AppRegistry.registerHeadlessTask('BackgroundCallTask', () => {
    return async (taskData) => {
      try {
        const { displayIncomingCall, initCallKeep } = require('@/services/callkeep');
        initCallKeep('AfroConnect');
        const { callerId, callerName, callType } = taskData || {};
        if (callerId) {
          displayIncomingCall(callerId, callerName || 'Unknown', callType === 'video');
          // Store so that when the app foregrounds after answer, IncomingCallHandler
          // picks it up and connects via socket.
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

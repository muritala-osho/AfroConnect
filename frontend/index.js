import { registerRootComponent } from "expo";
import { AppRegistry, Platform } from 'react-native';

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

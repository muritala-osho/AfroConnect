import { registerRootComponent } from "expo";
import { AppRegistry, Platform } from 'react-native';

if (typeof global !== 'undefined') {
  global.Platform = Platform;
}

import { registerFirebaseBackgroundHandler } from "@/services/firebaseMessaging";
if (Platform.OS !== 'web') {
  registerFirebaseBackgroundHandler();
}

import App from "@/App";

registerRootComponent(App);

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

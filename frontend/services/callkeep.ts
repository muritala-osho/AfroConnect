import logger from '@/utils/logger';
import { Platform } from 'react-native';

let RNCallKeep: any = null;

function loadCallKeep() {
  if (RNCallKeep) return RNCallKeep;
  if (Platform.OS === 'web') return null;
  try {
    RNCallKeep = require('react-native-callkeep').default;
    return RNCallKeep;
  } catch (err) {
    logger.warn('[CallKeep] Module not available:', err);
    return null;
  }
}

let _initialized = false;

const uuidMap = new Map<string, string>();

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function initCallKeep(appName: string = 'AfroConnect') {
  if (_initialized || Platform.OS === 'web') return;
  const CK = loadCallKeep();
  if (!CK) return;

  try {
    CK.setup({
      ios: {
        appName,
        supportsVideo: true,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
        includesCallsInRecents: true,
      },
      android: {
        alertTitle: 'Phone account permissions required',
        alertDescription:
          'AfroConnect needs access to manage phone accounts to show incoming calls.',
        cancelButton: 'Cancel',
        okButton: 'Allow',
        additionalPermissions: [],
        selfManaged: false,
        foregroundService: {
          channelId: 'calls',
          channelName: 'Incoming Calls',
          notificationTitle: 'Incoming AfroConnect call…',
          notificationIcon: 'ic_notification',
        },
      },
    });
    _initialized = true;
    logger.log('[CallKeep] Initialized.');
  } catch (err) {
    logger.error('[CallKeep] setup() failed:', err);
  }
}

export function setupCallKeepListeners(handlers: {
  onAnswer: (callerId: string, callUUID: string) => void;
  onEnd: (callerId: string, callUUID: string) => void;
  onToggleMute?: (muted: boolean, callUUID: string) => void;
}) {
  const CK = loadCallKeep();
  if (!CK || Platform.OS === 'web') return;

  CK.addEventListener('answerCall', ({ callUUID }: { callUUID: string }) => {
    logger.log('[CallKeep] answerCall uuid:', callUUID);
    const callerId = getCallerIdByUUID(callUUID);
    CK.setCurrentCallActive(callUUID);
    handlers.onAnswer(callerId ?? callUUID, callUUID);
  });

  CK.addEventListener('endCall', ({ callUUID }: { callUUID: string }) => {
    logger.log('[CallKeep] endCall uuid:', callUUID);
    const callerId = getCallerIdByUUID(callUUID);
    handlers.onEnd(callerId ?? callUUID, callUUID);
    uuidMap.forEach((uuid, id) => {
      if (uuid === callUUID) uuidMap.delete(id);
    });
  });

  CK.addEventListener('didActivateAudioSession', () => {
    logger.log('[CallKeep] Audio session activated.');
  });

  if (handlers.onToggleMute) {
    const muteHandler = handlers.onToggleMute;
    CK.addEventListener(
      'didPerformSetMutedCallAction',
      ({ muted, callUUID }: { muted: boolean; callUUID: string }) => {
        muteHandler(muted, callUUID);
      },
    );
  }
}

export function removeCallKeepListeners() {
  const CK = loadCallKeep();
  if (!CK || Platform.OS === 'web') return;
  try {
    CK.removeEventListener('answerCall');
    CK.removeEventListener('endCall');
    CK.removeEventListener('didActivateAudioSession');
    CK.removeEventListener('didPerformSetMutedCallAction');
  } catch {}
}

export function displayIncomingCall(
  callerId: string,
  callerName: string,
  hasVideo: boolean = false,
): string {
  if (Platform.OS === 'web') return '';
  const CK = loadCallKeep();
  if (!CK) return '';

  if (!_initialized) initCallKeep();

  const uuid = generateUUID();
  uuidMap.set(callerId, uuid);

  try {
    CK.displayIncomingCall(uuid, callerId, callerName, 'generic', hasVideo);
    logger.log('[CallKeep] displayIncomingCall — caller:', callerName, 'uuid:', uuid);
  } catch (err) {
    logger.error('[CallKeep] displayIncomingCall error:', err);
  }
  return uuid;
}

export function endCallKeepCall(callerId: string) {
  if (Platform.OS === 'web') return;
  const CK = loadCallKeep();
  if (!CK) return;
  const uuid = uuidMap.get(callerId);
  if (uuid) {
    try {
      CK.endCall(uuid);
    } catch {}
    uuidMap.delete(callerId);
  }
}

export function reportCallEnded(callerId: string) {
  if (Platform.OS === 'web') return;
  const CK = loadCallKeep();
  if (!CK) return;
  const uuid = uuidMap.get(callerId);
  if (uuid) {
    try {
      CK.reportEndCallWithUUID(uuid, 6);
    } catch {}
    uuidMap.delete(callerId);
  }
}

export function setCallActive(callerId: string) {
  if (Platform.OS === 'web') return;
  const CK = loadCallKeep();
  if (!CK) return;
  const uuid = uuidMap.get(callerId);
  if (uuid) {
    try {
      CK.setCurrentCallActive(uuid);
    } catch {}
  }
}

function getCallerIdByUUID(uuid: string): string | undefined {
  for (const [id, u] of uuidMap.entries()) {
    if (u === uuid) return id;
  }
  return undefined;
}

export function getUUIDForCaller(callerId: string) {
  return uuidMap.get(callerId);
}

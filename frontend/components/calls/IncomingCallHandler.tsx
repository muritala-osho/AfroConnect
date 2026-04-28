import logger from '@/utils/logger';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
  Platform,
  Vibration,
} from 'react-native';
import { SafeImage } from '@/components/SafeImage';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Audio } from '../../utils/expoAvCompat';
import { useAuth } from '@/hooks/useAuth';
import socketService from '@/services/socket';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setupNotificationListeners } from '@/services/notifications';
import { useCallContext } from '@/contexts/CallContext';
import {
  displayIncomingCall,
  endCallKeepCall,
  reportCallEnded,
  setupCallKeepListeners,
  removeCallKeepListeners,
  setCallActive,
} from '@/services/callkeep';

interface IncomingCallData {
  callData: any;
  callerInfo: {
    name: string;
    photo: string;
  };
  callerId: string;
}

const AUTO_DISMISS_MS = 30000;

export default function IncomingCallHandler() {
  const { user, token } = useAuth();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { setActiveCall, clearCall, activeCall } = useCallContext();

  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const isVisibleRef = useRef(false);
  const activeCallRef = useRef(activeCall);
  const incomingCallRef = useRef<IncomingCallData | null>(null);

  useEffect(() => { isVisibleRef.current = isVisible; }, [isVisible]);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  const slideAnim   = useRef(new Animated.Value(-300)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const ringtoneRef = useRef<Audio.Sound | null>(null);
  const hapticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoDismissRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseLoopRef      = useRef<any>(null);
  const coldStartHandledRef = useRef(false);

  /* ── ringtone ── */
  const stopRingtone = useCallback(async () => {
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
      autoDismissRef.current = null;
    }
    if (pulseLoopRef.current) {
      pulseLoopRef.current.stop();
      pulseLoopRef.current = null;
    }
    Vibration.cancel();
    try {
      if (ringtoneRef.current) {
        const s = ringtoneRef.current;
        ringtoneRef.current = null;
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      }
    } catch {}
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: true,
      });
    } catch {}
  }, []);

  const playRingtone = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/sounds/mixkit-waiting-ringtone-1354.wav'),
        { shouldPlay: true, isLooping: true, volume: 1.0 }
      );
      ringtoneRef.current = sound;
      Vibration.vibrate([500, 1000, 500], true);
    } catch (err) {
      logger.log('Ringtone error:', err);
      Vibration.vibrate([500, 1000, 500], true);
    }
  }, []);

  /* ── dismiss UI ── */
  const dismissModal = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: -300, duration: 280, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => {
      setIsVisible(false);
      setIncomingCall(null);
    });
  }, [slideAnim, opacityAnim]);

  const showCallUI = useCallback(async (data: IncomingCallData) => {
    setIncomingCall(data);
    setIsVisible(true);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    const callerName = data.callerInfo?.name || 'Unknown';
    const hasVideo   = data.callData?.callType === 'video';
    if (Platform.OS !== 'web') {
      displayIncomingCall(data.callerId, callerName, hasVideo);
    }

    await playRingtone();

    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 55, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulseLoopRef.current = loop;
    loop.start();

    hapticIntervalRef.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 2200);

    autoDismissRef.current = setTimeout(async () => {
      await stopRingtone();
      reportCallEnded(data.callerId);
      socketService.missedCall?.({ targetUserId: data.callerId, callType: data.callData?.callType || 'audio' });
      dismissModal();
    }, AUTO_DISMISS_MS);
  }, [playRingtone, slideAnim, opacityAnim, pulseAnim, stopRingtone, dismissModal]);

  /* ── CallKeep native UI event listeners ── */
  useEffect(() => {
    if (Platform.OS === 'web') return;

    setupCallKeepListeners({
      onAnswer: (callerId) => {
        logger.log('[CallKeep] Native answer pressed — callerId:', callerId);
        const call = incomingCallRef.current;
        if (!call) return;

        stopRingtone();

        socketService.acceptCall({ callerId: call.callerId, callData: call.callData });
        setCallActive(call.callerId);

        const callTypeFromData = call.callData?.callType === 'video' ? 'video' : 'voice';
        setActiveCall({
          userId: call.callerId,
          userName: call.callerInfo?.name || 'Unknown',
          userPhoto: call.callerInfo?.photo,
          isIncoming: true,
          callStatus: 'connected',
          callType: callTypeFromData,
          duration: 0,
        });

        setIsVisible(false);
        setIncomingCall(null);

        navigation.navigate(callTypeFromData === 'video' ? 'VideoCall' : 'VoiceCall', {
          userId:       call.callerId,
          userName:     call.callerInfo?.name || 'Unknown',
          userPhoto:    call.callerInfo?.photo || '',
          isIncoming:   true,
          callData:     call.callData,
          callerId:     call.callerId,
          callAccepted: true,
        });
      },
      onEnd: (callerId) => {
        logger.log('[CallKeep] Native end/decline pressed — callerId:', callerId);
        const call = incomingCallRef.current;
        if (!call) return;
        stopRingtone();
        socketService.declineCall({ callerId: call.callerId });
        dismissModal();
      },
    });

    return () => {
      removeCallKeepListeners();
    };
  }, []);

  /* ── Socket listeners ── */
  useEffect(() => {
    const myUserId = (user as any)?._id || user?.id;
    if (!myUserId || !token) return;

    const handleIncomingCall = async (data: IncomingCallData) => {
      logger.log('Incoming call:', data);

      const currentActiveCall = activeCallRef.current;
      const currentlyVisible = isVisibleRef.current;

      const inActiveCall = currentActiveCall && (
        currentActiveCall.callStatus === 'connected' ||
        currentActiveCall.callStatus === 'ringing' ||
        currentActiveCall.callStatus === 'connecting'
      );

      if (inActiveCall || currentlyVisible) {
        socketService.busyCall({
          callerId: data.callerId,
          callType: data.callData?.callType || 'audio',
        });
        return;
      }

      await showCallUI(data);
    };

    const dismissCallNotifications = async (callerId?: string) => {
      try {
        const presented = await Notifications.getPresentedNotificationsAsync();
        await Promise.all(
          presented
            .filter((n) => {
              const d: any = n.request?.content?.data || {};
              if (d.type !== 'call') return false;
              if (callerId && d.callerId && d.callerId !== callerId) return false;
              return true;
            })
            .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
        );
      } catch (err) {
        logger.warn('[Notifications] dismiss call notifications failed:', err);
      }
    };

    const handleCallEnded = async (data?: any) => {
      await stopRingtone();
      const call = incomingCallRef.current;
      const cId = call?.callerId || data?.endedBy || data?.callerId;
      if (call) reportCallEnded(call.callerId);
      await dismissCallNotifications(cId);
      dismissModal();
    };

    const handleCallDeclined = async (data?: any) => {
      await stopRingtone();
      const call = incomingCallRef.current;
      const cId = call?.callerId || data?.callerId;
      if (call) reportCallEnded(call.callerId);
      await dismissCallNotifications(cId);
      dismissModal();
    };

    socketService.onIncomingCall(handleIncomingCall);
    socketService.on('call:ended', handleCallEnded);
    socketService.on('call:declined', handleCallDeclined);

    const pendingVoip = (global as any).__pendingVoipCall;
    if (pendingVoip) {
      (global as any).__pendingVoipCall = null;
      handleIncomingCall({
        callerId: pendingVoip.callerId,
        callerInfo: { name: pendingVoip.callerName, photo: '' },
        callData: { callType: pendingVoip.callType, ...pendingVoip.callData },
      });
    }

    return () => {
      socketService.off('call:incoming');
      socketService.off('call:ended');
      socketService.off('call:declined');
      stopRingtone();
    };
  }, [(user as any)?._id || user?.id, token]);

  /* ── Handle notification tap (cold start / tapped-from-background) ── */
  const handleNotificationResponse = useCallback(async (response: any) => {
    const data = response?.notification?.request?.content?.data;
    if (!data) return;

    if (data?.type === 'call') {
      await stopRingtone();
      const callerId = data.callerId;
      if (callerId) reportCallEnded(callerId);
      dismissModal();
      socketService.acceptCall({ callerId: data.callerId, callData: data.callData });
      navigation.navigate(data.callType === 'video' ? 'VideoCall' : 'VoiceCall', {
        userId:       data.callerId,
        userName:     data.callerName,
        userPhoto:    data.callerPhoto || '',
        isIncoming:   true,
        callData:     data.callData,
        callerId:     data.callerId,
        callAccepted: true,
      });
    } else if (data?.type === 'message') {
      const senderId = data.senderId || data.userId;
      if (!senderId) return;
      navigation.navigate('ChatDetail', {
        userId:    senderId,
        userName:  data.senderName || 'Chat',
        userPhoto: data.senderPhoto || data.userPhoto || '',
        matchId:   data.matchId,
      } as any);
    } else if (data?.type === 'match') {
      navigation.navigate('Discovery');
    }
  }, [stopRingtone, dismissModal, navigation]);

  useEffect(() => {
    if (!coldStartHandledRef.current) {
      coldStartHandledRef.current = true;
      Notifications.getLastNotificationResponseAsync().then((response) => {
        if (response) handleNotificationResponse(response);
      });
    }

    const unsubscribe = setupNotificationListeners(
      () => {},
      handleNotificationResponse,
    );
    return unsubscribe;
  }, [handleNotificationResponse]);

  /* ── Accept (in-app button) ── */
  const handleAccept = useCallback(async () => {
    const call = incomingCallRef.current;
    if (!call) return;
    await stopRingtone();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    socketService.acceptCall({
      callerId: call.callerId,
      callData: call.callData,
    });

    setCallActive(call.callerId);

    setIsVisible(false);

    const callTypeFromData = call.callData?.callType === 'video' ? 'video' : 'voice';
    setActiveCall({
      userId:      call.callerId,
      userName:    call.callerInfo?.name || 'Unknown',
      userPhoto:   call.callerInfo?.photo,
      isIncoming:  true,
      callStatus:  'connected',
      callType:    callTypeFromData,
      duration:    0,
    });

    navigation.navigate(callTypeFromData === 'video' ? 'VideoCall' : 'VoiceCall', {
      userId:       call.callerId,
      userName:     call.callerInfo?.name || 'Unknown',
      userPhoto:    call.callerInfo?.photo || '',
      isIncoming:   true,
      callData:     call.callData,
      callerId:     call.callerId,
      callAccepted: true,
    });

    setIncomingCall(null);
  }, [stopRingtone, setActiveCall, navigation]);

  /* ── Decline (in-app button) ── */
  const handleDecline = useCallback(async () => {
    const call = incomingCallRef.current;
    if (!call) return;
    await stopRingtone();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    endCallKeepCall(call.callerId);

    socketService.declineCall({ callerId: call.callerId });
    dismissModal();
  }, [stopRingtone, dismissModal]);

  if (!isVisible || !incomingCall) return null;

  const callType   = incomingCall.callData?.callType || 'voice';
  const isVideo    = callType === 'video';
  const callerName = incomingCall.callerInfo?.name || 'Unknown';

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDecline}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
        <Animated.View
          style={[
            styles.card,
            { marginTop: insets.top + 8, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <LinearGradient
            colors={['#16213e', '#0f3460', '#1a1a2e']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            <View style={styles.headerPill}>
              <Ionicons
                name={isVideo ? 'videocam' : 'call'}
                size={11}
                color="#a78bfa"
              />
              <ThemedText style={styles.headerPillText}>
                Incoming {isVideo ? 'Video' : 'Voice'} Call
              </ThemedText>
            </View>

            <View style={styles.callerRow}>
              <Animated.View style={[styles.avatarWrap, { transform: [{ scale: pulseAnim }] }]}>
                <SafeImage
                  source={{ uri: incomingCall.callerInfo?.photo || 'https://via.placeholder.com/80' }}
                  style={styles.avatar}
                />
                <View style={styles.liveIndicator} />
              </Animated.View>

              <View style={styles.callerText}>
                <ThemedText style={styles.callerName} numberOfLines={1}>
                  {callerName}
                </ThemedText>
                <ThemedText style={styles.callerSubtext}>
                  {isVideo ? '📹 Wants to video call…' : '📞 Wants to voice call…'}
                </ThemedText>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.actions}>
              <View style={styles.actionWrap}>
                <Pressable style={styles.declineBtn} onPress={handleDecline}>
                  <Ionicons
                    name="call"
                    size={26}
                    color="#FFF"
                    style={{ transform: [{ rotate: '135deg' }] }}
                  />
                </Pressable>
                <ThemedText style={styles.actionLabel}>Decline</ThemedText>
              </View>

              <View style={styles.actionWrap}>
                <Pressable style={styles.acceptBtn} onPress={handleAccept}>
                  <Ionicons
                    name={isVideo ? 'videocam' : 'call'}
                    size={26}
                    color="#FFF"
                  />
                </Pressable>
                <ThemedText style={styles.actionLabel}>Accept</ThemedText>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-start',
    paddingHorizontal: 14,
  },
  card: {
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  gradient: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },

  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.3)',
    marginBottom: 16,
  },
  headerPillText: { fontSize: 12, color: '#a78bfa', fontWeight: '600' },

  callerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
  },
  liveIndicator: {
    position: 'absolute',
    bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#22c55e',
    borderWidth: 2, borderColor: '#16213e',
  },
  callerText: { flex: 1 },
  callerName: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  callerSubtext: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 3 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 18 },

  actions: { flexDirection: 'row', justifyContent: 'space-evenly' },
  actionWrap: { alignItems: 'center', gap: 8 },
  declineBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#dc2626',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#dc2626', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  acceptBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#16a34a',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#16a34a', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  actionLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
});

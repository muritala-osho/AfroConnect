import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, Dimensions, StatusBar, Platform, Alert } from 'react-native';
import { SafeImage } from '@/components/SafeImage';
import { ThemedText } from '@/components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import socketService from '@/services/socket';
import agoraService from '@/services/agoraService';
import { getApiBaseUrl } from '@/constants/config';
import { useCallContext, CallStatus } from '@/contexts/CallContext';
import WebView from 'react-native-webview';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CallData {
  channelName: string;
  token: string;
  appId: string;
  uid: number;
  callType: string;
  callerId: string;
  targetUserId: string;
}

export default function VideoCallScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    userId,
    userName,
    userPhoto,
    isIncoming,
    callData: incomingCallData,
    callerId,
    callAccepted,
    returnToCall,
  } = route.params || {};
  const { token: authToken, user } = useAuth();
  const { post, get } = useApi();
  const {
    setActiveCall,
    updateCallStatus,
    startGlobalTimer,
    stopGlobalTimer,
    minimizeCall,
    clearCall,
    activeCall,
  } = useCallContext();

  const [callStatus, setCallStatus] = useState<CallStatus>(
    callAccepted ? 'connected' : 'connecting'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callData, setCallData] = useState<CallData | null>(incomingCallData || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [remoteUserJoined, setRemoteUserJoined] = useState(false);
  const [webviewReady, setWebviewReady] = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const ringingTimeout = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const agoraJoined = useRef(false);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  const ringtoneRef = useRef<Audio.Sound | null>(null);
  const shouldRingRef = useRef(false);
  const callStatusRef = useRef<CallStatus>(callAccepted ? 'connected' : 'connecting');
  const pendingJoinRef = useRef<CallData | null>(null);

  /* ── helpers ── */
  const setStatus = useCallback((s: CallStatus) => {
    callStatusRef.current = s;
    setCallStatus(s);
    updateCallStatus(s);
  }, [updateCallStatus]);

  const stopRingtone = useCallback(async () => {
    shouldRingRef.current = false;
    try {
      if (ringtoneRef.current) {
        const s = ringtoneRef.current;
        ringtoneRef.current = null;
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      }
    } catch {}
  }, []);

  const playRingtone = useCallback(async () => {
    shouldRingRef.current = true;
    try {
      await stopRingtone();
      if (!shouldRingRef.current) return;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      if (!shouldRingRef.current) return;
      const source = isIncoming
        ? require('../assets/sounds/mixkit-waiting-ringtone-1354.wav')
        : require('../assets/sounds/phone-calling-1b.mp3');
      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
        isLooping: true,
        volume: 1.0,
      });
      if (!shouldRingRef.current) { await sound.unloadAsync().catch(() => {}); return; }
      ringtoneRef.current = sound;
    } catch (err) {
      console.log('Ringtone error:', err);
    }
  }, [isIncoming, stopRingtone]);

  /* ── WebView bridge ── */
  const sendToWebView = useCallback((msg: any) => {
    webViewRef.current?.postMessage(JSON.stringify(msg));
  }, []);

  /* ── Agora join ── */
  const doJoinAgora = useCallback(async (data: CallData) => {
    if (agoraJoined.current) return;
    agoraJoined.current = true;

    let joinToken = data.token;
    let joinUid = data.uid || 0;

    if (isIncoming && authToken) {
      try {
        const res = await get<{ token: string; uid: number }>(
          `/agora/token`,
          { channelName: data.channelName, uid: 0, role: 'publisher' },
          authToken
        );
        if (res.success && res.data?.token) {
          joinToken = res.data.token;
          joinUid = 0;
        }
      } catch {
        console.log('Receiver token fetch failed, using shared token');
      }
    }

    if (Platform.OS === 'web') {
      if (agoraService.isSupported()) {
        agoraService.setRemoteUserHandlers(
          (u: any) => {
            setRemoteUserJoined(true);
            if (u.videoTrack && remoteVideoRef.current) u.videoTrack.play(remoteVideoRef.current);
          },
          () => setRemoteUserJoined(false)
        );
        const { videoTrack } = await agoraService.joinVideoCall(data.appId, data.channelName, joinToken, joinUid);
        if (videoTrack && localVideoRef.current) videoTrack.play(localVideoRef.current);
      }
    } else {
      sendToWebView({
        action: 'join',
        appId: data.appId,
        channel: data.channelName,
        token: joinToken,
        uid: joinUid,
        callType: 'video',
      });
    }
  }, [isIncoming, authToken, get, sendToWebView]);

  /* ── Initiate outgoing call ── */
  const initiateCall = useCallback(async () => {
    if (!authToken || !userId) {
      setStatus('failed');
      setErrorMessage('Authentication required');
      return;
    }

    const isConnected = await socketService.ensureConnected(authToken || undefined);
    if (!isConnected) {
      setStatus('failed');
      setErrorMessage('Connection issue. Please check your internet and try again.');
      return;
    }

    try {
      setStatus('connecting');
      const response = await post<{ callData: CallData }>('/agora/call/initiate', {
        targetUserId: userId,
        callType: 'video',
      }, authToken);

      if (response.success && response.data?.callData) {
        const newCallData = response.data.callData;
        setCallData(newCallData);
        setStatus('ringing');

        const userPhotoVal = user?.photos?.[0];
        const photoUrl = typeof userPhotoVal === 'string' ? userPhotoVal : userPhotoVal?.url || '';
        socketService.initiateCall({
          targetUserId: userId,
          callData: newCallData,
          callerInfo: { name: user?.name || 'Unknown', photo: photoUrl, id: user?.id || '' },
        });

        ringingTimeout.current = setTimeout(() => {
          if (callStatusRef.current === 'ringing') {
            setStatus('missed');
            setErrorMessage('No answer');
            socketService.missedCall?.({ targetUserId: userId, callType: 'video' });
            clearCall();
            setTimeout(() => navigation.canGoBack() && navigation.goBack(), 2000);
          }
        }, 30000);
      } else {
        setStatus('failed');
        setErrorMessage(response.error || 'Failed to initiate call');
      }
    } catch (error: any) {
      setStatus('failed');
      setErrorMessage(error.message || 'Failed to connect');
    }
  }, [authToken, userId, post, user, navigation, setStatus, clearCall]);

  /* ── End call ── */
  const handleEndCall = useCallback(async (skipGoBack = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const wasConnected = callStatusRef.current === 'connected';
    const currentDuration = activeCall?.duration || 0;
    setStatus('ended');
    await stopRingtone();
    stopGlobalTimer();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);

    if (Platform.OS === 'web') agoraService.leave();
    else sendToWebView({ action: 'leave' });

    socketService.endCall({
      targetUserId: isIncoming ? callerId : userId,
      callType: 'video',
      duration: currentDuration,
      wasAnswered: wasConnected,
    });

    clearCall();
    if (!skipGoBack) {
      setTimeout(() => navigation.canGoBack() && navigation.goBack(), 500);
    }
  }, [callerId, userId, isIncoming, stopRingtone, stopGlobalTimer, clearCall, activeCall, navigation, sendToWebView, setStatus]);

  /* ── Minimize ── */
  const handleMinimize = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    minimizeCall();
    navigation.canGoBack() && navigation.goBack();
  }, [minimizeCall, navigation]);

  /* ── Main setup effect ── */
  useEffect(() => {
    requestCameraPermission();

    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    setActiveCall({
      userId: userId || callerId || '',
      userName: userName || 'Unknown',
      userPhoto,
      isIncoming: !!isIncoming,
      callStatus: callAccepted ? 'connected' : 'connecting',
      callType: 'video',
      duration: 0,
    });

    if (callAccepted) {
      setStatus('connected');
      startGlobalTimer();
      if (incomingCallData) {
        if (Platform.OS === 'web') doJoinAgora(incomingCallData);
        else pendingJoinRef.current = incomingCallData;
      }
    } else if (returnToCall) {
      setStatus('connected');
    } else if (isIncoming && incomingCallData) {
      setStatus('ringing');
    } else {
      initiateCall();
    }

    socketService.onCallAccepted(async () => {
      await stopRingtone();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setStatus('connected');
      startGlobalTimer();
      if (callData) doJoinAgora(callData);
    });

    socketService.onCallDeclined(async () => {
      await stopRingtone();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setStatus('declined');
      setErrorMessage('They declined the call');
      clearCall();
      setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1500);
    });

    socketService.onCallBusy(async () => {
      await stopRingtone();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setStatus('busy');
      setErrorMessage("They're on another call");
      clearCall();
      setTimeout(() => navigation.canGoBack() && navigation.goBack(), 2000);
    });

    socketService.onCallEnded(async () => {
      await stopRingtone();
      if (Platform.OS === 'web') agoraService.leave();
      else sendToWebView({ action: 'leave' });
      setStatus('ended');
      stopGlobalTimer();
      clearCall();
      setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1200);
    });

    return () => {
      stopRingtone();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      socketService.off('call:accepted');
      socketService.off('call:declined');
      socketService.off('call:busy');
      socketService.off('call:ended');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Ringtone ── */
  useEffect(() => {
    if (callStatus === 'ringing' && !isIncoming) playRingtone();
    else stopRingtone();
  }, [callStatus]);

  /* ── Pulse animation ── */
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (callStatus === 'ringing' || callStatus === 'connecting') {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      loop.start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
    return () => { if (loop) loop.stop(); };
  }, [callStatus]);

  /* ── Auto-hide controls ── */
  useEffect(() => {
    if (callStatus === 'connected') {
      const t = setTimeout(() => setShowControls(false), 5000);
      return () => clearTimeout(t);
    }
  }, [callStatus, showControls]);

  /* ── Join Agora when connected ── */
  useEffect(() => {
    if (callStatus === 'connected' && callData && !agoraJoined.current) {
      if (Platform.OS === 'web' || webviewReady) {
        doJoinAgora(callData);
      } else {
        pendingJoinRef.current = callData;
      }
    }
  }, [callStatus, callData, webviewReady]);

  /* ── WebView ready ── */
  useEffect(() => {
    if (webviewReady && pendingJoinRef.current) {
      doJoinAgora(pendingJoinRef.current);
      pendingJoinRef.current = null;
    }
  }, [webviewReady]);

  /* ── Mute sync ── */
  useEffect(() => {
    if (!agoraJoined.current) return;
    if (Platform.OS === 'web') agoraService.toggleMute(isMuted);
    else sendToWebView({ action: 'mute', muted: isMuted });
  }, [isMuted]);

  /* ── Camera sync ── */
  useEffect(() => {
    if (!agoraJoined.current) return;
    if (Platform.OS === 'web') agoraService.toggleCamera(isCameraOff);
    else sendToWebView({ action: 'camera', off: isCameraOff });
  }, [isCameraOff]);

  /* ── Free-tier 5-min limit ── */
  useEffect(() => {
    const duration = activeCall?.duration || 0;
    const isPremium = user?.premium?.isActive;
    if (isPremium || callStatus !== 'connected') return;
    if (duration === 240) {
      Alert.alert(
        '1 Minute Remaining',
        'Free video calls are limited to 5 minutes. Upgrade to Premium for unlimited call time.',
        [{ text: 'OK' }]
      );
    }
    if (duration >= 300) handleEndCall();
  }, [activeCall?.duration, callStatus, user]);

  const duration = activeCall?.duration || 0;

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'idle':
      case 'initializing':  return 'Initializing…';
      case 'connecting':    return 'Connecting…';
      case 'ringing':       return isIncoming ? 'Incoming video call…' : 'Ringing…';
      case 'connected':     return formatDuration(duration);
      case 'ended':         return 'Call ended';
      case 'declined':      return errorMessage || 'Call declined';
      case 'busy':          return errorMessage || 'Line busy';
      case 'missed':        return errorMessage || 'No answer';
      case 'failed':        return errorMessage || 'Call failed';
      default:              return '';
    }
  };

  const handleAcceptCall = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    stopRingtone();
    socketService.acceptCall({ callerId, callData: incomingCallData });
    setStatus('connected');
    startGlobalTimer();
  };

  const handleDeclineCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setStatus('declined');
    await stopRingtone();
    try {
      if (authToken && isIncoming) {
        await post('/call/decline', { callerId, type: 'video' }, authToken);
      }
    } catch {}
    socketService.declineCall({ callerId, callType: 'video' });
    clearCall();
    setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1500);
  }, [callerId, navigation, stopRingtone, clearCall, authToken, isIncoming, post, setStatus]);

  const toggleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(p => !p);
  };

  const toggleCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCameraOff(p => !p);
  };

  const toggleSpeaker = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: !next,
      });
    } catch {}
  }, [isSpeakerOn]);

  const flipCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFrontCamera(p => !p);
    if (agoraJoined.current) {
      if (Platform.OS === 'web') agoraService.switchCamera?.();
      else sendToWebView({ action: 'switch-camera' });
    }
  };

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'remote-user-joined' || data.type === 'remote-video-started') {
        setRemoteUserJoined(true);
      } else if (data.type === 'remote-user-left' || data.type === 'remote-video-stopped') {
        setRemoteUserJoined(false);
      }
    } catch {}
  }, []);

  const agoraCallUrl = `${getApiBaseUrl()}/public/agora-call.html`;

  const renderNativeCallView = () => (
    <>
      <SafeImage
        source={{ uri: userPhoto || 'https://via.placeholder.com/400' }}
        style={styles.remoteVideo}
        contentFit="cover"
      />
      {callStatus === 'connected' && (
        <WebView
          ref={webViewRef}
          source={{ uri: agoraCallUrl }}
          style={StyleSheet.absoluteFillObject}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleWebViewMessage}
          onPermissionRequest={(request) => request.grant(request.resources)}
          onLoad={() => setWebviewReady(true)}
        />
      )}
    </>
  );

  const renderWebCallView = () => {
    if (remoteUserJoined) {
      return (
        <View style={styles.remoteVideo}>
          <div ref={remoteVideoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' as any }} />
        </View>
      );
    }
    return (
      <SafeImage
        source={{ uri: userPhoto || 'https://via.placeholder.com/400' }}
        style={styles.remoteVideo}
        contentFit="cover"
      />
    );
  };

  const renderLocalVideo = () => {
    if (Platform.OS === 'web' && agoraJoined.current && !isCameraOff) {
      return (
        <View style={styles.selfVideo}>
          <div ref={localVideoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' as any, borderRadius: 20 }} />
        </View>
      );
    }
    if (callStatus === 'connected' && Platform.OS !== 'web') return null;
    if (isCameraOff) {
      return (
        <View style={styles.cameraOffPlaceholder}>
          <Ionicons name="videocam-off" size={28} color="rgba(255,255,255,0.6)" />
          <ThemedText style={styles.cameraOffText}>Camera Off</ThemedText>
        </View>
      );
    }
    if (cameraPermission?.granted && Platform.OS !== 'web') {
      return <CameraView style={styles.selfVideo} facing={isFrontCamera ? 'front' : 'back'} />;
    }
    return (
      <Pressable style={styles.selfVideo} onPress={requestCameraPermission}>
        <LinearGradient colors={['#1a2a3a', '#0a0a0a']} style={styles.selfVideoPermissionPlaceholder}>
          <Ionicons name="videocam-outline" size={28} color="rgba(255,255,255,0.55)" />
          <ThemedText style={styles.cameraOffText}>Tap to enable</ThemedText>
        </LinearGradient>
      </Pressable>
    );
  };

  const isTerminal = callStatus === 'busy' || callStatus === 'missed' || callStatus === 'declined' || callStatus === 'ended' || callStatus === 'failed';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Remote video / placeholder */}
      {Platform.OS === 'web' ? renderWebCallView() : renderNativeCallView()}

      {/* Top gradient fade */}
      <LinearGradient
        colors={['rgba(0,0,0,0.80)', 'rgba(0,0,0,0.25)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />
      {/* Bottom gradient fade */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.88)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Tap to toggle controls */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowControls(v => !v)} />

      {/* ── TOP BAR ── */}
      <Animated.View
        pointerEvents={showControls ? 'auto' : 'none'}
        style={[styles.topBar, { paddingTop: insets.top + 14, opacity: showControls ? 1 : 0 }]}
      >
        <View style={styles.headerRow}>
          {callStatus === 'connected' && (
            <Pressable style={styles.minimizeBtn} onPress={handleMinimize} hitSlop={10}>
              <Ionicons name="chevron-down" size={20} color="#fff" />
            </Pressable>
          )}
          <View style={styles.callInfo}>
            <ThemedText style={styles.callerName} numberOfLines={1}>{userName || 'Unknown'}</ThemedText>
            <ThemedText style={[styles.callStatusText, isTerminal && styles.errorText]}>
              {getStatusText()}
            </ThemedText>
          </View>
          {callStatus === 'connected' && (
            <View style={styles.secureBadge}>
              <Ionicons name="lock-closed" size={11} color="#10B981" />
              <ThemedText style={styles.secureText}>Secure</ThemedText>
            </View>
          )}
        </View>
      </Animated.View>

      {/* ── Self-video PIP ── */}
      {!isTerminal && (
        <View style={[styles.pip, { top: insets.top + 80 }]}>
          {renderLocalVideo()}
          <View style={styles.pipLabel}>
            <ThemedText style={styles.pipLabelText}>You</ThemedText>
          </View>
          <Pressable style={styles.flipBtn} onPress={flipCamera} hitSlop={8}>
            <Ionicons name="camera-reverse" size={15} color="#FFF" />
          </Pressable>
        </View>
      )}

      {/* ── Pre-connect center state ── */}
      {callStatus !== 'connected' && (
        <View style={styles.centerState}>
          {isTerminal ? (
            <View style={styles.terminalAvatar}>
              <SafeImage
                source={{ uri: userPhoto || 'https://via.placeholder.com/150' }}
                style={styles.terminalAvatarImg}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)']}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.terminalIconOverlay}>
                {callStatus === 'failed'   && <Ionicons name="alert-circle" size={40} color="#FF3B30" />}
                {callStatus === 'busy'     && <MaterialCommunityIcons name="phone-off" size={40} color="#FF3B30" />}
                {callStatus === 'missed'   && <Ionicons name="call" size={40} color="#FF9500" style={{ transform: [{ rotate: '135deg' }] }} />}
                {callStatus === 'declined' && <MaterialCommunityIcons name="phone-cancel" size={40} color="#FF3B30" />}
                {callStatus === 'ended'    && <Ionicons name="checkmark-circle" size={40} color="#10B981" />}
              </View>
            </View>
          ) : (
            <View style={styles.preConnectAvatar}>
              <Animated.View style={[styles.preConnectRing, { transform: [{ scale: pulseAnim }] }]} />
              <SafeImage
                source={{ uri: userPhoto || 'https://via.placeholder.com/150' }}
                style={styles.preConnectAvatarImg}
              />
            </View>
          )}
          <ThemedText style={[styles.centerStatusText, isTerminal && styles.errorText]}>
            {getStatusText()}
          </ThemedText>
          {(callStatus === 'ringing' || callStatus === 'connecting') && (
            <View style={styles.encryptRow}>
              <Ionicons name="lock-closed" size={10} color="rgba(255,255,255,0.5)" />
              <ThemedText style={styles.encryptText}>End-to-end encrypted</ThemedText>
            </View>
          )}
        </View>
      )}

      {/* ── INCOMING CALL BUTTONS ── */}
      {isIncoming && callStatus === 'ringing' && (
        <View style={[styles.incomingControls, { paddingBottom: insets.bottom + 44 }]}>
          <View style={styles.incomingBtn}>
            <Pressable style={styles.declineCircle} onPress={handleDeclineCall}>
              <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
            <ThemedText style={styles.callBtnLabel}>Decline</ThemedText>
          </View>
          <View style={styles.incomingBtn}>
            <Pressable style={styles.acceptCircle} onPress={handleAcceptCall}>
              <Ionicons name="videocam" size={30} color="#FFF" />
            </Pressable>
            <ThemedText style={styles.callBtnLabel}>Accept</ThemedText>
          </View>
        </View>
      )}

      {/* ── TERMINAL: close ── */}
      {isTerminal && (
        <View style={[styles.terminalFooter, { paddingBottom: insets.bottom + 44 }]}>
          <Pressable style={styles.closeCircle} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={30} color="#FFF" />
          </Pressable>
        </View>
      )}

      {/* ── ACTIVE CALL CONTROLS ── */}
      {!isTerminal && !(isIncoming && callStatus === 'ringing') && (
        <Animated.View
          pointerEvents={showControls ? 'auto' : 'none'}
          style={[styles.controlsPanel, { paddingBottom: insets.bottom + 28, opacity: showControls ? 1 : 0 }]}
        >
          <View style={styles.glassCard}>
            <View style={styles.controlsRow}>
              <View style={styles.ctrlItem}>
                <Pressable style={[styles.ctrlBtn, isCameraOff && styles.ctrlBtnOn]} onPress={toggleCamera}>
                  <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={22} color={isCameraOff ? '#000' : '#FFF'} />
                </Pressable>
                <ThemedText style={styles.ctrlLabel}>{isCameraOff ? 'Show' : 'Camera'}</ThemedText>
              </View>
              <View style={styles.ctrlItem}>
                <Pressable style={[styles.ctrlBtn, isMuted && styles.ctrlBtnOn]} onPress={toggleMute}>
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color={isMuted ? '#000' : '#FFF'} />
                </Pressable>
                <ThemedText style={styles.ctrlLabel}>{isMuted ? 'Unmute' : 'Mute'}</ThemedText>
              </View>
              <View style={styles.ctrlItem}>
                <Pressable style={[styles.ctrlBtn, isSpeakerOn && styles.ctrlBtnOn]} onPress={toggleSpeaker}>
                  <Ionicons name={isSpeakerOn ? 'volume-high' : 'ear'} size={22} color={isSpeakerOn ? '#000' : '#FFF'} />
                </Pressable>
                <ThemedText style={styles.ctrlLabel}>{isSpeakerOn ? 'Earpiece' : 'Speaker'}</ThemedText>
              </View>
              <View style={styles.ctrlItem}>
                <Pressable style={styles.ctrlBtn} onPress={flipCamera}>
                  <Ionicons name="camera-reverse" size={22} color="#FFF" />
                </Pressable>
                <ThemedText style={styles.ctrlLabel}>Flip</ThemedText>
              </View>
            </View>
            <Pressable style={styles.endCallBtn} onPress={() => handleEndCall()}>
              <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  remoteVideo: { ...StyleSheet.absoluteFillObject as any },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 180, zIndex: 2 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 260, zIndex: 2 },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 16 },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(12,12,12,0.6)',
    borderRadius: 22, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  minimizeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  callInfo: { flex: 1 },
  callerName: { fontSize: 18, fontWeight: '700', color: '#FFF', letterSpacing: 0.2 },
  callStatusText: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 1, fontWeight: '500' },
  errorText: { color: '#FF3B30' },
  secureBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
  },
  secureText: { fontSize: 11, color: '#10B981', fontWeight: '600' },

  pip: {
    position: 'absolute', right: 14, zIndex: 30,
    width: 114, height: 160, borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6, shadowRadius: 18, elevation: 20,
  },
  selfVideo: {
    width: '100%', height: '100%',
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  selfVideoPermissionPlaceholder: {
    width: '100%', height: '100%', borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  cameraOffPlaceholder: {
    width: '100%', height: '100%', borderRadius: 18,
    backgroundColor: 'rgba(20,20,20,0.95)',
    alignItems: 'center', justifyContent: 'center',
  },
  cameraOffText: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 6, fontWeight: '500' },
  pipLabel: {
    position: 'absolute', top: 7, left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 7,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  pipLabelText: { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  flipBtn: {
    position: 'absolute', bottom: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },

  centerState: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 5,
  },
  preConnectAvatar: { alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  preConnectRing: {
    position: 'absolute',
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  preConnectAvatarImg: {
    width: 144, height: 144, borderRadius: 72,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.4)',
  },
  terminalAvatar: {
    width: 148, height: 148, borderRadius: 74, overflow: 'hidden',
    marginBottom: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.2)',
  },
  terminalAvatarImg: { width: '100%', height: '100%' },
  terminalIconOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  centerStatusText: {
    fontSize: 20, color: '#FFF', fontWeight: '700', letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  encryptRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  encryptText: { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },

  incomingControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 64, zIndex: 20,
  },
  incomingBtn: { alignItems: 'center', gap: 12 },
  declineCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  acceptCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#34C759', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  callBtnLabel: { color: '#FFF', fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },

  terminalFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', zIndex: 20,
  },
  closeCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(50,50,50,0.88)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },

  controlsPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', zIndex: 20, paddingHorizontal: 16,
  },
  glassCard: {
    width: '100%', alignItems: 'center', gap: 18,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20,
    backgroundColor: 'rgba(10,10,10,0.82)',
    borderRadius: 34, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 16,
  },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 8 },
  ctrlItem: { flex: 1, alignItems: 'center', gap: 7 },
  ctrlBtn: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  ctrlBtnOn: { backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.1)' },
  ctrlLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.65)',
    fontWeight: '500', letterSpacing: 0.2, textAlign: 'center',
  },
  endCallBtn: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 10,
  },
  overlay: { ...StyleSheet.absoluteFillObject as any },
});

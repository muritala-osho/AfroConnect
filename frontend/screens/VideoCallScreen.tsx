import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { SafeImage } from '@/components/SafeImage';
import { ThemedText } from '@/components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

const { width: SW, height: SH } = Dimensions.get('window');

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
  const insets      = useSafeAreaInsets();
  const navigation  = useNavigation<any>();
  const route       = useRoute<any>();

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

  /* â”€â”€ State â”€â”€ */
  const [callStatus, setCallStatus]         = useState<CallStatus>(callAccepted ? 'connected' : 'connecting');
  const [isMuted, setIsMuted]               = useState(false);
  const [isCameraOff, setIsCameraOff]       = useState(false);
  const [isFrontCamera, setIsFrontCamera]   = useState(true);
  const [isSpeakerOn, setIsSpeakerOn]       = useState(true);
  const [callData, setCallData]             = useState<CallData | null>(incomingCallData || null);
  const [errorMessage, setErrorMessage]     = useState<string | null>(null);
  const [showControls, setShowControls]     = useState(true);
  const [remoteUserJoined, setRemoteUserJoined] = useState(false);
  const [webviewReady, setWebviewReady]     = useState(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  /* â”€â”€ Animated values â”€â”€ */
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  /* â”€â”€ Refs â”€â”€ */
  const ringingTimeout   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agoraJoined      = useRef(false);
  const remoteVideoRef   = useRef<HTMLDivElement | null>(null);
  const localVideoRef    = useRef<HTMLDivElement | null>(null);
  const webViewRef       = useRef<WebView | null>(null);
  const ringtoneRef      = useRef<Audio.Sound | null>(null);
  const shouldRingRef    = useRef(false);
  const callStatusRef    = useRef<CallStatus>(callAccepted ? 'connected' : 'connecting');
  const pendingJoinRef   = useRef<CallData | null>(null);

  /* â”€â”€ Derived â”€â”€ */
  const duration = activeCall?.duration || 0;

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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

  /* â”€â”€ WebView bridge â”€â”€ */
  const sendToWebView = useCallback((msg: any) => {
    webViewRef.current?.postMessage(JSON.stringify(msg));
  }, []);

  /* â”€â”€ Agora join â”€â”€ */
  const doJoinAgora = useCallback(async (data: CallData) => {
    if (agoraJoined.current) return;
    agoraJoined.current = true;

    let joinToken = data.token;
    let joinUid   = data.uid || 0;

    if (isIncoming && authToken) {
      try {
        const res = await get<{ token: string; uid: number }>(
          `/agora/token`,
          { channelName: data.channelName, uid: 0, role: 'publisher' },
          authToken
        );
        if (res.success && res.data?.token) {
          joinToken = res.data.token;
          joinUid   = 0;
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

  /* â”€â”€ Initiate outgoing call â”€â”€ */
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

  /* â”€â”€ End call â”€â”€ */
  const handleEndCall = useCallback(async (skipGoBack = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const wasConnected    = callStatusRef.current === 'connected';
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

  /* â”€â”€ Minimize â”€â”€ */
  const handleMinimize = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    minimizeCall();
    navigation.canGoBack() && navigation.goBack();
  }, [minimizeCall, navigation]);

  /* â”€â”€ Main setup effect â”€â”€ */
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

  /* â”€â”€ Ringtone on status change â”€â”€ */
  useEffect(() => {
    if (callStatus === 'ringing' && !isIncoming) playRingtone();
    else stopRingtone();
  }, [callStatus]);

  /* â”€â”€ Pulse animation when waiting â”€â”€ */
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

  /* â”€â”€ Auto-hide controls when connected â”€â”€ */
  useEffect(() => {
    if (callStatus === 'connected') {
      const t = setTimeout(() => {
        Animated.timing(controlsOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
          setShowControls(false);
        });
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [callStatus, showControls]);

  /* â”€â”€ Show controls on tap â”€â”€ */
  const handleScreenTap = useCallback(() => {
    if (callStatus !== 'connected') return;
    setShowControls(true);
    Animated.timing(controlsOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  }, [callStatus]);

  /* â”€â”€ Join Agora when connected â”€â”€ */
  useEffect(() => {
    if (callStatus === 'connected' && callData && !agoraJoined.current) {
      if (Platform.OS === 'web' || webviewReady) doJoinAgora(callData);
      else pendingJoinRef.current = callData;
    }
  }, [callStatus, callData, webviewReady]);

  /* â”€â”€ WebView ready â”€â”€ */
  useEffect(() => {
    if (webviewReady && pendingJoinRef.current) {
      doJoinAgora(pendingJoinRef.current);
      pendingJoinRef.current = null;
    }
  }, [webviewReady]);

  /* â”€â”€ Mute sync â”€â”€ */
  useEffect(() => {
    if (!agoraJoined.current) return;
    if (Platform.OS === 'web') agoraService.toggleMute(isMuted);
    else sendToWebView({ action: 'mute', muted: isMuted });
  }, [isMuted]);

  /* â”€â”€ Camera sync â”€â”€ */
  useEffect(() => {
    if (!agoraJoined.current) return;
    if (Platform.OS === 'web') agoraService.toggleCamera(isCameraOff);
    else sendToWebView({ action: 'camera', off: isCameraOff });
  }, [isCameraOff]);

  /* â”€â”€ Free-tier 5-min limit â”€â”€ */
  useEffect(() => {
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
  }, [duration, callStatus, user]);

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const formatDuration = (s: number) => {
    const m   = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const getStatusText = (): string => {
    switch (callStatus) {
      case 'connecting':  return 'Connectingâ€¦';
      case 'ringing':     return isIncoming ? 'Incoming video call' : 'Ringingâ€¦';
      case 'connected':   return formatDuration(duration);
      case 'ended':       return 'Call ended';
      case 'declined':    return errorMessage || 'Call declined';
      case 'busy':        return errorMessage || 'Line busy';
      case 'missed':      return errorMessage || 'No answer';
      case 'failed':      return errorMessage || 'Call failed';
      default:            return '';
    }
  };

  /* â”€â”€ Accept / Decline â”€â”€ */
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

  /* â”€â”€ Control actions â”€â”€ */
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

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Video Renders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const agoraCallUrl = `${getApiBaseUrl()}/public/agora-call.html`;

  // Remote video background (native path)
  const renderNativeBackground = () => (
    <>
      <SafeImage
        source={{ uri: userPhoto || 'https://via.placeholder.com/400' }}
        style={StyleSheet.absoluteFillObject as any}
        contentFit="cover"
      />
      {callStatus === 'connected' && (
        <WebView
          ref={webViewRef}
          source={{ uri: agoraCallUrl }}
          style={StyleSheet.absoluteFillObject as any}
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

  // Remote video background (web path)
  const renderWebBackground = () => {
    if (remoteUserJoined) {
      return (
        <View style={StyleSheet.absoluteFillObject as any}>
          <div ref={remoteVideoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' as any }} />
        </View>
      );
    }
    return (
      <SafeImage
        source={{ uri: userPhoto || 'https://via.placeholder.com/400' }}
        style={StyleSheet.absoluteFillObject as any}
        contentFit="cover"
      />
    );
  };

  // Self-view PIP
  const renderLocalVideo = () => {
    if (isCameraOff) {
      return (
        <View style={s.pipPlaceholder}>
          <Ionicons name="videocam-off" size={22} color="rgba(255,255,255,0.6)" />
        </View>
      );
    }
    if (Platform.OS === 'web' && agoraJoined.current) {
      return (
        <View style={{ flex: 1 }}>
          <div ref={localVideoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' as any, borderRadius: 16 }} />
        </View>
      );
    }
    if (cameraPermission?.granted && Platform.OS !== 'web') {
      return <CameraView style={{ flex: 1 }} facing={isFrontCamera ? 'front' : 'back'} />;
    }
    return (
      <Pressable style={s.pipPlaceholder} onPress={requestCameraPermission}>
        <Ionicons name="videocam-outline" size={22} color="rgba(255,255,255,0.55)" />
        <ThemedText style={s.pipPlaceholderText}>Tap to enable</ThemedText>
      </Pressable>
    );
  };

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Derived booleans â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const isTerminal     = ['busy', 'missed', 'declined', 'ended', 'failed'].includes(callStatus);
  const isWaiting      = callStatus === 'ringing' || callStatus === 'connecting';
  const showIncoming   = isIncoming && callStatus === 'ringing';
  const isConnected    = callStatus === 'connected';

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Remote video / placeholder fills screen */}
      {Platform.OS === 'web' ? renderWebBackground() : renderNativeBackground()}

      {/* Dark gradient overlays for readability */}
      <LinearGradient
        colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.15)', 'transparent']}
        style={s.topGradient}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.85)']}
        style={s.bottomGradient}
        pointerEvents="none"
      />

      {/* Tappable overlay to show/hide controls when connected */}
      <Pressable style={StyleSheet.absoluteFill} onPress={handleScreenTap} />

      {/* â”€â”€ PRE-CONNECT OVERLAY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
          Shown when not yet connected (ringing, connecting, terminal).
          Blurs the background and centers the caller card. â”€â”€ */}
      {!isConnected && (
        <View style={s.preConnectOverlay}>
          {/* Blurred bg tint */}
          <LinearGradient
            colors={['rgba(10,4,30,0.88)', 'rgba(30,8,60,0.82)', 'rgba(10,4,30,0.92)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Caller card */}
          <View style={s.callerCard}>
            {/* Avatar with pulse */}
            <View style={s.avatarArea}>
              {isWaiting && (
                <>
                  <Animated.View style={[s.ring2, { transform: [{ scale: pulseAnim }] }]} />
                  <Animated.View style={[s.ring1, { transform: [{ scale: pulseAnim }] }]} />
                </>
              )}
              <View style={[s.avatarFrame, isTerminal && s.avatarFrameTerminal]}>
                <SafeImage
                  source={{ uri: userPhoto || 'https://via.placeholder.com/150' }}
                  style={{ width: '100%', height: '100%' }}
                />
                {/* Terminal state icon overlay */}
                {isTerminal && (
                  <View style={s.terminalIconOverlay}>
                    {callStatus === 'failed'    && <Ionicons name="alert-circle"     size={36} color="#FF3B30" />}
                    {callStatus === 'busy'      && <Ionicons name="call"             size={36} color="#FF3B30" style={{ transform: [{ rotate: '135deg' }] }} />}
                    {callStatus === 'missed'    && <Ionicons name="call"             size={36} color="#FF9500" style={{ transform: [{ rotate: '135deg' }] }} />}
                    {callStatus === 'declined'  && <Ionicons name="close-circle"    size={36} color="#FF3B30" />}
                    {callStatus === 'ended'     && <Ionicons name="checkmark-circle" size={36} color="#10B981" />}
                  </View>
                )}
              </View>
            </View>

            {/* Name */}
            <ThemedText style={s.callerName} numberOfLines={1}>
              {userName || 'Unknown'}
            </ThemedText>

            {/* Status */}
            <ThemedText style={[s.callerStatus, isTerminal && s.callerStatusError]}>
              {getStatusText()}
            </ThemedText>

            {/* E2E badge */}
            {isWaiting && (
              <View style={s.encryptBadge}>
                <Ionicons name="lock-closed" size={10} color="rgba(196,181,253,0.7)" />
                <ThemedText style={s.encryptText}>End-to-end encrypted</ThemedText>
              </View>
            )}
          </View>
        </View>
      )}

      {/* â”€â”€ SELF-VIEW PIP â€” shown when not terminal â”€â”€ */}
      {!isTerminal && (
        <View style={[s.pip, { top: insets.top + 76 }]}>
          {renderLocalVideo()}
          <View style={s.pipLabel}>
            <ThemedText style={s.pipLabelText}>You</ThemedText>
          </View>
          {/* Flip camera button */}
          <Pressable style={s.pipFlipBtn} onPress={flipCamera} hitSlop={8}>
            <Ionicons name="camera-reverse" size={15} color="#FFF" />
          </Pressable>
        </View>
      )}

      {/* â”€â”€ TOP BAR: caller info + minimize â”€â”€ */}
      <Animated.View
        pointerEvents={showControls || !isConnected ? 'auto' : 'none'}
        style={[
          s.topBar,
          { paddingTop: insets.top + 14 },
          isConnected && { opacity: controlsOpacity },
        ]}
      >
        <View style={s.headerRow}>
          {isConnected && (
            <Pressable style={s.minimizeBtn} onPress={handleMinimize} hitSlop={10}>
              <Ionicons name="chevron-down" size={20} color="#fff" />
            </Pressable>
          )}
          <View style={s.headerInfo}>
            <ThemedText style={s.headerName} numberOfLines={1}>{userName || 'Unknown'}</ThemedText>
            {isConnected && (
              <ThemedText style={s.headerTimer}>{getStatusText()}</ThemedText>
            )}
          </View>
          {isConnected && (
            <View style={s.secureBadge}>
              <Ionicons name="lock-closed" size={11} color="#10B981" />
              <ThemedText style={s.secureText}>Secure</ThemedText>
            </View>
          )}
        </View>
      </Animated.View>

      {/* â”€â”€ INCOMING CALL: Accept / Decline â”€â”€ */}
      {showIncoming && (
        <View style={[s.incomingControls, { paddingBottom: insets.bottom + 48 }]}>
          <View style={s.incomingBtn}>
            <Pressable style={s.declineCircle} onPress={handleDeclineCall}>
              <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
            <ThemedText style={s.incomingBtnLabel}>Decline</ThemedText>
          </View>
          <View style={s.incomingBtn}>
            <Pressable style={s.acceptCircle} onPress={handleAcceptCall}>
              <Ionicons name="videocam" size={28} color="#FFF" />
            </Pressable>
            <ThemedText style={s.incomingBtnLabel}>Accept</ThemedText>
          </View>
        </View>
      )}

      {/* â”€â”€ TERMINAL: Close button â”€â”€ */}
      {isTerminal && (
        <View style={[s.terminalFooter, { paddingBottom: insets.bottom + 48 }]}>
          <Pressable style={s.closeCircle} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={30} color="#FFF" />
          </Pressable>
        </View>
      )}

      {/* â”€â”€ ACTIVE CALL CONTROLS â”€â”€ */}
      {!isTerminal && !showIncoming && (
        <Animated.View
          pointerEvents={showControls ? 'auto' : 'none'}
          style={[
            s.controlsPanel,
            { paddingBottom: insets.bottom + 28 },
            isConnected && { opacity: controlsOpacity },
          ]}
        >
          <View style={s.glassCard}>
            {/* Secondary controls */}
            <View style={s.controlsRow}>
              {/* Camera */}
              <View style={s.ctrlItem}>
                <Pressable style={[s.ctrlBtn, isCameraOff && s.ctrlBtnActive]} onPress={toggleCamera}>
                  <Ionicons
                    name={isCameraOff ? 'videocam-off' : 'videocam'}
                    size={22}
                    color={isCameraOff ? '#000' : '#FFF'}
                  />
                </Pressable>
                <ThemedText style={s.ctrlLabel}>{isCameraOff ? 'Show' : 'Camera'}</ThemedText>
              </View>

              {/* Mute */}
              <View style={s.ctrlItem}>
                <Pressable style={[s.ctrlBtn, isMuted && s.ctrlBtnActive]} onPress={toggleMute}>
                  <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color={isMuted ? '#000' : '#FFF'} />
                </Pressable>
                <ThemedText style={s.ctrlLabel}>{isMuted ? 'Unmute' : 'Mute'}</ThemedText>
              </View>

              {/* Speaker */}
              <View style={s.ctrlItem}>
                <Pressable style={[s.ctrlBtn, isSpeakerOn && s.ctrlBtnActive]} onPress={toggleSpeaker}>
                  <Ionicons name={isSpeakerOn ? 'volume-high' : 'ear'} size={22} color={isSpeakerOn ? '#000' : '#FFF'} />
                </Pressable>
                <ThemedText style={s.ctrlLabel}>{isSpeakerOn ? 'Earpiece' : 'Speaker'}</ThemedText>
              </View>

              {/* Flip */}
              <View style={s.ctrlItem}>
                <Pressable style={s.ctrlBtn} onPress={flipCamera}>
                  <Ionicons name="camera-reverse" size={22} color="#FFF" />
                </Pressable>
                <ThemedText style={s.ctrlLabel}>Flip</ThemedText>
              </View>
            </View>

            {/* End Call */}
            <Pressable style={s.endCallBtn} onPress={() => handleEndCall()}>
              <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Styles
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const AVATAR_PRE = Math.min(SW * 0.38, 148);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  /* Gradient overlays */
  topGradient:    { position: 'absolute', top: 0, left: 0, right: 0, height: 180, zIndex: 2 },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 280, zIndex: 2 },

  /* Pre-connect full-screen overlay */
  preConnectOverlay: {
    ...StyleSheet.absoluteFillObject as any,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Caller card (shown while waiting) */
  callerCard: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 28,
  },
  avatarArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  ring2: {
    position: 'absolute',
    width: AVATAR_PRE + 66, height: AVATAR_PRE + 66,
    borderRadius: (AVATAR_PRE + 66) / 2,
    backgroundColor: 'rgba(109,40,217,0.08)',
    borderWidth: 1, borderColor: 'rgba(196,181,253,0.14)',
  },
  ring1: {
    position: 'absolute',
    width: AVATAR_PRE + 34, height: AVATAR_PRE + 34,
    borderRadius: (AVATAR_PRE + 34) / 2,
    backgroundColor: 'rgba(109,40,217,0.14)',
    borderWidth: 1.5, borderColor: 'rgba(196,181,253,0.26)',
  },
  avatarFrame: {
    width: AVATAR_PRE, height: AVATAR_PRE,
    borderRadius: AVATAR_PRE / 2,
    overflow: 'hidden',
    borderWidth: 3, borderColor: 'rgba(196,181,253,0.45)',
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65, shadowRadius: 22, elevation: 14,
  },
  avatarFrameTerminal: {
    borderColor: 'rgba(255,255,255,0.2)',
    shadowOpacity: 0.15,
  },
  terminalIconOverlay: {
    ...StyleSheet.absoluteFillObject as any,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callerName: {
    fontSize: 32, fontWeight: '800', color: '#FFF',
    letterSpacing: 0.2, textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  callerStatus: {
    fontSize: 15, color: 'rgba(255,255,255,0.55)',
    fontWeight: '500', letterSpacing: 0.6, textAlign: 'center',
  },
  callerStatusError: { color: '#FF3B30' },
  encryptBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  encryptText: { fontSize: 11, color: 'rgba(196,181,253,0.65)', fontWeight: '500' },

  /* Self-view PIP */
  pip: {
    position: 'absolute', right: 14, zIndex: 30,
    width: 110, height: 155,
    borderRadius: 18, overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6, shadowRadius: 18, elevation: 20,
  },
  pipPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(20,20,20,0.95)', gap: 6,
  },
  pipPlaceholderText: {
    color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: '500',
  },
  pipLabel: {
    position: 'absolute', top: 7, left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 7,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  pipLabelText: { color: '#FFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  pipFlipBtn: {
    position: 'absolute', bottom: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },

  /* Top bar */
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 20, paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(10,10,10,0.62)',
    borderRadius: 22, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
  },
  minimizeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '700', color: '#FFF', letterSpacing: 0.2 },
  headerTimer: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 1, fontWeight: '500' },
  secureBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)', borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.28)',
  },
  secureText: { fontSize: 11, color: '#10B981', fontWeight: '600' },

  /* Incoming call buttons */
  incomingControls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 64, zIndex: 20,
  },
  incomingBtn: { alignItems: 'center', gap: 12 },
  declineCircle: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  acceptCircle: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#34C759', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },
  incomingBtnLabel: { color: '#FFF', fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },

  /* Terminal close */
  terminalFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', zIndex: 20,
  },
  closeCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(50,50,50,0.88)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },

  /* Active call controls panel */
  controlsPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', zIndex: 20, paddingHorizontal: 16,
  },
  glassCard: {
    width: '100%', alignItems: 'center', gap: 18,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20,
    backgroundColor: 'rgba(8,8,8,0.84)',
    borderRadius: 34, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55, shadowRadius: 24, elevation: 16,
  },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 6 },
  ctrlItem: { flex: 1, alignItems: 'center', gap: 7 },
  ctrlBtn: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  ctrlBtnActive: { backgroundColor: '#FFFFFF', borderColor: 'rgba(0,0,0,0.1)' },
  ctrlLabel: {
    fontSize: 10, color: 'rgba(255,255,255,0.65)',
    fontWeight: '500', letterSpacing: 0.2, textAlign: 'center',
  },
  endCallBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#FF3B30', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF3B30', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 10,
  },
});
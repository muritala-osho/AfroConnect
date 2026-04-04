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
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { userId, userName, userPhoto, isIncoming, callData: incomingCallData, callerId, callAccepted } = route.params || {};
  const { token: authToken, user } = useAuth();
  const { post, get } = useApi();
 
  const [callStatus, setCallStatus] = useState<'idle' | 'initializing' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed' | 'declined' | 'busy' | 'missed'>('initializing');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callData, setCallData] = useState<CallData | null>(incomingCallData || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const ringingTimeout = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  const [showControls, setShowControls] = useState(true);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const agoraJoined = useRef(false);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const [remoteUserJoined, setRemoteUserJoined] = useState(false);
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  const [webviewReady, setWebviewReady] = useState(false);
  const ringtoneRef = useRef<Audio.Sound | null>(null);

  const playRingtone = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      const source = isIncoming
        ? require('../assets/sounds/mixkit-waiting-ringtone-1354.wav')
        : require('../assets/sounds/phone-calling-1b.mp3');

      const { sound } = await Audio.Sound.createAsync(
        source,
        { shouldPlay: true, isLooping: true, volume: 0.7 }
      );
      ringtoneRef.current = sound;
    } catch (err) {
      console.log('Ringtone error:', err);
    }
  }, [isIncoming]);

  const stopRingtone = useCallback(async () => {
    try {
      if (ringtoneRef.current) {
        await ringtoneRef.current.stopAsync();
        await ringtoneRef.current.unloadAsync();
        ringtoneRef.current = null;
      }
    } catch (err) {
      console.log('Stop ringtone error:', err);
    }
  }, []);

  const initiateCall = useCallback(async () => {
    if (!authToken || !userId) {
      setCallStatus('failed');
      setErrorMessage('Authentication required');
      return;
    }

    const isConnected = await socketService.ensureConnected(authToken || undefined);
    if (!isConnected) {
      setCallStatus('failed');
      setErrorMessage('Connection issue. Please check your internet and try again.');
      return;
    }

    try {
      setCallStatus('connecting');
     
      const response = await post<{ callData: CallData }>('/agora/call/initiate', {
        targetUserId: userId,
        callType: 'video',
      }, authToken);

      if (response.success && response.data?.callData) {
        const newCallData = response.data.callData;
        setCallData(newCallData);
        setCallStatus('ringing');
       
        const userPhotoVal = user?.photos?.[0];
        const photoUrl = typeof userPhotoVal === 'string' ? userPhotoVal : userPhotoVal?.url || '';
        socketService.initiateCall({
          targetUserId: userId,
          callData: newCallData,
          callerInfo: {
            name: user?.name || 'Unknown',
            photo: photoUrl,
            id: user?.id || ''
          }
        });
       
        ringingTimeout.current = setTimeout(() => {
          setCallStatus('missed');
          setErrorMessage('No answer');
          socketService.missedCall({ targetUserId: userId, callType: 'video' });
          setTimeout(() => navigation.goBack(), 2000);
        }, 30000);
      } else {
        setCallStatus('failed');
        setErrorMessage(response.error || 'Failed to initiate call');
      }
    } catch (error: any) {
      console.error('Call initiation error:', error);
      setCallStatus('failed');
      setErrorMessage(error.message || 'Failed to connect');
    }
  }, [authToken, userId, post, user]);

  useEffect(() => {
    requestCameraPermission();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    if (isIncoming && incomingCallData) {
      if (callAccepted) {
        setCallStatus('connected');
        durationInterval.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      } else {
        setCallStatus('ringing');
      }
    } else {
      initiateCall();
    }

    socketService.onCallAccepted((data) => {
      if (ringingTimeout.current) {
        clearTimeout(ringingTimeout.current);
      }
      stopRingtone();
      setCallStatus('connected');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      durationInterval.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    });

    socketService.onCallDeclined((data) => {
      if (ringingTimeout.current) {
        clearTimeout(ringingTimeout.current);
      }
      setCallStatus('declined');
      setErrorMessage('Call declined');
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
    });

    socketService.onCallEnded((data) => {
      stopRingtone();
      setCallStatus('ended');
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      setTimeout(() => {
        navigation.goBack();
      }, 1000);
    });

    socketService.onCallBusy(() => {
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setCallStatus('busy');
      setErrorMessage('User is busy');
      setTimeout(() => navigation.goBack(), 2500);
    });

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      if (ringingTimeout.current) {
        clearTimeout(ringingTimeout.current);
      }
      if (Platform.OS === 'web') {
        agoraService.leave();
      } else {
        sendToWebView({ action: 'leave' });
      }
      socketService.off('call:accepted');
      socketService.off('call:declined');
      socketService.off('call:ended');
      socketService.off('call:busy');
    };
  }, []);

  // Ringing tone effect
  useEffect(() => {
    if (callStatus === 'ringing' && !isIncoming) {
      playRingtone();
    } else {
      stopRingtone();
    }
    return () => { stopRingtone(); };
  }, [callStatus]);

  // Pulse animation for connecting/ringing states
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (callStatus === 'ringing' || callStatus === 'connecting') {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
        ])
      );
      loop.start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
    return () => { if (loop) loop.stop(); };
  }, [callStatus, pulseAnim]);

  const sendToWebView = useCallback((msg: any) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(msg));
    }
  }, []);

  const pendingJoinRef = useRef<CallData | null>(null);

  const doJoinAgora = useCallback(async (data: CallData) => {
    let joinToken = data.token;
    let joinUid = data.uid || 0;
    if (isIncoming && authToken) {
      try {
        const res = await get<{ token: string; uid: number }>(`/agora/token`, { channelName: data.channelName, uid: 0, role: 'publisher' }, authToken);
        if (res.success && res.data?.token) {
          joinToken = res.data.token;
          joinUid = 0;
        }
      } catch (e) {
        console.log('Failed to get receiver token, using shared token');
      }
    }

    if (Platform.OS === 'web') {
      if (agoraService.isSupported()) {
        agoraService.setRemoteUserHandlers(
          (user) => {
            setRemoteUserJoined(true);
            if (user.videoTrack && remoteVideoRef.current) {
              user.videoTrack.play(remoteVideoRef.current);
            }
          },
          () => { setRemoteUserJoined(false); }
        );
        const { videoTrack } = await agoraService.joinVideoCall(data.appId, data.channelName, joinToken, joinUid);
        if (videoTrack && localVideoRef.current) {
          videoTrack.play(localVideoRef.current);
        }
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

  useEffect(() => {
    if (callStatus === 'connected' && callData && !agoraJoined.current) {
      agoraJoined.current = true;
      if (Platform.OS === 'web' || webviewReady) {
        doJoinAgora(callData);
      } else {
        pendingJoinRef.current = callData;
      }
    }
  }, [callStatus, callData, webviewReady]);

  useEffect(() => {
    if (webviewReady && pendingJoinRef.current) {
      doJoinAgora(pendingJoinRef.current);
      pendingJoinRef.current = null;
    }
  }, [webviewReady]);

  useEffect(() => {
    if (agoraJoined.current) {
      if (Platform.OS === 'web') {
        agoraService.toggleMute(isMuted);
      } else {
        sendToWebView({ action: 'mute', muted: isMuted });
      }
    }
  }, [isMuted]);

  useEffect(() => {
    if (agoraJoined.current) {
      if (Platform.OS === 'web') {
        agoraService.toggleCamera(isCameraOff);
      } else {
        sendToWebView({ action: 'camera', off: isCameraOff });
      }
    }
  }, [isCameraOff]);

  useEffect(() => {
    if (callStatus === 'connected') {
      const hideTimeout = setTimeout(() => {
        setShowControls(false);
      }, 5000);
      return () => clearTimeout(hideTimeout);
    }
  }, [callStatus, showControls]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = (skipGoBack = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const wasConnected = callStatus === 'connected';
    setCallStatus('ended');
    stopRingtone();
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }
    if (ringingTimeout.current) {
      clearTimeout(ringingTimeout.current);
    }
    if (Platform.OS === 'web') {
      agoraService.leave();
    } else {
      sendToWebView({ action: 'leave' });
    }
    socketService.endCall({
      targetUserId: isIncoming ? callerId : userId,
      callType: 'video',
      duration: callDuration,
      wasAnswered: wasConnected
    });

    if (!skipGoBack) {
      setTimeout(() => {
        navigation.goBack();
      }, 500);
    }
  };

  useEffect(() => {
    const isPremium = user?.premium?.isActive;
    if (isPremium || callStatus !== 'connected') return;
    if (callDuration === 240) {
      Alert.alert(
        '1 Minute Remaining',
        'Free video calls are limited to 5 minutes. Upgrade to Premium for unlimited call time.',
        [{ text: 'OK' }]
      );
    }
    if (callDuration >= 300) {
      handleEndCall();
    }
  }, [callDuration, callStatus, user]);

  const handleAcceptCall = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    stopRingtone();
    socketService.acceptCall({ callerId, callData: incomingCallData });
    setCallStatus('connected');
    durationInterval.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const handleDeclineCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCallStatus('declined');
    stopRingtone();
    try {
      if (authToken && isIncoming) {
        await post('/call/decline', {
          callerId,
          type: 'video'
        }, authToken);
      }
    } catch (error) {
      console.error('Error recording declined call:', error);
    }
    socketService.declineCall({ callerId, callType: 'video' });
    setTimeout(() => {
      navigation.goBack();
    }, 1500);
  }, [callerId, navigation]);

  const toggleMute = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted(!isMuted);
  };

  const toggleCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCameraOff(!isCameraOff);
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
    } catch (e) {
      console.log('Speaker toggle error:', e);
    }
  }, [isSpeakerOn]);

  const flipCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFrontCamera(!isFrontCamera);
    if (agoraJoined.current) {
      if (Platform.OS === 'web') {
        agoraService.switchCamera();
      } else {
        sendToWebView({ action: 'switch-camera' });
      }
    }
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'idle': return '';
      case 'initializing': return 'Initializing...';
      case 'connecting': return 'Connecting...';
      case 'ringing': return isIncoming ? 'Incoming video call...' : 'Ringing...';
      case 'connected': return formatDuration(callDuration);
      case 'ended': return 'Call ended';
      case 'declined': return 'Call declined';
      case 'busy': return 'User is busy';
      case 'missed': return 'No answer';
      case 'failed': return errorMessage || 'Call failed';
      default: return '';
    }
  };

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'remote-user-joined' || data.type === 'remote-video-started') {
        setRemoteUserJoined(true);
      } else if (data.type === 'remote-user-left' || data.type === 'remote-video-stopped') {
        setRemoteUserJoined(false);
      } else if (data.type === 'joined') {
        console.log('WebView Agora joined:', data.uid);
      } else if (data.type === 'error') {
        console.log('WebView Agora error:', data.message);
      }
    } catch (e) {}
  }, []);

  const agoraCallUrl = `${getApiBaseUrl()}/public/agora-call.html`;

  const renderNativeCallView = () => {
    return (
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
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onMessage={handleWebViewMessage}
            onPermissionRequest={(request) => {
              request.grant(request.resources);
            }}
            onLoad={() => {
              setWebviewReady(true);
            }}
          />
        )}
      </>
    );
  };

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
     
      {Platform.OS === 'web' ? renderWebCallView() : renderNativeCallView()}
     
      <LinearGradient
        colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.3)', 'transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']}
        style={styles.overlay}
        pointerEvents="none"
      />

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => setShowControls(!showControls)}
      />

      <Animated.View
        pointerEvents={showControls ? 'auto' : 'none'}
        style={[
          styles.topBar,
          {
            paddingTop: insets.top + 16,
            opacity: showControls ? 1 : 0,
          }
        ]}
      >
        <View style={styles.headerGlass}>
          <View style={styles.callInfo}>
            <ThemedText style={styles.userName}>{userName || 'Unknown'}</ThemedText>
            <ThemedText style={[styles.callStatusText, callStatus === 'failed' && styles.errorStatus]}>
              {getStatusText()}
            </ThemedText>
          </View>
         
          {callStatus === 'connected' && callData && (
            <View style={styles.qualityBadge}>
              <Ionicons name="lock-closed" size={12} color="#10B981" />
              <ThemedText style={styles.qualityText}>Secure</ThemedText>
            </View>
          )}
        </View>
      </Animated.View>

      {callStatus !== 'ended' && callStatus !== 'declined' && callStatus !== 'failed' && callStatus !== 'missed' && (
        <View style={[styles.selfVideoContainer, { top: insets.top + 90 }]}>
          {renderLocalVideo()}
          <View style={styles.selfVideoLabel}>
            <ThemedText style={styles.selfVideoLabelText}>You</ThemedText>
          </View>
          <Pressable style={styles.flipButton} onPress={flipCamera}>
            <Ionicons name="camera-reverse" size={16} color="#FFF" />
          </Pressable>
        </View>
      )}

      {callStatus !== 'connected' && (
        <View style={styles.centerContent}>
          {callStatus === 'failed' || callStatus === 'busy' ? (
            <View style={styles.errorIndicator}>
              <Ionicons name={callStatus === 'busy' ? 'call' : 'alert-circle'} size={44} color="#FF3B30" />
            </View>
          ) : callStatus === 'missed' ? (
            <View style={styles.errorIndicator}>
              <Ionicons name="call" size={44} color="#FF9500" style={{ transform: [{ rotate: '135deg' }] }} />
            </View>
          ) : (
            <Animated.View style={[styles.connectingIndicator, { transform: [{ scale: pulseAnim }] }]}>
              {callStatus === 'ringing' && !isIncoming ? (
                <>
                  <MaterialCommunityIcons name="phone-ring" size={44} color="#FFF" />
                </>
              ) : (
                <Ionicons
                  name={callStatus === 'connecting' || callStatus === 'initializing' ? 'sync' : 'videocam'}
                  size={44}
                  color="#FFF"
                />
              )}
            </Animated.View>
          )}
          <ThemedText style={[styles.centerStatus, (callStatus === 'failed' || callStatus === 'busy') && styles.errorStatus]}>
            {getStatusText()}
          </ThemedText>
        </View>
      )}

      {isIncoming && callStatus === 'ringing' ? (
        <View style={[styles.incomingCallControls, { paddingBottom: insets.bottom + 40 }]}>
          <Pressable style={styles.incomingButtonWrapper} onPress={handleDeclineCall}>
            <View style={styles.declineButtonInner}>
              <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </View>
            <ThemedText style={styles.callActionLabel}>Decline</ThemedText>
          </Pressable>

          <Pressable style={styles.incomingButtonWrapper} onPress={handleAcceptCall}>
            <View style={styles.acceptButtonInner}>
              <Ionicons name="videocam" size={32} color="#FFF" />
            </View>
            <ThemedText style={styles.callActionLabel}>Accept</ThemedText>
          </Pressable>
        </View>
      ) : callStatus === 'busy' || callStatus === 'missed' || callStatus === 'declined' || callStatus === 'ended' ? (
        <View style={[styles.terminalControls, { paddingBottom: insets.bottom + 40 }]}>
          <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={32} color="#FFF" />
          </Pressable>
        </View>
      ) : (
        <Animated.View
          pointerEvents={showControls ? 'auto' : 'none'}
          style={[
            styles.controls,
            {
              paddingBottom: insets.bottom + 30,
              opacity: showControls ? 1 : 0,
            }
          ]}
        >
          <View style={styles.glassControlsContainer}>
            <View style={styles.glassControlsRow}>
              <View style={styles.controlItem}>
                <Pressable
                  style={[styles.controlButton, isCameraOff && styles.controlButtonActive]}
                  onPress={toggleCamera}
                >
                  <Ionicons
                    name={isCameraOff ? "videocam-off" : "videocam"}
                    size={22}
                    color={isCameraOff ? "#000" : "#FFF"}
                  />
                </Pressable>
                <ThemedText style={styles.controlLabel}>{isCameraOff ? 'Show' : 'Camera'}</ThemedText>
              </View>

              <View style={styles.controlItem}>
                <Pressable
                  style={[styles.controlButton, isMuted && styles.controlButtonActive]}
                  onPress={toggleMute}
                >
                  <Ionicons
                    name={isMuted ? "mic-off" : "mic"}
                    size={22}
                    color={isMuted ? "#000" : "#FFF"}
                  />
                </Pressable>
                <ThemedText style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</ThemedText>
              </View>

              <View style={styles.controlItem}>
                <Pressable
                  style={[styles.controlButton, isSpeakerOn && styles.controlButtonActive]}
                  onPress={toggleSpeaker}
                >
                  <Ionicons
                    name={isSpeakerOn ? "volume-high" : "ear"}
                    size={22}
                    color={isSpeakerOn ? "#000" : "#FFF"}
                  />
                </Pressable>
                <ThemedText style={styles.controlLabel}>{isSpeakerOn ? 'Earpiece' : 'Speaker'}</ThemedText>
              </View>

              <View style={styles.controlItem}>
                <Pressable style={styles.controlButton} onPress={flipCamera}>
                  <Ionicons name="camera-reverse" size={22} color="#FFF" />
                </Pressable>
                <ThemedText style={styles.controlLabel}>Flip</ThemedText>
              </View>

              <View style={styles.controlItem}>
                <Pressable style={styles.controlButton} onPress={() => {
                  handleEndCall(true);
                  navigation.goBack();
                  setTimeout(() => {
                    (navigation as any).navigate('ChatDetail', { userId: isIncoming ? callerId : userId, userName });
                  }, 100);
                }}>
                  <MaterialCommunityIcons name="message-text" size={22} color="#FFF" />
                </Pressable>
                <ThemedText style={styles.controlLabel}>Message</ThemedText>
              </View>
            </View>

            <Pressable style={styles.endCallButton} onPress={handleEndCall}>
              <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  headerGlass: {
    marginHorizontal: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(20, 20, 20, 0.65)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  callInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.3,
  },
  callStatusText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 3,
    fontWeight: '500',
  },
  errorStatus: {
    color: '#FF3B30',
  },
  qualityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  qualityText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  selfVideoContainer: {
    position: 'absolute',
    right: 16,
    width: 120,
    height: 170,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: '#1C1C1E',
    zIndex: 30,
    elevation: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
  },
  selfVideo: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfVideoLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  selfVideoLabelText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  flipButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cameraOffPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(20,20,20,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  selfVideoPermissionPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraOffText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  centerContent: {
    position: 'absolute',
    top: '38%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  connectingIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  errorIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,59,48,0.15)',
  },
  centerStatus: {
    color: '#FFF',
    fontSize: 18,
    marginTop: 24,
    fontWeight: '600',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  incomingCallControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 60,
    zIndex: 20,
  },
  incomingButtonWrapper: {
    alignItems: 'center',
  },
  declineButtonInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  acceptButtonInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  callActionLabel: {
    color: '#FFF',
    fontSize: 15,
    marginTop: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  terminalControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  closeButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(50,50,50,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  glassControlsContainer: {
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(15, 15, 15, 0.82)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  glassControlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  controlItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  controlLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#FFF',
  },
  endCallButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
});

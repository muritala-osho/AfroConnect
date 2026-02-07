import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, Dimensions, StatusBar, Platform } from 'react-native';
import { SafeImage } from '@/components/SafeImage';
import { ThemedText } from '@/components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
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
  const { post } = useApi();
  
  const [callStatus, setCallStatus] = useState<'initializing' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed' | 'declined'>('initializing');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [callData, setCallData] = useState<CallData | null>(incomingCallData || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const ringingTimeout = useRef<NodeJS.Timeout | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showControls, setShowControls] = useState(true);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const agoraJoined = useRef(false);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const [remoteUserJoined, setRemoteUserJoined] = useState(false);
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  const [webviewReady, setWebviewReady] = useState(false);

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
          if (callStatus === 'ringing') {
            setCallStatus('failed');
            setErrorMessage('No answer');
            socketService.missedCall({ targetUserId: userId, callType: 'video' });
          }
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
      setCallStatus('ended');
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      setTimeout(() => {
        navigation.goBack();
      }, 1000);
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
    };
  }, []);

  const sendToWebView = useCallback((msg: any) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (callStatus === 'connected' && callData && !agoraJoined.current) {
      agoraJoined.current = true;
      const joinAgora = async () => {
        let joinToken = callData.token;
        let joinUid = callData.uid || 0;
        if (isIncoming && authToken) {
          try {
            const res = await post<{ token: string; uid: number }>(`/agora/token?channelName=${encodeURIComponent(callData.channelName)}&uid=0&role=publisher`, {}, authToken);
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
              () => {
                setRemoteUserJoined(false);
              }
            );
            const { videoTrack } = await agoraService.joinVideoCall(
              callData.appId,
              callData.channelName,
              joinToken,
              joinUid
            );
            if (videoTrack && localVideoRef.current) {
              videoTrack.play(localVideoRef.current);
            }
          }
        } else {
          sendToWebView({
            action: 'join',
            appId: callData.appId,
            channel: callData.channelName,
            token: joinToken,
            uid: joinUid,
            callType: 'video'
          });
        }
      };
      joinAgora();
    }
  }, [callStatus, callData, webviewReady]);

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

  const handleEndCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const wasConnected = callStatus === 'connected';
    setCallStatus('ended');
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

    setTimeout(() => {
      navigation.goBack();
    }, 500);
  };

  const handleAcceptCall = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    socketService.acceptCall({ callerId, callData: incomingCallData });
    setCallStatus('connected');
    durationInterval.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const handleDeclineCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setCallStatus('declined');
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
      case 'initializing': return 'Initializing...';
      case 'connecting': return 'Connecting...';
      case 'ringing': return isIncoming ? 'Incoming video call...' : 'Ringing...';
      case 'connected': return formatDuration(callDuration);
      case 'ended': return 'Call ended';
      case 'declined': return 'Call declined';
      case 'failed': return errorMessage || 'Call failed';
      default: return '';
    }
  };

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'remote-user-joined') {
        setRemoteUserJoined(true);
      } else if (data.type === 'remote-user-left') {
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
    if (callStatus === 'connected' && agoraJoined.current) {
      return (
        <View style={styles.remoteVideo}>
          <WebView
            ref={webViewRef}
            source={{ uri: agoraCallUrl }}
            style={{ flex: 1, backgroundColor: '#000' }}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onMessage={handleWebViewMessage}
            onLoad={() => {
              setWebviewReady(true);
              if (callData && agoraJoined.current) {
                const getTokenAndJoin = async () => {
                  let joinToken = callData.token;
                  let joinUid = callData.uid || 0;
                  if (isIncoming && authToken) {
                    try {
                      const res = await post<{ token: string; uid: number }>(`/agora/token?channelName=${encodeURIComponent(callData.channelName)}&uid=0&role=publisher`, {}, authToken);
                      if (res.success && res.data?.token) {
                        joinToken = res.data.token;
                        joinUid = 0;
                      }
                    } catch (e) {}
                  }
                  sendToWebView({
                    action: 'join',
                    appId: callData.appId,
                    channel: callData.channelName,
                    token: joinToken,
                    uid: joinUid,
                    callType: 'video'
                  });
                };
                getTokenAndJoin();
              }
            }}
          />
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
          <div ref={localVideoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' as any, borderRadius: 16 }} />
        </View>
      );
    }
    if (Platform.OS !== 'web' && callStatus === 'connected') {
      return null;
    }
    if (isCameraOff) {
      return (
        <View style={styles.cameraOffPlaceholder}>
          <Ionicons name="videocam-off" size={32} color="rgba(255,255,255,0.5)" />
          <ThemedText style={styles.cameraOffText}>Camera Off</ThemedText>
        </View>
      );
    }
    if (cameraPermission?.granted && Platform.OS !== 'web') {
      return <CameraView style={styles.selfVideo} facing={isFrontCamera ? 'front' : 'back'} />;
    }
    return (
      <LinearGradient colors={['rgba(74, 144, 226, 0.4)', 'rgba(74, 144, 226, 0.1)']} style={styles.selfVideo}>
        <Ionicons name="videocam" size={32} color="rgba(255,255,255,0.5)" />
      </LinearGradient>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {Platform.OS === 'web' ? renderWebCallView() : renderNativeCallView()}
      
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent', 'transparent', 'rgba(0,0,0,0.8)']}
        style={styles.overlay}
        pointerEvents="none"
      />

      <Pressable 
        style={StyleSheet.absoluteFill} 
        onPress={() => setShowControls(!showControls)}
      />

      <Animated.View style={[
        styles.topBar, 
        { 
          paddingTop: insets.top + 10,
          opacity: showControls ? 1 : 0,
        }
      ]}>
        <View style={styles.callInfo}>
          <ThemedText style={styles.userName}>{userName || 'Unknown'}</ThemedText>
          <ThemedText style={[styles.callStatus, callStatus === 'failed' && styles.errorStatus]}>
            {getStatusText()}
          </ThemedText>
        </View>
        
        {callStatus === 'connected' && callData && (
          <View style={styles.qualityBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#4CAF50" />
            <ThemedText style={styles.qualityText}>Secure</ThemedText>
          </View>
        )}
      </Animated.View>

      {Platform.OS !== 'web' || !agoraJoined.current ? (
        <View style={[styles.selfVideoContainer, { top: insets.top + 80 }]}>
          {renderLocalVideo()}
          <Pressable style={styles.flipButton} onPress={flipCamera}>
            <Ionicons name="camera-reverse" size={18} color="#FFF" />
          </Pressable>
        </View>
      ) : (
        <View style={[styles.selfVideoContainer, { top: insets.top + 80 }]}>
          {renderLocalVideo()}
          <Pressable style={styles.flipButton} onPress={flipCamera}>
            <Ionicons name="camera-reverse" size={18} color="#FFF" />
          </Pressable>
        </View>
      )}

      {callStatus !== 'connected' && (
        <View style={styles.centerContent}>
          {callStatus === 'failed' ? (
            <View style={styles.errorIndicator}>
              <Ionicons name="alert-circle" size={48} color="#FF5252" />
            </View>
          ) : (
            <View style={styles.connectingIndicator}>
              <Ionicons 
                name={callStatus === 'connecting' || callStatus === 'initializing' ? 'sync' : 'videocam'} 
                size={48} 
                color="rgba(255,255,255,0.7)" 
              />
            </View>
          )}
          <ThemedText style={[styles.centerStatus, callStatus === 'failed' && styles.errorStatus]}>
            {getStatusText()}
          </ThemedText>
        </View>
      )}

      {isIncoming && callStatus === 'ringing' ? (
        <View style={[styles.incomingCallControls, { paddingBottom: insets.bottom + 24 }]}>
          <Pressable style={styles.declineButton} onPress={handleDeclineCall}>
            <View style={styles.declineButtonInner}>
              <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </View>
            <ThemedText style={styles.callActionLabel}>Decline</ThemedText>
          </Pressable>

          <Pressable style={styles.acceptButton} onPress={handleAcceptCall}>
            <View style={styles.acceptButtonInner}>
              <Ionicons name="videocam" size={30} color="#FFF" />
            </View>
            <ThemedText style={styles.callActionLabel}>Accept</ThemedText>
          </Pressable>
        </View>
      ) : (
        <Animated.View style={[
          styles.controls, 
          { 
            paddingBottom: insets.bottom + 24,
            opacity: showControls ? 1 : 0,
          }
        ]}>
          <View style={styles.controlsRow}>
            <Pressable
              style={[styles.controlButton, isCameraOff && styles.controlButtonActive]}
              onPress={toggleCamera}
            >
              <Ionicons 
                name={isCameraOff ? "videocam-off" : "videocam"} 
                size={26} 
                color="#FFF" 
              />
            </Pressable>

            <Pressable
              style={[styles.controlButton, isMuted && styles.controlButtonActive]}
              onPress={toggleMute}
            >
              <Ionicons 
                name={isMuted ? "mic-off" : "mic"} 
                size={26} 
                color="#FFF" 
              />
            </Pressable>

            <Pressable style={styles.endCallButton} onPress={handleEndCall}>
              <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>

            <Pressable style={styles.controlButton} onPress={flipCamera}>
              <Ionicons name="camera-reverse" size={26} color="#FFF" />
            </Pressable>

            <Pressable style={styles.controlButton} onPress={() => {
              handleEndCall();
              (navigation as any).navigate('ChatDetail', { userId: isIncoming ? callerId : userId, userName });
            }}>
              <MaterialCommunityIcons name="message-text" size={26} color="#FFF" />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  callInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  callStatus: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  errorStatus: {
    color: '#FF5252',
  },
  qualityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  qualityText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  selfVideoContainer: {
    position: 'absolute',
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  selfVideo: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 12,
  },
  cameraOffPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraOffText: {
    marginTop: 8,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  flipButton: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectingIndicator: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorIndicator: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,82,82,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  centerStatus: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomingCallControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
  },
  declineButton: {
    alignItems: 'center',
  },
  declineButtonInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  acceptButton: {
    alignItems: 'center',
  },
  acceptButtonInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  callActionLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
});

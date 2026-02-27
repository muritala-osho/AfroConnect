
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, Dimensions, StatusBar, Alert, Platform } from 'react-native';
import { SafeImage } from '@/components/SafeImage';
import { ThemedText } from '@/components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
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

export default function VoiceCallScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { userId, userName, userPhoto, isIncoming, callData: incomingCallData, callerId, callAccepted } = route.params || {};
  const { token: authToken, user } = useAuth();
  const { post, get } = useApi();
  
  const [callStatus, setCallStatus] = useState<'idle' | 'initializing' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed' | 'declined' | 'busy' | 'missed'>('initializing');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [callData, setCallData] = useState<CallData | null>(incomingCallData || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPremium] = useState(user?.premium?.isActive || false);
  
  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const ringingTimeout = useRef<NodeJS.Timeout | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;
  const agoraJoined = useRef(false);
  const webViewRef = useRef<WebView | null>(null);
  const [webviewReady, setWebviewReady] = useState(false);
  const ringtoneRef = useRef<Audio.Sound | null>(null);

  const sendToWebView = useCallback((msg: any) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(msg));
    }
  }, []);

  const playRingtone = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
        { shouldPlay: true, isLooping: true, volume: 0.7 }
      );
      ringtoneRef.current = sound;
    } catch (err) {
      console.log('Ringtone error:', err);
    }
  }, []);

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
        callType: 'voice',
      }, authToken);

      if (response.success && response.data?.callData) {
        const newCallData = response.data.callData;
        setCallData(newCallData);
        setCallStatus('ringing');
        
        socketService.initiateCall({
          targetUserId: userId,
          callData: newCallData,
          callerInfo: {
            name: user?.name || 'Unknown',
            photo: user?.photos?.[0]?.url || '',
            id: user?.id || ''
          }
        });
        
        ringingTimeout.current = setTimeout(() => {
          setCallStatus('missed');
          setErrorMessage('No answer');
          socketService.missedCall({ targetUserId: userId, callType: 'audio' });
          setTimeout(() => navigation.goBack(), 2000);
        }, 30000);
      } else {
        setCallStatus('failed');
        setErrorMessage(response.error || 'Failed to initiate call');
      }
    } catch (error: any) {
      setCallStatus('failed');
      setErrorMessage(error.message || 'Failed to connect');
    }
  }, [authToken, userId, post, user]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    const startWaveAnimations = () => {
      const createWave = (anim: Animated.Value, delay: number) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
          ])
        );
      };
      createWave(waveAnim1, 0).start();
      createWave(waveAnim2, 600).start();
      createWave(waveAnim3, 1200).start();
    };
    startWaveAnimations();

    if (isIncoming && incomingCallData) {
      if (callAccepted) {
        setCallStatus('connected');
      } else {
        setCallStatus('ringing');
      }
    } else {
      initiateCall();
    }

    socketService.onCallAccepted(() => {
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      stopRingtone();
      setCallStatus('connected');
    });

    socketService.onCallDeclined(() => {
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setCallStatus('declined');
      setTimeout(() => navigation.goBack(), 2000);
    });

    socketService.onCallEnded(() => {
      setCallStatus('ended');
      setTimeout(() => navigation.goBack(), 1000);
    });

    socketService.on('call:busy', () => {
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setCallStatus('busy');
      setErrorMessage('User is busy');
      setTimeout(() => navigation.goBack(), 2500);
    });

    return () => {
      if (durationInterval.current) clearInterval(durationInterval.current);
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
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

  useEffect(() => {
    if (callStatus === 'ringing' && !isIncoming) {
      playRingtone();
    } else {
      stopRingtone();
    }
    return () => { stopRingtone(); };
  }, [callStatus]);

  useEffect(() => {
    if (callStatus === 'connected' && callData && !agoraJoined.current) {
      agoraJoined.current = true;
      const joinAgora = async () => {
        let joinToken = callData.token;
        let joinUid = callData.uid || 0;
        if (isIncoming && authToken) {
          try {
            const res = await get<{ token: string; uid: number }>(`/agora/token`, { channelName: callData.channelName, uid: 0, role: 'publisher' }, authToken);
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
            const joined = await agoraService.joinVoiceCall(
              callData.appId,
              callData.channelName,
              joinToken,
              joinUid
            );
            if (!joined) {
              console.log('Agora voice join failed, call continues without RTC');
            }
          }
        } else {
          sendToWebView({
            action: 'join',
            appId: callData.appId,
            channel: callData.channelName,
            token: joinToken,
            uid: joinUid,
            callType: 'voice'
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
    if (callStatus === 'connected') {
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: !isSpeakerOn,
      }).catch((err) => console.log('Speaker toggle error:', err));
    }
  }, [isSpeakerOn, callStatus]);

  useEffect(() => {
    if (callStatus === 'connected') {
      durationInterval.current = setInterval(() => {
        setCallDuration(prev => {
          if (!isPremium && prev >= 300) {
            Alert.alert("Call Limit", "Free calls are limited to 5 minutes.", [{ text: "Upgrade", onPress: () => navigation.navigate('Premium') }, { text: "OK", onPress: () => handleEndCall() }]);
            handleEndCall();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => { if (durationInterval.current) clearInterval(durationInterval.current); };
  }, [callStatus, isPremium]);

  const handleEndCall = (skipGoBack = false) => {
    const wasConnected = callStatus === 'connected';
    setCallStatus('ended');
    stopRingtone();
    if (Platform.OS === 'web') {
      agoraService.leave();
    } else {
      sendToWebView({ action: 'leave' });
    }
    socketService.endCall({ 
      targetUserId: isIncoming ? callerId : userId,
      callType: 'audio',
      duration: callDuration,
      wasAnswered: wasConnected
    });
    if (!skipGoBack) {
      setTimeout(() => navigation.goBack(), 500);
    }
  };

  const handleAcceptCall = () => {
    stopRingtone();
    socketService.acceptCall({ callerId, callData: incomingCallData });
    setCallStatus('connected');
  };

  const handleDeclineCall = async () => {
    stopRingtone();
    setCallStatus('declined');
    socketService.declineCall({ callerId, callType: 'audio' });
    setTimeout(() => navigation.goBack(), 1500);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'idle': return '';
      case 'initializing': return 'Initializing...';
      case 'connecting': return 'Connecting...';
      case 'ringing': return isIncoming ? 'Incoming voice call' : 'Ringing...';
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
      if (data.type === 'joined') {
        console.log('WebView Agora voice joined:', data.uid);
      } else if (data.type === 'error') {
        console.log('WebView Agora voice error:', data.message);
      }
    } catch (e) {}
  }, []);

  const agoraCallUrl = `${getApiBaseUrl()}/public/agora-call.html`;

  const isTerminal = callStatus === 'ended' || callStatus === 'declined' || callStatus === 'busy' || callStatus === 'missed' || callStatus === 'failed';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={['#0f0c29', '#302b63', '#24243e']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {Platform.OS !== 'web' && callStatus === 'connected' && (
        <WebView
          ref={webViewRef}
          source={{ uri: agoraCallUrl }}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
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
                    const res = await get<{ token: string; uid: number }>(`/agora/token`, { channelName: callData.channelName, uid: 0, role: 'publisher' }, authToken);
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
                  callType: 'voice'
                });
              };
              getTokenAndJoin();
            }
          }}
        />
      )}

      <Animated.View style={[styles.topBar, { opacity: fadeAnim, paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backBtn} onPress={() => { handleEndCall(); }}>
          <Ionicons name="chevron-back" size={28} color="rgba(255,255,255,0.8)" />
        </Pressable>
        <View style={styles.encryptionBadge}>
          <Ionicons name="lock-closed" size={12} color="#10B981" />
          <ThemedText style={styles.encryptionText}>Encrypted</ThemedText>
        </View>
      </Animated.View>

      <Animated.View style={[styles.centerSection, { opacity: fadeAnim }]}>
        <View style={styles.avatarSection}>
          {(callStatus === 'ringing' || callStatus === 'connecting' || callStatus === 'initializing') && (
            <>
              <Animated.View style={[styles.waveRing, {
                opacity: waveAnim1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.15, 0] }),
                transform: [{ scale: waveAnim1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
              }]} />
              <Animated.View style={[styles.waveRing, {
                opacity: waveAnim2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.15, 0] }),
                transform: [{ scale: waveAnim2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
              }]} />
              <Animated.View style={[styles.waveRing, {
                opacity: waveAnim3.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.15, 0] }),
                transform: [{ scale: waveAnim3.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] }) }],
              }]} />
            </>
          )}

          {callStatus === 'connected' && (
            <View style={styles.connectedGlow} />
          )}

          <Animated.View style={[styles.avatarWrapper, {
            transform: [{ scale: (callStatus === 'ringing' || callStatus === 'connecting') ? pulseAnim : 1 }]
          }]}>
            <SafeImage
              source={{ uri: userPhoto || 'https://via.placeholder.com/150' }}
              style={styles.avatar}
            />
          </Animated.View>
        </View>

        <ThemedText style={styles.userName}>{userName || 'Unknown'}</ThemedText>

        <View style={styles.statusContainer}>
          {callStatus === 'connected' && (
            <View style={styles.connectedDot} />
          )}
          {isTerminal && (
            <Ionicons
              name={callStatus === 'busy' ? 'call' : callStatus === 'missed' ? 'call' : callStatus === 'failed' ? 'alert-circle' : 'call'}
              size={16}
              color={callStatus === 'failed' || callStatus === 'busy' ? '#FF5252' : callStatus === 'missed' ? '#FF9800' : 'rgba(255,255,255,0.5)'}
              style={callStatus === 'declined' || callStatus === 'ended' || callStatus === 'missed' || callStatus === 'busy' ? { transform: [{ rotate: '135deg' }] } : undefined}
            />
          )}
          <ThemedText style={[
            styles.statusText,
            callStatus === 'connected' && styles.statusConnected,
            (callStatus === 'failed' || callStatus === 'busy') && styles.statusError,
            callStatus === 'missed' && styles.statusWarning,
          ]}>
            {getStatusText()}
          </ThemedText>
        </View>
      </Animated.View>

      <View style={[styles.controlsSection, { paddingBottom: insets.bottom + 30 }]}>
        {isIncoming && callStatus === 'ringing' ? (
          <View style={styles.incomingButtons}>
            <View style={styles.actionButtonCol}>
              <Pressable onPress={handleDeclineCall} style={styles.declineBtn}>
                <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </Pressable>
              <ThemedText style={styles.actionLabel}>Decline</ThemedText>
            </View>
            <View style={styles.actionButtonCol}>
              <Pressable onPress={handleAcceptCall} style={styles.acceptBtn}>
                <Ionicons name="call" size={30} color="#FFF" />
              </Pressable>
              <ThemedText style={styles.actionLabel}>Accept</ThemedText>
            </View>
          </View>
        ) : isTerminal ? (
          <View style={styles.terminalButtons}>
            <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={30} color="#FFF" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.connectedButtons}>
            {callStatus === 'connected' && (
              <View style={styles.controlRow}>
                <View style={styles.controlCol}>
                  <Pressable
                    style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                    onPress={() => {
                      setIsMuted(!isMuted);
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch(e) {}
                    }}
                  >
                    <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color={isMuted ? '#302b63' : '#FFF'} />
                  </Pressable>
                  <ThemedText style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</ThemedText>
                </View>
                <View style={styles.controlCol}>
                  <Pressable
                    style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
                    onPress={() => {
                      setIsSpeakerOn(!isSpeakerOn);
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch(e) {}
                    }}
                  >
                    <Ionicons name={isSpeakerOn ? "volume-high" : "volume-medium"} size={24} color={isSpeakerOn ? '#302b63' : '#FFF'} />
                  </Pressable>
                  <ThemedText style={styles.controlLabel}>Speaker</ThemedText>
                </View>
                <View style={styles.controlCol}>
                  <Pressable
                    style={styles.controlBtn}
                    onPress={() => {
                      handleEndCall(true);
                      navigation.goBack();
                      setTimeout(() => {
                        (navigation as any).navigate('ChatDetail', { userId: isIncoming ? callerId : userId, userName });
                      }, 100);
                    }}
                  >
                    <MaterialCommunityIcons name="message-text" size={24} color="#FFF" />
                  </Pressable>
                  <ThemedText style={styles.controlLabel}>Message</ThemedText>
                </View>
              </View>
            )}
            <Pressable style={styles.endCallBtn} onPress={handleEndCall}>
              <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0c29',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    position: 'absolute',
    zIndex: 10,
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  encryptionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  encryptionText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
    marginBottom: 32,
  },
  waveRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.5)',
  },
  connectedGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  avatarWrapper: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 17,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  statusConnected: {
    color: '#10B981',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 2,
  },
  statusError: {
    color: '#FF5252',
  },
  statusWarning: {
    color: '#FF9800',
  },
  controlsSection: {
    paddingHorizontal: 24,
  },
  incomingButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 80,
  },
  actionButtonCol: {
    alignItems: 'center',
  },
  declineBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  acceptBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  terminalButtons: {
    alignItems: 'center',
  },
  closeBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  connectedButtons: {
    alignItems: 'center',
    gap: 30,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
  },
  controlCol: {
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  controlBtnActive: {
    backgroundColor: '#FFF',
  },
  controlLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});


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
  
  const [callStatus, setCallStatus] = useState<'initializing' | 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed' | 'declined'>('initializing');
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
  const agoraJoined = useRef(false);
  const webViewRef = useRef<WebView | null>(null);
  const [webviewReady, setWebviewReady] = useState(false);

  const sendToWebView = useCallback((msg: any) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(msg));
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
          if (callStatus === 'ringing') {
            setCallStatus('failed');
            setErrorMessage('No answer');
            socketService.missedCall({ targetUserId: userId, callType: 'audio' });
          }
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
    };
  }, []);

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

  const handleEndCall = () => {
    const wasConnected = callStatus === 'connected';
    setCallStatus('ended');
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
    setTimeout(() => navigation.goBack(), 500);
  };

  const handleAcceptCall = () => {
    socketService.acceptCall({ callerId, callData: incomingCallData });
    setCallStatus('connected');
  };

  const handleDeclineCall = async () => {
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
      case 'initializing': return 'Initializing...';
      case 'connecting': return 'Connecting...';
      case 'ringing': return isIncoming ? 'Incoming call...' : 'Ringing...';
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
      if (data.type === 'joined') {
        console.log('WebView Agora voice joined:', data.uid);
      } else if (data.type === 'error') {
        console.log('WebView Agora voice error:', data.message);
      }
    } catch (e) {}
  }, []);

  const agoraCallUrl = `${getApiBaseUrl()}/public/agora-call.html`;

  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#0f3460']} style={styles.container}>
      <StatusBar barStyle="light-content" />

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

      <Animated.View style={[styles.content, { opacity: fadeAnim, paddingTop: insets.top + 40 }]}>
        <Animated.View style={[styles.avatarContainer, { transform: [{ scale: callStatus === 'ringing' ? pulseAnim : 1 }] }]}>
          <View style={styles.avatarGlow} />
          <SafeImage source={{ uri: userPhoto || 'https://via.placeholder.com/150' }} style={styles.avatar} />
        </Animated.View>
        <ThemedText style={styles.userName}>{userName || 'Unknown'}</ThemedText>
        <ThemedText style={styles.callStatus}>{getStatusText()}</ThemedText>
        {callStatus === 'ringing' && !isIncoming && (
          <View style={styles.ringingIndicator}>
            <MaterialCommunityIcons name="bell-ring" size={24} color="#FFD700" />
            <ThemedText style={styles.ringingText}>Waiting for answer...</ThemedText>
          </View>
        )}
      </Animated.View>
      <View style={[styles.controls, { paddingBottom: insets.bottom + 40 }]}>
        {isIncoming && callStatus === 'ringing' ? (
          <View style={styles.incomingCallButtons}>
            <Pressable onPress={handleDeclineCall}>
              <LinearGradient colors={['#FF5252', '#D32F2F']} style={styles.callActionGradient}>
                <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </LinearGradient>
            </Pressable>
            <Pressable onPress={handleAcceptCall}>
              <LinearGradient colors={['#4CAF50', '#388E3C']} style={styles.callActionGradient}>
                <Ionicons name="call" size={32} color="#FFF" />
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.connectedControls}>
            {callStatus === 'connected' && (
              <View style={styles.controlRow}>
                <Pressable style={[styles.controlBtn, isMuted && styles.controlBtnActive]} onPress={() => setIsMuted(!isMuted)}>
                  <Ionicons name={isMuted ? "mic-off" : "mic"} size={26} color="#FFF" />
                  <ThemedText style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</ThemedText>
                </Pressable>
                <Pressable style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]} onPress={() => setIsSpeakerOn(!isSpeakerOn)}>
                  <Ionicons name={isSpeakerOn ? "volume-high" : "volume-medium"} size={26} color="#FFF" />
                  <ThemedText style={styles.controlLabel}>Speaker</ThemedText>
                </Pressable>
              </View>
            )}
            <Pressable style={styles.endCallButton} onPress={handleEndCall}>
              <LinearGradient colors={['#FF5252', '#D32F2F']} style={styles.endCallGradient}>
                <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
  avatarContainer: { alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  avatarGlow: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(74, 144, 226, 0.3)' },
  avatar: { width: 150, height: 150, borderRadius: 75, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)' },
  userName: { fontSize: 28, fontWeight: '700', color: '#FFF', marginBottom: 8 },
  callStatus: { fontSize: 18, color: 'rgba(255,255,255,0.7)', marginBottom: 32 },
  ringingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, backgroundColor: 'rgba(255, 215, 0, 0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  ringingText: { color: '#FFD700', fontWeight: '600', fontSize: 14 },
  controls: { paddingHorizontal: 24 },
  incomingCallButtons: { flexDirection: 'row', justifyContent: 'space-around', width: '100%' },
  callActionGradient: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  endCallButton: { alignItems: 'center' },
  endCallGradient: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  connectedControls: { alignItems: 'center', gap: 32 },
  controlRow: { flexDirection: 'row', justifyContent: 'center', gap: 40 },
  controlBtn: { alignItems: 'center', gap: 8 },
  controlBtnActive: { opacity: 0.7 },
  controlLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
});

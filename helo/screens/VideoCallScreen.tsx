import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Pressable, Animated, Dimensions, StatusBar } from 'react-native';
import { SafeImage } from '@/components/SafeImage';
import { ThemedText } from '@/components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as AudioModule from 'expo-audio';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import socketService from '@/services/socket';

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
  const ringingAudioRef = useRef<any | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [showControls, setShowControls] = useState(true);

  const playRingingTone = useCallback(async () => {
    try {
      console.log('Ringing tone playing (handled by system audio)');
    } catch (error) {
      console.log('Could not play ringing tone:', error);
    }
  }, []);

  const stopRingingTone = useCallback(async () => {
    if (ringingAudioRef.current) {
      try {
        await ringingAudioRef.current.stopAsync();
      } catch (error) {
        console.log('Error stopping ringing tone:', error);
      }
    }
  }, []);

  const initiateCall = useCallback(async () => {
    if (!authToken || !userId) {
      setCallStatus('failed');
      setErrorMessage('Authentication required');
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
        
        // Start ringing tone
        playRingingTone();
        
        // Send socket event to notify target user of incoming call
        const userPhoto = user?.photos?.[0];
        const photoUrl = typeof userPhoto === 'string' ? userPhoto : userPhoto?.url || '';
        socketService.initiateCall({
          targetUserId: userId,
          callData: newCallData,
          callerInfo: {
            name: user?.name || 'Unknown',
            photo: photoUrl,
            id: user?.id || ''
          }
        });
        
        // Set timeout for unanswered call (30 seconds)
        ringingTimeout.current = setTimeout(() => {
          if (callStatus === 'ringing') {
            stopRingingTone();
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
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    if (isIncoming && incomingCallData) {
      if (callAccepted) {
        // Call was already accepted in IncomingCallHandler, start connected
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

    // Listen for call accepted
    socketService.onCallAccepted((data) => {
      if (ringingTimeout.current) {
        clearTimeout(ringingTimeout.current);
      }
      stopRingingTone();
      setCallStatus('connected');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      durationInterval.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    });

    // Listen for call declined
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

    // Listen for call ended by other party
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
      socketService.off('call:accepted');
      socketService.off('call:declined');
      socketService.off('call:ended');
    };
  }, []);

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
    // Notify the other user that call ended - socket will save to chat
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
    // Notify the caller that call was accepted
    socketService.acceptCall({ callerId, callData: incomingCallData });
    setCallStatus('connected');
    durationInterval.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const handleDeclineCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    stopRingingTone();
    setCallStatus('declined');
    try {
      // Save declined call to history
      if (authToken && isIncoming) {
        await post('/call/decline', {
          callerId,
          type: 'video'
        }, authToken);
      }
    } catch (error) {
      console.error('Error recording declined call:', error);
    }
    // Notify the caller that call was declined - socket will save to chat
    socketService.declineCall({ callerId, callType: 'video' });
    setTimeout(() => {
      navigation.goBack();
    }, 1500);
  }, [callerId, stopRingingTone, navigation]);

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

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      <SafeImage
        source={{ uri: userPhoto || 'https://via.placeholder.com/400' }}
        style={styles.remoteVideo}
        contentFit="cover"
      />
      
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent', 'transparent', 'rgba(0,0,0,0.8)']}
        style={styles.overlay}
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

      <View style={[styles.selfVideoContainer, { top: insets.top + 80 }]}>
        {isCameraOff ? (
          <View style={styles.cameraOffPlaceholder}>
            <Ionicons name="videocam-off" size={32} color="rgba(255,255,255,0.5)" />
            <ThemedText style={styles.cameraOffText}>Camera Off</ThemedText>
          </View>
        ) : (
          <LinearGradient
            colors={['rgba(74, 144, 226, 0.4)', 'rgba(74, 144, 226, 0.1)']}
            style={styles.selfVideo}
          >
            <SafeImage
              source={{ uri: user?.photos?.[0] || 'https://via.placeholder.com/200' }}
              style={styles.selfVideoImage}
              contentFit="cover"
            />
          </LinearGradient>
        )}
        <Pressable style={styles.flipButton} onPress={flipCamera}>
          <Ionicons name="camera-reverse" size={18} color="#FFF" />
        </Pressable>
      </View>

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

            <Pressable style={styles.controlButton}>
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
  selfVideoImage: {
    width: '100%',
    height: '100%',
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

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Modal, Pressable, Animated, Dimensions, Platform } from 'react-native';
import { SafeImage } from '@/components/SafeImage';
import { ThemedText } from '@/components/ThemedText';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import socketService from '@/services/socket';
import { useNavigation } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

import { setupNotificationListeners } from '@/services/notifications';

interface IncomingCallData {
  callData: any;
  callerInfo: {
    name: string;
    photo: string;
  };
  callerId: string;
}

export default function IncomingCallHandler() {
  const { user, token } = useAuth();
  const navigation = useNavigation<any>();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const soundRef = useRef<any>(null);

  useEffect(() => {
    if (!user?.id || !token) return;

    const handleIncomingCall = async (data: IncomingCallData) => {
      console.log('Incoming call received:', data);
      setIncomingCall(data);
      setIsVisible(true);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      
      // Send local notification for the incoming call
      const callType = data.callData?.callType || 'voice';
      const { sendLocalNotification } = require('@/services/notifications');
      sendLocalNotification(
        `Incoming ${callType} call`,
        `${data.callerInfo?.name || 'Someone'} is calling you...`,
        { type: 'call', callerId: data.callerId }
      );
      
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();

      // Continuous haptic feedback while ringing
      const hapticInterval = setInterval(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, 2000);
      
      // Store interval to clear later
      (soundRef as any).hapticInterval = hapticInterval;
    };

    socketService.onIncomingCall(handleIncomingCall);

    // Setup listeners for incoming notifications
    const unsubscribe = setupNotificationListeners(
      (notification) => {
        const data = notification.request.content.data;
        if (data?.type === 'call') {
          // Handled by socket while foregrounded
        }
      },
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'call') {
          navigation.navigate(data.callType === 'video' ? 'VideoCall' : 'VoiceCall', {
            userId: data.callerId,
            userName: data.callerName,
            userPhoto: data.callerPhoto,
            isIncoming: true,
            callData: data.callData,
            callerId: data.callerId
          });
        } else if (data?.type === 'message') {
          navigation.navigate('ChatDetail', { 
            userId: data.senderId,
            userName: data.senderName
          });
        }
      }
    );

    return () => {
      socketService.off('call:incoming');
      if (unsubscribe) unsubscribe();
      stopRingtone();
    };
  }, [user?.id, token]);

  const stopRingtone = () => {
    if (soundRef.current?.hapticInterval) {
      clearInterval(soundRef.current.hapticInterval);
      soundRef.current = null;
    }
  };

  const handleAccept = async () => {
    if (!incomingCall) return;
    
    await stopRingtone();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Send accept event to caller BEFORE navigating
    socketService.acceptCall({ 
      callerId: incomingCall.callerId, 
      callData: incomingCall.callData 
    });
    
    setIsVisible(false);
    
    const callType = incomingCall.callData?.callType || 'voice';
    const screenName = callType === 'video' ? 'VideoCall' : 'VoiceCall';
    
    navigation.navigate(screenName, {
      userId: incomingCall.callerId,
      userName: incomingCall.callerInfo?.name || 'Unknown',
      userPhoto: incomingCall.callerInfo?.photo || '',
      isIncoming: true,
      callData: incomingCall.callData,
      callerId: incomingCall.callerId,
      callAccepted: true, // Mark that call was already accepted
    });
    
    setIncomingCall(null);
  };

  const handleDecline = async () => {
    if (!incomingCall) return;
    
    await stopRingtone();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    socketService.declineCall({ callerId: incomingCall.callerId });
    
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      setIncomingCall(null);
    });
  };

  if (!isVisible || !incomingCall) return null;

  const callType = incomingCall.callData?.callType || 'voice';
  const isVideoCall = callType === 'video';

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.callCard,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <LinearGradient
            colors={['#1a1a2e', '#16213e']}
            style={styles.gradient}
          >
            <View style={styles.callerInfo}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <SafeImage
                  source={{ uri: incomingCall.callerInfo?.photo || 'https://via.placeholder.com/80' }}
                  style={styles.avatar}
                />
              </Animated.View>
              <View style={styles.textContainer}>
                <ThemedText style={styles.callerName}>
                  {incomingCall.callerInfo?.name || 'Unknown'}
                </ThemedText>
                <ThemedText style={styles.callType}>
                  Incoming {isVideoCall ? 'video' : 'voice'} call...
                </ThemedText>
              </View>
            </View>

            <View style={styles.actions}>
              <Pressable style={styles.declineButton} onPress={handleDecline}>
                <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: '135deg' }] }} />
              </Pressable>
              
              <Pressable style={styles.acceptButton} onPress={handleAccept}>
                <Ionicons name={isVideoCall ? "videocam" : "call"} size={28} color="#FFF" />
              </Pressable>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  callCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gradient: {
    padding: 20,
  },
  callerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  textContainer: {
    marginLeft: 16,
    flex: 1,
  },
  callerName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  callType: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  declineButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF5252',
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

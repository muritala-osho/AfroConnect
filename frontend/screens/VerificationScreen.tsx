import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native';
import { Image } from 'expo-image';
import { SafeImage } from '@/components/SafeImage';
import { ThemedText } from '@/components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Camera, CameraView } from 'expo-camera';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { getApiBaseUrl } from '@/constants/config';

type VerificationStatus = 'not_requested' | 'pending' | 'approved' | 'rejected';

interface VerificationState {
  verified: boolean;
  status: VerificationStatus;
  requestDate: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
}

export default function VerificationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token, user } = useAuth();
  const { get } = useApi();
  
  const [verificationState, setVerificationState] = useState<VerificationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [capturedSelfiePhoto, setCapturedSelfiePhoto] = useState<string | null>(null);
  const [verificationStep, setVerificationStep] = useState<'selfie' | 'review'>('selfie');
  const cameraRef = useRef<any>(null);

  const selfieTips = [
    'Position your face in the center',
    'Good lighting on your face',
    'Clear background behind you',
    'Look directly at the camera'
  ];


  useEffect(() => {
    fetchVerificationStatus();
  }, []);

  const fetchVerificationStatus = async () => {
    if (!token) return;
    
    try {
      const response = await get<any>('/verification/status', {}, token);
      const resData: any = response;
      if (resData && resData.success && resData.data) {
        setVerificationState(resData.data as any);
      }
    } catch (error) {
      console.error('Failed to fetch verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasPermission(status === 'granted');
    if (status === 'granted') {
      setShowCamera(true);
    } else {
      Alert.alert(
        'Camera Permission Required',
        'Please enable camera access in your device settings to verify your profile.',
        [{ text: 'OK' }]
      );
    }
  };

  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
        if (photo) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setCapturedSelfiePhoto(photo.uri);
          setVerificationStep('review');
          setShowCamera(false);
        }
      } catch (error) {
        console.error('Failed to take photo:', error);
        Alert.alert('Error', 'Failed to capture photo. Please try again.');
      }
    }
  };

  const retakePhoto = () => {
    setCapturedSelfiePhoto(null);
    setVerificationStep('selfie');
    setShowCamera(true);
  };

  const submitVerification = async () => {
    if (!capturedSelfiePhoto || !token) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('selfiePhoto', {
        uri: capturedSelfiePhoto,
        type: 'image/jpeg',
        name: 'selfie.jpg',
      } as any);

      const response = await fetch(`${getApiBaseUrl()}/api/verification/request`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Verification Submitted',
          'Your selfie has been submitted for review. Our team will compare it with your profile and you\'ll receive a "Photo Verified" badge once approved.',
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
      } else {
        throw new Error(data.message || 'Verification failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit verification');
    } finally {
      setSubmitting(false);
    }
  };

  const renderVerificationBadge = () => {
    if (!verificationState) return null;

    if (verificationState.verified) {
      return (
        <View style={[styles.statusBadge, { backgroundColor: 'rgba(76, 175, 80, 0.15)' }]}>
          <Image 
            source={require("@/assets/icons/verified-tick.png")} 
            style={{ width: 24, height: 24 }} 
            contentFit="contain"
          />
          <ThemedText style={[styles.statusText, { color: '#4CAF50' }]}>Verified</ThemedText>
        </View>
      );
    }

    switch (verificationState.status) {
      case 'pending':
        return (
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(255, 193, 7, 0.15)' }]}>
            <Ionicons name="time" size={24} color="#FFC107" />
            <ThemedText style={[styles.statusText, { color: '#FFC107' }]}>Pending Review</ThemedText>
          </View>
        );
      case 'rejected':
        return (
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(244, 67, 54, 0.15)' }]}>
            <Ionicons name="close-circle" size={24} color="#F44336" />
            <ThemedText style={[styles.statusText, { color: '#F44336' }]}>Not Approved</ThemedText>
            {verificationState.rejectionReason && (
              <ThemedText style={[{ color: '#F44336', fontSize: 12, marginTop: 4 }]}>
                {verificationState.rejectionReason}
              </ThemedText>
            )}
          </View>
        );
      default:
        return (
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(158, 158, 158, 0.15)' }]}>
            <Ionicons name="shield-outline" size={24} color="#9E9E9E" />
            <ThemedText style={[styles.statusText, { color: '#9E9E9E' }]}>Not Verified</ThemedText>
          </View>
        );
    }
  };

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        />
        <View style={[StyleSheet.absoluteFill, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.cameraHeader}>
            <Pressable
              style={styles.closeButton}
              onPress={() => setShowCamera(false)}
            >
              <Ionicons name="close" size={28} color="#FFF" />
            </Pressable>
            <ThemedText style={{ color: '#FFF', fontSize: 18, fontWeight: '700' }}>
              Take a Selfie
            </ThemedText>
            <View style={{ width: 40 }} />
          </View>

          {/* Tips at the top - improved visibility */}
          <View style={styles.topTipsContainer}>
            {selfieTips.map((tip, idx) => (
              <View key={idx} style={styles.topTipItem}>
                <Feather name="check-circle" size={14} color="#4CAF50" />
                <ThemedText style={styles.topTipText}>{tip}</ThemedText>
              </View>
            ))}
          </View>

          {/* Face Guide in center */}
          <View style={styles.faceGuide}>
            <View style={[styles.faceCircle, { borderColor: '#4CAF50', borderWidth: 3 }]} />
            <ThemedText style={styles.faceGuideText}>
              Position your face in the circle
            </ThemedText>
          </View>

          {/* Capture Controls */}
          <View style={[styles.cameraControls, { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: insets.bottom + 20 }]}>
            <Pressable style={styles.captureButton} onPress={takePhoto}>
              <View style={styles.captureButtonInner} />
            </Pressable>
            <ThemedText style={{ color: '#FFF', marginTop: 12, textAlign: 'center', fontSize: 14 }}>Tap to capture</ThemedText>
          </View>
        </View>
      </View>
    );
  }

  // Check if user needs verification and show blocking screen if they are on Discovery
  if (user?.needsVerification && !verificationState?.verified && verificationState?.status !== 'pending') {
     // We allow them to see the verification screen which is this screen
  }

  if (verificationStep === 'review' && capturedSelfiePhoto) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs' as any)}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Review Your Photo</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.reviewContent} contentContainerStyle={{ alignItems: 'center', padding: 20 }}>
          <ThemedText style={[styles.reviewLabel, { marginBottom: 16 }]}>Your Selfie</ThemedText>
          <SafeImage source={{ uri: capturedSelfiePhoto }} style={styles.previewImage} />
          <Pressable style={styles.retakeButton} onPress={retakePhoto}>
            <Ionicons name="refresh" size={16} color={theme.primary} />
            <ThemedText style={[styles.retakeText, { color: theme.primary }]}>Retake Photo</ThemedText>
          </Pressable>

          <View style={[styles.infoBox, { backgroundColor: theme.surface, marginTop: 24 }]}>
            <Ionicons name="information-circle" size={20} color={theme.primary} />
            <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
              Our team will compare this selfie with your profile photos to verify your identity.
            </ThemedText>
          </View>
        </ScrollView>

        <View style={[styles.actions, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            style={[styles.submitButton, submitting && styles.disabledButton]}
            onPress={submitVerification}
            disabled={submitting}
          >
            <LinearGradient
              colors={[theme.primary, theme.secondary || theme.primary]}
              style={styles.submitGradient}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <ThemedText style={styles.submitText}>Submit for Verification</ThemedText>
                  <Ionicons name="shield-checkmark" size={20} color="#FFF" />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable style={styles.backButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('MainTabs' as any)}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.headerTitle}>Get Verified</ThemedText>
          <View style={{ width: 40 }} />
        </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <View style={styles.verifiedHeroCard}>
            <View style={styles.verifiedBadgeCircle}>
              <Ionicons name="shield-checkmark-outline" size={48} color={theme.primary} />
            </View>
            <ThemedText style={[styles.heroTitle, { color: theme.text }]}>
              Verify Your Profile
            </ThemedText>
            <ThemedText style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
              Build trust and get more matches
            </ThemedText>
            {renderVerificationBadge()}
          </View>

          <View style={styles.benefitsGrid}>
            {[
              { icon: 'shield-checkmark', title: 'Trust Badge', desc: 'Show you\'re real' },
              { icon: 'trending-up', title: 'More Visibility', desc: 'Appear in more feeds' },
              { icon: 'heart', title: 'Better Matches', desc: 'Quality connections' },
              { icon: 'star', title: 'Stand Out', desc: 'Premium profile' },
            ].map((item, index) => (
              <View key={index} style={[styles.benefitCard, { backgroundColor: theme.surface }]}>
                <View style={[styles.benefitIconCircle, { backgroundColor: theme.primary + '20' }]}>
                  <Ionicons name={item.icon as any} size={22} color={theme.primary} />
                </View>
                <ThemedText style={[styles.benefitCardTitle, { color: theme.text }]}>{item.title}</ThemedText>
                <ThemedText style={[styles.benefitCardDesc, { color: theme.textSecondary }]}>{item.desc}</ThemedText>
              </View>
            ))}
          </View>

          <View style={[styles.stepsCard, { backgroundColor: theme.surface }]}>
            <ThemedText style={[styles.stepsTitle, { color: theme.text }]}>How It Works</ThemedText>
            
            <View style={styles.stepsRow}>
              {[
                { num: '1', icon: 'camera', title: 'Take Selfie' },
                { num: '2', icon: 'checkmark-done', title: 'Get Verified' },
              ].map((step, index) => (
                <View key={index} style={styles.stepColumn}>
                  <View style={[styles.stepCircle, { backgroundColor: theme.primary }]}>
                    <Ionicons name={step.icon as any} size={20} color="#FFF" />
                  </View>
                  <ThemedText style={[styles.stepLabel, { color: theme.text }]}>{step.title}</ThemedText>
                  {index < 1 && <View style={[styles.stepConnector, { backgroundColor: theme.primary + '40' }]} />}
                </View>
              ))}
            </View>
          </View>

          {(!verificationState?.verified && verificationState?.status !== 'pending') && (
            <Pressable style={styles.verifyButton} onPress={requestCameraPermission}>
              <LinearGradient
                colors={[theme.primary, theme.secondary || theme.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.verifyGradient}
              >
                <Ionicons name="camera" size={22} color="#FFF" />
                <ThemedText style={styles.verifyButtonText}>Start Verification</ThemedText>
              </LinearGradient>
            </Pressable>
          )}

          {verificationState?.status === 'pending' && (
            <View style={[styles.pendingCard, { backgroundColor: '#FFC10720' }]}>
              <Ionicons name="time" size={24} color="#FFC107" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText style={[styles.pendingTitle, { color: '#FFC107' }]}>Under Review</ThemedText>
                <ThemedText style={[styles.pendingDesc, { color: theme.textSecondary }]}>
                  We're comparing your selfie with your profile photos. This usually takes up to 24 hours.
                </ThemedText>
              </View>
            </View>
          )}

          {verificationState?.verified && (
            <View style={[styles.verifiedCard, { backgroundColor: '#4CAF5020' }]}>
              <Feather name="check-circle" size={24} color="#4CAF50" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText style={[styles.verifiedTitle, { color: '#4CAF50' }]}>You're Verified!</ThemedText>
                <ThemedText style={[styles.verifiedDesc, { color: theme.textSecondary }]}>
                  Your profile has been verified. Enjoy your premium badge!
                </ThemedText>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  heroSection: {
    marginBottom: 24,
  },
  heroBg: {
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconGradient: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    marginBottom: 32,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  benefitsSection: {
    marginBottom: 32,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  benefitText: {
    fontSize: 16,
    flex: 1,
    fontWeight: '500',
    color: '#EEE',
  },
  howItWorks: {
    marginBottom: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 24,
    borderRadius: 24,
  },
  howItWorksTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    color: '#FFF',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  stepNumberText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepText: {
    fontSize: 14,
    flex: 1,
    color: '#999',
    marginTop: 4,
  },
  verifyButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  verifyGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  verifyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pendingMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 16,
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderRadius: 12,
  },
  pendingText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGuide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -40,
  },
  faceCircle: {
    width: 280,
    height: 380,
    borderRadius: 140,
    borderWidth: 3,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
  },
  poseInstruction: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    marginHorizontal: 40,
    borderRadius: 16,
    gap: 8,
  },
  poseText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  cameraControls: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4CAF50',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  tipsSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  previewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 16,
  },
  reviewContent: {
    flex: 1,
    padding: 24,
  },
  reviewLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  actions: {
    padding: 24,
    gap: 16,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.6,
  },
  verifiedHeroCard: {
    alignItems: 'center',
    marginBottom: 24,
  },
  verifiedBadgeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    marginBottom: 16,
  },
  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  benefitCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  benefitCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  benefitCardDesc: {
    fontSize: 12,
    textAlign: 'center',
  },
  stepsCard: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 24,
  },
  stepsTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  stepsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  stepColumn: {
    alignItems: 'center',
    position: 'relative',
  },
  stepCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepConnector: {
    position: 'absolute',
    top: 24,
    left: 48,
    width: 40,
    height: 2,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  pendingDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  verifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginTop: 8,
  },
  verifiedTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  verifiedDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  topTipsContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  topTipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  topTipText: {
    color: '#FFF',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '500',
  },
  faceGuideText: {
    color: '#FFF',
    marginTop: 20,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

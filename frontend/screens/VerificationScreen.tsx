import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert, Platform, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { SafeImage } from '@/components/SafeImage';
import { ThemedText } from '@/components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Camera, CameraView } from 'expo-camera';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { getApiBaseUrl } from '@/constants/config';
import { VerificationBadge } from '@/components/VerificationBadge';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type VerificationStatus = 'not_requested' | 'pending' | 'approved' | 'rejected';

interface VerificationState {
  verified: boolean;
  status: VerificationStatus;
  requestDate: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
}

const BENEFITS = [
  { icon: 'shield-checkmark', title: 'Trust Badge', desc: 'Blue tick on your profile', color: '#4CAF50' },
  { icon: 'trending-up', title: 'More Matches', desc: 'Appear higher in discovery', color: '#2196F3' },
  { icon: 'heart', title: 'Better Connections', desc: 'Quality over quantity', color: '#E91E63' },
  { icon: 'star', title: 'Stand Out', desc: 'Premium verified look', color: '#FF9800' },
];

const STEPS = [
  { num: 1, icon: 'camera-outline', title: 'Take a selfie', desc: 'Front camera, good lighting' },
  { num: 2, icon: 'cloud-upload-outline', title: 'Submit for review', desc: 'Our team reviews within 24h' },
  { num: 3, icon: 'checkmark-circle-outline', title: 'Get your badge', desc: 'Verified tick appears on profile' },
];

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
          'Submitted!',
          'Your selfie has been submitted. Our team will compare it with your profile photos and award your verified badge within 24 hours.',
          [{ text: 'Got it', onPress: () => navigation.goBack() }]
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

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

        <LinearGradient
          colors={['rgba(0,0,0,0.7)', 'transparent']}
          style={[styles.cameraTopOverlay, { paddingTop: insets.top + 8 }]}
        >
          <View style={styles.cameraHeader}>
            <Pressable style={styles.cameraCloseBtn} onPress={() => setShowCamera(false)}>
              <Ionicons name="close" size={24} color="#FFF" />
            </Pressable>
            <ThemedText style={styles.cameraTitle}>Take a Selfie</ThemedText>
            <View style={{ width: 44 }} />
          </View>

          <View style={styles.tipsList}>
            {['Face centered & visible', 'Good lighting', 'No sunglasses or hats'].map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={styles.tipDot} />
                <ThemedText style={styles.tipText}>{tip}</ThemedText>
              </View>
            ))}
          </View>
        </LinearGradient>

        <View style={styles.faceGuideWrapper}>
          <View style={styles.faceOval}>
            <View style={styles.faceOvalCornerTL} />
            <View style={styles.faceOvalCornerTR} />
            <View style={styles.faceOvalCornerBL} />
            <View style={styles.faceOvalCornerBR} />
          </View>
          <ThemedText style={styles.faceGuideLabel}>Fit your face inside</ThemedText>
        </View>

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={[styles.cameraBottomOverlay, { paddingBottom: insets.bottom + 24 }]}
        >
          <Pressable style={styles.captureBtn} onPress={takePhoto}>
            <View style={styles.captureBtnOuter}>
              <LinearGradient
                colors={['#4CAF50', '#2E7D32']}
                style={styles.captureBtnInner}
              >
                <Ionicons name="camera" size={28} color="#FFF" />
              </LinearGradient>
            </View>
          </Pressable>
          <ThemedText style={styles.captureBtnLabel}>Tap to capture</ThemedText>
        </LinearGradient>
      </View>
    );
  }

  if (verificationStep === 'review' && capturedSelfiePhoto) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={[theme.primary + '20', theme.primary + '08', 'transparent']}
          style={[styles.reviewHeader, { paddingTop: insets.top + 8 }]}
        >
          <Pressable style={styles.backBtn} onPress={() => navigation.canGoBack() ? navigation.goBack() : (navigation as any).navigate('MainTabs')}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Review Photo</ThemedText>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.reviewContent}>
          <View style={styles.reviewPhotoWrapper}>
            <LinearGradient
              colors={[theme.primary, theme.primary + '80']}
              style={styles.reviewPhotoRing}
            >
              <SafeImage source={{ uri: capturedSelfiePhoto }} style={styles.reviewPhoto} />
            </LinearGradient>
            <ThemedText style={[styles.reviewPhotoLabel, { color: theme.textSecondary }]}>
              Your selfie
            </ThemedText>
          </View>

          <View style={[styles.reviewInfoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.reviewInfoRow}>
              <View style={[styles.reviewInfoIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="eye-outline" size={20} color={theme.primary} />
              </View>
              <ThemedText style={[styles.reviewInfoText, { color: theme.textSecondary }]}>
                Our team will compare this selfie with your profile photos to confirm your identity. Only our moderators will see it.
              </ThemedText>
            </View>
          </View>

          <Pressable style={[styles.retakeBtn, { borderColor: theme.border }]} onPress={retakePhoto}>
            <Ionicons name="refresh-outline" size={18} color={theme.primary} />
            <ThemedText style={[styles.retakeBtnText, { color: theme.primary }]}>Retake Photo</ThemedText>
          </Pressable>
        </ScrollView>

        <View style={[styles.reviewFooter, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={submitVerification}
            disabled={submitting}
          >
            <LinearGradient
              colors={[theme.primary, (theme as any).secondary || theme.primary + 'CC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitBtnGradient}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={20} color="#FFF" />
                  <ThemedText style={styles.submitBtnText}>Submit for Verification</ThemedText>
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
      <LinearGradient
        colors={[theme.primary + '25', theme.primary + '08', 'transparent']}
        style={[styles.mainHeader, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.mainHeaderRow}>
          <Pressable style={styles.backBtn} onPress={() => navigation.canGoBack() ? navigation.goBack() : (navigation as any).navigate('MainTabs')}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Get Verified</ThemedText>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>Loading...</ThemedText>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.mainContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
            <LinearGradient
              colors={[theme.primary + '25', theme.primary + '10']}
              style={styles.heroCard}
            >
              <LinearGradient
                colors={[theme.primary, (theme as any).secondary || theme.primary + 'CC']}
                style={styles.heroIconCircle}
              >
                <Ionicons name="shield-checkmark" size={36} color="#FFF" />
              </LinearGradient>
              <ThemedText style={[styles.heroTitle, { color: theme.text }]}>
                Verify Your Identity
              </ThemedText>
              <ThemedText style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                A quick selfie is all it takes. Get your verified badge and stand out.
              </ThemedText>

              {verificationState?.verified && (
                <View style={[styles.statusPill, { backgroundColor: '#4CAF5025' }]}>
                  <VerificationBadge size={18} />
                  <ThemedText style={[styles.statusPillText, { color: '#4CAF50' }]}>You're Verified</ThemedText>
                </View>
              )}
              {verificationState?.status === 'pending' && (
                <View style={[styles.statusPill, { backgroundColor: '#FFC10720' }]}>
                  <Ionicons name="time" size={16} color="#FFC107" />
                  <ThemedText style={[styles.statusPillText, { color: '#FFC107' }]}>Pending Review</ThemedText>
                </View>
              )}
              {verificationState?.status === 'rejected' && (
                <View style={[styles.statusPill, { backgroundColor: '#F4433620' }]}>
                  <Ionicons name="close-circle" size={16} color="#F44336" />
                  <ThemedText style={[styles.statusPillText, { color: '#F44336' }]}>Not Approved</ThemedText>
                </View>
              )}
            </LinearGradient>
          </View>

          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Why get verified?</ThemedText>
          <View style={styles.benefitsGrid}>
            {BENEFITS.map((b, i) => (
              <View key={i} style={[styles.benefitCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={[styles.benefitIconCircle, { backgroundColor: b.color + '20' }]}>
                  <Ionicons name={b.icon as any} size={22} color={b.color} />
                </View>
                <ThemedText style={[styles.benefitTitle, { color: theme.text }]}>{b.title}</ThemedText>
                <ThemedText style={[styles.benefitDesc, { color: theme.textSecondary }]}>{b.desc}</ThemedText>
              </View>
            ))}
          </View>

          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>How it works</ThemedText>
          <View style={[styles.stepsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {STEPS.map((step, i) => (
              <View key={i}>
                <View style={styles.stepRow}>
                  <View style={[styles.stepNumCircle, { backgroundColor: theme.primary }]}>
                    <ThemedText style={styles.stepNum}>{step.num}</ThemedText>
                  </View>
                  <View style={styles.stepInfo}>
                    <ThemedText style={[styles.stepTitle, { color: theme.text }]}>{step.title}</ThemedText>
                    <ThemedText style={[styles.stepDesc, { color: theme.textSecondary }]}>{step.desc}</ThemedText>
                  </View>
                  <Ionicons name={step.icon as any} size={22} color={theme.primary + '80'} />
                </View>
                {i < STEPS.length - 1 && (
                  <View style={[styles.stepLine, { backgroundColor: theme.border }]} />
                )}
              </View>
            ))}
          </View>

          {verificationState?.status === 'pending' && (
            <View style={[styles.alertCard, { backgroundColor: '#FFC10715', borderColor: '#FFC10740' }]}>
              <Ionicons name="time" size={24} color="#FFC107" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText style={[styles.alertTitle, { color: '#FFC107' }]}>Under Review</ThemedText>
                <ThemedText style={[styles.alertDesc, { color: theme.textSecondary }]}>
                  We're reviewing your selfie now. This usually takes up to 24 hours.
                </ThemedText>
              </View>
            </View>
          )}

          {verificationState?.status === 'rejected' && verificationState.rejectionReason && (
            <View style={[styles.alertCard, { backgroundColor: '#F4433615', borderColor: '#F4433640' }]}>
              <Ionicons name="alert-circle" size={24} color="#F44336" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText style={[styles.alertTitle, { color: '#F44336' }]}>Rejection Reason</ThemedText>
                <ThemedText style={[styles.alertDesc, { color: theme.textSecondary }]}>
                  {verificationState.rejectionReason}
                </ThemedText>
              </View>
            </View>
          )}

          {verificationState?.verified && (
            <View style={[styles.alertCard, { backgroundColor: '#4CAF5015', borderColor: '#4CAF5040' }]}>
              <Feather name="check-circle" size={24} color="#4CAF50" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText style={[styles.alertTitle, { color: '#4CAF50' }]}>You're Verified!</ThemedText>
                <ThemedText style={[styles.alertDesc, { color: theme.textSecondary }]}>
                  Your verified badge is live on your profile. Keep enjoying AfroConnect!
                </ThemedText>
              </View>
            </View>
          )}

          {(!verificationState?.verified && verificationState?.status !== 'pending') && (
            <Pressable style={styles.startBtn} onPress={requestCameraPermission}>
              <LinearGradient
                colors={[theme.primary, (theme as any).secondary || theme.primary + 'CC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startBtnGradient}
              >
                <Ionicons name="camera" size={22} color="#FFF" />
                <ThemedText style={styles.startBtnText}>Start Verification</ThemedText>
              </LinearGradient>
            </Pressable>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
  },

  mainHeader: {
    paddingBottom: 16,
  },
  mainHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  mainContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  heroSection: {
    marginBottom: 28,
  },
  heroCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  heroIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 4,
  },
  statusPillText: {
    fontSize: 14,
    fontWeight: '700',
  },

  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },

  benefitsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  benefitCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  benefitIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  benefitDesc: {
    fontSize: 12,
    lineHeight: 17,
  },

  stepsCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  stepNumCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  stepLine: {
    width: 2,
    height: 20,
    marginLeft: 17,
    marginVertical: 4,
  },

  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  alertDesc: {
    fontSize: 13,
    lineHeight: 19,
  },

  startBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
  },
  startBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  startBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },

  reviewContent: {
    padding: 24,
    alignItems: 'center',
  },
  reviewPhotoWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  reviewPhotoRing: {
    padding: 4,
    borderRadius: 130,
    marginBottom: 10,
  },
  reviewPhoto: {
    width: 240,
    height: 240,
    borderRadius: 120,
  },
  reviewPhotoLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  reviewInfoCard: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  reviewInfoRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  reviewInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewInfoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  retakeBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  reviewFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  submitBtn: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },

  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraTopOverlay: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  cameraCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  tipsList: {
    gap: 6,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4CAF50',
  },
  tipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '500',
  },
  faceGuideWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceOval: {
    width: 260,
    height: 340,
    borderRadius: 130,
    borderWidth: 2.5,
    borderColor: 'rgba(76,175,80,0.8)',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
    position: 'relative',
  },
  faceOvalCornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#4CAF50',
    borderTopLeftRadius: 8,
  },
  faceOvalCornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 30,
    height: 30,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#4CAF50',
    borderTopRightRadius: 8,
  },
  faceOvalCornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#4CAF50',
    borderBottomLeftRadius: 8,
  },
  faceOvalCornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#4CAF50',
    borderBottomRightRadius: 8,
  },
  faceGuideLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 16,
    fontWeight: '500',
  },
  cameraBottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 40,
  },
  captureBtn: {
    marginBottom: 10,
  },
  captureBtnOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.8)',
    padding: 4,
  },
  captureBtnInner: {
    flex: 1,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '500',
  },
});
import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  Alert, Dimensions, Animated,
} from 'react-native';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type VerificationStatus = 'not_requested' | 'pending' | 'approved' | 'rejected';
interface VerificationState {
  verified: boolean;
  status: VerificationStatus;
  requestDate: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
}

const BENEFITS = [
  { icon: 'shield-checkmark', title: 'Trust Badge',        desc: 'Blue tick on your profile',        color: '#4CAF50' },
  { icon: 'trending-up',      title: 'More Matches',       desc: 'Appear higher in discovery',       color: '#2196F3' },
  { icon: 'heart',            title: 'Better Connections', desc: 'Quality over quantity',             color: '#E91E63' },
  { icon: 'star',             title: 'Stand Out',          desc: 'Premium verified look',            color: '#FF9800' },
];

const STEPS = [
  { num: 1, icon: 'camera-outline',          title: 'Quick live selfie',   desc: 'Follow 3 on-screen prompts while the camera is open' },
  { num: 2, icon: 'checkmark-circle-outline', title: 'Submit & get badge', desc: 'Verified tick appears on your profile within 24 hours' },
];

// ─── Liveness stages shown in the camera HUD ─────────────────────────────────
const LIVENESS_STAGES = [
  { icon: 'arrow-back',   label: 'Look Left',  color: '#4CAF50', arrowDir: 'left'  },
  { icon: 'arrow-forward', label: 'Look Right', color: '#2196F3', arrowDir: 'right' },
  { icon: 'happy-outline', label: 'Smile',      color: '#FF9800', arrowDir: 'smile' },
] as const;

const STAGE_DURATION_MS = 2000; // time per stage in ms

export default function VerificationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { get } = useApi();

  const [verificationState, setVerificationState] = useState<VerificationState | null>(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Steps: 'main' | 'camera' | 'review'
  const [step, setStep]           = useState<'main' | 'camera' | 'review'>('main');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);

  // Liveness HUD state
  const [livenessStage, setLivenessStage] = useState(0); // 0-2 = prompts, 3 = done
  const livenessStageRef = useRef(0);
  const livenessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animations
  const arrowAnim  = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(1)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const capturePulse = useRef(new Animated.Value(1)).current;

  useEffect(() => { fetchVerificationStatus(); }, []);

  // Start liveness cycle when camera opens
  useEffect(() => {
    if (step === 'camera') {
      livenessStageRef.current = 0;
      setLivenessStage(0);
      advanceLiveness(0);
      return () => { if (livenessTimerRef.current) clearTimeout(livenessTimerRef.current); };
    }
  }, [step]);

  // Arrow bounce animation whenever stage changes
  useEffect(() => {
    if (livenessStage >= LIVENESS_STAGES.length) {
      // All done — pulse the capture button
      Animated.loop(
        Animated.sequence([
          Animated.timing(capturePulse, { toValue: 1.12, duration: 600, useNativeDriver: true }),
          Animated.timing(capturePulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ])
      ).start();
      return;
    }

    capturePulse.setValue(1);
    arrowAnim.setValue(0);
    fadeAnim.setValue(0);

    const dir = LIVENESS_STAGES[livenessStage].arrowDir;
    const target = dir === 'left' ? -14 : dir === 'right' ? 14 : 0;

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(arrowAnim, { toValue: target, duration: 350, useNativeDriver: true }),
          Animated.timing(arrowAnim, { toValue: 0,      duration: 350, useNativeDriver: true }),
        ]), { iterations: dir === 'smile' ? 4 : 999 }
      ),
    ]).start();
  }, [livenessStage]);

  function advanceLiveness(stage: number) {
    if (stage >= LIVENESS_STAGES.length) {
      livenessStageRef.current = LIVENESS_STAGES.length;
      setLivenessStage(LIVENESS_STAGES.length);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    Haptics.selectionAsync();
    livenessTimerRef.current = setTimeout(() => {
      const next = stage + 1;
      livenessStageRef.current = next;
      setLivenessStage(next);
      advanceLiveness(next);
    }, STAGE_DURATION_MS);
  }

  const fetchVerificationStatus = async () => {
    if (!token) return;
    try {
      const response = await get<any>('/verification/status', {}, token);
      const resData: any = response;
      if (resData?.success && resData.data) setVerificationState(resData.data);
    } catch (e) {
      console.error('Failed to fetch verification status:', e);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Required', 'Please enable camera access in device settings.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('camera');
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) return;
      if (livenessTimerRef.current) clearTimeout(livenessTimerRef.current);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCapturedPhoto(photo.uri);
      setStep('review');
    } catch (e) {
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    setStep('camera');
  };

  const submitVerification = async () => {
    if (!capturedPhoto || !token) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('selfiePhoto', {
        uri: capturedPhoto,
        type: 'image/jpeg',
        name: 'selfie.jpg',
      } as any);

      const response = await fetch(`${getApiBaseUrl()}/api/verification/request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Submitted!',
          "Your selfie has been submitted for review. We'll compare it against your profile photos and award your verified badge within 24 hours.",
          [{ text: 'Got it', onPress: () => navigation.goBack() }],
        );
      } else {
        throw new Error(data.message || 'Verification failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit verification');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── CAMERA SCREEN ─────────────────────────────────────────────────────────
  if (step === 'camera') {
    const stagesDone = livenessStage >= LIVENESS_STAGES.length;
    const currentStage = !stagesDone ? LIVENESS_STAGES[livenessStage] : null;

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

        {/* Top gradient + back button */}
        <LinearGradient
          colors={['rgba(0,0,0,0.75)', 'transparent']}
          style={[styles.cameraTopOverlay, { paddingTop: insets.top + 8 }]}
        >
          <View style={styles.cameraHeader}>
            <Pressable style={styles.cameraCloseBtn} onPress={() => setStep('main')}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </Pressable>
            <ThemedText style={styles.cameraTitle}>Live Verification</ThemedText>
            <View style={{ width: 44 }} />
          </View>

          {/* Progress dots */}
          <View style={styles.livenessDots}>
            {LIVENESS_STAGES.map((s, i) => (
              <View
                key={i}
                style={[
                  styles.livenessDot,
                  {
                    backgroundColor:
                      livenessStage > i
                        ? s.color
                        : livenessStage === i
                        ? s.color + 'AA'
                        : 'rgba(255,255,255,0.25)',
                    width: livenessStage === i ? 22 : 8,
                  },
                ]}
              />
            ))}
          </View>
        </LinearGradient>

        {/* Face guide oval */}
        <View style={styles.faceGuideWrapper}>
          <View style={[
            styles.faceOval,
            { borderColor: stagesDone ? '#4CAF50' : (currentStage?.color ?? '#FFF') },
          ]}>
            <View style={[styles.faceOvalCorner, styles.faceOvalCornerTL, { borderColor: stagesDone ? '#4CAF50' : (currentStage?.color ?? '#FFF') }]} />
            <View style={[styles.faceOvalCorner, styles.faceOvalCornerTR, { borderColor: stagesDone ? '#4CAF50' : (currentStage?.color ?? '#FFF') }]} />
            <View style={[styles.faceOvalCorner, styles.faceOvalCornerBL, { borderColor: stagesDone ? '#4CAF50' : (currentStage?.color ?? '#FFF') }]} />
            <View style={[styles.faceOvalCorner, styles.faceOvalCornerBR, { borderColor: stagesDone ? '#4CAF50' : (currentStage?.color ?? '#FFF') }]} />
          </View>
        </View>

        {/* Liveness HUD — shown in the middle of the screen */}
        <View style={styles.livenessHudWrapper} pointerEvents="none">
          {!stagesDone && currentStage ? (
            <Animated.View
              style={[
                styles.livenessHud,
                { backgroundColor: currentStage.color + '22', borderColor: currentStage.color + '66' },
                { opacity: fadeAnim },
              ]}
            >
              <Animated.View style={{
                transform: [
                  currentStage.arrowDir === 'smile'
                    ? { scale: arrowAnim.interpolate({ inputRange: [-14, 0, 14], outputRange: [0.9, 1.1, 0.9] }) }
                    : { translateX: arrowAnim },
                ],
              }}>
                <Ionicons
                  name={currentStage.icon as any}
                  size={46}
                  color={currentStage.color}
                />
              </Animated.View>
              <ThemedText style={[styles.livenessHudLabel, { color: currentStage.color }]}>
                {currentStage.label}
              </ThemedText>
            </Animated.View>
          ) : (
            <Animated.View style={[styles.livenessHudDone, { opacity: fadeAnim }]}>
              <Ionicons name="checkmark-circle" size={44} color="#4CAF50" />
              <ThemedText style={styles.livenessHudDoneText}>Now take your selfie</ThemedText>
            </Animated.View>
          )}
        </View>

        {/* Bottom capture button */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.80)']}
          style={[styles.cameraBottomOverlay, { paddingBottom: insets.bottom + 28 }]}
        >
          <Pressable style={styles.captureBtn} onPress={takePhoto}>
            <Animated.View style={[styles.captureBtnOuter, { transform: [{ scale: capturePulse }] }]}>
              <LinearGradient
                colors={stagesDone ? ['#4CAF50', '#2E7D32'] : ['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.15)']}
                style={styles.captureBtnInner}
              >
                <Ionicons name="camera" size={28} color="#FFF" />
              </LinearGradient>
            </Animated.View>
          </Pressable>
          <ThemedText style={styles.captureBtnLabel}>
            {stagesDone ? 'Tap to capture' : 'Follow the prompts above…'}
          </ThemedText>
        </LinearGradient>
      </View>
    );
  }

  // ─── REVIEW SCREEN ──────────────────────────────────────────────────────────
  if (step === 'review' && capturedPhoto) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={[theme.primary + '20', theme.primary + '08', 'transparent']}
          style={[styles.reviewHeader, { paddingTop: insets.top + 8 }]}
        >
          <Pressable style={styles.backBtn} onPress={() => navigation.canGoBack() ? navigation.goBack() : (navigation as any).navigate('MainTabs')}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Review & Submit</ThemedText>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.reviewContent} showsVerticalScrollIndicator={false}>
          {/* Photo preview */}
          <View style={styles.reviewPhotoWrapper}>
            <LinearGradient
              colors={[theme.primary, (theme as any).secondary || theme.primary + 'CC']}
              style={styles.reviewPhotoRing}
            >
              <SafeImage source={{ uri: capturedPhoto }} style={styles.reviewPhoto} />
            </LinearGradient>
          </View>

          {/* Liveness confirmed badge */}
          <View style={[styles.livenessBadge, { backgroundColor: '#4CAF5015', borderColor: '#4CAF5040' }]}>
            <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <ThemedText style={[styles.livenessBadgeTitle, { color: '#4CAF50' }]}>Liveness Confirmed</ThemedText>
              <ThemedText style={[styles.livenessBadgeDesc, { color: theme.textSecondary }]}>
                Look Left · Look Right · Smile completed
              </ThemedText>
            </View>
          </View>

          <View style={[styles.reviewInfoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.reviewInfoRow}>
              <View style={[styles.reviewInfoIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="eye-outline" size={20} color={theme.primary} />
              </View>
              <ThemedText style={[styles.reviewInfoText, { color: theme.textSecondary }]}>
                Our team will verify your face matches your profile photos. Only moderators see this selfie — it's never shown to other users.
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
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
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

  // ─── MAIN SCREEN ────────────────────────────────────────────────────────────
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
          {/* Hero */}
          <View style={styles.heroSection}>
            <LinearGradient colors={[theme.primary + '25', theme.primary + '10']} style={styles.heroCard}>
              <LinearGradient
                colors={[theme.primary, (theme as any).secondary || theme.primary + 'CC']}
                style={styles.heroIconCircle}
              >
                <Ionicons name="shield-checkmark" size={36} color="#FFF" />
              </LinearGradient>
              <ThemedText style={[styles.heroTitle, { color: theme.text }]}>Verify Your Identity</ThemedText>
              <ThemedText style={[styles.heroSubtitle, { color: theme.textSecondary }]}>
                Take a quick live selfie — look left, look right, smile — to prove you're real and earn your verified badge.
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

          {/* Live selfie indicator preview */}
          <View style={[styles.livenessPreviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={[styles.livenessPreviewTitle, { color: theme.text }]}>
              What you'll do
            </ThemedText>
            <View style={styles.livenessPreviewRow}>
              {LIVENESS_STAGES.map((s, i) => (
                <View key={i} style={styles.livenessPreviewItem}>
                  <View style={[styles.livenessPreviewIcon, { backgroundColor: s.color + '20' }]}>
                    <Ionicons name={s.icon as any} size={22} color={s.color} />
                  </View>
                  <ThemedText style={[styles.livenessPreviewLabel, { color: theme.textSecondary }]}>
                    {s.label}
                  </ThemedText>
                  {i < LIVENESS_STAGES.length - 1 && (
                    <Ionicons name="chevron-forward" size={14} color={theme.border} style={styles.livenessPreviewArrow} />
                  )}
                </View>
              ))}
            </View>
          </View>

          {/* Benefits */}
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

          {/* How it works */}
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>How it works</ThemedText>
          <View style={[styles.stepsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {STEPS.map((s, i) => (
              <View key={i}>
                <View style={styles.stepRow}>
                  <View style={[styles.stepNumCircle, { backgroundColor: theme.primary }]}>
                    <ThemedText style={styles.stepNum}>{s.num}</ThemedText>
                  </View>
                  <View style={styles.stepInfo}>
                    <ThemedText style={[styles.stepTitle, { color: theme.text }]}>{s.title}</ThemedText>
                    <ThemedText style={[styles.stepDesc, { color: theme.textSecondary }]}>{s.desc}</ThemedText>
                  </View>
                  <Ionicons name={s.icon as any} size={22} color={theme.primary + '80'} />
                </View>
                {i < STEPS.length - 1 && <View style={[styles.stepLine, { backgroundColor: theme.border }]} />}
              </View>
            ))}
          </View>

          {/* Status alerts */}
          {verificationState?.status === 'pending' && (
            <View style={[styles.alertCard, { backgroundColor: '#FFC10715', borderColor: '#FFC10740' }]}>
              <Ionicons name="time" size={24} color="#FFC107" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText style={[styles.alertTitle, { color: '#FFC107' }]}>Under Review</ThemedText>
                <ThemedText style={[styles.alertDesc, { color: theme.textSecondary }]}>
                  We're reviewing your submission. This usually takes up to 24 hours.
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
                  Your verified badge is live on your profile.
                </ThemedText>
              </View>
            </View>
          )}

          {/* Start button */}
          {!verificationState?.verified && verificationState?.status !== 'pending' && (
            <Pressable style={styles.startBtn} onPress={startCamera}>
              <LinearGradient
                colors={[theme.primary, (theme as any).secondary || theme.primary + 'CC']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.startBtnGradient}
              >
                <Ionicons name="camera-outline" size={22} color="#FFF" />
                <ThemedText style={styles.startBtnText}>Start Live Verification</ThemedText>
              </LinearGradient>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 15 },

  mainHeader: { paddingBottom: 16 },
  mainHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 0, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  mainContent: { paddingHorizontal: 20, paddingTop: 8 },

  heroSection: { marginBottom: 24 },
  heroCard: { borderRadius: 24, padding: 28, alignItems: 'center' },
  heroIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  heroTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  heroSubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 4 },
  statusPillText: { fontSize: 14, fontWeight: '700' },

  livenessPreviewCard: { borderRadius: 20, padding: 18, borderWidth: 1, marginBottom: 24 },
  livenessPreviewTitle: { fontSize: 13, fontWeight: '700', marginBottom: 14, textAlign: 'center' },
  livenessPreviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 },
  livenessPreviewItem: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  livenessPreviewIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  livenessPreviewLabel: { fontSize: 12, fontWeight: '600' },
  livenessPreviewArrow: { marginHorizontal: 6 },

  sectionTitle: { fontSize: 17, fontWeight: '700', marginBottom: 14 },

  benefitsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  benefitCard: { width: (SCREEN_WIDTH - 52) / 2, borderRadius: 18, padding: 16, borderWidth: 1, alignItems: 'flex-start' },
  benefitIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  benefitTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  benefitDesc: { fontSize: 12, lineHeight: 17 },

  stepsCard: { borderRadius: 20, padding: 20, borderWidth: 1, marginBottom: 24 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 4 },
  stepNumCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepNum: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  stepInfo: { flex: 1 },
  stepTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  stepDesc: { fontSize: 13, lineHeight: 18 },
  stepLine: { width: 2, height: 20, marginLeft: 17, marginVertical: 4 },

  alertCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 20 },
  alertTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  alertDesc: { fontSize: 13, lineHeight: 19 },

  startBtn: { borderRadius: 16, overflow: 'hidden', marginBottom: 8 },
  startBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  startBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },

  // ─── Camera ────────────────────────────────────────────────────────────────
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraTopOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 20 },
  cameraHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 14 },
  cameraCloseBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 22 },
  cameraTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },

  livenessDots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  livenessDot: { height: 8, borderRadius: 4 },

  // Face guide oval
  faceGuideWrapper: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  faceOval: { width: 220, height: 290, borderRadius: 110, borderWidth: 2, borderStyle: 'dashed' },
  faceOvalCorner: { position: 'absolute', width: 30, height: 30, borderWidth: 4 },
  faceOvalCornerTL: { top: -2, left: -2, borderBottomWidth: 0, borderRightWidth: 0, borderRadius: 4 },
  faceOvalCornerTR: { top: -2, right: -2, borderBottomWidth: 0, borderLeftWidth: 0, borderRadius: 4 },
  faceOvalCornerBL: { bottom: -2, left: -2, borderTopWidth: 0, borderRightWidth: 0, borderRadius: 4 },
  faceOvalCornerBR: { bottom: -2, right: -2, borderTopWidth: 0, borderLeftWidth: 0, borderRadius: 4 },

  // Liveness HUD
  livenessHudWrapper: { position: 'absolute', bottom: 200, left: 0, right: 0, zIndex: 20, alignItems: 'center' },
  livenessHud: { alignItems: 'center', gap: 10, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 24, borderWidth: 1.5, minWidth: 160 },
  livenessHudLabel: { fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  livenessHudDone: { alignItems: 'center', gap: 8 },
  livenessHudDoneText: { color: '#4CAF50', fontSize: 16, fontWeight: '700' },

  // Capture button
  cameraBottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, paddingTop: 40, alignItems: 'center', gap: 10 },
  captureBtn: { alignItems: 'center', justifyContent: 'center' },
  captureBtnOuter: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  captureBtnInner: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  captureBtnLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600' },

  // ─── Review ────────────────────────────────────────────────────────────────
  reviewContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  reviewPhotoWrapper: { alignItems: 'center', marginBottom: 24 },
  reviewPhotoRing: { padding: 4, borderRadius: 120, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12 },
  reviewPhoto: { width: 200, height: 200, borderRadius: 100 },

  livenessBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 16 },
  livenessBadgeTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  livenessBadgeDesc: { fontSize: 12 },

  reviewInfoCard: { borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 20 },
  reviewInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  reviewInfoIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reviewInfoText: { flex: 1, fontSize: 13, lineHeight: 19 },

  retakeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1, marginBottom: 4 },
  retakeBtnText: { fontSize: 15, fontWeight: '600' },

  reviewFooter: { paddingHorizontal: 20 },
  submitBtn: { borderRadius: 16, overflow: 'hidden' },
  submitBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  submitBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },
});

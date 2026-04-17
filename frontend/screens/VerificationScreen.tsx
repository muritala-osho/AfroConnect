import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  { icon: 'shield-checkmark', title: 'Trust Badge',        desc: 'Blue tick on your profile',     color: '#4CAF50' },
  { icon: 'trending-up',      title: 'More Matches',       desc: 'Appear higher in discovery',    color: '#2196F3' },
  { icon: 'heart',            title: 'Better Connections', desc: 'Quality over quantity',          color: '#E91E63' },
  { icon: 'star',             title: 'Stand Out',          desc: 'Premium verified look',          color: '#FF9800' },
];

const STEPS = [
  { num: 1, icon: 'camera-outline',           title: 'Quick live selfie',  desc: 'Follow 3 on-screen prompts — the camera watches you in real time' },
  { num: 2, icon: 'checkmark-circle-outline', title: 'Submit & get badge', desc: 'Verified tick appears on your profile within 24 hours' },
];

// ─── Liveness stages ─────────────────────────────────────────────────────────
// yaw: negative = user looking LEFT, positive = user looking RIGHT
// Front-facing camera: if images are mirrored, swap the signs.
const LIVENESS_STAGES = [
  {
    icon: 'arrow-back'   as const,
    label: 'Look Left',
    hint: 'Turn your head slowly to the left',
    color: '#4CAF50',
    check: (yaw: number, smile: number) => yaw < -12,
  },
  {
    icon: 'arrow-forward' as const,
    label: 'Look Right',
    hint: 'Now turn your head to the right',
    color: '#2196F3',
    check: (yaw: number, smile: number) => yaw > 12,
  },
  {
    icon: 'happy-outline' as const,
    label: 'Smile',
    hint: 'Give us a big smile',
    color: '#FF9800',
    check: (yaw: number, smile: number) => smile > 0.60,
  },
] as const;

const HOLD_DURATION_MS = 500; // how long to hold pose before advancing
const SCAN_INTERVAL_MS = 900; // how often to analyze a frame

export default function VerificationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { get } = useApi();

  const [verificationState, setVerificationState] = useState<VerificationState | null>(null);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [step, setStep] = useState<'main' | 'camera' | 'review'>('main');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);

  // ─── Liveness detection state ───────────────────────────────────────────────
  const [livenessStage, setLivenessStage]     = useState(0);
  const livenessStageRef                      = useRef(0);
  const [faceDetected, setFaceDetected]       = useState(false);
  const [holdProgress, setHoldProgress]       = useState(0); // 0-1
  const isAnalyzingRef                        = useRef(false);
  const detectionIntervalRef                  = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdStartRef                          = useRef<number | null>(null);

  // Animations
  const stageTransitionAnim = useRef(new Animated.Value(1)).current;
  const capturePulse        = useRef(new Animated.Value(1)).current;
  const dotPulse            = useRef(new Animated.Value(0)).current;

  useEffect(() => { fetchVerificationStatus(); }, []);

  // Start / stop detection loop when camera is open
  useEffect(() => {
    if (step === 'camera') {
      livenessStageRef.current = 0;
      setLivenessStage(0);
      setFaceDetected(false);
      setHoldProgress(0);
      holdStartRef.current = null;
      startDetectionLoop();
    } else {
      stopDetectionLoop();
    }
    return () => stopDetectionLoop();
  }, [step]);

  // Animate stage card whenever stage changes
  useEffect(() => {
    stageTransitionAnim.setValue(0);
    Animated.spring(stageTransitionAnim, { toValue: 1, useNativeDriver: true, damping: 14, stiffness: 120 }).start();

    if (livenessStage >= LIVENESS_STAGES.length) {
      // All done — pulse capture button
      Animated.loop(
        Animated.sequence([
          Animated.timing(capturePulse, { toValue: 1.10, duration: 650, useNativeDriver: true }),
          Animated.timing(capturePulse, { toValue: 1,    duration: 650, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [livenessStage]);

  // Scanning dot animation
  useEffect(() => {
    if (step !== 'camera') return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(dotPulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [step]);

  const startDetectionLoop = () => {
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    // Small delay so camera is fully ready
    setTimeout(() => {
      detectionIntervalRef.current = setInterval(analyzeFrame, SCAN_INTERVAL_MS);
    }, 1200);
  };

  const stopDetectionLoop = () => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
  };

  const advanceStage = useCallback((toStage: number) => {
    holdStartRef.current = null;
    setHoldProgress(0);
    isAnalyzingRef.current = false;

    if (toStage >= LIVENESS_STAGES.length) {
      // All stages done
      stopDetectionLoop();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      livenessStageRef.current = LIVENESS_STAGES.length;
      setLivenessStage(LIVENESS_STAGES.length);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      livenessStageRef.current = toStage;
      setLivenessStage(toStage);
    }
  }, []);

  const analyzeFrame = useCallback(async () => {
    if (isAnalyzingRef.current) return;
    if (!cameraRef.current) return;
    if (livenessStageRef.current >= LIVENESS_STAGES.length) return;

    isAnalyzingRef.current = true;
    try {
      // Take a low-quality frame — just enough for face landmark detection
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.18,
        skipProcessing: true,
      });
      if (!photo?.uri) return;

      // Send to backend for face landmark analysis
      const formData = new FormData();
      formData.append('frame', { uri: photo.uri, type: 'image/jpeg', name: 'frame.jpg' } as any);

      const resp = await fetch(`${getApiBaseUrl()}/api/verification/analyze-frame`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!resp.ok) return;
      const data = await resp.json();

      if (!data.faceDetected) {
        setFaceDetected(false);
        holdStartRef.current = null;
        setHoldProgress(0);
        return;
      }

      setFaceDetected(true);
      const yaw   = data.yawAngle   ?? 0;
      const smile = data.smileScore ?? 0;
      const stage = livenessStageRef.current;

      const conditionMet = LIVENESS_STAGES[stage].check(yaw, smile);

      if (conditionMet) {
        if (!holdStartRef.current) holdStartRef.current = Date.now();
        const elapsed  = Date.now() - holdStartRef.current;
        const progress = Math.min(elapsed / HOLD_DURATION_MS, 1);
        setHoldProgress(progress);
        if (elapsed >= HOLD_DURATION_MS) advanceStage(stage + 1);
      } else {
        holdStartRef.current = null;
        setHoldProgress(0);
      }
    } catch {
      // Network hiccup — silently skip this frame
    } finally {
      isAnalyzingRef.current = false;
    }
  }, [advanceStage, token]);

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
      stopDetectionLoop();
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      if (!photo) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setCapturedPhoto(photo.uri);
      setStep('review');
    } catch (e) {
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
      startDetectionLoop();
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
          "Your selfie has been submitted for review. We'll compare it against your profile photos and notify you within 24 hours.",
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
    const allDone     = livenessStage >= LIVENESS_STAGES.length;
    const stageInfo   = !allDone ? LIVENESS_STAGES[livenessStage] : null;
    const stageColor  = stageInfo?.color ?? '#4CAF50';

    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

        {/* Top gradient */}
        <LinearGradient
          colors={['rgba(0,0,0,0.80)', 'transparent']}
          style={[styles.cameraTopOverlay, { paddingTop: insets.top + 8 }]}
        >
          {/* Header */}
          <View style={styles.cameraHeader}>
            <Pressable style={styles.cameraCloseBtn} onPress={() => { stopDetectionLoop(); setStep('main'); }}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </Pressable>
            <ThemedText style={styles.cameraTitle}>Live Verification</ThemedText>
            <View style={{ width: 44 }} />
          </View>

          {/* Step dots */}
          <View style={styles.stepDotsRow}>
            {LIVENESS_STAGES.map((s, i) => {
              const isDone    = livenessStage > i;
              const isCurrent = livenessStage === i;
              return (
                <View key={i} style={styles.stepDotWrapper}>
                  <View style={[
                    styles.stepDot,
                    {
                      backgroundColor: isDone
                        ? s.color
                        : isCurrent
                        ? s.color + 'BB'
                        : 'rgba(255,255,255,0.22)',
                      width: isCurrent ? 24 : 8,
                    },
                  ]}>
                    {isDone && <Ionicons name="checkmark" size={10} color="#FFF" />}
                  </View>
                </View>
              );
            })}
          </View>
        </LinearGradient>

        {/* Face guide oval — color tracks current stage */}
        <View style={styles.faceGuideWrapper} pointerEvents="none">
          <View style={[styles.faceOval, { borderColor: allDone ? '#4CAF50' : stageColor + 'BB' }]}>
            <View style={[styles.faceOvalCorner, styles.faceOvalCornerTL, { borderColor: allDone ? '#4CAF50' : stageColor }]} />
            <View style={[styles.faceOvalCorner, styles.faceOvalCornerTR, { borderColor: allDone ? '#4CAF50' : stageColor }]} />
            <View style={[styles.faceOvalCorner, styles.faceOvalCornerBL, { borderColor: allDone ? '#4CAF50' : stageColor }]} />
            <View style={[styles.faceOvalCorner, styles.faceOvalCornerBR, { borderColor: allDone ? '#4CAF50' : stageColor }]} />
          </View>
        </View>

        {/* ─── Liveness instruction card ─── */}
        <View style={styles.hudWrapper} pointerEvents="none">
          {allDone ? (
            // All stages done
            <Animated.View
              style={[
                styles.hudCard,
                { backgroundColor: '#4CAF5022', borderColor: '#4CAF5066' },
                { transform: [{ scale: stageTransitionAnim }], opacity: stageTransitionAnim },
              ]}
            >
              <Ionicons name="checkmark-circle" size={40} color="#4CAF50" />
              <ThemedText style={[styles.hudLabel, { color: '#4CAF50' }]}>All set!</ThemedText>
              <ThemedText style={styles.hudHint}>Tap the button to take your selfie</ThemedText>
            </Animated.View>
          ) : (
            <Animated.View
              style={[
                styles.hudCard,
                { backgroundColor: stageColor + '1A', borderColor: stageColor + '55' },
                { transform: [{ scale: stageTransitionAnim }], opacity: stageTransitionAnim },
              ]}
            >
              {/* Icon */}
              <View style={[styles.hudIconCircle, { backgroundColor: stageColor + '25' }]}>
                <Ionicons name={stageInfo!.icon} size={32} color={stageColor} />
              </View>

              {/* Label */}
              <ThemedText style={[styles.hudLabel, { color: stageColor }]}>
                {stageInfo!.label}
              </ThemedText>

              {/* Hint or detection status */}
              {!faceDetected ? (
                <View style={styles.hudStatusRow}>
                  <Animated.View style={[
                    styles.hudStatusDot,
                    { backgroundColor: '#FF5722', opacity: dotPulse },
                  ]} />
                  <ThemedText style={styles.hudHint}>Face your camera directly</ThemedText>
                </View>
              ) : holdProgress > 0 ? (
                // Actively holding correct pose — show progress
                <View style={styles.holdProgressWrapper}>
                  <View style={[styles.holdProgressTrack, { backgroundColor: stageColor + '30' }]}>
                    <View style={[
                      styles.holdProgressFill,
                      { backgroundColor: stageColor, width: `${holdProgress * 100}%` as any },
                    ]} />
                  </View>
                  <ThemedText style={[styles.hudHint, { color: stageColor }]}>Hold it…</ThemedText>
                </View>
              ) : (
                <View style={styles.hudStatusRow}>
                  <Animated.View style={[
                    styles.hudStatusDot,
                    { backgroundColor: stageColor, opacity: dotPulse },
                  ]} />
                  <ThemedText style={styles.hudHint}>{stageInfo!.hint}</ThemedText>
                </View>
              )}
            </Animated.View>
          )}
        </View>

        {/* Bottom capture area */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={[styles.cameraBottomOverlay, { paddingBottom: insets.bottom + 28 }]}
        >
          <Pressable
            style={[styles.captureBtn, !allDone && styles.captureBtnDimmed]}
            onPress={takePhoto}
          >
            <Animated.View style={[styles.captureBtnOuter, { transform: [{ scale: allDone ? capturePulse : 1 }] }]}>
              <LinearGradient
                colors={allDone ? ['#4CAF50', '#2E7D32'] : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.08)']}
                style={styles.captureBtnInner}
              >
                <Ionicons name="camera" size={28} color={allDone ? '#FFF' : 'rgba(255,255,255,0.45)'} />
              </LinearGradient>
            </Animated.View>
          </Pressable>
          <ThemedText style={styles.captureBtnLabel}>
            {allDone ? 'Tap to capture' : 'Complete prompts above to unlock'}
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
          <View style={styles.reviewPhotoWrapper}>
            <LinearGradient
              colors={[theme.primary, (theme as any).secondary || theme.primary + 'CC']}
              style={styles.reviewPhotoRing}
            >
              <SafeImage source={{ uri: capturedPhoto }} style={styles.reviewPhoto} />
            </LinearGradient>
          </View>

          {/* Liveness confirmed */}
          <View style={[styles.livenessBadge, { backgroundColor: '#4CAF5015', borderColor: '#4CAF5040' }]}>
            <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <ThemedText style={[styles.livenessBadgeTitle, { color: '#4CAF50' }]}>Liveness Confirmed</ThemedText>
              <ThemedText style={[styles.livenessBadgeDesc, { color: theme.textSecondary }]}>
                Look Left · Look Right · Smile — all detected by camera
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
              {submitting
                ? <ActivityIndicator color="#FFF" />
                : <>
                    <Ionicons name="shield-checkmark" size={20} color="#FFF" />
                    <ThemedText style={styles.submitBtnText}>Submit for Verification</ThemedText>
                  </>
              }
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
                The camera watches you in real time — look left, look right, smile. Each action unlocks the next step automatically.
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

          {/* Steps preview */}
          <View style={[styles.livenessPreviewCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={[styles.livenessPreviewTitle, { color: theme.text }]}>What the camera checks</ThemedText>
            <View style={styles.livenessPreviewRow}>
              {LIVENESS_STAGES.map((s, i) => (
                <View key={i} style={styles.livenessPreviewItem}>
                  <View style={[styles.livenessPreviewIcon, { backgroundColor: s.color + '20' }]}>
                    <Ionicons name={s.icon} size={22} color={s.color} />
                  </View>
                  <ThemedText style={[styles.livenessPreviewLabel, { color: theme.textSecondary }]}>{s.label}</ThemedText>
                  {i < LIVENESS_STAGES.length - 1 && (
                    <Ionicons name="chevron-forward" size={14} color={theme.border} style={styles.livenessPreviewArrow} />
                  )}
                </View>
              ))}
            </View>
            <ThemedText style={[styles.livenessPreviewNote, { color: theme.textSecondary }]}>
              Each step only advances when your action is actually detected.
            </ThemedText>
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
                <ThemedText style={[styles.alertDesc, { color: theme.textSecondary }]}>{verificationState.rejectionReason}</ThemedText>
              </View>
            </View>
          )}
          {verificationState?.verified && (
            <View style={[styles.alertCard, { backgroundColor: '#4CAF5015', borderColor: '#4CAF5040' }]}>
              <Feather name="check-circle" size={24} color="#4CAF50" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText style={[styles.alertTitle, { color: '#4CAF50' }]}>You're Verified!</ThemedText>
                <ThemedText style={[styles.alertDesc, { color: theme.textSecondary }]}>Your verified badge is live on your profile.</ThemedText>
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
  livenessPreviewRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 4 },
  livenessPreviewItem: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  livenessPreviewIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  livenessPreviewLabel: { fontSize: 12, fontWeight: '600' },
  livenessPreviewArrow: { marginHorizontal: 4 },
  livenessPreviewNote: { fontSize: 11, textAlign: 'center', marginTop: 12, lineHeight: 16, fontStyle: 'italic' },

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
  cameraTopOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 16 },
  cameraHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16 },
  cameraCloseBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 22 },
  cameraTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },

  stepDotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  stepDotWrapper: { alignItems: 'center' },
  stepDot: { height: 8, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },

  // Face oval
  faceGuideWrapper: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  faceOval: { width: 220, height: 290, borderRadius: 110, borderWidth: 2, borderStyle: 'dashed' },
  faceOvalCorner: { position: 'absolute', width: 30, height: 30, borderWidth: 4 },
  faceOvalCornerTL: { top: -2, left: -2, borderBottomWidth: 0, borderRightWidth: 0, borderRadius: 4 },
  faceOvalCornerTR: { top: -2, right: -2, borderBottomWidth: 0, borderLeftWidth: 0, borderRadius: 4 },
  faceOvalCornerBL: { bottom: -2, left: -2, borderTopWidth: 0, borderRightWidth: 0, borderRadius: 4 },
  faceOvalCornerBR: { bottom: -2, right: -2, borderTopWidth: 0, borderLeftWidth: 0, borderRadius: 4 },

  // HUD instruction card
  hudWrapper: {
    position: 'absolute',
    bottom: 210,
    left: 24,
    right: 24,
    zIndex: 20,
    alignItems: 'center',
  },
  hudCard: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 28,
    borderWidth: 1.5,
    width: '100%',
  },
  hudIconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  hudLabel: { fontSize: 20, fontWeight: '900', letterSpacing: 0.2 },
  hudHint: { fontSize: 13, color: 'rgba(255,255,255,0.70)', textAlign: 'center' },
  hudStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  hudStatusDot: { width: 8, height: 8, borderRadius: 4 },

  holdProgressWrapper: { width: '80%', gap: 6, alignItems: 'center', marginTop: 4 },
  holdProgressTrack: { width: '100%', height: 6, borderRadius: 3, overflow: 'hidden' },
  holdProgressFill: { height: '100%', borderRadius: 3 },

  // Capture button
  cameraBottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, paddingTop: 48, alignItems: 'center', gap: 10 },
  captureBtn: { alignItems: 'center', justifyContent: 'center' },
  captureBtnDimmed: { opacity: 0.55 },
  captureBtnOuter: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  captureBtnInner: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center' },
  captureBtnLabel: { color: 'rgba(255,255,255,0.70)', fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 24 },

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

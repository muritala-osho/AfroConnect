import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  Alert, Dimensions, Animated,
} from 'react-native';
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
  { icon: 'shield-checkmark', title: 'Trust Badge', desc: 'Blue tick on your profile', color: '#4CAF50' },
  { icon: 'trending-up', title: 'More Matches', desc: 'Appear higher in discovery', color: '#2196F3' },
  { icon: 'heart', title: 'Better Connections', desc: 'Quality over quantity', color: '#E91E63' },
  { icon: 'star', title: 'Stand Out', desc: 'Premium verified look', color: '#FF9800' },
];

const STEPS = [
  { num: 1, icon: 'body-outline', title: 'Complete a pose', desc: 'We give you a random pose to prove you\'re live' },
  { num: 2, icon: 'camera-outline', title: 'Take your selfie', desc: 'Match the pose with the front camera' },
  { num: 3, icon: 'checkmark-circle-outline', title: 'Get your badge', desc: 'Verified tick appears on your profile' },
];

interface Pose {
  id: string;
  emoji: string;
  instruction: string;
  hint: string;
  color: string;
}

const POSES: Pose[] = [
  { id: 'tilt_left',   emoji: '↩️',  instruction: 'Tilt your head to the LEFT',      hint: 'Lean your left ear toward your shoulder',    color: '#4CAF50' },
  { id: 'tilt_right',  emoji: '↪️',  instruction: 'Tilt your head to the RIGHT',     hint: 'Lean your right ear toward your shoulder',   color: '#2196F3' },
  { id: 'chin_touch',  emoji: '🤏',  instruction: 'Touch your CHIN with one finger',  hint: 'Point your index finger at your chin',       color: '#FF9800' },
  { id: 'thumbs_up',   emoji: '👍',  instruction: 'Give a THUMBS UP near your face',  hint: 'Hold your thumb up clearly next to your face', color: '#9C27B0' },
  { id: 'smile_wide',  emoji: '😁',  instruction: 'SMILE wide, show your teeth',      hint: 'Big genuine smile — no hands needed',        color: '#E91E63' },
  { id: 'wave',        emoji: '👋',  instruction: 'WAVE at the camera',               hint: 'Wave your open hand next to your face',      color: '#00BCD4' },
  { id: 'peace',       emoji: '✌️',  instruction: 'Make a PEACE sign',                hint: 'Hold two fingers next to your face',         color: '#8BC34A' },
  { id: 'ears_both',   emoji: '🙉',  instruction: 'Cover BOTH ears with your hands',  hint: 'Place both palms flat over your ears',       color: '#FF5722' },
];

function pickRandomPose(): Pose {
  return POSES[Math.floor(Math.random() * POSES.length)];
}

export default function VerificationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { get } = useApi();

  const [verificationState, setVerificationState] = useState<VerificationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Steps: 'main' | 'pose' | 'camera' | 'review'
  const [step, setStep] = useState<'main' | 'pose' | 'camera' | 'review'>('main');
  const [challengePose, setChallengePose] = useState<Pose | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);

  // Pulse animation for pose card
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fetchVerificationStatus();
  }, []);

  useEffect(() => {
    if (step === 'pose') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [step]);

  const fetchVerificationStatus = async () => {
    if (!token) return;
    try {
      const response = await get<any>('/verification/status', {}, token);
      const resData: any = response;
      if (resData?.success && resData.data) {
        setVerificationState(resData.data);
      }
    } catch (e) {
      console.error('Failed to fetch verification status:', e);
    } finally {
      setLoading(false);
    }
  };

  const startPoseChallenge = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Required', 'Please enable camera access in device settings.');
      return;
    }
    const pose = pickRandomPose();
    setChallengePose(pose);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep('pose');
  };

  const openCamera = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep('camera');
  };

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      if (photo) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCapturedPhoto(photo.uri);
        setStep('review');
      }
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
      if (challengePose) {
        formData.append('poseChallenge', JSON.stringify({
          id: challengePose.id,
          instruction: challengePose.instruction,
          emoji: challengePose.emoji,
        }));
      }

      const response = await fetch(`${getApiBaseUrl()}/api/verification/request`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Submitted!',
          'Your pose selfie has been submitted for review. We\'ll compare it against your profile photos and award your verified badge within 24 hours.',
          [{ text: 'Got it', onPress: () => navigation.goBack() }]
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

  // ─── POSE CHALLENGE SCREEN ───────────────────────────────────────────────────
  if (step === 'pose' && challengePose) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={[challengePose.color + '30', challengePose.color + '10', 'transparent']}
          style={[styles.poseHeader, { paddingTop: insets.top + 8 }]}
        >
          <Pressable style={styles.backBtn} onPress={() => setStep('main')}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Live Pose Challenge</ThemedText>
          <View style={{ width: 40 }} />
        </LinearGradient>

        <ScrollView contentContainerStyle={styles.poseChallengeContent} showsVerticalScrollIndicator={false}>
          {/* Instruction text */}
          <ThemedText style={[styles.poseIntroText, { color: theme.textSecondary }]}>
            To prove you're real and live, match the pose below when you take your selfie.
          </ThemedText>

          {/* Pose card */}
          <Animated.View style={[{ transform: [{ scale: pulseAnim }] }]}>
            <LinearGradient
              colors={[challengePose.color + '25', challengePose.color + '10']}
              style={[styles.poseCard, { borderColor: challengePose.color + '40' }]}
            >
              <View style={[styles.poseEmojiCircle, { backgroundColor: challengePose.color + '20' }]}>
                <ThemedText style={styles.poseEmoji}>{challengePose.emoji}</ThemedText>
              </View>
              <ThemedText style={[styles.poseInstruction, { color: challengePose.color }]}>
                {challengePose.instruction}
              </ThemedText>
              <ThemedText style={[styles.poseHint, { color: theme.textSecondary }]}>
                {challengePose.hint}
              </ThemedText>
            </LinearGradient>
          </Animated.View>

          {/* What this is for */}
          <View style={[styles.poseExplainCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.poseExplainRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={theme.primary} />
              <ThemedText style={[styles.poseExplainText, { color: theme.textSecondary }]}>
                This proves you're a real, live person — not a photo or AI. Your admin will check that your selfie matches this pose.
              </ThemedText>
            </View>
            <View style={styles.poseExplainRow}>
              <Ionicons name="eye-off-outline" size={18} color={theme.primary} />
              <ThemedText style={[styles.poseExplainText, { color: theme.textSecondary }]}>
                Only moderators can see your verification selfie. It is never shown to other users.
              </ThemedText>
            </View>
          </View>

          {/* Tips */}
          <View style={[styles.poseTipsCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <ThemedText style={[styles.poseTipsTitle, { color: theme.text }]}>Tips for a good selfie</ThemedText>
            {[
              'Good lighting — face clearly visible',
              'No sunglasses, hats, or heavy filters',
              'Face centred inside the oval guide',
              'Match the pose exactly as shown',
            ].map((tip, i) => (
              <View key={i} style={styles.tipRow}>
                <View style={[styles.tipDot, { backgroundColor: theme.primary }]} />
                <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>{tip}</ThemedText>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.poseFooter, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable style={[styles.differentPoseBtn, { borderColor: theme.border }]} onPress={() => { setChallengePose(pickRandomPose()); Haptics.selectionAsync(); }}>
            <Ionicons name="refresh-outline" size={16} color={theme.primary} />
            <ThemedText style={[styles.differentPoseBtnText, { color: theme.primary }]}>Different pose</ThemedText>
          </Pressable>

          <Pressable style={styles.openCameraBtn} onPress={openCamera}>
            <LinearGradient
              colors={[challengePose.color, challengePose.color + 'CC']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.openCameraBtnGradient}
            >
              <Ionicons name="camera" size={20} color="#FFF" />
              <ThemedText style={styles.openCameraBtnText}>I'm Ready — Open Camera</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  // ─── CAMERA SCREEN ───────────────────────────────────────────────────────────
  if (step === 'camera') {
    return (
      <View style={styles.cameraContainer}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

        {/* Top overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.8)', 'transparent']}
          style={[styles.cameraTopOverlay, { paddingTop: insets.top + 8 }]}
        >
          <View style={styles.cameraHeader}>
            <Pressable style={styles.cameraCloseBtn} onPress={() => setStep('pose')}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </Pressable>
            <ThemedText style={styles.cameraTitle}>Match Your Pose</ThemedText>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>

        {/* Live pose reminder — shown prominently so user can reference it */}
        {challengePose && (
          <View style={[styles.poseBadge, { backgroundColor: challengePose.color }]}>
            <ThemedText style={styles.poseBadgeEmoji}>{challengePose.emoji}</ThemedText>
            <ThemedText style={styles.poseBadgeText}>{challengePose.instruction}</ThemedText>
          </View>
        )}

        {/* Face guide oval */}
        <View style={styles.faceGuideWrapper}>
          <View style={[styles.faceOval, { borderColor: challengePose ? challengePose.color : '#FFF' }]}>
            <View style={[styles.faceOvalCornerTL, { borderColor: challengePose ? challengePose.color : '#FFF' }]} />
            <View style={[styles.faceOvalCornerTR, { borderColor: challengePose ? challengePose.color : '#FFF' }]} />
            <View style={[styles.faceOvalCornerBL, { borderColor: challengePose ? challengePose.color : '#FFF' }]} />
            <View style={[styles.faceOvalCornerBR, { borderColor: challengePose ? challengePose.color : '#FFF' }]} />
          </View>
          <ThemedText style={styles.faceGuideLabel}>Fit your face inside</ThemedText>
        </View>

        {/* Bottom overlay with capture button */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={[styles.cameraBottomOverlay, { paddingBottom: insets.bottom + 24 }]}
        >
          <Pressable style={styles.captureBtn} onPress={takePhoto}>
            <View style={styles.captureBtnOuter}>
              <LinearGradient
                colors={challengePose ? [challengePose.color, challengePose.color + 'CC'] : ['#4CAF50', '#2E7D32']}
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

  // ─── REVIEW SCREEN ───────────────────────────────────────────────────────────
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
              colors={challengePose ? [challengePose.color, challengePose.color + '80'] : [theme.primary, theme.primary + '80']}
              style={styles.reviewPhotoRing}
            >
              <SafeImage source={{ uri: capturedPhoto }} style={styles.reviewPhoto} />
            </LinearGradient>
          </View>

          {/* Pose confirmation */}
          {challengePose && (
            <View style={[styles.reviewPoseCard, { backgroundColor: challengePose.color + '15', borderColor: challengePose.color + '40' }]}>
              <ThemedText style={styles.reviewPoseEmoji}>{challengePose.emoji}</ThemedText>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.reviewPoseLabel, { color: challengePose.color }]}>Pose submitted</ThemedText>
                <ThemedText style={[styles.reviewPoseInstruction, { color: theme.text }]}>{challengePose.instruction}</ThemedText>
              </View>
              <Ionicons name="checkmark-circle" size={22} color={challengePose.color} />
            </View>
          )}

          <View style={[styles.reviewInfoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={styles.reviewInfoRow}>
              <View style={[styles.reviewInfoIcon, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="eye-outline" size={20} color={theme.primary} />
              </View>
              <ThemedText style={[styles.reviewInfoText, { color: theme.textSecondary }]}>
                Our team will verify your pose matches the challenge and your face matches your profile photos. Only moderators see this.
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

  // ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
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
                Complete a quick live pose challenge to prove you're real and get your verified badge.
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

          {/* Alerts */}
          {verificationState?.status === 'pending' && (
            <View style={[styles.alertCard, { backgroundColor: '#FFC10715', borderColor: '#FFC10740' }]}>
              <Ionicons name="time" size={24} color="#FFC107" />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <ThemedText style={[styles.alertTitle, { color: '#FFC107' }]}>Under Review</ThemedText>
                <ThemedText style={[styles.alertDesc, { color: theme.textSecondary }]}>
                  We're reviewing your submission now. This usually takes up to 24 hours.
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

          {/* Start button */}
          {!verificationState?.verified && verificationState?.status !== 'pending' && (
            <Pressable style={styles.startBtn} onPress={startPoseChallenge}>
              <LinearGradient
                colors={[theme.primary, (theme as any).secondary || theme.primary + 'CC']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.startBtnGradient}
              >
                <Ionicons name="body-outline" size={22} color="#FFF" />
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
  container: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 15 },

  mainHeader: { paddingBottom: 16 },
  mainHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  poseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },

  mainContent: { paddingHorizontal: 20, paddingTop: 8 },

  heroSection: { marginBottom: 28 },
  heroCard: { borderRadius: 24, padding: 28, alignItems: 'center' },
  heroIconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  heroTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  heroSubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 4 },
  statusPillText: { fontSize: 14, fontWeight: '700' },

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

  // ─── Pose challenge styles ────────────────────────────────────────────────
  poseChallengeContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  poseIntroText: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 20 },

  poseCard: { borderRadius: 28, padding: 32, alignItems: 'center', borderWidth: 2, marginBottom: 20 },
  poseEmojiCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  poseEmoji: { fontSize: 54 },
  poseInstruction: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 10, letterSpacing: -0.5 },
  poseHint: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  poseExplainCard: { borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 16, gap: 12 },
  poseExplainRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  poseExplainText: { flex: 1, fontSize: 13, lineHeight: 19 },

  poseTipsCard: { borderRadius: 18, padding: 16, borderWidth: 1, gap: 10 },
  poseTipsTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipDot: { width: 6, height: 6, borderRadius: 3 },
  tipText: { fontSize: 13, lineHeight: 18, flex: 1 },

  poseFooter: { paddingHorizontal: 20, gap: 10 },
  differentPoseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  differentPoseBtnText: { fontSize: 14, fontWeight: '600' },
  openCameraBtn: { borderRadius: 16, overflow: 'hidden' },
  openCameraBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  openCameraBtnText: { color: '#FFF', fontSize: 17, fontWeight: '800' },

  // ─── Camera styles ────────────────────────────────────────────────────────
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  cameraTopOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 24 },
  cameraHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  cameraCloseBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 22 },
  cameraTitle: { color: '#FFF', fontSize: 17, fontWeight: '700' },

  poseBadge: { position: 'absolute', top: 130, left: 20, right: 20, zIndex: 10, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  poseBadgeEmoji: { fontSize: 26 },
  poseBadgeText: { color: '#FFF', fontSize: 15, fontWeight: '800', flex: 1 },

  faceGuideWrapper: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  faceOval: { width: 220, height: 290, borderRadius: 110, borderWidth: 2, borderColor: '#FFF', borderStyle: 'dashed' },
  faceOvalCornerTL: { position: 'absolute', top: -2, left: -2, width: 30, height: 30, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#FFF', borderRadius: 4 },
  faceOvalCornerTR: { position: 'absolute', top: -2, right: -2, width: 30, height: 30, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#FFF', borderRadius: 4 },
  faceOvalCornerBL: { position: 'absolute', bottom: -2, left: -2, width: 30, height: 30, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#FFF', borderRadius: 4 },
  faceOvalCornerBR: { position: 'absolute', bottom: -2, right: -2, width: 30, height: 30, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#FFF', borderRadius: 4 },
  faceGuideLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 16 },

  cameraBottomOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, paddingTop: 60, alignItems: 'center', gap: 10 },
  captureBtn: { alignItems: 'center', justifyContent: 'center' },
  captureBtnOuter: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  captureBtnInner: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  captureBtnLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },

  // ─── Review styles ────────────────────────────────────────────────────────
  reviewContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 },
  reviewPhotoWrapper: { alignItems: 'center', marginBottom: 24 },
  reviewPhotoRing: { padding: 4, borderRadius: 120, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 12 },
  reviewPhoto: { width: 200, height: 200, borderRadius: 100 },

  reviewPoseCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 16 },
  reviewPoseEmoji: { fontSize: 32 },
  reviewPoseLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  reviewPoseInstruction: { fontSize: 14, fontWeight: '700' },

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

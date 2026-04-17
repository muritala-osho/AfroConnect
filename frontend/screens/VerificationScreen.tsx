import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from '@/hooks/useAuth';
import { getApiBaseUrl } from '@/constants/config';

const MIN_RECORD_SECONDS = 5;
const MAX_RECORD_SECONDS = 7;

const STEPS = [
  { key: 'blink', emoji: '😉', icon: 'eye-outline'                  as const, title: 'Blink your eyes',   desc: 'Look at the camera and blink once' },
  { key: 'left',  emoji: '👈', icon: 'arrow-back-circle-outline'    as const, title: 'Turn head left',    desc: 'Slowly turn your head to the left' },
  { key: 'right', emoji: '👉', icon: 'arrow-forward-circle-outline' as const, title: 'Turn head right',   desc: 'Then slowly turn your head to the right' },
];

interface VerificationResult {
  submitted: boolean;
  status: 'pending' | 'failed';
  videoUrl?: string;
  reason?: string;
}

function Corner({ top, bottom, left, right, color }: any) {
  return (
    <View style={{
      position: 'absolute', width: 26, height: 26,
      top, bottom, left, right,
      borderColor: color,
      borderTopWidth:    top    !== undefined ? 3 : 0,
      borderBottomWidth: bottom !== undefined ? 3 : 0,
      borderLeftWidth:   left   !== undefined ? 3 : 0,
      borderRightWidth:  right  !== undefined ? 3 : 0,
    }} />
  );
}

export default function VerificationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { token, user } = useAuth();

  const [screen, setScreen] = useState<'intro' | 'camera' | 'uploading' | 'result'>('intro');
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [canSubmit, setCanSubmit] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const cameraRef             = useRef<any>(null);
  const recordingPromiseRef   = useRef<Promise<{ uri: string }> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const uploadStartedRef      = useRef(false);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission, requestPermission]);

  const stopAndSaveVideo = useCallback(async () => {
    if (uploadStartedRef.current) return;
    uploadStartedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    setScreen('uploading');
    try {
      if (cameraRef.current && recordingPromiseRef.current) {
        cameraRef.current.stopRecording();
        const video = await recordingPromiseRef.current;
        if (!video?.uri) throw new Error('No video recorded. Please try again.');
        const formData = new FormData();
        formData.append('userId', user?.id || '');
        formData.append('video', { uri: video.uri, type: 'video/mp4', name: 'verification-video.mp4' } as any);
        const resp = await fetch(`${getApiBaseUrl()}/upload-verification-video`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          body: formData,
        });
        const data = await resp.json();
        if (!resp.ok || !data.success) throw new Error(data.message || 'Upload failed. Please try again.');
        setResult({ submitted: true, status: 'pending', videoUrl: data.videoUrl });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error('Recording did not start. Please try again.');
      }
    } catch (error: any) {
      setResult({ submitted: false, status: 'failed', reason: error?.message || 'Could not save video.' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setScreen('result');
      setRecording(false);
    }
  }, [token, user?.id]);

  const startRecording = useCallback(() => {
    if (!cameraRef.current || recordingPromiseRef.current || uploadStartedRef.current) return;
    setRecording(true);
    setRecordSeconds(0);
    setCanSubmit(false);
    setCurrentStep(0);
    recordingStartedAtRef.current = Date.now();
    recordingPromiseRef.current = cameraRef.current.recordAsync();
    recordingPromiseRef.current?.catch(() => null);

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
      setRecordSeconds(elapsed);
      if (elapsed >= 1 && elapsed < 3) setCurrentStep(0);
      if (elapsed >= 3 && elapsed < 5) setCurrentStep(1);
      if (elapsed >= 5) { setCurrentStep(2); setCanSubmit(true); }
    }, 500);

    autoStopRef.current = setTimeout(() => {
      stopAndSaveVideo();
    }, MAX_RECORD_SECONDS * 1000);
  }, [stopAndSaveVideo]);

  useEffect(() => {
    if (screen !== 'camera' || !permission?.granted || !cameraReady) return;
    startRecording();
  }, [screen, permission?.granted, cameraReady, startRecording]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (recordingPromiseRef.current && cameraRef.current && !uploadStartedRef.current) {
        try { cameraRef.current.stopRecording(); } catch {}
      }
    };
  }, []);

  const restart = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    uploadStartedRef.current    = false;
    recordingPromiseRef.current = null;
    setResult(null);
    setRecording(false);
    setRecordSeconds(0);
    setCanSubmit(false);
    setCurrentStep(0);
    setScreen('camera');
  };

  const timerColor = recordSeconds >= MIN_RECORD_SECONDS ? '#10B981'
    : recordSeconds >= 3 ? '#f59e0b'
    : '#ef4444';

  // ─── INTRO ────────────────────────────────────────────────────────────────
  if (screen === 'intro') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

          {/* Header */}
          <LinearGradient
            colors={['#10B981', '#059669', '#0D9488']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.gradientHeader, { paddingTop: insets.top + 12 }]}
          >
            <Pressable style={styles.headerBackBtn} onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </Pressable>

            <View style={{ alignItems: 'center' }}>
              <View style={styles.headerIconWrap}>
                <View style={styles.headerIconRing} />
                <View style={styles.headerIconInner}>
                  <Ionicons name="shield-checkmark" size={44} color="#fff" />
                </View>
              </View>
              <ThemedText style={styles.headerTitle}>Face Verification</ThemedText>
              <ThemedText style={styles.headerSub}>
                Earn your verified badge and build trust with other members
              </ThemedText>
            </View>
          </LinearGradient>

          {/* Body */}
          <View style={styles.bodyPad}>

            {/* Steps card */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBadge}>
                  <Ionicons name="videocam-outline" size={16} color="#10B981" />
                </View>
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>What you will do</ThemedText>
              </View>
              {STEPS.map((s, i) => (
                <View key={s.key} style={[styles.stepRow, i < STEPS.length - 1 && styles.stepRowDivider]}>
                  <View style={styles.stepNumBadge}>
                    <ThemedText style={styles.stepNumText}>{i + 1}</ThemedText>
                  </View>
                  <View style={styles.stepIconCircle}>
                    <Ionicons name={s.icon} size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.stepLabel, { color: theme.text }]}>{s.title}</ThemedText>
                    <ThemedText style={[styles.stepDesc, { color: theme.textSecondary }]}>{s.desc}</ThemedText>
                  </View>
                </View>
              ))}
            </View>

            {/* How it works card */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBadge, { backgroundColor: '#3B82F620' }]}>
                  <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
                </View>
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>How it works</ThemedText>
              </View>
              {[
                { icon: 'videocam-outline' as const, color: '#10B981', bg: '#10B98120', text: 'A short 5–7 second video will be recorded' },
                { icon: 'list-outline' as const, color: '#8B5CF6', bg: '#8B5CF620', text: 'Follow the on-screen instructions during recording' },
                { icon: 'cloud-upload-outline' as const, color: '#3B82F6', bg: '#3B82F620', text: 'Video is submitted securely for admin review' },
                { icon: 'checkmark-circle-outline' as const, color: '#10B981', bg: '#10B98120', text: 'Admin approves and your verified badge is applied' },
              ].map((item, i) => (
                <View key={i} style={[styles.howRow, i > 0 && { marginTop: 12 }]}>
                  <View style={[styles.howIconCircle, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <ThemedText style={[styles.howText, { color: theme.textSecondary }]}>{item.text}</ThemedText>
                </View>
              ))}
            </View>

            {/* Tips */}
            <View style={[styles.tipRow, { backgroundColor: '#10B98110', borderColor: '#10B98130' }]}>
              <Ionicons name="sunny-outline" size={18} color="#10B981" />
              <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
                Be in a <ThemedText style={{ fontWeight: '800', color: theme.text }}>well-lit area</ThemedText> and hold your phone at face level for best results.
              </ThemedText>
            </View>

            <View style={[styles.tipRow, { backgroundColor: '#3B82F610', borderColor: '#3B82F630' }]}>
              <Ionicons name="lock-closed-outline" size={18} color="#3B82F6" />
              <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
                Your video is <ThemedText style={{ fontWeight: '800', color: theme.text }}>never shared publicly</ThemedText> — submitted only for admin review.
              </ThemedText>
            </View>

            {/* CTA */}
            <Pressable
              style={styles.ctaBtn}
              onPress={() => {
                if (!permission?.granted) {
                  requestPermission().then(res => { if (res.granted) setScreen('camera'); });
                } else {
                  setScreen('camera');
                }
              }}
            >
              <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtnGrad}>
                <Ionicons name="videocam" size={20} color="#fff" />
                <ThemedText style={styles.ctaBtnText}>Start Verification</ThemedText>
              </LinearGradient>
            </Pressable>

          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── CAMERA ───────────────────────────────────────────────────────────────
  if (screen === 'camera') {
    const step = STEPS[Math.min(currentStep, 2)];

    return (
      <View style={styles.cameraFull}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
          mode="video"
          mute
          onCameraReady={() => setCameraReady(true)}
        />

        {/* Top gradient bar */}
        <LinearGradient
          colors={['rgba(0,0,0,0.82)', 'transparent']}
          style={[styles.camTop, { paddingTop: insets.top + 8 }]}
        >
          <View style={styles.camHeader}>
            <Pressable style={styles.camBackBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#FFF" />
            </Pressable>
            <ThemedText style={styles.camTitle}>Face Verification</ThemedText>
            {/* REC indicator */}
            <View style={[styles.recPill, { borderColor: recording ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.2)' }]}>
              <View style={[styles.recDot, { backgroundColor: recording ? '#ef4444' : '#64748b' }]} />
              <ThemedText style={styles.recText}>{recording ? 'REC' : 'READY'}</ThemedText>
            </View>
          </View>
        </LinearGradient>

        {/* Timer badge */}
        <View style={styles.timerWrap} pointerEvents="none">
          <View style={[styles.timerBadge, { borderColor: timerColor + '60', backgroundColor: 'rgba(0,0,0,0.60)' }]}>
            <ThemedText style={[styles.timerNum, { color: timerColor }]}>{recordSeconds}s</ThemedText>
            <ThemedText style={styles.timerSub}>/ 7s</ThemedText>
          </View>
        </View>

        {/* Face oval */}
        <View style={styles.ovalWrapper} pointerEvents="none">
          <View style={[styles.faceOval, { borderColor: recording ? '#10B981BB' : 'rgba(255,255,255,0.55)' }]}>
            <Corner top={-2}    left={-2}  color={recording ? '#10B981' : 'rgba(255,255,255,0.55)'} />
            <Corner top={-2}    right={-2} color={recording ? '#10B981' : 'rgba(255,255,255,0.55)'} />
            <Corner bottom={-2} left={-2}  color={recording ? '#10B981' : 'rgba(255,255,255,0.55)'} />
            <Corner bottom={-2} right={-2} color={recording ? '#10B981' : 'rgba(255,255,255,0.55)'} />
          </View>
        </View>

        {/* Bottom instructions panel */}
        <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 20 }]}>

          {/* Current step */}
          <View style={styles.currentStepRow}>
            <View style={styles.currentStepIcon}>
              <Ionicons name={step.icon} size={22} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.currentStepTitle}>{step.title}</ThemedText>
              <ThemedText style={styles.currentStepHint}>{step.desc}</ThemedText>
            </View>
            <View style={styles.stepCounter}>
              <ThemedText style={styles.stepCounterText}>{currentStep + 1}/3</ThemedText>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressBar}>
            {STEPS.map((s, i) => (
              <View
                key={s.key}
                style={[
                  styles.progressSeg,
                  i < currentStep  && { backgroundColor: '#059669' },
                  i === currentStep && { backgroundColor: '#10B981' },
                  i > currentStep  && { backgroundColor: 'rgba(255,255,255,0.18)' },
                ]}
              />
            ))}
          </View>

          {/* Steps list */}
          <View style={styles.stepsList}>
            {STEPS.map((s, i) => (
              <View key={s.key} style={styles.stepsRow}>
                <View style={[
                  styles.stepsCheck,
                  i < currentStep  && { backgroundColor: '#10B98125', borderColor: '#10B98150' },
                  i === currentStep && { backgroundColor: '#10B98115', borderColor: '#10B981' },
                  i > currentStep  && { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.15)' },
                ]}>
                  {i < currentStep
                    ? <Ionicons name="checkmark" size={13} color="#10B981" />
                    : <ThemedText style={[styles.stepsNum, i > currentStep && { color: 'rgba(255,255,255,0.35)' }]}>{i + 1}</ThemedText>
                  }
                </View>
                <ThemedText style={[
                  styles.stepsLabel,
                  i < currentStep  && { color: '#10B981' },
                  i === currentStep && { color: '#fff', fontWeight: '800' },
                  i > currentStep  && { color: 'rgba(255,255,255,0.40)' },
                ]}>
                  {s.emoji}  {s.title}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* Submit / waiting */}
          {canSubmit ? (
            <Pressable style={styles.submitBtn} onPress={stopAndSaveVideo}>
              <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtnGrad}>
                <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                <ThemedText style={styles.submitBtnText}>Submit Video</ThemedText>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={styles.waitRow}>
              <ActivityIndicator size="small" color="#10B981" />
              <ThemedText style={styles.waitText}>
                Recording in progress — ready in {Math.max(0, MIN_RECORD_SECONDS - recordSeconds)}s
              </ThemedText>
            </View>
          )}

        </View>
      </View>
    );
  }

  // ─── UPLOADING ────────────────────────────────────────────────────────────
  if (screen === 'uploading') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.centerContent}>
          <View style={[styles.uploadIconWrap, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}>
            <Ionicons name="cloud-upload-outline" size={52} color="#10B981" />
          </View>
          <ThemedText style={[styles.uploadTitle, { color: theme.text }]}>Uploading your video…</ThemedText>
          <ThemedText style={[styles.uploadSub, { color: theme.textSecondary }]}>
            Submitting securely for admin review. This will only take a moment.
          </ThemedText>
          <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 24 }} />
        </View>
      </View>
    );
  }

  // ─── RESULT ───────────────────────────────────────────────────────────────
  if (screen === 'result' && result) {
    const ok    = result.status === 'pending';
    const color = ok ? '#10B981' : '#ef4444';

    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.resultTopBar, { paddingTop: insets.top + 16 }]}>
          <ThemedText style={[styles.resultTopTitle, { color: theme.text }]}>Verification</ThemedText>
        </View>

        <ScrollView
          contentContainerStyle={[styles.bodyPad, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ alignItems: 'center' }}>

            {/* Result icon */}
            <View style={[styles.resultIconWrap, { backgroundColor: color + '15', borderColor: color + '35' }]}>
              <LinearGradient colors={[color, color + 'CC']} style={styles.resultIconInner}>
                <Ionicons name={ok ? 'shield-checkmark' : 'alert-circle'} size={44} color="#fff" />
              </LinearGradient>
            </View>

            <ThemedText style={[styles.resultTitle, { color }]}>
              {ok ? 'Video Submitted' : 'Upload Failed'}
            </ThemedText>
            <ThemedText style={[styles.resultSub, { color: theme.textSecondary }]}>
              {ok
                ? 'Your verification video is pending admin review. Your profile badge will update once approved.'
                : result.reason || 'Something went wrong. Please try again.'}
            </ThemedText>

            {/* Completed steps */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, width: '100%' }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBadge, { backgroundColor: ok ? '#10B98120' : '#ef444420' }]}>
                  <Ionicons
                    name={ok ? 'checkmark-circle-outline' : 'close-circle-outline'}
                    size={16}
                    color={ok ? '#10B981' : '#ef4444'}
                  />
                </View>
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
                  {ok ? 'Instructions completed' : 'Steps attempted'}
                </ThemedText>
              </View>
              {STEPS.map(s => (
                <View key={s.key} style={styles.completedRow}>
                  <Ionicons name="checkmark-circle" size={17} color={ok ? '#10B981' : '#94a3b8'} />
                  <ThemedText style={[styles.completedText, { color: theme.textSecondary }]}>{s.title}</ThemedText>
                </View>
              ))}
            </View>

            {ok ? (
              <Pressable style={styles.ctaBtn} onPress={() => navigation.goBack()}>
                <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtnGrad}>
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <ThemedText style={styles.ctaBtnText}>Back to Profile</ThemedText>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable style={styles.ctaBtn} onPress={restart}>
                <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtnGrad}>
                  <Ionicons name="refresh" size={20} color="#fff" />
                  <ThemedText style={styles.ctaBtnText}>Try Again</ThemedText>
                </LinearGradient>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Header ──
  gradientHeader: { paddingHorizontal: 20, paddingBottom: 40 },
  headerBackBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  headerIconWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  headerIconRing: {
    position: 'absolute', width: 108, height: 108, borderRadius: 54,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerIconInner: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: -0.5 },
  headerSub:   { fontSize: 14, color: 'rgba(255,255,255,0.80)', textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 280 },

  // ── Body ──
  bodyPad: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },

  // ── Card ──
  card: { borderRadius: 20, padding: 18, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIconBadge: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#10B98120', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800' },

  // ── Step rows ──
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  stepRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.07)' },
  stepNumBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  stepNumText:  { color: '#fff', fontSize: 12, fontWeight: '900' },
  stepIconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#10B98112', alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  stepDesc:  { fontSize: 12, lineHeight: 17 },

  // ── How it works ──
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  howIconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  howText: { flex: 1, fontSize: 13, lineHeight: 19 },

  // ── Tips ──
  tipRow: { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19 },

  // ── CTA ──
  ctaBtn:     { borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  ctaBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // ── Camera ──
  cameraFull: { flex: 1, backgroundColor: '#000' },
  camTop:     { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 28 },
  camHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  camBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  camTitle:   { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  recPill:    {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.50)', borderWidth: 1,
  },
  recDot:  { width: 8, height: 8, borderRadius: 4 },
  recText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  // ── Timer badge ──
  timerWrap:  { position: 'absolute', top: 112, right: 18, zIndex: 10 },
  timerBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, alignItems: 'center' },
  timerNum:   { fontSize: 20, fontWeight: '900', lineHeight: 24 },
  timerSub:   { color: 'rgba(255,255,255,0.40)', fontSize: 9, fontWeight: '700', marginTop: 1 },

  // ── Oval ──
  ovalWrapper: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  faceOval:    { width: 210, height: 278, borderRadius: 105, borderWidth: 2, borderStyle: 'dashed' },

  // ── Bottom panel ──
  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    backgroundColor: 'rgba(5,10,20,0.88)',
    paddingHorizontal: 20, paddingTop: 20,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: 'rgba(16,185,129,0.20)',
  },

  currentStepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  currentStepIcon: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#10B98118', borderWidth: 1, borderColor: '#10B98130',
    alignItems: 'center', justifyContent: 'center',
  },
  currentStepTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  currentStepHint:  { color: 'rgba(255,255,255,0.50)', fontSize: 12, marginTop: 2 },
  stepCounter: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  stepCounterText: { color: 'rgba(255,255,255,0.70)', fontSize: 12, fontWeight: '800' },

  progressBar: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },

  stepsList: { gap: 10, marginBottom: 18 },
  stepsRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepsCheck: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  stepsNum:   { fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.70)' },
  stepsLabel: { fontSize: 14, fontWeight: '600' },

  submitBtn:     { borderRadius: 16, overflow: 'hidden' },
  submitBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  waitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  waitText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600', flex: 1 },

  // ── Uploading screen ──
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36 },
  uploadIconWrap: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  uploadTitle:    { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  uploadSub:      { fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 290 },

  // ── Result screen ──
  resultTopBar:   { alignItems: 'center', paddingBottom: 8 },
  resultTopTitle: { fontSize: 18, fontWeight: '900' },
  resultIconWrap: { width: 124, height: 124, borderRadius: 62, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20, marginTop: 8 },
  resultIconInner: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  resultSub:   { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24, maxWidth: 300 },

  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)' },
  completedText: { fontSize: 14, fontWeight: '600' },
});

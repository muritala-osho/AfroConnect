import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView, ActivityIndicator,
  Animated, Dimensions, Easing,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import LottieView from 'lottie-react-native';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import { useAuth } from '@/hooks/useAuth';
import { getApiBaseUrl } from '@/constants/config';

const { width: SW } = Dimensions.get('window');

const MIN_RECORD_SECONDS = 5;
const MAX_RECORD_SECONDS = 7;

const STEPS = [
  { key: 'blink', emoji: '😉', icon: 'eye-outline'                as const, title: 'Blink eyes',      desc: 'Look at the camera and blink once' },
  { key: 'left',  emoji: '👈', icon: 'arrow-back-circle-outline'  as const, title: 'Turn head left',  desc: 'Slowly turn your head to the left' },
  { key: 'right', emoji: '👉', icon: 'arrow-forward-circle-outline' as const, title: 'Turn head right', desc: 'Then slowly turn your head to the right' },
];

const PROMPT_LOTTIE = {
  v: '5.7.4', fr: 30, ip: 0, op: 60, w: 180, h: 180,
  nm: 'AfroConnect verification prompt pulse', ddd: 0, assets: [],
  layers: [{
    ddd: 0, ind: 1, ty: 4, nm: 'premium-pulse', sr: 1,
    ks: {
      o: { a: 1, k: [{ t: 0, s: [80] }, { t: 30, s: [38] }, { t: 60, s: [80] }] },
      r: { a: 0, k: 0 },
      p: { a: 0, k: [90, 90, 0] },
      a: { a: 0, k: [0, 0, 0] },
      s: { a: 1, k: [{ t: 0, s: [72, 72, 100] }, { t: 30, s: [104, 104, 100] }, { t: 60, s: [72, 72, 100] }] },
    },
    ao: 0,
    shapes: [{
      ty: 'gr',
      it: [
        { d: 1, ty: 'el', s: { a: 0, k: [132, 132] }, p: { a: 0, k: [0, 0] }, nm: 'pulse-ring' },
        { ty: 'st', c: { a: 0, k: [0.063, 0.725, 0.506, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 7 }, lc: 2, lj: 2, ml: 4, nm: 'green-stroke' },
        { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 }, nm: 'Transform' },
      ],
      nm: 'pulse-group', np: 3, cix: 2, bm: 0,
    }],
    ip: 0, op: 60, st: 0, bm: 0,
  }],
};

interface VerificationResult {
  submitted: boolean;
  status: 'pending' | 'failed';
  videoUrl?: string;
  reason?: string;
}

function Corner({ top, bottom, left, right, color }: any) {
  return (
    <View style={{
      position: 'absolute', width: 28, height: 28,
      top, bottom, left, right,
      borderColor: color,
      borderTopWidth:    top    !== undefined ? 3 : 0,
      borderBottomWidth: bottom !== undefined ? 3 : 0,
      borderLeftWidth:   left   !== undefined ? 3 : 0,
      borderRightWidth:  right  !== undefined ? 3 : 0,
    }} />
  );
}

function StepIcon({ stepKey }: { stepKey: string }) {
  const stroke = '#10B981';
  return (
    <View style={styles.promptIcon}>
      <LottieView source={PROMPT_LOTTIE as any} autoPlay loop style={StyleSheet.absoluteFill} />
      <Svg width={78} height={78} viewBox="0 0 78 78">
        <Circle cx={39} cy={39} r={24} fill="rgba(16,185,129,0.10)" stroke={stroke} strokeWidth={3} />
        {stepKey === 'blink' ? (
          <>
            <Path d="M23 36 Q30 31 37 36" stroke={stroke} strokeWidth={4} fill="none" strokeLinecap="round" />
            <Path d="M41 36 Q48 31 55 36" stroke={stroke} strokeWidth={4} fill="none" strokeLinecap="round" />
            <Line x1={24} y1={47} x2={54} y2={47} stroke={stroke} strokeWidth={4} strokeLinecap="round" />
          </>
        ) : stepKey === 'left' ? (
          <Path d="M48 25 L27 39 L48 53 M29 39 H57" stroke={stroke} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <Path d="M30 25 L51 39 L30 53 M21 39 H49" stroke={stroke} strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </Svg>
    </View>
  );
}

export default function VerificationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { token, user } = useAuth();

  const [screen, setScreen] = useState<'intro' | 'camera' | 'analyzing' | 'result'>('intro');
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [canSubmit, setCanSubmit] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  const cameraRef             = useRef<any>(null);
  const recordingPromiseRef   = useRef<Promise<{ uri: string }> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const uploadStartedRef      = useRef(false);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef           = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim             = useRef(new Animated.Value(1)).current;
  const fadeAnim              = useRef(new Animated.Value(0)).current;
  const slideAnim             = useRef(new Animated.Value(24)).current;
  const scanAnim              = useRef(new Animated.Value(0)).current;
  const recPulse              = useRef(new Animated.Value(1)).current;

  useEffect(() => { if (!permission) requestPermission(); }, [permission, requestPermission]);

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(24);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [screen]);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (screen !== 'analyzing') return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(scanAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(scanAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [screen]);

  useEffect(() => {
    if (!recording) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(recPulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
      Animated.timing(recPulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [recording]);

  const stopAndSaveVideo = useCallback(async () => {
    if (uploadStartedRef.current) return;
    uploadStartedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    setScreen('analyzing');
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
        if (!resp.ok || !data.success) throw new Error(data.message || 'Video upload failed. Please try again.');
        setResult({ submitted: true, status: 'pending', videoUrl: data.videoUrl });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        throw new Error('Recording did not start. Please try again.');
      }
    } catch (error: any) {
      setResult({ submitted: false, status: 'failed', reason: error?.message || 'Could not save verification video.' });
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
      if (elapsed === 1) setCurrentStep(0);
      if (elapsed === 3) setCurrentStep(1);
      if (elapsed === 5) { setCurrentStep(2); setCanSubmit(true); }
    }, 500);

    autoStopRef.current = setTimeout(() => {
      setCanSubmit(true);
      setTimeout(() => stopAndSaveVideo(), 500);
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
    uploadStartedRef.current   = false;
    recordingPromiseRef.current = null;
    setResult(null);
    setRecording(false);
    setRecordSeconds(0);
    setCanSubmit(false);
    setCurrentStep(0);
    setVideoUri(null);
    setScreen('camera');
  };

  const timerColor = recordSeconds >= MIN_RECORD_SECONDS ? '#10B981' : recordSeconds >= 3 ? '#f59e0b' : '#ef4444';

  // ─── INTRO ────────────────────────────────────────────────────────────────
  if (screen === 'intro') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

          <LinearGradient
            colors={['#10B981', '#059669', '#0D9488']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.gradientHeader, { paddingTop: insets.top + 12 }]}
          >
            <Pressable style={styles.headerBackBtn} onPress={() => navigation.goBack()} hitSlop={12}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </Pressable>

            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>
              <Animated.View style={[styles.headerIconWrap, { transform: [{ scale: pulseAnim }] }]}>
                <View style={styles.headerIconRing} />
                <View style={styles.headerIconInner}>
                  <Ionicons name="shield-checkmark" size={44} color="#fff" />
                </View>
              </Animated.View>
              <ThemedText style={styles.headerTitle}>Face Verification</ThemedText>
              <ThemedText style={styles.headerSub}>
                Earn your verified badge and build trust with other members
              </ThemedText>
            </Animated.View>
          </LinearGradient>

          <Animated.View style={[styles.bodyPad, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

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
                    <ThemedText style={[styles.stepDesc,  { color: theme.textSecondary }]}>{s.desc}</ThemedText>
                  </View>
                </View>
              ))}
            </View>

            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBadge, { backgroundColor: '#3B82F620' }]}>
                  <Ionicons name="time-outline" size={16} color="#3B82F6" />
                </View>
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>How it works</ThemedText>
              </View>
              {[
                { icon: 'videocam' as const, color: '#10B981', bg: '#10B98120', text: 'A short 5–7 second video will be recorded' },
                { icon: 'eye-outline' as const, color: '#8B5CF6', bg: '#8B5CF620', text: 'Follow the on-screen instructions while recording' },
                { icon: 'cloud-upload-outline' as const, color: '#3B82F6', bg: '#3B82F620', text: 'Your video is submitted securely for admin review' },
              ].map((item, i) => (
                <View key={i} style={[styles.howRow, i > 0 && { marginTop: 10 }]}>
                  <View style={[styles.howIconCircle, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <ThemedText style={[styles.howText, { color: theme.textSecondary }]}>{item.text}</ThemedText>
                </View>
              ))}
            </View>

            <View style={[styles.tipRow, { backgroundColor: '#10B98110', borderColor: '#10B98130' }]}>
              <Ionicons name="sunny-outline" size={18} color="#10B981" />
              <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
                Be in a{' '}
                <ThemedText style={{ fontWeight: '800', color: theme.text }}>well-lit area</ThemedText>
                {' '}and hold your phone at face level for best results.
              </ThemedText>
            </View>

            <View style={[styles.tipRow, { backgroundColor: '#3B82F610', borderColor: '#3B82F630' }]}>
              <Ionicons name="lock-closed-outline" size={18} color="#3B82F6" />
              <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
                Your video is submitted securely for{' '}
                <ThemedText style={{ fontWeight: '800', color: theme.text }}>admin review only</ThemedText>
                {' '}and is never shared publicly.
              </ThemedText>
            </View>

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

          </Animated.View>
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

        {/* Top bar */}
        <LinearGradient colors={['rgba(0,0,0,0.80)', 'rgba(0,0,0,0.0)']} style={[styles.camTop, { paddingTop: insets.top + 6 }]}>
          <View style={styles.camHeader}>
            <Pressable style={styles.camBackBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#FFF" />
            </Pressable>
            <ThemedText style={styles.camTitle}>Face Verification</ThemedText>
            <View style={styles.recPill}>
              <Animated.View style={[styles.recDot, { backgroundColor: recording ? '#ef4444' : '#64748b', transform: [{ scale: recPulse }] }]} />
              <ThemedText style={styles.recText}>{recording ? 'REC' : 'READY'}</ThemedText>
            </View>
          </View>
        </LinearGradient>

        {/* Timer ring */}
        <View style={styles.timerWrap} pointerEvents="none">
          <View style={[styles.timerRing, { borderColor: timerColor + '80' }]}>
            <ThemedText style={[styles.timerNum, { color: timerColor }]}>
              {recordSeconds}s
            </ThemedText>
            <ThemedText style={styles.timerLabel}>/ 7s</ThemedText>
          </View>
        </View>

        {/* Face oval */}
        <View style={styles.ovalWrapper} pointerEvents="none">
          <View style={[styles.faceOval, { borderColor: recording ? '#10B981CC' : '#ffffff80' }]}>
            <Corner top={-2}    left={-2}  color={recording ? '#10B981' : '#ffffff80'} />
            <Corner top={-2}    right={-2} color={recording ? '#10B981' : '#ffffff80'} />
            <Corner bottom={-2} left={-2}  color={recording ? '#10B981' : '#ffffff80'} />
            <Corner bottom={-2} right={-2} color={recording ? '#10B981' : '#ffffff80'} />
          </View>
        </View>

        {/* Instructions + submit */}
        <View style={[styles.bottomCard, { paddingBottom: insets.bottom + 16 }]}>

          {/* Current step prompt */}
          <View style={styles.stepPromptRow}>
            <StepIcon stepKey={step.key} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.stepPromptTitle}>{step.title}</ThemedText>
              <ThemedText style={styles.stepPromptHint}>{step.desc}</ThemedText>
            </View>
          </View>

          {/* Step dots */}
          <View style={styles.stepDots}>
            {STEPS.map((s, i) => (
              <View
                key={s.key}
                style={[
                  styles.stepDot,
                  i < currentStep  && styles.stepDotDone,
                  i === currentStep && styles.stepDotActive,
                ]}
              />
            ))}
          </View>

          {/* Static steps list */}
          <View style={styles.stepsList}>
            {STEPS.map((s, i) => (
              <View key={s.key} style={styles.stepsListRow}>
                <View style={[styles.stepsListIcon, i < currentStep && { backgroundColor: '#10B98130' }]}>
                  {i < currentStep
                    ? <Ionicons name="checkmark" size={12} color="#10B981" />
                    : <ThemedText style={styles.stepsListNum}>{i + 1}</ThemedText>
                  }
                </View>
                <ThemedText style={[
                  styles.stepsListLabel,
                  i < currentStep  && { color: '#10B981' },
                  i === currentStep && { color: '#fff', fontWeight: '900' },
                  i > currentStep  && { color: 'rgba(255,255,255,0.45)' },
                ]}>
                  {s.emoji} {s.title}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* Submit button */}
          {canSubmit ? (
            <Pressable
              style={styles.submitBtn}
              onPress={stopAndSaveVideo}
            >
              <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.submitBtnGrad}>
                <Ionicons name="cloud-upload" size={20} color="#fff" />
                <ThemedText style={styles.submitBtnText}>Submit Video</ThemedText>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={styles.waitRow}>
              <ActivityIndicator size="small" color="#10B981" />
              <ThemedText style={styles.waitText}>Recording… {MIN_RECORD_SECONDS - recordSeconds}s until ready</ThemedText>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ─── ANALYZING ────────────────────────────────────────────────────────────
  if (screen === 'analyzing') {
    const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, SW * 0.65] });
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient colors={['#10B98115', 'transparent']} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.centerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.analyzeFrame}>
            <LinearGradient colors={['#052e16', '#064e3b']} style={StyleSheet.absoluteFillObject} />
            <Ionicons name="videocam" size={56} color="#10B98155" />
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />
            <Corner top={0}    left={0}  color="#10B981" />
            <Corner top={0}    right={0} color="#10B981" />
            <Corner bottom={0} left={0}  color="#10B981" />
            <Corner bottom={0} right={0} color="#10B981" />
          </View>
          <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 32 }} />
          <ThemedText style={[styles.analyzeTitle, { color: theme.text }]}>Uploading your video…</ThemedText>
          <ThemedText style={[styles.analyzeSub, { color: theme.textSecondary }]}>
            Your recording is being securely submitted for admin review.
          </ThemedText>
        </Animated.View>
      </View>
    );
  }

  // ─── RESULT ───────────────────────────────────────────────────────────────
  if (screen === 'result' && result) {
    const ok    = result.status === 'pending';
    const color = ok ? '#10B981' : '#ef4444';

    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient colors={[color + '12', 'transparent']} style={StyleSheet.absoluteFill} />

        <View style={[styles.resultTopBar, { paddingTop: insets.top + 12 }]}>
          <ThemedText style={[styles.resultTopTitle, { color: theme.text }]}>Verification</ThemedText>
        </View>

        <ScrollView contentContainerStyle={[styles.bodyPad, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>

            <Animated.View style={[styles.resultRing, { borderColor: color + '40', backgroundColor: color + '12', transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient colors={[color, color + 'BB']} style={styles.resultInner}>
                <Ionicons name={ok ? 'shield-checkmark' : 'alert-circle'} size={44} color="#FFF" />
              </LinearGradient>
            </Animated.View>

            <ThemedText style={[styles.resultTitle, { color }]}>
              {ok ? 'Verification Submitted' : 'Upload Failed'}
            </ThemedText>
            <ThemedText style={[styles.resultSub, { color: theme.textSecondary }]}>
              {ok
                ? 'Your verification video is pending admin review. We will update your profile status once checked.'
                : result.reason || 'Please try recording your verification again.'}
            </ThemedText>

            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, width: '100%' }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBadge, { backgroundColor: ok ? '#10B98120' : '#ef444420' }]}>
                  <Ionicons name={ok ? 'checkmark-circle-outline' : 'close-circle-outline'} size={16} color={ok ? '#10B981' : '#ef4444'} />
                </View>
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Completed sequence</ThemedText>
              </View>
              {STEPS.map(s => (
                <View key={s.key} style={styles.completedRow}>
                  <Ionicons name="checkmark-circle" size={16} color={ok ? '#10B981' : '#94a3b8'} />
                  <ThemedText style={[styles.completedText, { color: theme.textSecondary }]}>{s.title}</ThemedText>
                </View>
              ))}
            </View>

            {ok ? (
              <Pressable style={styles.ctaBtn} onPress={() => navigation.goBack()}>
                <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtnGrad}>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <ThemedText style={styles.ctaBtnText}>Back to Profile</ThemedText>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable style={styles.ctaBtn} onPress={restart}>
                <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtnGrad}>
                  <Ionicons name="refresh" size={20} color="#FFF" />
                  <ThemedText style={styles.ctaBtnText}>Try Again</ThemedText>
                </LinearGradient>
              </Pressable>
            )}
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container:   { flex: 1 },

  gradientHeader: { paddingHorizontal: 20, paddingBottom: 40 },
  headerBackBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  headerIconWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  headerIconRing: {
    position: 'absolute', width: 108, height: 108, borderRadius: 54,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.30)', backgroundColor: 'rgba(255,255,255,0.10)',
  },
  headerIconInner: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: -0.3 },
  headerSub:   { fontSize: 14, color: 'rgba(255,255,255,0.82)', textAlign: 'center', marginTop: 6, lineHeight: 20, maxWidth: 280 },

  bodyPad: { paddingHorizontal: 20, paddingTop: 24, gap: 14 },

  card: { borderRadius: 20, padding: 18, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIconBadge: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#10B98120', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '800' },

  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  stepRowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  stepNumBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  stepNumText:  { color: '#fff', fontSize: 12, fontWeight: '900' },
  stepIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10B98112', alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  stepDesc:  { fontSize: 12, lineHeight: 17 },

  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  howIconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  howText: { flex: 1, fontSize: 13, lineHeight: 18 },

  tipRow: { borderRadius: 14, padding: 14, borderWidth: 1, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19 },

  ctaBtn:     { borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  ctaBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  ctaBtnText: { color: '#fff', fontSize: 17, fontWeight: '900' },

  cameraFull: { flex: 1, backgroundColor: '#000' },
  camTop: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 24 },
  camHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  camBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  camTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  recPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.40)' },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  recText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  timerWrap: { position: 'absolute', top: 120, right: 20, zIndex: 10 },
  timerRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  timerNum: { fontSize: 18, fontWeight: '900', lineHeight: 22 },
  timerLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: '700' },

  ovalWrapper: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  faceOval: { width: 210, height: 280, borderRadius: 105, borderWidth: 2.5, borderStyle: 'dashed' },

  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.82)', paddingHorizontal: 20, paddingTop: 20,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: 'rgba(16,185,129,0.25)',
  },

  stepPromptRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  stepPromptTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  stepPromptHint: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 2 },
  promptIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },

  stepDots: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  stepDot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' },
  stepDotActive: { backgroundColor: '#10B981' },
  stepDotDone:   { backgroundColor: '#059669' },

  stepsList: { gap: 8, marginBottom: 16 },
  stepsListRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepsListIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  stepsListNum: { color: 'rgba(255,255,255,0.50)', fontSize: 10, fontWeight: '900' },
  stepsListLabel: { fontSize: 13, fontWeight: '700' },

  submitBtn:     { borderRadius: 16, overflow: 'hidden' },
  submitBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  waitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  waitText: { color: 'rgba(255,255,255,0.60)', fontSize: 13, fontWeight: '600' },

  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  analyzeFrame: {
    width: SW * 0.65, height: SW * 0.65, borderRadius: 24,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center', position: 'relative',
  },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#10B981', opacity: 0.7 },
  analyzeTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center', marginTop: 20 },
  analyzeSub:   { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 280 },

  resultTopBar: { alignItems: 'center', paddingBottom: 12 },
  resultTopTitle: { fontSize: 18, fontWeight: '900' },
  resultRing: { width: 130, height: 130, borderRadius: 65, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  resultInner: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  resultSub:   { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24, maxWidth: 300 },

  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  completedText: { fontSize: 14, fontWeight: '600' },
});

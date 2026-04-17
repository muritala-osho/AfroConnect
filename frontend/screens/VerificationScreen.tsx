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

const VERIFICATION_STEPS = [
  { index: 0, key: 'blink', emoji: '😉', title: 'Blink eyes', hint: 'Look at the camera and blink once' },
  { index: 1, key: 'left',  emoji: '👈', title: 'Turn head left',  hint: 'Slowly turn your head to the left' },
  { index: 2, key: 'right', emoji: '👉', title: 'Turn head right', hint: 'Now slowly turn your head to the right' },
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

interface LandmarkMetrics {
  centered: boolean;
  landmarksReady: boolean;
  distance: 'tooFar' | 'good' | 'tooClose';
  yaw: number;
  eyeScore: number;
  prompt: string;
}

const INITIAL_METRICS: LandmarkMetrics = {
  centered: false,
  landmarksReady: false,
  distance: 'good',
  yaw: 0,
  eyeScore: 1,
  prompt: 'Position your face in the oval',
};

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

function PromptIcon({ stepKey }: { stepKey: string }) {
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
  const [verificationStep, setVerificationStep] = useState(0);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [faceStatus, setFaceStatus] = useState('Position your face in the oval');
  const [landmarkMetrics, setLandmarkMetrics] = useState<LandmarkMetrics>(INITIAL_METRICS);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [faceDetected, setFaceDetected] = useState(false);

  const cameraRef              = useRef<any>(null);
  const recordingPromiseRef    = useRef<Promise<{ uri: string }> | null>(null);
  const recordingStartedAtRef  = useRef(0);
  const uploadStartedRef       = useRef(false);
  const blinkOpenSeenRef       = useRef(false);
  const leftTurnDirectionRef   = useRef<number | null>(null);
  const stepRef                = useRef(0);
  const screenRef              = useRef<string>('intro');
  const advanceGuardRef        = useRef(false);
  const pulseAnim              = useRef(new Animated.Value(1)).current;
  const fadeAnim               = useRef(new Animated.Value(0)).current;
  const slideAnim              = useRef(new Animated.Value(24)).current;
  const scanAnim               = useRef(new Animated.Value(0)).current;

  useEffect(() => { if (!permission) requestPermission(); }, [permission, requestPermission]);
  useEffect(() => { stepRef.current = verificationStep; }, [verificationStep]);
  useEffect(() => { screenRef.current = screen; }, [screen]);

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

  const uploadVerificationVideo = useCallback(async (videoUri: string) => {
    try {
      const formData = new FormData();
      formData.append('userId', user?.id || '');
      formData.append('video', { uri: videoUri, type: 'video/mp4', name: 'verification-video.mp4' } as any);

      const resp = await fetch(`${getApiBaseUrl()}/upload-verification-video`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: formData,
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.message || 'Video upload failed. Please try again.');

      setResult({ submitted: true, status: 'pending', videoUrl: data.videoUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      setResult({ submitted: false, status: 'failed', reason: error?.message || 'Connection error. Please try again.' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setScreen('result');
      setRecording(false);
    }
  }, [token, user?.id]);

  const stopRecordingAndUpload = useCallback(async () => {
    if (uploadStartedRef.current) return;
    uploadStartedRef.current = true;
    setScreen('analyzing');
    setFaceStatus('All steps completed. Saving your video…');

    try {
      const elapsed = Date.now() - recordingStartedAtRef.current;
      if (elapsed < 3000) await new Promise(resolve => setTimeout(resolve, 3000 - elapsed));

      if (cameraRef.current && recordingPromiseRef.current) {
        cameraRef.current.stopRecording();
        const video = await recordingPromiseRef.current;
        if (!video?.uri) throw new Error('No video was recorded. Please try again.');
        await uploadVerificationVideo(video.uri);
      } else {
        throw new Error('Recording did not start. Please try again.');
      }
    } catch (error: any) {
      setResult({ submitted: false, status: 'failed', reason: error?.message || 'Could not save verification video.' });
      setScreen('result');
      setRecording(false);
    }
  }, [uploadVerificationVideo]);

  const advanceStep = useCallback((detectedStep: number) => {
    if (stepRef.current !== detectedStep || detectedStep >= 3 || advanceGuardRef.current) return;
    advanceGuardRef.current = true;
    console.log(`[Liveness] Step ${detectedStep} COMPLETED ✓`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const next = detectedStep + 1;
    stepRef.current = next;
    setVerificationStep(next);
    setTimeout(() => { advanceGuardRef.current = false; }, 800);
    if (next >= 3) stopRecordingAndUpload();
  }, [stopRecordingAndUpload]);

  const startRecording = useCallback(() => {
    if (!cameraRef.current || recordingPromiseRef.current || uploadStartedRef.current) return;
    setRecording(true);
    recordingStartedAtRef.current = Date.now();
    recordingPromiseRef.current = cameraRef.current.recordAsync();
    recordingPromiseRef.current?.catch(() => null);
    console.log('[Liveness] Recording started');
  }, []);

  useEffect(() => {
    if (screen !== 'camera' || !permission?.granted || !cameraReady) return;
    startRecording();
  }, [screen, permission?.granted, cameraReady, startRecording]);

  useEffect(() => {
    return () => {
      if (recordingPromiseRef.current && cameraRef.current && !uploadStartedRef.current) {
        try { cameraRef.current.stopRecording(); } catch {}
      }
    };
  }, []);

  const onFacesDetected = useCallback(({ faces }: { faces: any[] }) => {
    if (screenRef.current !== 'camera') return;

    if (!faces || faces.length === 0) {
      setFaceDetected(false);
      setFaceStatus('No face detected — look at the camera');
      console.log('[Liveness] No face detected');
      return;
    }

    const face = faces[0];
    const currentStep = stepRef.current;
    if (currentStep >= 3) return;

    console.log('[Liveness] Face detected — landmarks count: face data present');

    const fW = SW;
    const fH = SW * 1.4;
    const centerX   = ((face?.bounds?.origin?.x || 0) + (face?.bounds?.size?.width  || 0) / 2) / fW;
    const centerY   = ((face?.bounds?.origin?.y || 0) + (face?.bounds?.size?.height || 0) / 2) / fH;
    const widthRatio = (face?.bounds?.size?.width || 0) / fW;

    const centered  = centerX > 0.25 && centerX < 0.75 && centerY > 0.15 && centerY < 0.85;
    const distance  = widthRatio < 0.18 ? 'tooFar' : widthRatio > 0.78 ? 'tooClose' : 'good';

    const hasEyeProbs = typeof face?.leftEyeOpenProbability === 'number' &&
                        typeof face?.rightEyeOpenProbability === 'number';
    const hasYaw      = typeof face?.yawAngle === 'number';
    const landmarksReady = hasEyeProbs || hasYaw;

    const yaw      = hasYaw ? Number(face.yawAngle) : 0;
    const leftEye  = hasEyeProbs ? face.leftEyeOpenProbability  : 1;
    const rightEye = hasEyeProbs ? face.rightEyeOpenProbability : 1;
    const eyeScore = Math.min(leftEye, rightEye);

    console.log(`[Liveness] step=${currentStep} centered=${centered} dist=${distance} hasEyeProbs=${hasEyeProbs} hasYaw=${hasYaw} yaw=${yaw.toFixed(1)} leftEye=${leftEye.toFixed(2)} rightEye=${rightEye.toFixed(2)}`);

    setFaceDetected(true);
    setLandmarkMetrics({ centered, landmarksReady, distance, yaw, eyeScore, prompt: 'Face locked. Follow the prompt.' });

    if (!centered) {
      setFaceStatus('Center your face inside the oval');
      return;
    }
    if (distance === 'tooFar') {
      setFaceStatus('Move a little closer');
      return;
    }
    if (distance === 'tooClose') {
      setFaceStatus('Move slightly back');
      return;
    }

    if (currentStep === 0) {
      if (!hasEyeProbs) {
        setFaceStatus('Hold still — detecting eye movement…');
        return;
      }
      if (leftEye > 0.5 && rightEye > 0.5) {
        blinkOpenSeenRef.current = true;
      }
      if (blinkOpenSeenRef.current && leftEye < 0.35 && rightEye < 0.35) {
        console.log(`[Liveness] BLINK detected! leftEye=${leftEye.toFixed(2)} rightEye=${rightEye.toFixed(2)}`);
        advanceStep(0);
      } else {
        setFaceStatus(blinkOpenSeenRef.current ? 'Blink now!' : 'Eyes open — ready to blink');
      }
      return;
    }

    if (currentStep === 1) {
      if (!hasYaw) {
        setFaceStatus('Hold still — detecting head position…');
        return;
      }
      console.log(`[Liveness] Head turn step 1 — yaw=${yaw.toFixed(1)}`);
      if (Math.abs(yaw) > 15) {
        leftTurnDirectionRef.current = Math.sign(yaw) || -1;
        console.log(`[Liveness] HEAD TURN LEFT detected! yaw=${yaw.toFixed(1)}`);
        advanceStep(1);
      } else {
        setFaceStatus('Turn your head left slowly');
      }
      return;
    }

    if (currentStep === 2) {
      if (!hasYaw) {
        setFaceStatus('Hold still — detecting head position…');
        return;
      }
      const leftDir        = leftTurnDirectionRef.current;
      const turnedOpposite = leftDir === null
        ? Math.abs(yaw) > 15
        : Math.sign(yaw) === -leftDir && Math.abs(yaw) > 15;

      console.log(`[Liveness] Head turn step 2 — yaw=${yaw.toFixed(1)} leftDir=${leftDir} turnedOpposite=${turnedOpposite}`);
      if (turnedOpposite) {
        console.log(`[Liveness] HEAD TURN RIGHT detected! yaw=${yaw.toFixed(1)}`);
        advanceStep(2);
      } else {
        setFaceStatus('Turn your head right slowly');
      }
    }
  }, [advanceStep]);

  const restart = () => {
    blinkOpenSeenRef.current        = false;
    leftTurnDirectionRef.current    = null;
    stepRef.current                 = 0;
    uploadStartedRef.current        = false;
    advanceGuardRef.current         = false;
    recordingPromiseRef.current     = null;
    setVerificationStep(0);
    setResult(null);
    setScreen('camera');
    setRecording(false);
    setFaceDetected(false);
    setFaceStatus('Position your face in the oval');
    setLandmarkMetrics(INITIAL_METRICS);
  };

  // ─── INTRO ────────────────────────────────────────────────────────────────
  if (screen === 'intro') {
    const steps = [
      { icon: 'eye-outline'               as const, label: 'Blink your eyes',   desc: 'Look at the camera and blink once naturally' },
      { icon: 'arrow-back-circle-outline' as const, label: 'Turn head left',    desc: 'Slowly turn your head to the left' },
      { icon: 'arrow-forward-circle-outline' as const, label: 'Turn head right', desc: 'Then slowly turn your head to the right' },
    ];
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

          {/* ── Gradient header ── */}
          <LinearGradient
            colors={['#10B981', '#059669', '#0D9488']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.gradientHeader, { paddingTop: insets.top + 12 }]}
          >
            <Pressable
              style={styles.headerBackBtn}
              onPress={() => navigation.goBack()}
              hitSlop={12}
            >
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

          {/* ── Body ── */}
          <Animated.View style={[styles.bodyPad, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

            {/* Steps card */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBadge}>
                  <Ionicons name="list-outline" size={16} color="#10B981" />
                </View>
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>What you will do</ThemedText>
              </View>
              {steps.map((s, i) => (
                <View key={s.label} style={[styles.stepRow, i < steps.length - 1 && styles.stepRowDivider]}>
                  <View style={styles.stepNumBadge}>
                    <ThemedText style={styles.stepNumText}>{i + 1}</ThemedText>
                  </View>
                  <View style={styles.stepIconCircle}>
                    <Ionicons name={s.icon} size={20} color="#10B981" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.stepLabel, { color: theme.text }]}>{s.label}</ThemedText>
                    <ThemedText style={[styles.stepDesc,  { color: theme.textSecondary }]}>{s.desc}</ThemedText>
                  </View>
                </View>
              ))}
            </View>

            {/* Tips */}
            <View style={[styles.tipRow, { backgroundColor: '#10B98110', borderColor: '#10B98130' }]}>
              <Ionicons name="sunny-outline" size={18} color="#10B981" />
              <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
                Be in a{' '}
                <ThemedText style={{ fontWeight: '800', color: theme.text }}>well-lit area</ThemedText>
                {' '}and hold your phone at face level. The process takes about 15 seconds.
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
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ─── CAMERA ───────────────────────────────────────────────────────────────
  if (screen === 'camera') {
    const activeStep = VERIFICATION_STEPS[Math.min(verificationStep, 2)];
    const ovalColor  = '#10B981';

    return (
      <View style={styles.cameraFull}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
          mode="video"
          mute
          onCameraReady={() => {
            console.log('[Liveness] Camera ready');
            setCameraReady(true);
          }}
          onFacesDetected={onFacesDetected}
          faceDetectorSettings={{
            mode: 'fast',
            detectLandmarks: 'all',
            runClassifications: 'all',
            minDetectionInterval: 100,
            tracking: true,
          }}
        />

        {/* Top bar */}
        <LinearGradient colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.0)']} style={[styles.camTop, { paddingTop: insets.top + 6 }]}>
          <View style={styles.camHeader}>
            <Pressable style={styles.camBackBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#FFF" />
            </Pressable>
            <ThemedText style={styles.camTitle}>Face Verification</ThemedText>
            <View style={[styles.recPill, { borderColor: recording ? '#ef444460' : '#ffffff30' }]}>
              <View style={[styles.recDot, { backgroundColor: recording ? '#ef4444' : '#64748b' }]} />
              <ThemedText style={styles.recText}>{recording ? 'REC' : 'READY'}</ThemedText>
            </View>
          </View>
        </LinearGradient>

        {/* Face oval */}
        <View style={styles.ovalWrapper} pointerEvents="none">
          <View style={[styles.faceOval, { borderColor: (faceDetected ? '#10B981' : '#ffffff80') + 'CC' }]}>
            <Corner top={-2}  left={-2}  color={faceDetected ? ovalColor : '#ffffff80'} />
            <Corner top={-2}  right={-2} color={faceDetected ? ovalColor : '#ffffff80'} />
            <Corner bottom={-2} left={-2} color={faceDetected ? ovalColor : '#ffffff80'} />
            <Corner bottom={-2} right={-2} color={faceDetected ? ovalColor : '#ffffff80'} />
          </View>
          <View style={styles.statusPillWrap}>
            <ThemedText style={styles.statusPillText}>{faceStatus}</ThemedText>
          </View>
        </View>

        {/* Action card */}
        <View style={styles.actionCardWrap} pointerEvents="none">
          <View style={styles.actionCard}>
            {/* Progress bar */}
            <View style={styles.progressRow}>
              {VERIFICATION_STEPS.map(item => (
                <View
                  key={item.key}
                  style={[
                    styles.progressSeg,
                    verificationStep > item.index  && styles.progressSegDone,
                    verificationStep === item.index && styles.progressSegActive,
                  ]}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {verificationStep === 3 ? (
                <View style={styles.doneCircle}>
                  <Ionicons name="checkmark" size={28} color="#10B981" />
                </View>
              ) : (
                <PromptIcon stepKey={activeStep.key} />
              )}
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.actionTitle}>
                  {verificationStep === 3 ? 'All done!' : activeStep.title}
                </ThemedText>
                <ThemedText style={styles.actionHint}>
                  {verificationStep === 3 ? 'Saving your recording now…' : activeStep.hint}
                </ThemedText>
                <View style={styles.signalRow}>
                  <View style={[styles.signalPill, landmarkMetrics.centered     && styles.signalOn]}>
                    <ThemedText style={styles.signalText}>Centered</ThemedText>
                  </View>
                  <View style={[styles.signalPill, landmarkMetrics.landmarksReady && styles.signalOn]}>
                    <ThemedText style={styles.signalText}>Landmarks</ThemedText>
                  </View>
                  <View style={[styles.signalPill, faceDetected && styles.signalOn]}>
                    <ThemedText style={styles.signalText}>Face</ThemedText>
                  </View>
                  <View style={[styles.signalPill, recording && styles.signalRec]}>
                    <ThemedText style={styles.signalText}>Live</ThemedText>
                  </View>
                </View>
              </View>
              <Ionicons name="scan" size={22} color="#10B981" />
            </View>
          </View>
        </View>

        {/* Bottom hint */}
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.82)']} style={[styles.camBottom, { paddingBottom: insets.bottom + 28 }]}>
          <ThemedText style={styles.captureLbl}>Steps are sequential: blink → left → right</ThemedText>
          <ThemedText style={styles.captureHint}>Recording starts automatically and stops after all steps pass.</ThemedText>
        </LinearGradient>
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

        {/* Header bar */}
        <View style={[styles.resultTopBar, { paddingTop: insets.top + 12 }]}>
          <ThemedText style={[styles.resultTopTitle, { color: theme.text }]}>Verification</ThemedText>
        </View>

        <ScrollView contentContainerStyle={[styles.bodyPad, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>

            {/* Result icon */}
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

            {/* Completed steps card */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, width: '100%' }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBadge, { backgroundColor: ok ? '#10B98120' : '#ef444420' }]}>
                  <Ionicons name={ok ? 'checkmark-circle-outline' : 'close-circle-outline'} size={16} color={ok ? '#10B981' : '#ef4444'} />
                </View>
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Completed sequence</ThemedText>
              </View>
              {['Blink eyes', 'Turn head left', 'Turn head right'].map(item => (
                <View key={item} style={styles.completedRow}>
                  <Ionicons name="checkmark-circle" size={16} color={ok ? '#10B981' : '#94a3b8'} />
                  <ThemedText style={[styles.completedText, { color: theme.textSecondary }]}>{item}</ThemedText>
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

  // ── Intro header ──
  gradientHeader: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  headerBackBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  headerIconWrap: {
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  headerIconRing: {
    position: 'absolute', width: 108, height: 108, borderRadius: 54,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  headerIconInner: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 26, fontWeight: '900', color: '#fff',
    textAlign: 'center', letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 14, color: 'rgba(255,255,255,0.82)',
    textAlign: 'center', marginTop: 6, lineHeight: 20, maxWidth: 280,
  },

  // ── Body ──
  bodyPad: { paddingHorizontal: 20, paddingTop: 24, gap: 14 },

  // ── Card ──
  card: {
    borderRadius: 20, padding: 18, borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardIconBadge: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: '#10B98120',
    alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '800' },

  // ── Step rows ──
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  stepRowDivider: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  stepNumBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  stepIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#10B98112', alignItems: 'center', justifyContent: 'center',
  },
  stepLabel: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  stepDesc:  { fontSize: 12, lineHeight: 17 },

  // ── Tips ──
  tipRow: {
    borderRadius: 14, padding: 14, borderWidth: 1,
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
  },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19 },

  // ── CTA button ──
  ctaBtn:     { borderRadius: 18, overflow: 'hidden', marginTop: 4 },
  ctaBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18,
  },
  ctaBtnText: { color: '#fff', fontSize: 17, fontWeight: '900' },

  // ── Camera ──
  cameraFull: { flex: 1, backgroundColor: '#000' },
  camTop: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 24 },
  camHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
  },
  camBackBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center',
  },
  camTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  recPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1,
  },
  recDot: { width: 7, height: 7, borderRadius: 4 },
  recText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  ovalWrapper: {
    position: 'absolute', inset: 0,
    alignItems: 'center', justifyContent: 'center', zIndex: 5,
  },
  faceOval: {
    width: 210, height: 280, borderRadius: 105,
    borderWidth: 2.5, borderStyle: 'dashed',
  },
  statusPillWrap: {
    marginTop: 14, backgroundColor: 'rgba(0,0,0,0.50)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.35)',
  },
  statusPillText: {
    color: 'rgba(255,255,255,0.90)', fontSize: 12, fontWeight: '700',
  },
  actionCardWrap: { position: 'absolute', bottom: 175, left: 16, right: 16, zIndex: 20 },
  actionCard: {
    backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 20, padding: 16,
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.30)',
  },
  actionTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', marginBottom: 2 },
  actionHint:  { color: 'rgba(255,255,255,0.60)', fontSize: 12 },
  promptIcon:  { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  doneCircle: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: 'rgba(16,185,129,0.15)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(16,185,129,0.50)',
  },
  signalRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  signalPill: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  signalOn: {
    backgroundColor: 'rgba(16,185,129,0.22)', borderColor: 'rgba(16,185,129,0.55)',
  },
  signalRec: {
    backgroundColor: 'rgba(239,68,68,0.22)', borderColor: 'rgba(239,68,68,0.55)',
  },
  signalText: { color: 'rgba(255,255,255,0.80)', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  progressRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  progressSeg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.20)' },
  progressSegActive: { backgroundColor: '#10B981' },
  progressSegDone:   { backgroundColor: '#059669' },
  camBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    paddingTop: 40, alignItems: 'center', gap: 6, paddingHorizontal: 24,
  },
  captureLbl:  { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  captureHint: { color: 'rgba(255,255,255,0.58)', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // ── Analyzing ──
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  analyzeFrame: {
    width: SW * 0.60, height: SW * 0.65, borderRadius: 20,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
  },
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: '#10B981', opacity: 0.85,
  },
  analyzeTitle: { fontSize: 20, fontWeight: '900', marginTop: 24, textAlign: 'center' },
  analyzeSub:   { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20, opacity: 0.75 },

  // ── Result ──
  resultTopBar: {
    paddingHorizontal: 20, paddingBottom: 8,
    alignItems: 'center',
  },
  resultTopTitle: { fontSize: 17, fontWeight: '800' },
  resultRing: {
    width: 120, height: 120, borderRadius: 60,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, marginTop: 8,
  },
  resultInner: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  resultTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  resultSub:   { fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 300, marginBottom: 20 },
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  completedText: { fontSize: 13 },
});

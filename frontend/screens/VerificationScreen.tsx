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
import * as FaceDetector from 'expo-face-detector';
import * as FileSystem from 'expo-file-system';
import LottieView from 'lottie-react-native';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import { useAuth } from '@/hooks/useAuth';
import { getApiBaseUrl } from '@/constants/config';

const { width: SW } = Dimensions.get('window');

const VERIFICATION_STEPS = [
  { index: 0, key: 'blink', emoji: '😉', title: 'Blink eyes', hint: 'Look at the camera and blink once' },
  { index: 1, key: 'left', emoji: '👈', title: 'Turn head left', hint: 'Slowly turn your head to the left' },
  { index: 2, key: 'right', emoji: '👉', title: 'Turn head right', hint: 'Now slowly turn your head to the right' },
];

const PROMPT_LOTTIE = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 60,
  w: 180,
  h: 180,
  nm: 'AfroConnect verification prompt pulse',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'premium-pulse',
      sr: 1,
      ks: {
        o: { a: 1, k: [{ t: 0, s: [80] }, { t: 30, s: [38] }, { t: 60, s: [80] }] },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [90, 90, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 1, k: [{ t: 0, s: [72, 72, 100] }, { t: 30, s: [104, 104, 100] }, { t: 60, s: [72, 72, 100] }] },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            { d: 1, ty: 'el', s: { a: 0, k: [132, 132] }, p: { a: 0, k: [0, 0] }, nm: 'pulse-ring' },
            { ty: 'st', c: { a: 0, k: [0.39, 0.4, 0.95, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 7 }, lc: 2, lj: 2, ml: 4, nm: 'indigo-stroke' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 }, nm: 'Transform' },
          ],
          nm: 'pulse-group',
          np: 3,
          cix: 2,
          bm: 0,
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
      bm: 0,
    },
  ],
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
      borderTopWidth: top !== undefined ? 3 : 0,
      borderBottomWidth: bottom !== undefined ? 3 : 0,
      borderLeftWidth: left !== undefined ? 3 : 0,
      borderRightWidth: right !== undefined ? 3 : 0,
    }} />
  );
}

function PromptIcon({ stepKey }: { stepKey: string }) {
  const stroke = '#6366f1';
  return (
    <View style={styles.promptIcon}>
      <LottieView source={PROMPT_LOTTIE as any} autoPlay loop style={StyleSheet.absoluteFill} />
      <Svg width={78} height={78} viewBox="0 0 78 78">
        <Circle cx={39} cy={39} r={24} fill="rgba(99,102,241,0.12)" stroke={stroke} strokeWidth={3} />
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

  const [screen, setScreen] = useState<'camera' | 'analyzing' | 'result'>('camera');
  const [verificationStep, setVerificationStep] = useState(0);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [faceStatus, setFaceStatus] = useState('Position your face in the oval');
  const [landmarkMetrics, setLandmarkMetrics] = useState<LandmarkMetrics>(INITIAL_METRICS);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const cameraRef = useRef<any>(null);
  const recordingPromiseRef = useRef<Promise<{ uri: string }> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const uploadStartedRef = useRef(false);
  const detectionBusyRef = useRef(false);
  const blinkOpenSeenRef = useRef(false);
  const leftTurnDirectionRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const scanAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    stepRef.current = verificationStep;
  }, [verificationStep]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [screen]);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
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
      if (!resp.ok || !data.success) {
        throw new Error(data.message || 'Video upload failed. Please try again.');
      }

      setResult({ submitted: true, status: 'pending', videoUrl: data.videoUrl });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      setResult({ submitted: false, status: 'failed', reason: error?.message || 'Connection error. Please try again.' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setScreen('result');
      setRecording(false);
      setDetecting(false);
    }
  }, [token, user?.id]);

  const stopRecordingAndUpload = useCallback(async () => {
    if (uploadStartedRef.current) return;
    uploadStartedRef.current = true;
    setScreen('analyzing');
    setFaceStatus('All steps completed. Saving your video…');

    try {
      const elapsed = Date.now() - recordingStartedAtRef.current;
      if (elapsed < 3000) {
        await new Promise(resolve => setTimeout(resolve, 3000 - elapsed));
      }

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

  const startRecording = useCallback(() => {
    if (!cameraRef.current || recordingPromiseRef.current || uploadStartedRef.current) return;
    setRecording(true);
    recordingStartedAtRef.current = Date.now();
    recordingPromiseRef.current = cameraRef.current.recordAsync();
    recordingPromiseRef.current.catch(() => null);
  }, []);

  const advanceStep = useCallback((detectedStep: number) => {
    if (stepRef.current !== detectedStep || detectedStep >= 3) return;
    const next = detectedStep + 1;
    stepRef.current = next;
    setVerificationStep(next);
    Haptics.impactAsync(next === 3 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);

    if (next === 3) {
      setFaceStatus('Complete');
      setTimeout(() => stopRecordingAndUpload(), 150);
    } else {
      const nextStep = VERIFICATION_STEPS[next];
      setFaceStatus(`Detected. Next: ${nextStep.title}`);
    }
  }, [stopRecordingAndUpload]);

  const getLandmarkMetrics = useCallback((face: any, frame: any): LandmarkMetrics => {
    const bounds = face?.bounds;
    const frameWidth = Number(frame?.width || 1);
    const frameHeight = Number(frame?.height || 1);
    const faceWidth = Number(bounds?.size?.width || 0);
    const faceHeight = Number(bounds?.size?.height || 0);
    const centerX = (Number(bounds?.origin?.x || 0) + faceWidth / 2) / frameWidth;
    const centerY = (Number(bounds?.origin?.y || 0) + faceHeight / 2) / frameHeight;
    const widthRatio = faceWidth / frameWidth;
    const centered = centerX > 0.28 && centerX < 0.72 && centerY > 0.22 && centerY < 0.78;
    const distance = widthRatio < 0.22 ? 'tooFar' : widthRatio > 0.72 ? 'tooClose' : 'good';
    const landmarksReady = Boolean(face?.leftEyePosition && face?.rightEyePosition && (face?.noseBasePosition || face?.mouthPosition));
    const yaw = Number(face?.yawAngle ?? 0);
    const leftEye = typeof face?.leftEyeOpenProbability === 'number' ? face.leftEyeOpenProbability : 1;
    const rightEye = typeof face?.rightEyeOpenProbability === 'number' ? face.rightEyeOpenProbability : 1;
    const eyeScore = Math.min(leftEye, rightEye);
    let prompt = 'Face locked. Follow the prompt.';

    if (!centered) prompt = 'Center your face inside the oval';
    else if (distance === 'tooFar') prompt = 'Move a little closer';
    else if (distance === 'tooClose') prompt = 'Move slightly back';
    else if (!landmarksReady) prompt = 'Hold still while landmarks lock';

    return { centered, landmarksReady, distance, yaw, eyeScore, prompt };
  }, []);

  const analyzeDetectedFace = useCallback((face: any, frame: any) => {
    const currentStep = stepRef.current;
    const metrics = getLandmarkMetrics(face, frame);
    setLandmarkMetrics(metrics);
    if (!metrics.centered || metrics.distance !== 'good' || !metrics.landmarksReady) {
      setFaceStatus(metrics.prompt);
      return;
    }

    const yaw = metrics.yaw;
    const leftEye = typeof face?.leftEyeOpenProbability === 'number' ? face.leftEyeOpenProbability : 1;
    const rightEye = typeof face?.rightEyeOpenProbability === 'number' ? face.rightEyeOpenProbability : 1;

    if (currentStep === 0) {
      if (leftEye > 0.65 && rightEye > 0.65) blinkOpenSeenRef.current = true;
      if (blinkOpenSeenRef.current && leftEye < 0.35 && rightEye < 0.35) {
        advanceStep(0);
      } else {
        setFaceStatus(blinkOpenSeenRef.current ? 'Blink now' : 'Eyes open — ready to blink');
      }
      return;
    }

    if (currentStep === 1) {
      if (Math.abs(yaw) > 15) {
        leftTurnDirectionRef.current = Math.sign(yaw) || -1;
        advanceStep(1);
      } else {
        setFaceStatus('Turn your head left slowly');
      }
      return;
    }

    if (currentStep === 2) {
      const leftDirection = leftTurnDirectionRef.current;
      const turnedOpposite = leftDirection === null ? Math.abs(yaw) > 15 : Math.sign(yaw) === -leftDirection && Math.abs(yaw) > 15;
      if (turnedOpposite) {
        advanceStep(2);
      } else {
        setFaceStatus('Turn your head right slowly');
      }
    }
  }, [advanceStep, getLandmarkMetrics]);

  const detectFrame = useCallback(async () => {
    if (!cameraRef.current || detectionBusyRef.current || screen !== 'camera' || stepRef.current >= 3) return;
    detectionBusyRef.current = true;
    setDetecting(true);

    let frameUri: string | null = null;
    try {
      const frame = await cameraRef.current.takePictureAsync({ quality: 0.25, skipProcessing: true });
      frameUri = frame?.uri || null;
      if (!frameUri) return;

      const detection = await FaceDetector.detectFacesAsync(frameUri, {
        mode: FaceDetector.FaceDetectorMode.fast,
        detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
        runClassifications: FaceDetector.FaceDetectorClassifications.all,
      });

      const face = detection.faces?.[0];
      if (!face) {
        setFaceStatus('No face detected. Move into the oval.');
        return;
      }

      analyzeDetectedFace(face, frame);
    } catch {
      setFaceStatus('Detecting face movement…');
    } finally {
      if (frameUri) FileSystem.deleteAsync(frameUri, { idempotent: true }).catch(() => null);
      detectionBusyRef.current = false;
      setDetecting(false);
    }
  }, [analyzeDetectedFace, screen]);

  useEffect(() => {
    if (screen !== 'camera' || !permission?.granted || !cameraReady) return;
    startRecording();
    const interval = setInterval(detectFrame, 700);
    return () => clearInterval(interval);
  }, [screen, permission?.granted, cameraReady, startRecording, detectFrame]);

  useEffect(() => {
    return () => {
      if (recordingPromiseRef.current && cameraRef.current && !uploadStartedRef.current) {
        try { cameraRef.current.stopRecording(); } catch {}
      }
    };
  }, []);

  const restart = () => {
    blinkOpenSeenRef.current = false;
    leftTurnDirectionRef.current = null;
    stepRef.current = 0;
    uploadStartedRef.current = false;
    recordingPromiseRef.current = null;
    setVerificationStep(0);
    setResult(null);
    setScreen('camera');
    setRecording(false);
    setFaceStatus('Position your face in the oval');
    setLandmarkMetrics(INITIAL_METRICS);
  };

  if (!permission?.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 }]}> 
        <Ionicons name="camera-outline" size={60} color={theme.textSecondary} />
        <ThemedText style={[styles.heroTitle, { color: theme.text, fontSize: 20 }]}>Camera Permission Required</ThemedText>
        <ThemedText style={[styles.heroSub, { color: theme.textSecondary }]}>Camera access is needed to complete face verification.</ThemedText>
        <Pressable style={[styles.primaryBtn, { width: '100%' }]} onPress={requestPermission}>
          <LinearGradient colors={[theme.primary, theme.primary + 'CC']} style={styles.primaryBtnGrad}>
            <ThemedText style={styles.primaryBtnText}>Grant Camera Access</ThemedText>
          </LinearGradient>
        </Pressable>
      </View>
    );
  }

  if (screen === 'camera') {
    const activeStep = VERIFICATION_STEPS[Math.min(verificationStep, 2)];
    const ovalColor = verificationStep === 3 ? '#10b981' : '#6366f1';

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

        <LinearGradient colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.0)']} style={[styles.camTop, { paddingTop: insets.top + 6 }]}> 
          <View style={styles.camHeader}>
            <Pressable style={styles.camBackBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#FFF" />
            </Pressable>
            <ThemedText style={styles.camTitle}>Face Verification</ThemedText>
            <View style={styles.recordingPill}>
              <View style={[styles.recordingDot, { backgroundColor: recording ? '#ef4444' : '#64748b' }]} />
              <ThemedText style={styles.recordingText}>{recording ? 'REC' : 'READY'}</ThemedText>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.ovalWrapper} pointerEvents="none">
          <View style={[styles.faceOval, { borderColor: ovalColor + 'CC' }]}> 
            <Corner top={-2} left={-2} color={ovalColor} />
            <Corner top={-2} right={-2} color={ovalColor} />
            <Corner bottom={-2} left={-2} color={ovalColor} />
            <Corner bottom={-2} right={-2} color={ovalColor} />
          </View>
          <ThemedText style={styles.ovalLabel}>{faceStatus}</ThemedText>
        </View>

        <View style={styles.actionCardWrap} pointerEvents="none">
          <View style={styles.actionCard}>
            <View style={styles.progressRow}>
              {VERIFICATION_STEPS.map((item) => (
                <View key={item.key} style={[styles.progressDot, verificationStep > item.index && styles.progressDotDone, verificationStep === item.index && styles.progressDotActive]} />
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {verificationStep === 3 ? (
                <ThemedText style={{ fontSize: 28 }}>✅</ThemedText>
              ) : (
                <PromptIcon stepKey={activeStep.key} />
              )}
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.actionTitle}>{verificationStep === 3 ? 'Complete' : activeStep.title}</ThemedText>
                <ThemedText style={styles.actionHint}>{verificationStep === 3 ? 'Saving your recording now' : activeStep.hint}</ThemedText>
                <View style={styles.signalRow}>
                  <View style={[styles.signalPill, landmarkMetrics.centered && styles.signalPillOn]}>
                    <ThemedText style={styles.signalText}>Centered</ThemedText>
                  </View>
                  <View style={[styles.signalPill, landmarkMetrics.landmarksReady && styles.signalPillOn]}>
                    <ThemedText style={styles.signalText}>Landmarks</ThemedText>
                  </View>
                  <View style={[styles.signalPill, recording && styles.signalPillRec]}>
                    <ThemedText style={styles.signalText}>Live</ThemedText>
                  </View>
                </View>
              </View>
              {detecting ? <ActivityIndicator color="#6366f1" /> : <Ionicons name="scan" size={24} color="#6366f1" />}
            </View>
          </View>
        </View>

        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.82)']} style={[styles.camBottom, { paddingBottom: insets.bottom + 28 }]}> 
          <ThemedText style={styles.captureLbl}>Steps are sequential: blink → left → right</ThemedText>
          <ThemedText style={styles.captureHint}>Recording started automatically and stops only after all steps pass.</ThemedText>
        </LinearGradient>
      </View>
    );
  }

  if (screen === 'analyzing') {
    const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, SW * 0.65] });
    return (
      <View style={[styles.container, { backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }]}> 
        <LinearGradient colors={['#14b8a615', 'transparent']} style={StyleSheet.absoluteFill} />
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>
          <View style={styles.analyzeFrame}>
            <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
            <Ionicons name="videocam" size={64} color="#334155" />
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />
            <Corner top={0} left={0} color="#14b8a6" />
            <Corner top={0} right={0} color="#14b8a6" />
            <Corner bottom={0} left={0} color="#14b8a6" />
            <Corner bottom={0} right={0} color="#14b8a6" />
          </View>
          <ActivityIndicator size="large" color="#14b8a6" style={{ marginTop: 28 }} />
          <ThemedText style={[styles.analyzeTitle, { color: theme.text }]}>Uploading verification video…</ThemedText>
          <ThemedText style={[styles.analyzeSub, { color: theme.textSecondary }]}>Your video was saved locally first and is now being submitted for review.</ThemedText>
        </Animated.View>
      </View>
    );
  }

  if (screen === 'result' && result) {
    const ok = result.status === 'pending';
    const color = ok ? '#10b981' : '#ef4444';
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}> 
        <LinearGradient colors={[color + '12', 'transparent']} style={StyleSheet.absoluteFill} />
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}> 
          <View style={{ width: 40 }} />
          <ThemedText style={[styles.topBarTitle, { color: theme.text }]}>Result</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>
            <Animated.View style={[styles.resultIconRing, { borderColor: color + '40', backgroundColor: color + '12', transform: [{ scale: pulseAnim }] }]}> 
              <LinearGradient colors={[color, color + 'BB']} style={styles.resultIconInner}>
                <Ionicons name={ok ? 'shield-checkmark' : 'alert-circle'} size={48} color="#FFF" />
              </LinearGradient>
            </Animated.View>
            <ThemedText style={[styles.resultTitle, { color }]}>{ok ? 'Verification Submitted' : 'Upload Failed'}</ThemedText>
            <ThemedText style={[styles.resultSub, { color: theme.textSecondary }]}> 
              {ok ? 'Your verification video is pending review. We will update your status after it is checked.' : result.reason || 'Please try recording your verification again.'}
            </ThemedText>
            <View style={[styles.resultCard, { backgroundColor: theme.card, borderColor: theme.border }]}> 
              <ThemedText style={[styles.tipsTitle, { color: theme.text }]}>Completed sequence</ThemedText>
              {['Blink eyes', 'Turn head left', 'Turn head right'].map((item, i) => (
                <View key={item} style={styles.completedRow}>
                  <Ionicons name="checkmark-circle" size={16} color={ok ? '#10b981' : '#94a3b8'} />
                  <ThemedText style={[styles.tipItem, { color: theme.textSecondary }]}>{i}: {item}</ThemedText>
                </View>
              ))}
            </View>
            {ok ? (
              <Pressable style={styles.primaryBtn} onPress={() => navigation.goBack()}>
                <LinearGradient colors={['#10b981', '#059669']} style={styles.primaryBtnGrad}>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <ThemedText style={styles.primaryBtnText}>Done</ThemedText>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable style={styles.primaryBtn} onPress={restart}>
                <LinearGradient colors={[theme.primary, theme.primary + 'CC']} style={styles.primaryBtnGrad}>
                  <Ionicons name="refresh" size={20} color="#FFF" />
                  <ThemedText style={styles.primaryBtnText}>Try Again</ThemedText>
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
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  topBarTitle: { fontSize: 17, fontWeight: '800' },
  heroTitle: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  heroSub: { fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 300 },
  cameraFull: { flex: 1, backgroundColor: '#000' },
  camTop: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 20 },
  camHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 4 },
  camBackBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  camTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  recordingPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.45)' },
  recordingDot: { width: 7, height: 7, borderRadius: 4 },
  recordingText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  ovalWrapper: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  faceOval: { width: 210, height: 280, borderRadius: 105, borderWidth: 2.5, borderStyle: 'dashed' },
  ovalLabel: { fontSize: 12, marginTop: 14, fontWeight: '700', color: 'rgba(255,255,255,0.78)', backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, overflow: 'hidden' },
  actionCardWrap: { position: 'absolute', bottom: 180, left: 16, right: 16, zIndex: 20 },
  actionCard: { backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(99,102,241,0.35)' },
  actionTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', marginBottom: 2 },
  actionHint: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  promptIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  signalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 9 },
  signalPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  signalPillOn: { backgroundColor: 'rgba(16,185,129,0.2)', borderColor: 'rgba(16,185,129,0.5)' },
  signalPillRec: { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: 'rgba(239,68,68,0.5)' },
  signalText: { color: 'rgba(255,255,255,0.78)', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  progressRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  progressDot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  progressDotActive: { backgroundColor: '#6366f1' },
  progressDotDone: { backgroundColor: '#10b981' },
  camBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, paddingTop: 40, alignItems: 'center', gap: 6, paddingHorizontal: 24 },
  captureLbl: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  captureHint: { color: 'rgba(255,255,255,0.58)', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  analyzeFrame: { width: SW * 0.6, height: SW * 0.65, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#14b8a6', opacity: 0.85 },
  analyzeTitle: { fontSize: 20, fontWeight: '900', marginTop: 20, textAlign: 'center' },
  analyzeSub: { fontSize: 13, textAlign: 'center', marginTop: 8, maxWidth: 280, lineHeight: 19 },
  resultIconRing: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20, marginTop: 16 },
  resultIconInner: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  resultSub: { fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 300, marginBottom: 20 },
  resultCard: { width: '100%', borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 12 },
  tipsTitle: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  tipItem: { fontSize: 13, lineHeight: 22 },
  completedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  primaryBtn: { width: '100%', borderRadius: 18, overflow: 'hidden' },
  primaryBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  primaryBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },
});

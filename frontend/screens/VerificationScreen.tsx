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
import { useAuth } from '@/hooks/useAuth';
import { getApiBaseUrl } from '@/constants/config';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Liveness challenges ─────────────────────────────────────────────────────
const LIVENESS_ACTIONS = [
  { id: 'look_left',  emoji: '👈', title: 'Turn your head LEFT',   hint: 'Slowly rotate your head to the left',  holdSecs: 3 },
  { id: 'look_right', emoji: '👉', title: 'Turn your head RIGHT',  hint: 'Slowly rotate your head to the right', holdSecs: 3 },
  { id: 'smile',      emoji: '😁', title: 'Show a BIG smile',      hint: 'Show your teeth — smile wide!',        holdSecs: 3 },
  { id: 'blink',      emoji: '😉', title: 'Blink slowly',          hint: 'Close both eyes then reopen them',     holdSecs: 3 },
  { id: 'nod',        emoji: '🙂', title: 'Nod your head',         hint: 'Gently nod up and down twice',         holdSecs: 3 },
];

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Step = 'intro' | 'liveness' | 'capture' | 'analyzing' | 'result';

interface AnalysisResult {
  verified: boolean;
  similarity: number;
  reason?: string;
  livenessIssues?: string[];
}

// ─── Countdown ring component ─────────────────────────────────────────────────
function CountdownRing({ seconds, color }: { seconds: number; color: string }) {
  const progress = useRef(new Animated.Value(0)).current;
  const SIZE = 80;
  const R    = 36;
  const CIRC = 2 * Math.PI * R;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: seconds * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [seconds]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, CIRC],
  });

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: SIZE / 2, borderWidth: 6, borderColor: color + '30' }]} />
      <Animated.View
        style={{
          position: 'absolute',
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          borderWidth: 6,
          borderColor: color,
          borderTopColor: 'transparent',
          borderLeftColor: 'transparent',
        }}
      />
      <ThemedText style={{ fontSize: 22, fontWeight: '900', color }}>{seconds}</ThemedText>
    </View>
  );
}

// ─── Similarity meter ─────────────────────────────────────────────────────────
function SimilarityMeter({ score, verified }: { score: number; verified: boolean }) {
  const anim     = useRef(new Animated.Value(0)).current;
  const pct      = Math.round(score * 100);
  const color    = verified ? '#10b981' : score > 0.6 ? '#f59e0b' : '#ef4444';

  useEffect(() => {
    Animated.timing(anim, { toValue: score, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [score]);

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={{ marginVertical: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#94a3b8' }}>Similarity Score</ThemedText>
        <ThemedText style={{ fontSize: 12, fontWeight: '900', color }}>{pct}%</ThemedText>
      </View>
      <View style={{ height: 10, backgroundColor: '#1e293b', borderRadius: 5, overflow: 'hidden' }}>
        <Animated.View style={{ height: '100%', width, backgroundColor: color, borderRadius: 5 }} />
      </View>
      <ThemedText style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
        {verified ? 'Above 85% threshold — identity confirmed' : pct > 60 ? 'Close but below 85% threshold' : 'Not enough similarity to your profile photo'}
      </ThemedText>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function VerificationScreen() {
  const { theme }  = useTheme();
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { token }  = useAuth();

  const [step,        setStep]        = useState<Step>('intro');
  const [challenges,  setChallenges]  = useState(() => shuffled(LIVENESS_ACTIONS).slice(0, 3));
  const [challengeIdx,setChallengeIdx]= useState(0);
  const [countdown,   setCountdown]   = useState(challenges[0]?.holdSecs ?? 3);
  const [allPassed,   setAllPassed]   = useState(false);

  // Camera
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef  = useRef<any>(null);
  const [capturing,  setCapturing]  = useState(false);

  // Result
  const [result,    setResult]    = useState<AnalysisResult | null>(null);

  // Animations
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(30)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const scanAnim   = useRef(new Animated.Value(0)).current;
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  const fadeIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(24);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => { fadeIn(); }, [step]);

  // Pulse loop for the shield icon on intro / result
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  // Scan line animation for analyzing step
  useEffect(() => {
    if (step !== 'analyzing') return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(scanAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(scanAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [step]);

  // Liveness countdown timer
  useEffect(() => {
    if (step !== 'liveness') { if (timerRef.current) clearInterval(timerRef.current); return; }
    const action = challenges[challengeIdx];
    if (!action) return;
    setCountdown(action.holdSecs);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          nextChallenge();
          return action.holdSecs;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step, challengeIdx]);

  const nextChallenge = useCallback(() => {
    setChallengeIdx(prev => {
      const next = prev + 1;
      if (next >= challenges.length) {
        setAllPassed(true);
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setStep('capture');
        }, 600);
        return prev;
      }
      return next;
    });
  }, [challenges]);

  const skipChallenge = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    nextChallenge();
  };

  // Take photo and call API
  const captureAndVerify = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) { setCapturing(false); return; }
      setStep('analyzing');
      await callVerifyFace(photo.uri);
    } catch {
      setCapturing(false);
    }
  };

  const callVerifyFace = async (photoUri: string) => {
    try {
      const formData = new FormData();
      formData.append('photo', { uri: photoUri, type: 'image/jpeg', name: 'selfie.jpg' } as any);

      const resp = await fetch(`${getApiBaseUrl()}/api/verification/me/verify-face`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: formData,
      });

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        setResult({ verified: false, similarity: 0, reason: data.message || 'Server error. Please try again.' });
      } else {
        const issues: string[] = [];
        if (data.liveness && !data.liveness.passed && data.liveness.issues?.length) {
          issues.push(...data.liveness.issues);
        }
        setResult({
          verified: data.verified,
          similarity: data.similarity ?? 0,
          reason: data.reason,
          livenessIssues: issues,
        });
        Haptics.notificationAsync(data.verified
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setResult({ verified: false, similarity: 0, reason: 'Connection error. Check your network and try again.' });
    } finally {
      setStep('result');
      setCapturing(false);
    }
  };

  const restart = () => {
    setChallenges(shuffled(LIVENESS_ACTIONS).slice(0, 3));
    setChallengeIdx(0);
    setAllPassed(false);
    setResult(null);
    setCapturing(false);
    setStep('intro');
  };

  // ─── INTRO ──────────────────────────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient colors={[theme.primary + '18', 'transparent']} style={StyleSheet.absoluteFill} />

        {/* Header */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.topBarTitle, { color: theme.text }]}>Face Verification</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            {/* Hero icon */}
            <View style={styles.heroBlock}>
              <Animated.View style={[styles.shieldRing, { transform: [{ scale: pulseAnim }], borderColor: theme.primary + '40', backgroundColor: theme.primary + '10' }]}>
                <LinearGradient colors={[theme.primary, theme.primary + 'CC']} style={styles.shieldInner}>
                  <Ionicons name="shield-checkmark" size={44} color="#FFF" />
                </LinearGradient>
              </Animated.View>
              <ThemedText style={[styles.heroTitle, { color: theme.text }]}>Identity Verification</ThemedText>
              <ThemedText style={[styles.heroSub, { color: theme.textSecondary }]}>
                A quick liveness check confirms you're a real person, then your face is compared to your profile photo.
              </ThemedText>
            </View>

            {/* Steps */}
            {[
              { n: 1, icon: 'walk', title: 'Complete 3 liveness checks', desc: 'Turn left, turn right, smile — proves you\'re live in front of the camera.', color: '#6366f1' },
              { n: 2, icon: 'camera', title: 'Take a clear selfie', desc: 'One frontal photo in good lighting — this is compared to your profile.', color: '#14b8a6' },
              { n: 3, icon: 'sparkles', title: 'Instant AI result', desc: 'Our AI compares your faces. 85%+ similarity = verified blue badge.', color: '#f59e0b' },
            ].map(({ n, icon, title, desc, color }) => (
              <View key={n} style={[styles.stepRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <View style={[styles.stepNum, { backgroundColor: color }]}>
                  <ThemedText style={styles.stepNumText}>{n}</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.stepTitle, { color: theme.text }]}>{title}</ThemedText>
                  <ThemedText style={[styles.stepDesc, { color: theme.textSecondary }]}>{desc}</ThemedText>
                </View>
                <Ionicons name={icon as any} size={22} color={color} style={{ opacity: 0.7 }} />
              </View>
            ))}

            {/* Note */}
            <View style={[styles.noteCard, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '25' }]}>
              <Ionicons name="lock-closed" size={14} color={theme.primary} style={{ marginRight: 8 }} />
              <ThemedText style={[styles.noteText, { color: theme.primary }]}>
                Your selfie is only used for identity matching and never shared with other users.
              </ThemedText>
            </View>

            {/* Start */}
            <Pressable style={styles.startBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setStep('liveness'); }}>
              <LinearGradient colors={[theme.primary, theme.primary + 'CC']} style={styles.startBtnGrad}>
                <Ionicons name="play-circle" size={22} color="#FFF" />
                <ThemedText style={styles.startBtnText}>Start Verification</ThemedText>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ─── LIVENESS ───────────────────────────────────────────────────────────────
  if (step === 'liveness') {
    const action = challenges[challengeIdx];
    const done   = allPassed;
    const pct    = ((challengeIdx + (done ? 1 : 0)) / challenges.length) * 100;

    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient colors={['#6366f115', 'transparent']} style={StyleSheet.absoluteFill} />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.backBtn} onPress={() => setStep('intro')}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.topBarTitle, { color: theme.text }]}>Liveness Check</ThemedText>
          <ThemedText style={[styles.stepCounter, { color: theme.textSecondary }]}>
            {Math.min(challengeIdx + 1, challenges.length)}/{challenges.length}
          </ThemedText>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center', width: '100%' }}>

            {/* Progress bar */}
            <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
              <Animated.View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: '#6366f1' }]} />
            </View>

            {done ? (
              <>
                <View style={[styles.livenessEmojiCircle, { backgroundColor: '#10b98115', borderColor: '#10b981' }]}>
                  <ThemedText style={styles.bigEmoji}>✅</ThemedText>
                </View>
                <ThemedText style={[styles.livenessTitle, { color: theme.text }]}>Liveness Confirmed!</ThemedText>
                <ThemedText style={[styles.livenessSub, { color: theme.textSecondary }]}>
                  Great job! Now take a clear frontal selfie for face comparison.
                </ThemedText>
                <ActivityIndicator color={theme.primary} style={{ marginTop: 20 }} />
              </>
            ) : (
              <>
                <View style={[styles.livenessEmojiCircle, { backgroundColor: '#6366f115', borderColor: '#6366f1' }]}>
                  <ThemedText style={styles.bigEmoji}>{action.emoji}</ThemedText>
                </View>
                <ThemedText style={[styles.livenessTitle, { color: theme.text }]}>{action.title}</ThemedText>
                <ThemedText style={[styles.livenessSub, { color: theme.textSecondary }]}>{action.hint}</ThemedText>

                <View style={{ marginVertical: 24 }}>
                  <CountdownRing seconds={countdown} color="#6366f1" />
                </View>

                <Pressable
                  style={[styles.skipBtn, { borderColor: theme.border }]}
                  onPress={skipChallenge}
                >
                  <Ionicons name="checkmark" size={16} color={theme.textSecondary} />
                  <ThemedText style={[styles.skipBtnText, { color: theme.textSecondary }]}>I did it</ThemedText>
                </Pressable>

                {/* Progress dots */}
                <View style={styles.dots}>
                  {challenges.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        { backgroundColor: i < challengeIdx ? '#6366f1' : i === challengeIdx ? '#a5b4fc' : theme.border },
                        i === challengeIdx && { width: 20 },
                      ]}
                    />
                  ))}
                </View>
              </>
            )}
          </Animated.View>
        </View>
      </View>
    );
  }

  // ─── CAPTURE ────────────────────────────────────────────────────────────────
  if (step === 'capture') {
    if (!permission?.granted) {
      return (
        <View style={[styles.container, { backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="camera-outline" size={60} color={theme.textSecondary} />
          <ThemedText style={[styles.permTitle, { color: theme.text, marginTop: 16, marginBottom: 8 }]}>Camera Permission</ThemedText>
          <ThemedText style={[styles.permSub, { color: theme.textSecondary }]}>Camera access is required to take your verification selfie.</ThemedText>
          <Pressable style={[styles.permBtn, { backgroundColor: theme.primary }]} onPress={requestPermission}>
            <ThemedText style={styles.permBtnText}>Grant Camera Access</ThemedText>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.cameraFull}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

        {/* Top gradient */}
        <LinearGradient colors={['rgba(0,0,0,0.7)', 'transparent']} style={[styles.camTop, { paddingTop: insets.top + 8 }]}>
          <View style={styles.camHeader}>
            <Pressable style={styles.camBackBtn} onPress={() => setStep('liveness')}>
              <Ionicons name="arrow-back" size={22} color="#FFF" />
            </Pressable>
            <ThemedText style={styles.camTitle}>Take Your Selfie</ThemedText>
            <View style={{ width: 40 }} />
          </View>
          <ThemedText style={styles.camSubtitle}>Look straight ahead — neutral expression, good light</ThemedText>
        </LinearGradient>

        {/* Face oval */}
        <View style={styles.ovalWrapper}>
          <View style={styles.faceOval} />
          <ThemedText style={styles.ovalLabel}>Centre your face here</ThemedText>
        </View>

        {/* Tips bar */}
        <View style={styles.tipBar}>
          {['💡 Good lighting', '👀 Look straight', '😐 Neutral expression'].map((t, i) => (
            <View key={i} style={styles.tipChip}>
              <ThemedText style={styles.tipText}>{t}</ThemedText>
            </View>
          ))}
        </View>

        {/* Bottom capture */}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={[styles.camBottom, { paddingBottom: insets.bottom + 28 }]}>
          <Pressable style={styles.captureBtn} onPress={captureAndVerify} disabled={capturing}>
            <View style={styles.captureOuter}>
              <LinearGradient colors={['#14b8a6', '#0d9488']} style={styles.captureInner}>
                {capturing
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Ionicons name="camera" size={30} color="#FFF" />}
              </LinearGradient>
            </View>
          </Pressable>
          <ThemedText style={styles.captureLbl}>Tap to capture</ThemedText>
        </LinearGradient>
      </View>
    );
  }

  // ─── ANALYZING ──────────────────────────────────────────────────────────────
  if (step === 'analyzing') {
    const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, SW * 0.65] });
    return (
      <View style={[styles.container, { backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }]}>
        <LinearGradient colors={['#14b8a615', 'transparent']} style={StyleSheet.absoluteFill} />
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>
          <View style={styles.analyzeFrame}>
            <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.analyzeGrad} />
            <Ionicons name="person" size={64} color="#334155" />
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />
            <View style={[styles.analyzeCorner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
            <View style={[styles.analyzeCorner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
            <View style={[styles.analyzeCorner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
            <View style={[styles.analyzeCorner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
          </View>
          <ActivityIndicator size="large" color="#14b8a6" style={{ marginTop: 28 }} />
          <ThemedText style={[styles.analyzeTitle, { color: theme.text }]}>Analyzing your identity…</ThemedText>
          <ThemedText style={[styles.analyzeSub, { color: theme.textSecondary }]}>
            Comparing facial features against your profile photo. This takes 10–20 seconds.
          </ThemedText>
        </Animated.View>
      </View>
    );
  }

  // ─── RESULT ─────────────────────────────────────────────────────────────────
  if (step === 'result' && result) {
    const ok    = result.verified;
    const color = ok ? '#10b981' : result.similarity > 0.6 ? '#f59e0b' : '#ef4444';
    const icon  = ok ? 'shield-checkmark' : 'shield-outline';

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

            {/* Result icon */}
            <Animated.View style={[styles.resultIconRing, { borderColor: color + '40', backgroundColor: color + '12', transform: [{ scale: pulseAnim }] }]}>
              <LinearGradient colors={[color, color + 'BB']} style={styles.resultIconInner}>
                <Ionicons name={icon} size={48} color="#FFF" />
              </LinearGradient>
            </Animated.View>

            <ThemedText style={[styles.resultTitle, { color }]}>
              {ok ? 'Identity Verified!' : 'Verification Failed'}
            </ThemedText>
            <ThemedText style={[styles.resultSub, { color: theme.textSecondary }]}>
              {ok
                ? 'Your identity has been confirmed. A verified badge has been added to your profile.'
                : result.reason || 'The face in your selfie didn\'t match your profile photo closely enough.'}
            </ThemedText>

            {/* Similarity meter */}
            {result.similarity > 0 && (
              <View style={[styles.resultCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <SimilarityMeter score={result.similarity} verified={ok} />
              </View>
            )}

            {/* Liveness issues */}
            {(result.livenessIssues?.length ?? 0) > 0 && (
              <View style={[styles.resultCard, { backgroundColor: '#ef444410', borderColor: '#ef444430' }]}>
                <ThemedText style={{ fontSize: 12, fontWeight: '800', color: '#ef4444', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Liveness Issues</ThemedText>
                {result.livenessIssues!.map((issue, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 4 }}>
                    <Ionicons name="alert-circle" size={14} color="#ef4444" style={{ marginTop: 1 }} />
                    <ThemedText style={{ fontSize: 12, color: '#ef4444', flex: 1 }}>{issue}</ThemedText>
                  </View>
                ))}
              </View>
            )}

            {/* Tips on failure */}
            {!ok && (
              <View style={[styles.resultCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <ThemedText style={[styles.tipsTitle, { color: theme.text }]}>Tips for a better result</ThemedText>
                {[
                  '📸  Use your first profile photo (the one shown publicly)',
                  '💡  Find a well-lit spot — avoid backlighting',
                  '👤  Your face should be clearly visible, no hat or sunglasses',
                  '📐  Hold your phone at eye level, look directly at the camera',
                ].map((t, i) => (
                  <ThemedText key={i} style={[styles.tipItem, { color: theme.textSecondary }]}>{t}</ThemedText>
                ))}
              </View>
            )}

            {/* Actions */}
            {ok ? (
              <Pressable style={styles.primaryBtn} onPress={() => navigation.goBack()}>
                <LinearGradient colors={['#10b981', '#059669']} style={styles.primaryBtnGrad}>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <ThemedText style={styles.primaryBtnText}>Go to My Profile</ThemedText>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={{ width: '100%', gap: 10 }}>
                <Pressable style={styles.primaryBtn} onPress={restart}>
                  <LinearGradient colors={[theme.primary, theme.primary + 'CC']} style={styles.primaryBtnGrad}>
                    <Ionicons name="refresh" size={20} color="#FFF" />
                    <ThemedText style={styles.primaryBtnText}>Try Again</ThemedText>
                  </LinearGradient>
                </Pressable>
                <Pressable style={[styles.secondaryBtn, { borderColor: theme.border }]} onPress={() => navigation.goBack()}>
                  <ThemedText style={[styles.secondaryBtnText, { color: theme.textSecondary }]}>Go Back</ThemedText>
                </Pressable>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container:     { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  topBarTitle:   { fontSize: 17, fontWeight: '800' },
  backBtn:       { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stepCounter:   { fontSize: 13, fontWeight: '700' },

  // ── Intro
  heroBlock:     { alignItems: 'center', paddingVertical: 28 },
  shieldRing:    { width: 108, height: 108, borderRadius: 54, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  shieldInner:   { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  heroTitle:     { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  heroSub:       { fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 300 },
  stepRow:       { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 10 },
  stepNum:       { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepNumText:   { color: '#FFF', fontWeight: '900', fontSize: 15 },
  stepTitle:     { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  stepDesc:      { fontSize: 12, lineHeight: 17 },
  noteCard:      { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 4, marginBottom: 20 },
  noteText:      { fontSize: 12, lineHeight: 18, flex: 1 },
  startBtn:      { borderRadius: 18, overflow: 'hidden', marginBottom: 4 },
  startBtnGrad:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  startBtnText:  { color: '#FFF', fontSize: 17, fontWeight: '900' },

  // ── Liveness
  progressBar:          { height: 6, width: '100%', borderRadius: 3, overflow: 'hidden', marginBottom: 32 },
  progressFill:         { height: '100%', borderRadius: 3 },
  livenessEmojiCircle:  { width: 120, height: 120, borderRadius: 60, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  bigEmoji:             { fontSize: 58 },
  livenessTitle:        { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8 },
  livenessSub:          { fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 260 },
  skipBtn:              { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  skipBtnText:          { fontSize: 13, fontWeight: '600' },
  dots:                 { flexDirection: 'row', gap: 6, marginTop: 24 },
  dot:                  { height: 8, width: 8, borderRadius: 4 },

  // ── Camera capture
  cameraFull:    { flex: 1, backgroundColor: '#000' },
  camTop:        { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 20 },
  camHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  camBackBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  camTitle:      { color: '#FFF', fontSize: 17, fontWeight: '800' },
  camSubtitle:   { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
  ovalWrapper:   { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  faceOval:      { width: 210, height: 280, borderRadius: 105, borderWidth: 2.5, borderColor: '#14b8a6', borderStyle: 'dashed' },
  ovalLabel:     { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 14 },
  tipBar:        { position: 'absolute', bottom: 160, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8, zIndex: 10 },
  tipChip:       { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tipText:       { color: '#FFF', fontSize: 11, fontWeight: '600' },
  camBottom:     { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, paddingTop: 60, alignItems: 'center', gap: 8 },
  captureBtn:    { alignItems: 'center' },
  captureOuter:  { width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)', alignItems: 'center', justifyContent: 'center' },
  captureInner:  { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  captureLbl:    { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' },

  // ── Permission request
  permTitle:  { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  permSub:    { fontSize: 13, textAlign: 'center', maxWidth: 280, lineHeight: 19 },
  permBtn:    { marginTop: 20, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  permBtnText:{ color: '#FFF', fontWeight: '800', fontSize: 15 },

  // ── Analyzing
  analyzeFrame:  { width: SW * 0.6, height: SW * 0.65, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  analyzeGrad:   { ...StyleSheet.absoluteFillObject },
  scanLine:      { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#14b8a6', opacity: 0.85 },
  analyzeCorner: { position: 'absolute', width: 24, height: 24, borderColor: '#14b8a6' },
  analyzeTitle:  { fontSize: 20, fontWeight: '900', marginTop: 20, textAlign: 'center' },
  analyzeSub:    { fontSize: 13, textAlign: 'center', marginTop: 8, maxWidth: 280, lineHeight: 19 },

  // ── Result
  resultIconRing:  { width: 120, height: 120, borderRadius: 60, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20, marginTop: 16 },
  resultIconInner: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  resultTitle:     { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  resultSub:       { fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 300, marginBottom: 20 },
  resultCard:      { width: '100%', borderRadius: 18, padding: 16, borderWidth: 1, marginBottom: 12 },
  tipsTitle:       { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  tipItem:         { fontSize: 13, lineHeight: 22 },
  primaryBtn:      { width: '100%', borderRadius: 18, overflow: 'hidden' },
  primaryBtnGrad:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  primaryBtnText:  { color: '#FFF', fontSize: 17, fontWeight: '900' },
  secondaryBtn:    { width: '100%', paddingVertical: 14, borderRadius: 18, borderWidth: 1, alignItems: 'center' },
  secondaryBtnText:{ fontSize: 15, fontWeight: '600' },
});

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

const { width: SW } = Dimensions.get('window');

// ─── Liveness challenges ──────────────────────────────────────────────────────
const LIVENESS_ACTIONS = [
  { id: 'look_left',  emoji: '👈', title: 'Turn LEFT',   hint: 'Slowly rotate your head to the left',  holdSecs: 3 },
  { id: 'look_right', emoji: '👉', title: 'Turn RIGHT',  hint: 'Slowly rotate your head to the right', holdSecs: 3 },
  { id: 'smile',      emoji: '😁', title: 'Big Smile',   hint: 'Show your teeth — smile wide!',        holdSecs: 3 },
  { id: 'blink',      emoji: '😉', title: 'Blink Slowly',hint: 'Close both eyes then reopen them',     holdSecs: 3 },
  { id: 'nod',        emoji: '🙂', title: 'Nod Head',    hint: 'Gently nod up and down twice',         holdSecs: 3 },
];

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Step = 'intro' | 'camera' | 'analyzing' | 'result';
// During 'camera' step we have sub-phases:
//  'challenge' → liveness actions in progress (capture button locked)
//  'selfie'    → all actions done, user takes final selfie (capture button unlocked)
type CameraPhase = 'challenge' | 'selfie';

interface AnalysisResult {
  verified: boolean;
  similarity: number;
  reason?: string;
  livenessIssues?: string[];
}

// ─── Countdown ring (arc style) ──────────────────────────────────────────────
function CountdownRing({ seconds, total, color }: { seconds: number; total: number; color: string }) {
  const SIZE = 56;
  const pct  = seconds / total;

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: SIZE / 2, borderWidth: 4, borderColor: 'rgba(255,255,255,0.15)' }]} />
      <View style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: SIZE / 2,
          borderWidth: 4,
          borderColor: color,
          opacity: pct,
        }
      ]} />
      <ThemedText style={{ fontSize: 20, fontWeight: '900', color: '#FFF' }}>{seconds}</ThemedText>
    </View>
  );
}

// ─── Similarity meter ─────────────────────────────────────────────────────────
function SimilarityMeter({ score, verified }: { score: number; verified: boolean }) {
  const anim  = useRef(new Animated.Value(0)).current;
  const pct   = Math.round(score * 100);
  const color = verified ? '#10b981' : score > 0.6 ? '#f59e0b' : '#ef4444';

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

// ─── Corner bracket ───────────────────────────────────────────────────────────
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

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function VerificationScreen() {
  const { theme }  = useTheme();
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { token }  = useAuth();

  const [step,         setStep]         = useState<Step>('intro');
  const [cameraPhase,  setCameraPhase]  = useState<CameraPhase>('challenge');
  const [challenges,   setChallenges]   = useState(() => shuffled(LIVENESS_ACTIONS).slice(0, 3));
  const [challengeIdx, setChallengeIdx] = useState(0);
  const [countdown,    setCountdown]    = useState(challenges[0]?.holdSecs ?? 3);
  const [result,       setResult]       = useState<AnalysisResult | null>(null);

  // Camera
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef      = useRef<any>(null);
  const [capturing,    setCapturing]    = useState(false);
  const liveCapturingRef = useRef(false); // ref avoids stale-closure issues inside the interval

  // Flash effect on auto-capture
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Animations
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanAnim  = useRef(new Animated.Value(0)).current;
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const fadeIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(24);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => { fadeIn(); }, [step]);

  // Pulse for intro / result shield icon
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  // Scan line for analyzing step
  useEffect(() => {
    if (step !== 'analyzing') return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(scanAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(scanAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [step]);

  // Challenge countdown — runs while step='camera' and cameraPhase='challenge'
  useEffect(() => {
    if (step !== 'camera' || cameraPhase !== 'challenge') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const action = challenges[challengeIdx];
    if (!action) return;
    setCountdown(action.holdSecs);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          autoCaptureLiveness();
          return action.holdSecs;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step, cameraPhase, challengeIdx]);

  // Flash effect helper
  const triggerFlash = () => {
    flashAnim.setValue(1);
    Animated.timing(flashAnim, { toValue: 0, duration: 350, useNativeDriver: true }).start();
  };

  // Advance to next challenge (or to selfie phase when all done)
  const advanceChallenge = useCallback(() => {
    setChallengeIdx(prev => {
      const next = prev + 1;
      if (next >= challenges.length) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => setCameraPhase('selfie'), 400);
        return prev;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return next;
    });
  }, [challenges]);

  // Auto-capture a liveness frame silently, then advance
  const autoCaptureLiveness = useCallback(async () => {
    if (!cameraRef.current || liveCapturingRef.current) return;
    liveCapturingRef.current = true;
    triggerFlash();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await cameraRef.current.takePictureAsync({ quality: 0.4, skipProcessing: true });
    } catch {
      // Ignore camera errors on liveness captures
    } finally {
      liveCapturingRef.current = false;
      advanceChallenge();
    }
  }, [advanceChallenge]);

  const skipChallenge = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    autoCaptureLiveness();
  };

  // Take the final selfie and send to server
  const captureAndVerify = async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    triggerFlash();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
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
          verified:       data.verified,
          similarity:     data.similarity ?? 0,
          reason:         data.reason,
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
    setCameraPhase('challenge');
    setResult(null);
    setCapturing(false);
    liveCapturingRef.current = false;
    setStep('intro');
  };

  // ─── INTRO ───────────────────────────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient colors={[theme.primary + '18', 'transparent']} style={StyleSheet.absoluteFill} />

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.topBarTitle, { color: theme.text }]}>Face Verification</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            <View style={styles.heroBlock}>
              <Animated.View style={[styles.shieldRing, { transform: [{ scale: pulseAnim }], borderColor: theme.primary + '40', backgroundColor: theme.primary + '10' }]}>
                <LinearGradient colors={[theme.primary, theme.primary + 'CC']} style={styles.shieldInner}>
                  <Ionicons name="shield-checkmark" size={44} color="#FFF" />
                </LinearGradient>
              </Animated.View>
              <ThemedText style={[styles.heroTitle, { color: theme.text }]}>Identity Verification</ThemedText>
              <ThemedText style={[styles.heroSub, { color: theme.textSecondary }]}>
                Your camera opens once. Follow 3 quick actions, then tap to take your final selfie.
              </ThemedText>
            </View>

            {[
              { n: 1, icon: 'videocam',        title: 'Live camera opens',          desc: 'Position your face in the oval and follow the on-screen prompts.',            color: '#6366f1' },
              { n: 2, icon: 'walk',             title: 'Auto-captures 3 actions',    desc: 'Turn left, smile, blink — each snapped automatically when the timer hits 0.', color: '#14b8a6' },
              { n: 3, icon: 'camera',           title: 'Tap to take your selfie',    desc: 'Once all actions pass, the button unlocks. Tap for your final frontal photo.', color: '#f59e0b' },
              { n: 4, icon: 'sparkles',         title: 'Instant AI result',          desc: '85%+ match with your profile photo = verified blue badge.',                   color: '#10b981' },
            ].map(({ n, icon, title, desc, color }) => (
              <View key={n} style={[styles.stepRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <View style={[styles.stepNum, { backgroundColor: color }]}>
                  <ThemedText style={styles.stepNumText}>{n}</ThemedText>
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.stepTitle, { color: theme.text }]}>{title}</ThemedText>
                  <ThemedText style={[styles.stepDesc, { color: theme.textSecondary }]}>{desc}</ThemedText>
                </View>
                <Ionicons name={icon as any} size={20} color={color} style={{ opacity: 0.7 }} />
              </View>
            ))}

            <View style={[styles.noteCard, { backgroundColor: theme.primary + '10', borderColor: theme.primary + '25' }]}>
              <Ionicons name="lock-closed" size={14} color={theme.primary} style={{ marginRight: 8 }} />
              <ThemedText style={[styles.noteText, { color: theme.primary }]}>
                Your selfie is only used for identity matching and never shared with other users.
              </ThemedText>
            </View>

            <Pressable
              style={styles.startBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (!permission?.granted) {
                  requestPermission().then(r => { if (r.granted) setStep('camera'); });
                } else {
                  setStep('camera');
                }
              }}
            >
              <LinearGradient colors={[theme.primary, theme.primary + 'CC']} style={styles.startBtnGrad}>
                <Ionicons name="videocam" size={22} color="#FFF" />
                <ThemedText style={styles.startBtnText}>Start Verification</ThemedText>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    );
  }

  // ─── CAMERA (liveness + selfie combined) ─────────────────────────────────────
  if (step === 'camera') {
    if (!permission?.granted) {
      return (
        <View style={[styles.container, { backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 }]}>
          <Ionicons name="camera-outline" size={60} color={theme.textSecondary} />
          <ThemedText style={[styles.heroTitle, { color: theme.text, fontSize: 20 }]}>Camera Permission Required</ThemedText>
          <ThemedText style={[styles.heroSub, { color: theme.textSecondary }]}>Camera access is needed to complete identity verification.</ThemedText>
          <Pressable style={[styles.startBtn, { width: '100%' }]} onPress={requestPermission}>
            <LinearGradient colors={[theme.primary, theme.primary + 'CC']} style={styles.startBtnGrad}>
              <ThemedText style={styles.startBtnText}>Grant Camera Access</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      );
    }

    const isChallenge = cameraPhase === 'challenge';
    const isSelfie    = cameraPhase === 'selfie';
    const action      = challenges[challengeIdx];
    const completedCount = isChallenge ? challengeIdx : challenges.length;
    const ovalColor   = isSelfie ? '#10b981' : '#6366f1';

    return (
      <View style={styles.cameraFull}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />

        {/* White flash overlay */}
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: '#FFF', opacity: flashAnim, zIndex: 50 }]}
        />

        {/* Top gradient + header */}
        <LinearGradient
          colors={['rgba(0,0,0,0.72)', 'rgba(0,0,0,0.0)']}
          style={[styles.camTop, { paddingTop: insets.top + 6 }]}
        >
          <View style={styles.camHeader}>
            <Pressable style={styles.camBackBtn} onPress={() => setStep('intro')}>
              <Ionicons name="arrow-back" size={20} color="#FFF" />
            </Pressable>
            <ThemedText style={styles.camTitle}>
              {isSelfie ? 'Take Your Selfie' : 'Live Verification'}
            </ThemedText>
            {/* Progress dots */}
            <View style={{ flexDirection: 'row', gap: 5, paddingRight: 4 }}>
              {challenges.map((_, i) => (
                <View
                  key={i}
                  style={{
                    width:  i < completedCount ? 18 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: i < completedCount
                      ? '#10b981'
                      : i === challengeIdx && isChallenge
                        ? '#6366f1'
                        : 'rgba(255,255,255,0.3)',
                  }}
                />
              ))}
              {isSelfie && (
                <View style={{ width: 18, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Face oval with corner brackets */}
        <View style={styles.ovalWrapper} pointerEvents="none">
          <View style={[styles.faceOval, { borderColor: ovalColor + 'CC' }]}>
            <Corner top={-2}   left={-2}  color={ovalColor} />
            <Corner top={-2}   right={-2} color={ovalColor} />
            <Corner bottom={-2} left={-2} color={ovalColor} />
            <Corner bottom={-2} right={-2} color={ovalColor} />
          </View>
          <ThemedText style={[styles.ovalLabel, { color: isSelfie ? '#10b981' : 'rgba(255,255,255,0.65)' }]}>
            {isSelfie ? 'Look straight ahead' : 'Keep face in oval'}
          </ThemedText>
        </View>

        {/* Action card — shows during challenges */}
        {isChallenge && action && (
          <View style={styles.actionCardWrap} pointerEvents="none">
            <View style={styles.actionCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <ThemedText style={{ fontSize: 28 }}>{action.emoji}</ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.actionTitle}>{action.title}</ThemedText>
                  <ThemedText style={styles.actionHint}>{action.hint}</ThemedText>
                </View>
                <CountdownRing seconds={countdown} total={action.holdSecs} color="#6366f1" />
              </View>
            </View>
          </View>
        )}

        {/* Selfie prompt — shows after all actions */}
        {isSelfie && (
          <View style={styles.actionCardWrap} pointerEvents="none">
            <View style={[styles.actionCard, { borderColor: '#10b98140' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <ThemedText style={{ fontSize: 26 }}>✅</ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.actionTitle, { color: '#10b981' }]}>Liveness Confirmed!</ThemedText>
                  <ThemedText style={styles.actionHint}>Now tap the button below to take your selfie</ThemedText>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Bottom gradient + capture button */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.82)']}
          style={[styles.camBottom, { paddingBottom: insets.bottom + 28 }]}
        >
          {/* Skip button — only during challenges */}
          {isChallenge && (
            <Pressable style={styles.skipBtn} onPress={skipChallenge}>
              <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.65)" />
              <ThemedText style={styles.skipBtnText}>I did it</ThemedText>
            </Pressable>
          )}

          {/* Capture button */}
          <Pressable
            style={[styles.captureBtn, isChallenge && styles.captureBtnLocked]}
            onPress={isSelfie ? captureAndVerify : undefined}
            disabled={isChallenge || capturing}
          >
            <View style={[styles.captureOuter, { borderColor: isSelfie ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)' }]}>
              <LinearGradient
                colors={isSelfie ? ['#10b981', '#059669'] : ['#334155', '#1e293b']}
                style={styles.captureInner}
              >
                {capturing
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Ionicons name="camera" size={30} color={isSelfie ? '#FFF' : 'rgba(255,255,255,0.4)'} />}
              </LinearGradient>
            </View>
          </Pressable>

          <ThemedText style={styles.captureLbl}>
            {isChallenge
              ? 'Complete prompts above to unlock'
              : capturing ? 'Processing…' : 'Tap to capture'}
          </ThemedText>
        </LinearGradient>
      </View>
    );
  }

  // ─── ANALYZING ───────────────────────────────────────────────────────────────
  if (step === 'analyzing') {
    const scanY = scanAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, SW * 0.65] });
    return (
      <View style={[styles.container, { backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }]}>
        <LinearGradient colors={['#14b8a615', 'transparent']} style={StyleSheet.absoluteFill} />
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], alignItems: 'center' }}>
          <View style={styles.analyzeFrame}>
            <LinearGradient colors={['#0f172a', '#1e293b']} style={StyleSheet.absoluteFillObject} />
            <Ionicons name="person" size={64} color="#334155" />
            <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanY }] }]} />
            <Corner top={0}    left={0}  color="#14b8a6" />
            <Corner top={0}    right={0} color="#14b8a6" />
            <Corner bottom={0} left={0}  color="#14b8a6" />
            <Corner bottom={0} right={0} color="#14b8a6" />
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

  // ─── RESULT ──────────────────────────────────────────────────────────────────
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
                : result.reason || "The face in your selfie didn't match your profile photo closely enough."}
            </ThemedText>

            {result.similarity > 0 && (
              <View style={[styles.resultCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <SimilarityMeter score={result.similarity} verified={ok} />
              </View>
            )}

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

  heroBlock:    { alignItems: 'center', paddingVertical: 28 },
  shieldRing:   { width: 108, height: 108, borderRadius: 54, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  shieldInner:  { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  heroTitle:    { fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  heroSub:      { fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 300 },
  stepRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1, marginBottom: 10 },
  stepNum:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepNumText:  { color: '#FFF', fontWeight: '900', fontSize: 15 },
  stepTitle:    { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  stepDesc:     { fontSize: 12, lineHeight: 17 },
  noteCard:     { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 4, marginBottom: 20 },
  noteText:     { fontSize: 12, lineHeight: 18, flex: 1 },
  startBtn:     { borderRadius: 18, overflow: 'hidden', marginBottom: 4 },
  startBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  startBtnText: { color: '#FFF', fontSize: 17, fontWeight: '900' },

  // Camera
  cameraFull:      { flex: 1, backgroundColor: '#000' },
  camTop:          { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 20 },
  camHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 4 },
  camBackBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  camTitle:        { color: '#FFF', fontSize: 16, fontWeight: '800' },
  ovalWrapper:     { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  faceOval:        { width: 210, height: 280, borderRadius: 105, borderWidth: 2.5, borderStyle: 'dashed' },
  ovalLabel:       { fontSize: 12, marginTop: 14, fontWeight: '600' },

  actionCardWrap: { position: 'absolute', bottom: 180, left: 16, right: 16, zIndex: 20 },
  actionCard:     {
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.35)',
  },
  actionTitle:    { color: '#FFF', fontSize: 16, fontWeight: '900', marginBottom: 2 },
  actionHint:     { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  camBottom:       { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, paddingTop: 40, alignItems: 'center', gap: 6 },
  skipBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.12)' },
  skipBtnText:     { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' },
  captureBtn:      { alignItems: 'center' },
  captureBtnLocked:{ opacity: 0.55 },
  captureOuter:    { width: 78, height: 78, borderRadius: 39, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  captureInner:    { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  captureLbl:      { color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '600' },

  // Analyzing
  analyzeFrame:  { width: SW * 0.6, height: SW * 0.65, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  scanLine:      { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#14b8a6', opacity: 0.85 },
  analyzeTitle:  { fontSize: 20, fontWeight: '900', marginTop: 20, textAlign: 'center' },
  analyzeSub:    { fontSize: 13, textAlign: 'center', marginTop: 8, maxWidth: 280, lineHeight: 19 },

  // Result
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

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

const MIN_RECORD_SECONDS = 30;
const MAX_RECORD_SECONDS = 35;

const STEPS = [
  { key: 'blink', emoji: '😉', icon: 'eye-outline'                  as const, title: 'Blink your eyes',   desc: 'Look at the camera and blink naturally' },
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

type ScreenState = 'loading' | 'intro' | 'camera' | 'uploading' | 'result' | 'status_pending' | 'status_rejected';

export default function VerificationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { token, user } = useAuth();

  const [screen, setScreen] = useState<ScreenState>('loading');
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [canSubmit, setCanSubmit] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [requestDate, setRequestDate] = useState<string | null>(null);

  const cameraRef             = useRef<any>(null);
  const recordingPromiseRef   = useRef<Promise<{ uri: string }> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const uploadStartedRef      = useRef(false);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Check verification status on mount ──────────────────────────────────
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const resp = await fetch(`${getApiBaseUrl()}/verification/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        if (data.success) {
          const s = data.data?.status;
          if (s === 'pending') {
            setRequestDate(data.data?.requestDate || null);
            setScreen('status_pending');
          } else if (s === 'rejected') {
            setRejectionReason(data.data?.rejectionReason || null);
            setRequestDate(data.data?.requestDate || null);
            setScreen('status_rejected');
          } else {
            setScreen('intro');
          }
        } else {
          setScreen('intro');
        }
      } catch {
        setScreen('intro');
      }
    };
    checkStatus();
  }, [token]);

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission, requestPermission]);

  const stopAndSaveVideo = useCallback(() => {
    if (uploadStartedRef.current) return;
    uploadStartedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    setTorchOn(false);
    setRecording(false);

    // Show pending immediately — upload runs in background
    setResult({ submitted: true, status: 'pending' });
    setScreen('result');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Background upload — fire and forget
    (async () => {
      try {
        if (cameraRef.current && recordingPromiseRef.current) {
          cameraRef.current.stopRecording();
          const video = await recordingPromiseRef.current;
          if (!video?.uri) return;
          const formData = new FormData();
          formData.append('userId', user?.id || '');
          formData.append('video', { uri: video.uri, type: 'video/mp4', name: 'verification-video.mp4' } as any);
          await fetch(`${getApiBaseUrl()}/upload-verification-video`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
            body: formData,
          });
        }
      } catch {
        // Silent — user already sees pending, admin will review when upload lands
      }
    })();
  }, [token, user?.id]);

  const startRecording = useCallback(() => {
    if (!cameraRef.current || recordingPromiseRef.current || uploadStartedRef.current) return;
    setRecording(true);
    setRecordSeconds(0);
    setCanSubmit(false);
    recordingStartedAtRef.current = Date.now();
    recordingPromiseRef.current = cameraRef.current.recordAsync({ maxDuration: MAX_RECORD_SECONDS });
    recordingPromiseRef.current?.catch(() => null);

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
      setRecordSeconds(elapsed);
      if (elapsed >= MIN_RECORD_SECONDS) setCanSubmit(true);
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

  const startFresh = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    uploadStartedRef.current    = false;
    recordingPromiseRef.current = null;
    setResult(null);
    setRecording(false);
    setRecordSeconds(0);
    setCanSubmit(false);
    setTorchOn(false);
    setCameraReady(false);
    setScreen('camera');
  };

  const timerPct   = Math.min((recordSeconds / MIN_RECORD_SECONDS) * 100, 100);
  const timerColor = recordSeconds >= MIN_RECORD_SECONDS ? '#10B981'
    : recordSeconds >= 15 ? '#f59e0b'
    : '#ef4444';

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (screen === 'loading') {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color="#10B981" />
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>Checking status…</ThemedText>
      </View>
    );
  }

  // ── STATUS: PENDING ───────────────────────────────────────────────────────
  if (screen === 'status_pending') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={['#f59e0b', '#d97706']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.gradientHeader, { paddingTop: insets.top + 12 }]}
        >
          <Pressable style={styles.headerBackBtn} onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.headerIconWrap}>
              <View style={[styles.headerIconRing, { borderColor: 'rgba(255,255,255,0.28)' }]} />
              <View style={[styles.headerIconInner, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                <Ionicons name="time-outline" size={44} color="#fff" />
              </View>
            </View>
            <ThemedText style={styles.headerTitle}>Under Review</ThemedText>
            <ThemedText style={styles.headerSub}>
              Your verification video has been submitted and is being reviewed by our team
            </ThemedText>
          </View>
        </LinearGradient>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 32 }}>

          {/* Status card */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: '#f59e0b30' }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: '#f59e0b20' }]}>
                <Ionicons name="hourglass-outline" size={16} color="#f59e0b" />
              </View>
              <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Review in Progress</ThemedText>
            </View>
            {requestDate && (
              <View style={styles.statusInfoRow}>
                <Ionicons name="calendar-outline" size={15} color={theme.textSecondary as string} />
                <ThemedText style={[styles.statusInfoText, { color: theme.textSecondary }]}>
                  Submitted on {new Date(requestDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </ThemedText>
              </View>
            )}
            <View style={styles.statusInfoRow}>
              <Ionicons name="person-outline" size={15} color={theme.textSecondary as string} />
              <ThemedText style={[styles.statusInfoText, { color: theme.textSecondary }]}>
                A team member will review your video manually
              </ThemedText>
            </View>
            <View style={styles.statusInfoRow}>
              <Ionicons name="notifications-outline" size={15} color={theme.textSecondary as string} />
              <ThemedText style={[styles.statusInfoText, { color: theme.textSecondary }]}>
                You will be notified once the review is complete
              </ThemedText>
            </View>
          </View>

          {/* What happens next */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="list-outline" size={16} color="#10B981" />
              </View>
              <ThemedText style={[styles.cardTitle, { color: theme.text }]}>What happens next</ThemedText>
            </View>
            {[
              { icon: 'checkmark-circle-outline' as const, color: '#10B981', text: 'If approved — your verified badge is added instantly' },
              { icon: 'close-circle-outline' as const, color: '#ef4444', text: 'If rejected — you will see the reason and can resubmit' },
              { icon: 'time-outline' as const, color: '#f59e0b', text: 'Reviews typically complete within 24 hours' },
            ].map((item, i) => (
              <View key={i} style={[styles.howRow, i > 0 && { marginTop: 12 }]}>
                <View style={[styles.howIconCircle, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <ThemedText style={[styles.howText, { color: theme.textSecondary }]}>{item.text}</ThemedText>
              </View>
            ))}
          </View>

          <View style={[styles.tipRow, { backgroundColor: '#f59e0b10', borderColor: '#f59e0b30' }]}>
            <Ionicons name="information-circle-outline" size={18} color="#f59e0b" />
            <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
              Please do not resubmit while your current video is under review. This may delay the process.
            </ThemedText>
          </View>

          <Pressable style={styles.ctaBtn} onPress={() => navigation.goBack()}>
            <LinearGradient colors={['#f59e0b', '#d97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtnGrad}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
              <ThemedText style={styles.ctaBtnText}>Back to Profile</ThemedText>
            </LinearGradient>
          </Pressable>

        </ScrollView>
      </View>
    );
  }

  // ── STATUS: REJECTED ──────────────────────────────────────────────────────
  if (screen === 'status_rejected') {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <LinearGradient
          colors={['#ef4444', '#dc2626']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.gradientHeader, { paddingTop: insets.top + 12 }]}
        >
          <Pressable style={styles.headerBackBtn} onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <View style={{ alignItems: 'center' }}>
            <View style={styles.headerIconWrap}>
              <View style={[styles.headerIconRing, { borderColor: 'rgba(255,255,255,0.28)' }]} />
              <View style={[styles.headerIconInner, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
                <Ionicons name="close-circle-outline" size={44} color="#fff" />
              </View>
            </View>
            <ThemedText style={styles.headerTitle}>Verification Rejected</ThemedText>
            <ThemedText style={styles.headerSub}>
              Unfortunately your verification was not approved. You can read the reason below and try again.
            </ThemedText>
          </View>
        </LinearGradient>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: insets.bottom + 32 }}>

          {/* Rejection reason */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: '#ef444430' }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: '#ef444420' }]}>
                <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
              </View>
              <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Reason for Rejection</ThemedText>
            </View>
            <View style={[styles.rejectionBox, { backgroundColor: '#ef444408', borderColor: '#ef444425' }]}>
              <ThemedText style={[styles.rejectionText, { color: theme.text }]}>
                {rejectionReason || 'Your verification video did not meet our requirements.'}
              </ThemedText>
            </View>
            {requestDate && (
              <View style={[styles.statusInfoRow, { marginTop: 12 }]}>
                <Ionicons name="calendar-outline" size={14} color={theme.textSecondary as string} />
                <ThemedText style={[styles.statusInfoText, { color: theme.textSecondary }]}>
                  Reviewed on {new Date(requestDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </ThemedText>
              </View>
            )}
          </View>

          {/* Tips to resubmit */}
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardIconBadge, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="refresh-circle-outline" size={16} color="#10B981" />
              </View>
              <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Tips for resubmission</ThemedText>
            </View>
            {[
              { icon: 'sunny-outline' as const, color: '#f59e0b', text: 'Record in a well-lit room — avoid dark environments' },
              { icon: 'videocam-outline' as const, color: '#10B981', text: 'Hold the phone steady at face level' },
              { icon: 'eye-outline' as const, color: '#8B5CF6', text: 'Clearly perform each step — blink, turn left, turn right' },
              { icon: 'person-outline' as const, color: '#3B82F6', text: 'Make sure your full face is clearly visible throughout' },
            ].map((item, i) => (
              <View key={i} style={[styles.howRow, i > 0 && { marginTop: 12 }]}>
                <View style={[styles.howIconCircle, { backgroundColor: item.color + '18' }]}>
                  <Ionicons name={item.icon} size={18} color={item.color} />
                </View>
                <ThemedText style={[styles.howText, { color: theme.textSecondary }]}>{item.text}</ThemedText>
              </View>
            ))}
          </View>

          {/* CTA */}
          <Pressable style={styles.ctaBtn} onPress={startFresh}>
            <LinearGradient colors={['#10B981', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtnGrad}>
              <Ionicons name="videocam" size={20} color="#fff" />
              <ThemedText style={styles.ctaBtnText}>Record New Video</ThemedText>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={[styles.ctaBtn, { marginTop: -4 }]}
            onPress={() => navigation.goBack()}
          >
            <View style={[styles.ctaBtnGrad, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}>
              <Ionicons name="arrow-back" size={20} color={theme.textSecondary as string} />
              <ThemedText style={[styles.ctaBtnText, { color: theme.textSecondary }]}>Back to Profile</ThemedText>
            </View>
          </Pressable>

        </ScrollView>
      </View>
    );
  }

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

            {/* How it works */}
            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBadge, { backgroundColor: '#3B82F620' }]}>
                  <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
                </View>
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>How it works</ThemedText>
              </View>
              {[
                { icon: 'videocam-outline' as const, color: '#10B981', bg: '#10B98120', text: 'A 30-second video will be recorded' },
                { icon: 'list-outline' as const, color: '#8B5CF6', bg: '#8B5CF620', text: 'Follow the 3 on-screen instructions during recording' },
                { icon: 'cloud-upload-outline' as const, color: '#3B82F6', bg: '#3B82F620', text: 'Video is submitted securely for admin review' },
                { icon: 'checkmark-circle-outline' as const, color: '#10B981', bg: '#10B98120', text: 'Approval adds the verified badge to your profile' },
              ].map((item, i) => (
                <View key={i} style={[styles.howRow, i > 0 && { marginTop: 12 }]}>
                  <View style={[styles.howIconCircle, { backgroundColor: item.bg }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <ThemedText style={[styles.howText, { color: theme.textSecondary }]}>{item.text}</ThemedText>
                </View>
              ))}
            </View>

            <View style={[styles.tipRow, { backgroundColor: '#f59e0b10', borderColor: '#f59e0b30' }]}>
              <Ionicons name="flashlight-outline" size={18} color="#f59e0b" />
              <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
                In a dark room? Use the <ThemedText style={{ fontWeight: '800', color: theme.text }}>torch button</ThemedText> on the camera screen to light up your face.
              </ThemedText>
            </View>

            <View style={[styles.tipRow, { backgroundColor: '#10B98110', borderColor: '#10B98130' }]}>
              <Ionicons name="sunny-outline" size={18} color="#10B981" />
              <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
                Be in a <ThemedText style={{ fontWeight: '800', color: theme.text }}>well-lit area</ThemedText> and hold your phone at face level for best results.
              </ThemedText>
            </View>

            <View style={[styles.tipRow, { backgroundColor: '#3B82F610', borderColor: '#3B82F630' }]}>
              <Ionicons name="lock-closed-outline" size={18} color="#3B82F6" />
              <ThemedText style={[styles.tipText, { color: theme.textSecondary }]}>
                Your video is <ThemedText style={{ fontWeight: '800', color: theme.text }}>never shared publicly</ThemedText> — admin review only.
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

          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── CAMERA ───────────────────────────────────────────────────────────────
  if (screen === 'camera') {
    return (
      <View style={styles.cameraFull}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
          mode="video"
          mute
          enableTorch={torchOn}
          onCameraReady={() => setCameraReady(true)}
        />

        {/* Top bar */}
        <LinearGradient
          colors={['rgba(0,0,0,0.85)', 'transparent']}
          style={[styles.camTop, { paddingTop: insets.top + 8 }]}
        >
          <View style={styles.camHeader}>
            <Pressable style={styles.camBackBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={20} color="#FFF" />
            </Pressable>
            <ThemedText style={styles.camTitle}>Face Verification</ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Torch toggle */}
              <Pressable
                style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
                onPress={() => setTorchOn(v => !v)}
              >
                <Ionicons
                  name={torchOn ? 'flashlight' : 'flashlight-outline'}
                  size={16}
                  color={torchOn ? '#fbbf24' : '#ffffff99'}
                />
              </Pressable>
              {/* REC pill */}
              <View style={[styles.recPill, { borderColor: recording ? 'rgba(239,68,68,0.55)' : 'rgba(255,255,255,0.2)' }]}>
                <View style={[styles.recDot, { backgroundColor: recording ? '#ef4444' : '#64748b' }]} />
                <ThemedText style={styles.recText}>{recording ? 'REC' : 'READY'}</ThemedText>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Timer badge */}
        <View style={styles.timerWrap} pointerEvents="none">
          <View style={[styles.timerBadge, { borderColor: timerColor + '60' }]}>
            <ThemedText style={[styles.timerNum, { color: timerColor }]}>{recordSeconds}s</ThemedText>
            <ThemedText style={styles.timerSub}>/ 30s</ThemedText>
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

        {/* Bottom panel */}
        <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 20 }]}>

          {/* Static instruction heading */}
          <ThemedText style={styles.panelHeading}>While recording, please:</ThemedText>

          {/* Static steps — no highlighting, no ticking */}
          <View style={styles.stepsList}>
            {STEPS.map((s, i) => (
              <View key={s.key} style={styles.stepsRow}>
                <View style={styles.stepsIconCircle}>
                  <Ionicons name={s.icon} size={16} color="#10B981" />
                </View>
                <ThemedText style={styles.stepsLabel}>
                  {s.emoji}  {s.title}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* Time progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${timerPct}%`, backgroundColor: timerColor }]} />
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
                {recording ? `Recording… ${Math.max(0, MIN_RECORD_SECONDS - recordSeconds)}s remaining` : 'Starting camera…'}
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
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.background }]}>
        <View style={[styles.uploadIconWrap, { backgroundColor: '#10B98115', borderColor: '#10B98130' }]}>
          <Ionicons name="cloud-upload-outline" size={52} color="#10B981" />
        </View>
        <ThemedText style={[styles.uploadTitle, { color: theme.text }]}>Uploading your video…</ThemedText>
        <ThemedText style={[styles.uploadSub, { color: theme.textSecondary }]}>
          Submitting securely for admin review. This only takes a moment.
        </ThemedText>
        <ActivityIndicator size="large" color="#10B981" style={{ marginTop: 24 }} />
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

        <ScrollView contentContainerStyle={[styles.bodyPad, { paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center' }}>

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
                ? 'Your verification video is pending admin review. Your badge will update once approved.'
                : result.reason || 'Something went wrong. Please try again.'}
            </ThemedText>

            <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, width: '100%' }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconBadge, { backgroundColor: ok ? '#10B98120' : '#ef444420' }]}>
                  <Ionicons name={ok ? 'checkmark-circle-outline' : 'close-circle-outline'} size={16} color={ok ? '#10B981' : '#ef4444'} />
                </View>
                <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
                  {ok ? 'Completed sequence' : 'Steps attempted'}
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
              <Pressable style={styles.ctaBtn} onPress={startFresh}>
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

  // ── Loading ──
  loadingText: { marginTop: 14, fontSize: 14, fontWeight: '600' },

  // ── Status info rows ──
  statusInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  statusInfoText: { flex: 1, fontSize: 13, lineHeight: 19 },

  // ── Rejection box ──
  rejectionBox: { borderRadius: 12, padding: 14, borderWidth: 1 },
  rejectionText: { fontSize: 14, lineHeight: 21, fontWeight: '500' },

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
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerIconInner: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: -0.5 },
  headerSub:   { fontSize: 14, color: 'rgba(255,255,255,0.82)', textAlign: 'center', marginTop: 8, lineHeight: 20, maxWidth: 290 },

  // ── Body ──
  bodyPad: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },

  // ── Card ──
  card: { borderRadius: 20, padding: 18, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
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
  ctaBtn:     { borderRadius: 18, overflow: 'hidden' },
  ctaBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  // ── Camera ──
  cameraFull: { flex: 1, backgroundColor: '#000' },
  camTop: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 28 },
  camHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  camBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.50)', alignItems: 'center', justifyContent: 'center' },
  camTitle:   { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },

  torchBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.50)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  torchBtnOn: {
    backgroundColor: 'rgba(251,191,36,0.20)', borderColor: '#fbbf24',
  },

  recPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1,
  },
  recDot:  { width: 8, height: 8, borderRadius: 4 },
  recText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  timerWrap:  { position: 'absolute', top: 112, right: 18, zIndex: 10 },
  timerBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1.5, backgroundColor: 'rgba(0,0,0,0.60)', alignItems: 'center' },
  timerNum:   { fontSize: 20, fontWeight: '900', lineHeight: 24 },
  timerSub:   { color: 'rgba(255,255,255,0.40)', fontSize: 9, fontWeight: '700', marginTop: 1 },

  ovalWrapper: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  faceOval:    { width: 210, height: 278, borderRadius: 105, borderWidth: 2, borderStyle: 'dashed' },

  bottomPanel: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    backgroundColor: 'rgba(5,10,20,0.90)',
    paddingHorizontal: 20, paddingTop: 18,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: 'rgba(16,185,129,0.20)',
  },

  panelHeading: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },

  progressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 14, overflow: 'hidden' },
  progressFill:  { height: 4, borderRadius: 2 },

  stepsList: { gap: 10, marginBottom: 14 },
  stepsRow:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepsIconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#10B98118', borderWidth: 1, borderColor: '#10B98140',
    alignItems: 'center', justifyContent: 'center',
  },
  stepsLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },

  submitBtn:     { borderRadius: 16, overflow: 'hidden' },
  submitBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  waitRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  waitText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600', flex: 1 },

  // ── Uploading ──
  centerContent:  { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 36 },
  uploadIconWrap: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  uploadTitle:    { fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  uploadSub:      { fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 290 },

  // ── Result ──
  resultTopBar:    { alignItems: 'center', paddingBottom: 8 },
  resultTopTitle:  { fontSize: 18, fontWeight: '900' },
  resultIconWrap:  { width: 124, height: 124, borderRadius: 62, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 20, marginTop: 8 },
  resultIconInner: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  resultSub:   { fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 24, maxWidth: 300 },

  completedRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)' },
  completedText: { fontSize: 14, fontWeight: '600' },
});

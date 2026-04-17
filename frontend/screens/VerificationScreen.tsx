import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, StyleSheet, Pressable, ScrollView,
  ActivityIndicator, Animated,
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
const MAX_RECORD_SECONDS = 120;
const BRAND      = '#10B981';
const BRAND_DARK = '#059669';
const SCREEN_BG  = '#0D0D0D';
const CARD_BG    = '#1A1A1A';
const CARD_BG2   = '#141414';

const STEPS = [
  { key: 'blink', emoji: '😉', icon: 'eye-outline'                  as const, label: 'Blink your eyes' },
  { key: 'left',  emoji: '👈', icon: 'arrow-back-circle-outline'    as const, label: 'Turn head left'  },
  { key: 'right', emoji: '👉', icon: 'arrow-forward-circle-outline' as const, label: 'Turn head right' },
];

type VerifStatus = 'loading' | 'none' | 'pending' | 'rejected' | 'approved';
type ScreenState = 'intro' | 'camera_idle' | 'camera_recording' | 'result';

/* ─── Pulse ring ──────────────────────────────────────────────────────────── */
function PulseRing({ color = BRAND }: { color?: string }) {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale,   { toValue: 1.5, duration: 900, useNativeDriver: true }),
          Animated.timing(scale,   { toValue: 1,   duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0,   duration: 900, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 900, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{
      position: 'absolute', width: 80, height: 80, borderRadius: 40,
      borderWidth: 2, borderColor: color,
      transform: [{ scale }], opacity,
    }} />
  );
}

export default function VerificationScreen() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { token, user } = useAuth();

  const [screen,          setScreen]          = useState<ScreenState>('intro');
  const [verifStatus,     setVerifStatus]     = useState<VerifStatus>('loading');
  const [permission,      requestPermission]  = useCameraPermissions();
  const [cameraReady,     setCameraReady]     = useState(false);
  const [recordSeconds,   setRecordSeconds]   = useState(0);
  const [canSubmit,       setCanSubmit]       = useState(false);
  const [torchOn,         setTorchOn]         = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [requestDate,     setRequestDate]     = useState<string | null>(null);
  const [submitting,      setSubmitting]      = useState(false);

  const cameraRef             = useRef<any>(null);
  const recordingPromiseRef   = useRef<Promise<{ uri: string }> | null>(null);
  const recordingStartedAtRef = useRef(0);
  const uploadStartedRef      = useRef(false);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef           = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fetch status on mount ──────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch(`${getApiBaseUrl()}/verification/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        if (data.success) {
          const s = data.data?.status;
          if (s === 'pending') {
            setRequestDate(data.data?.requestDate || null);
            setVerifStatus('pending');
          } else if (s === 'rejected') {
            setRejectionReason(data.data?.rejectionReason || null);
            setRequestDate(data.data?.requestDate  || null);
            setVerifStatus('rejected');
          } else if (s === 'approved') {
            setVerifStatus('approved');
          } else {
            setVerifStatus('none');
          }
        } else {
          setVerifStatus('none');
        }
      } catch {
        setVerifStatus('none');
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!permission) requestPermission();
  }, [permission]);

  useEffect(() => {
    return () => {
      if (timerRef.current)   clearInterval(timerRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
      if (recordingPromiseRef.current && cameraRef.current && !uploadStartedRef.current) {
        try { cameraRef.current.stopRecording(); } catch {}
      }
    };
  }, []);

  /* ── Open camera ──────────────────────────────────────────────────────────── */
  const openCamera = useCallback(() => {
    uploadStartedRef.current    = false;
    recordingPromiseRef.current = null;
    setCameraReady(false);
    if (!permission?.granted) {
      requestPermission().then(r => { if (r.granted) setScreen('camera_idle'); });
    } else {
      setScreen('camera_idle');
    }
  }, [permission, requestPermission]);

  /* ── Start recording ──────────────────────────────────────────────────────── */
  const startRecording = useCallback(() => {
    if (!cameraRef.current || recordingPromiseRef.current || uploadStartedRef.current || !cameraReady) return;
    setRecordSeconds(0);
    setCanSubmit(false);
    setScreen('camera_recording');
    recordingStartedAtRef.current = Date.now();
    recordingPromiseRef.current = cameraRef.current.recordAsync({ maxDuration: MAX_RECORD_SECONDS });
    recordingPromiseRef.current?.catch(() => null);

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartedAtRef.current) / 1000);
      setRecordSeconds(elapsed);
      if (elapsed >= MIN_RECORD_SECONDS) setCanSubmit(true);
    }, 500);

    autoStopRef.current = setTimeout(() => stopAndSaveVideo(), MAX_RECORD_SECONDS * 1000);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, [cameraReady]);

  /* ── Submit ───────────────────────────────────────────────────────────────── */
  const stopAndSaveVideo = useCallback(async () => {
    if (uploadStartedRef.current) return;
    uploadStartedRef.current = true;
    if (timerRef.current)    clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    setTorchOn(false);
    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    let videoUri: string | null = null;
    try {
      if (cameraRef.current && recordingPromiseRef.current) {
        cameraRef.current.stopRecording();
        const video = await recordingPromiseRef.current;
        videoUri = video?.uri || null;
      }
    } catch (err) {
      console.error('[Verification] Failed to stop recording:', err);
    }

    setScreen('result');

    if (!videoUri) {
      console.error('[Verification] No video URI — upload skipped');
      setSubmitting(false);
      return;
    }

    (async () => {
      try {
        const formData = new FormData();
        formData.append('userId', user?.id || '');
        formData.append('video', { uri: videoUri, type: 'video/mp4', name: 'verification-video.mp4' } as any);
        const resp = await fetch(`${getApiBaseUrl()}/upload-verification-video`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
          body: formData,
        });
        if (!resp.ok) {
          const body = await resp.text().catch(() => '');
          console.error('[Verification] Upload failed:', resp.status, body);
        }
      } catch (err) {
        console.error('[Verification] Upload error:', err);
      } finally {
        setSubmitting(false);
      }
    })();
  }, [token, user?.id]);

  /* ── Reset to try again ───────────────────────────────────────────────────── */
  const tryAgain = () => {
    if (timerRef.current)    clearInterval(timerRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    uploadStartedRef.current    = false;
    recordingPromiseRef.current = null;
    setRecordSeconds(0);
    setCanSubmit(false);
    setTorchOn(false);
    setCameraReady(false);
    setVerifStatus('none');
    setRejectionReason(null);
    setScreen('camera_idle');
  };

  const timerPct   = Math.min((recordSeconds / MIN_RECORD_SECONDS) * 100, 100);
  const secsLeft   = Math.max(0, MIN_RECORD_SECONDS - recordSeconds);
  const timerColor = recordSeconds >= MIN_RECORD_SECONDS ? BRAND : recordSeconds >= 3 ? '#f59e0b' : '#ef4444';

  /* ══════════════════════════════════════════════════════════════════════════
     CAMERA — IDLE
  ══════════════════════════════════════════════════════════════════════════ */
  if (screen === 'camera_idle') {
    return (
      <View style={[s.fill, { backgroundColor: SCREEN_BG }]}>
        <View style={[s.camTopBar, { paddingTop: insets.top + 12 }]}>
          <Pressable style={s.camBack} onPress={() => setScreen('intro')} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <ThemedText style={s.camBarTitle}>Get Verified</ThemedText>
          <Pressable style={[s.torchBtn, torchOn && s.torchBtnOn]} onPress={() => setTorchOn(v => !v)}>
            <Ionicons name={torchOn ? 'flashlight' : 'flashlight-outline'} size={16} color={torchOn ? '#fbbf24' : 'rgba(255,255,255,0.5)'} />
          </Pressable>
        </View>
        <View style={s.cameraBox}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="front"
            mode="video"
            mute
            enableTorch={torchOn}
            onCameraReady={() => setCameraReady(true)}
          />
          <View style={s.ovalGuide}>
            <View style={s.ovalInner} />
          </View>
        </View>
        <View style={[s.idleCard, { backgroundColor: CARD_BG }]}>
          <ThemedText style={s.idleCardTitle}>While recording, please:</ThemedText>
          {STEPS.map((step, i) => (
            <View key={step.key} style={[s.idleStepRow, i > 0 && { marginTop: 10 }]}>
              <View style={[s.idleStepIcon, { backgroundColor: BRAND + '18' }]}>
                <Ionicons name={step.icon} size={14} color={BRAND} />
              </View>
              <ThemedText style={s.idleStepText}>{step.emoji}  {step.label}</ThemedText>
            </View>
          ))}
        </View>
        <View style={[s.recordBtnWrap, { paddingBottom: insets.bottom + 28 }]}>
          <Pressable onPress={startRecording} disabled={!cameraReady} style={s.recordBtnOuter}>
            {cameraReady && <PulseRing color={BRAND} />}
            <LinearGradient colors={[BRAND, BRAND_DARK]} style={s.recordBtnInner}>
              <Ionicons name="radio-button-on" size={28} color="#fff" />
            </LinearGradient>
          </Pressable>
          <ThemedText style={s.recordHint}>
            {cameraReady ? 'Tap to start recording' : 'Starting camera…'}
          </ThemedText>
        </View>
      </View>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     CAMERA — RECORDING
  ══════════════════════════════════════════════════════════════════════════ */
  if (screen === 'camera_recording') {
    return (
      <View style={[s.fill, { backgroundColor: SCREEN_BG }]}>
        <View style={[s.camTopBar, { paddingTop: insets.top + 12 }]}>
          <View style={s.recPill}>
            <View style={s.recDot} />
            <ThemedText style={s.recText}>REC</ThemedText>
          </View>
          <ThemedText style={[s.timerText, { color: timerColor }]}>{recordSeconds}s</ThemedText>
          <Pressable style={[s.torchBtn, torchOn && s.torchBtnOn]} onPress={() => setTorchOn(v => !v)}>
            <Ionicons name={torchOn ? 'flashlight' : 'flashlight-outline'} size={16} color={torchOn ? '#fbbf24' : 'rgba(255,255,255,0.5)'} />
          </Pressable>
        </View>
        <View style={s.cameraBox}>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="front"
            mode="video"
            mute
            enableTorch={torchOn}
          />
          <View style={s.ovalGuide}>
            <View style={[s.ovalInner, { borderColor: BRAND + 'CC' }]} />
          </View>
        </View>
        <View style={s.progressOuter}>
          <View style={[s.progressFill, { width: `${timerPct}%`, backgroundColor: timerColor }]} />
        </View>
        <View style={[s.recStepsCard, { backgroundColor: CARD_BG }]}>
          <ThemedText style={s.recStepsHeading}>Do these now:</ThemedText>
          {STEPS.map((step, i) => (
            <View key={step.key} style={[s.idleStepRow, i > 0 && { marginTop: 8 }]}>
              <View style={[s.idleStepIcon, { backgroundColor: BRAND + '18' }]}>
                <Ionicons name={step.icon} size={14} color={BRAND} />
              </View>
              <ThemedText style={s.idleStepText}>{step.emoji}  {step.label}</ThemedText>
            </View>
          ))}
        </View>
        <View style={[s.submitArea, { paddingBottom: insets.bottom + 24 }]}>
          {canSubmit ? (
            <Pressable style={s.ctaWrap} onPress={stopAndSaveVideo}>
              <LinearGradient colors={[BRAND, BRAND_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ctaBtn}>
                <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                <ThemedText style={s.ctaBtnText}>Submit Video</ThemedText>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={s.waitRow}>
              <ActivityIndicator size="small" color={BRAND} />
              <ThemedText style={s.waitText}>Recording… submit available in {secsLeft}s</ThemedText>
            </View>
          )}
        </View>
      </View>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RESULT — just submitted (pending with 24-hour messaging)
  ══════════════════════════════════════════════════════════════════════════ */
  if (screen === 'result') {
    return (
      <View style={[s.fill, { backgroundColor: SCREEN_BG }]}>
        <View style={[s.statusTopBar, { paddingTop: insets.top + 16 }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>
        <View style={[s.fill, s.center, { paddingHorizontal: 28 }]}>
          <View style={[s.statusIconWrap, { borderColor: '#f59e0b30', backgroundColor: '#f59e0b10' }]}>
            <LinearGradient colors={['#f59e0b', '#d97706']} style={s.statusIconInner}>
              <ThemedText style={{ fontSize: 36 }}>⏳</ThemedText>
            </LinearGradient>
            {submitting && <ActivityIndicator size="small" color="#f59e0b" style={{ marginTop: 12 }} />}
          </View>
          <ThemedText style={s.statusTitle}>Verification Pending</ThemedText>
          <ThemedText style={s.statusSub}>
            Your video has been submitted! Within the next 24 hours, our team will review it and you'll be notified of the outcome.
          </ThemedText>
          {submitting && (
            <View style={[s.uploadingPill, { backgroundColor: '#f59e0b10' }]}>
              <ActivityIndicator size="small" color="#f59e0b" />
              <ThemedText style={[s.uploadingText, { color: '#f59e0b' }]}>Uploading video…</ThemedText>
            </View>
          )}
          <View style={[s.infoCard, { backgroundColor: CARD_BG, marginTop: 24 }]}>
            {[
              { icon: 'time-outline'             as const, c: '#f59e0b', t: 'Review takes up to 24 hours' },
              { icon: 'checkmark-circle-outline' as const, c: BRAND,     t: 'Approved → verified badge on your profile' },
              { icon: 'close-circle-outline'     as const, c: '#ef4444', t: 'Rejected → reason shown so you can retry' },
              { icon: 'notifications-outline'    as const, c: '#8B5CF6', t: 'You will be notified of the outcome' },
            ].map((row, i) => (
              <View key={i} style={[s.infoRow, i > 0 && { marginTop: 12 }]}>
                <Ionicons name={row.icon} size={18} color={row.c} />
                <ThemedText style={s.infoRowText}>{row.t}</ThemedText>
              </View>
            ))}
          </View>
          <Pressable style={[s.ctaWrap, { width: '100%', marginTop: 28 }]} onPress={() => navigation.goBack()}>
            <LinearGradient colors={['#f59e0b', '#d97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ctaBtn}>
              <Ionicons name="arrow-back" size={18} color="#fff" />
              <ThemedText style={s.ctaBtnText}>Back to Profile</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     INTRO — unified single page for all statuses
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <View style={[s.fill, { backgroundColor: SCREEN_BG }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>

        {/* Header */}
        <View style={[s.introHeader, { paddingTop: insets.top + 24 }]}>
          <Pressable style={s.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <View style={s.shieldWrap}>
            <LinearGradient
              colors={verifStatus === 'approved' ? ['#10B981', '#059669'] : verifStatus === 'pending' ? ['#f59e0b', '#d97706'] : verifStatus === 'rejected' ? ['#ef4444', '#dc2626'] : [BRAND, BRAND_DARK]}
              style={s.shieldCircle}
            >
              <Ionicons
                name={verifStatus === 'approved' ? 'shield-checkmark' : verifStatus === 'pending' ? 'hourglass-outline' : verifStatus === 'rejected' ? 'close-circle-outline' : 'shield-checkmark'}
                size={36}
                color="#fff"
              />
            </LinearGradient>
          </View>
          <ThemedText style={s.introTitle}>
            {verifStatus === 'approved' ? 'Verified ✓' : 'Get Verified'}
          </ThemedText>
          <ThemedText style={s.introSub}>
            {verifStatus === 'loading'  ? 'Checking your verification status…'
            : verifStatus === 'approved' ? 'Your identity has been confirmed. You have a verified badge.'
            : verifStatus === 'pending'  ? 'Your verification is under review'
            : verifStatus === 'rejected' ? 'Verification was unsuccessful — you can try again'
            : 'Quick video to confirm it\'s really you'}
          </ThemedText>
        </View>

        <View style={{ paddingHorizontal: 20, gap: 16 }}>

          {/* Loading spinner */}
          {verifStatus === 'loading' && (
            <View style={[s.card, s.center, { backgroundColor: CARD_BG, paddingVertical: 32 }]}>
              <ActivityIndicator size="large" color={BRAND} />
              <ThemedText style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 14 }}>
                Checking status…
              </ThemedText>
            </View>
          )}

          {/* Instruction card — shown for none / rejected states */}
          {(verifStatus === 'none' || verifStatus === 'rejected') && (
            <View style={[s.card, { backgroundColor: CARD_BG }]}>
              <View style={s.cardRow}>
                <View style={[s.cardIcon, { backgroundColor: BRAND + '20' }]}>
                  <Ionicons name="videocam-outline" size={18} color={BRAND} />
                </View>
                <ThemedText style={s.cardTitle}>What to do in the video</ThemedText>
              </View>
              {STEPS.map((step, i) => (
                <View key={step.key} style={[s.stepRow, i > 0 && { marginTop: 14 }]}>
                  <View style={[s.stepDot, { backgroundColor: BRAND }]}>
                    <ThemedText style={s.stepDotNum}>{i + 1}</ThemedText>
                  </View>
                  <View style={[s.stepIcon, { backgroundColor: CARD_BG2 }]}>
                    <Ionicons name={step.icon} size={18} color={BRAND} />
                  </View>
                  <ThemedText style={s.stepLabel}>{step.label}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* Rejection reason */}
          {verifStatus === 'rejected' && rejectionReason && (
            <View style={[s.reasonCard, { backgroundColor: '#ef444408', borderColor: '#ef444425' }]}>
              <View style={s.reasonHeader}>
                <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
                <ThemedText style={s.reasonHeaderText}>Reason for rejection</ThemedText>
              </View>
              <ThemedText style={s.reasonText}>{rejectionReason}</ThemedText>
            </View>
          )}

          {/* Pending info card */}
          {verifStatus === 'pending' && (
            <View style={[s.card, { backgroundColor: CARD_BG }]}>
              <View style={s.cardRow}>
                <View style={[s.cardIcon, { backgroundColor: '#f59e0b20' }]}>
                  <ThemedText style={{ fontSize: 18 }}>⏳</ThemedText>
                </View>
                <ThemedText style={s.cardTitle}>Under Review</ThemedText>
              </View>
              {requestDate && (
                <View style={[s.datePill, { backgroundColor: CARD_BG2, marginBottom: 14 }]}>
                  <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.4)" />
                  <ThemedText style={s.datePillText}>
                    Submitted {new Date(requestDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                  </ThemedText>
                </View>
              )}
              {[
                { icon: 'time-outline'             as const, c: '#f59e0b', t: 'Review takes up to 24 hours from submission' },
                { icon: 'checkmark-circle-outline' as const, c: BRAND,     t: 'Approved → verified badge on your profile' },
                { icon: 'close-circle-outline'     as const, c: '#ef4444', t: 'Rejected → reason shown so you can retry' },
                { icon: 'notifications-outline'    as const, c: '#8B5CF6', t: 'You will be notified of the outcome' },
              ].map((row, i) => (
                <View key={i} style={[s.infoRow, i > 0 && { marginTop: 12 }]}>
                  <Ionicons name={row.icon} size={18} color={row.c} />
                  <ThemedText style={s.infoRowText}>{row.t}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* Approved info card */}
          {verifStatus === 'approved' && (
            <View style={[s.card, { backgroundColor: CARD_BG }]}>
              <View style={s.cardRow}>
                <View style={[s.cardIcon, { backgroundColor: BRAND + '20' }]}>
                  <Ionicons name="shield-checkmark" size={18} color={BRAND} />
                </View>
                <ThemedText style={s.cardTitle}>You're Verified!</ThemedText>
              </View>
              {[
                { icon: 'checkmark-circle-outline' as const, c: BRAND,     t: 'Verified badge is visible on your profile' },
                { icon: 'star-outline'             as const, c: '#f59e0b', t: 'You appear higher in discovery results' },
                { icon: 'heart-circle-outline'     as const, c: '#ec4899', t: 'Other users can trust you are who you say' },
              ].map((row, i) => (
                <View key={i} style={[s.infoRow, i > 0 && { marginTop: 12 }]}>
                  <Ionicons name={row.icon} size={18} color={row.c} />
                  <ThemedText style={s.infoRowText}>{row.t}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* Tips — shown only for none/rejected */}
          {(verifStatus === 'none' || verifStatus === 'rejected') && (
            <View style={[s.card, { backgroundColor: CARD_BG }]}>
              <View style={s.cardRow}>
                <View style={[s.cardIcon, { backgroundColor: '#f59e0b20' }]}>
                  <Ionicons name="sunny-outline" size={18} color="#f59e0b" />
                </View>
                <ThemedText style={s.cardTitle}>Tips for best results</ThemedText>
              </View>
              {[
                { icon: 'flashlight-outline'  as const, c: '#f59e0b', t: 'Dark room? Use the torch button on camera' },
                { icon: 'person-outline'      as const, c: BRAND,     t: 'Keep your face fully visible throughout' },
                { icon: 'lock-closed-outline' as const, c: '#8B5CF6', t: 'Video is private — admin review only' },
              ].map((tip, i) => (
                <View key={i} style={[s.tipRow, i > 0 && { marginTop: 10 }]}>
                  <Ionicons name={tip.icon} size={16} color={tip.c} />
                  <ThemedText style={s.tipText}>{tip.t}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {/* ── CTA Button — changes based on status ── */}
          {verifStatus === 'none' && (
            <Pressable style={s.ctaWrap} onPress={openCamera}>
              <LinearGradient colors={[BRAND, BRAND_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ctaBtn}>
                <Ionicons name="videocam" size={20} color="#fff" />
                <ThemedText style={s.ctaBtnText}>Open Camera</ThemedText>
              </LinearGradient>
            </Pressable>
          )}

          {verifStatus === 'rejected' && (
            <Pressable style={s.ctaWrap} onPress={tryAgain}>
              <LinearGradient colors={[BRAND, BRAND_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.ctaBtn}>
                <Ionicons name="refresh" size={20} color="#fff" />
                <ThemedText style={s.ctaBtnText}>Try Again</ThemedText>
              </LinearGradient>
            </Pressable>
          )}

          {verifStatus === 'pending' && (
            <View style={[s.ctaWrap, { borderRadius: 18, overflow: 'hidden' }]}>
              <View style={[s.ctaBtn, { backgroundColor: '#f59e0b22', borderWidth: 1, borderColor: '#f59e0b40' }]}>
                <ThemedText style={{ fontSize: 18 }}>⏳</ThemedText>
                <ThemedText style={[s.ctaBtnText, { color: '#f59e0b' }]}>Pending Review</ThemedText>
              </View>
            </View>
          )}

          {verifStatus === 'approved' && (
            <View style={[s.ctaWrap, { borderRadius: 18, overflow: 'hidden' }]}>
              <View style={[s.ctaBtn, { backgroundColor: BRAND + '22', borderWidth: 1, borderColor: BRAND + '40' }]}>
                <Ionicons name="shield-checkmark" size={20} color={BRAND} />
                <ThemedText style={[s.ctaBtnText, { color: BRAND }]}>Verified ✓</ThemedText>
              </View>
            </View>
          )}

        </View>
      </ScrollView>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  fill:   { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  introHeader: { alignItems: 'center', paddingHorizontal: 20, paddingBottom: 32 },
  backBtn: {
    alignSelf: 'flex-start', width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#ffffff12', alignItems: 'center', justifyContent: 'center', marginBottom: 28,
  },
  shieldWrap:   { marginBottom: 20 },
  shieldCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  introTitle:   { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 8 },
  introSub:     { color: 'rgba(255,255,255,0.5)', fontSize: 15, textAlign: 'center', lineHeight: 22 },

  card:     { borderRadius: 20, padding: 20 },
  cardRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  cardIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle:{ color: '#fff', fontSize: 15, fontWeight: '800' },

  stepRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepDot:    { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepDotNum: { color: '#fff', fontSize: 11, fontWeight: '900' },
  stepIcon:   { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  stepLabel:  { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600', flex: 1 },

  tipRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  tipText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, flex: 1, lineHeight: 19 },

  ctaWrap: { borderRadius: 18, overflow: 'hidden' },
  ctaBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 17 },
  ctaBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },

  camTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingBottom: 14, backgroundColor: SCREEN_BG,
  },
  camBack:    { width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff10', alignItems: 'center', justifyContent: 'center' },
  camBarTitle:{ color: '#fff', fontSize: 16, fontWeight: '800' },
  torchBtn:   { width: 38, height: 38, borderRadius: 19, backgroundColor: '#ffffff10', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  torchBtnOn: { backgroundColor: 'rgba(251,191,36,0.18)', borderColor: '#fbbf24' },

  recPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ef444420', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  recDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  recText: { color: '#ef4444', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  timerText:{ fontSize: 15, fontWeight: '900' },

  cameraBox: {
    marginHorizontal: 18, height: 350, borderRadius: 24,
    overflow: 'hidden', backgroundColor: '#111',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  ovalGuide: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ovalInner: {
    width: 170, height: 230, borderRadius: 85,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', borderStyle: 'dashed',
  },

  idleCard: { marginHorizontal: 18, marginTop: 14, borderRadius: 18, padding: 18 },
  idleCardTitle: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  idleStepRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  idleStepIcon:  { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  idleStepText:  { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', flex: 1 },

  recordBtnWrap: { alignItems: 'center', marginTop: 20 },
  recordBtnOuter:{ alignItems: 'center', justifyContent: 'center', width: 80, height: 80 },
  recordBtnInner:{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  recordHint:    { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 12, fontWeight: '500' },

  progressOuter: { height: 4, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 14, marginHorizontal: 18, borderRadius: 2, overflow: 'hidden' },
  progressFill:  { height: 4, borderRadius: 2 },

  recStepsCard:    { marginHorizontal: 18, marginTop: 12, borderRadius: 18, padding: 16 },
  recStepsHeading: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  submitArea: { paddingHorizontal: 18, marginTop: 14 },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  waitText:{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },

  statusTopBar:    { paddingHorizontal: 20, paddingBottom: 8 },
  statusIconWrap:  { width: 120, height: 120, borderRadius: 60, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statusIconInner: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 20, marginBottom: 10, textAlign: 'center' },
  statusSub:   { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', lineHeight: 21, maxWidth: 300 },

  datePill:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  datePillText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },

  infoCard: { borderRadius: 18, padding: 18, width: '100%' },
  infoRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoRowText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, flex: 1, lineHeight: 19 },

  uploadingPill: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  uploadingText: { fontSize: 13, fontWeight: '600' },

  reasonCard:       { borderRadius: 16, padding: 16, borderWidth: 1, width: '100%' },
  reasonHeader:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  reasonHeaderText: { color: '#ef4444', fontSize: 13, fontWeight: '800' },
  reasonText:       { color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 21 },
});

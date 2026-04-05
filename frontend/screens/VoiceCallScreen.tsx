import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  StatusBar,
  Vibration,
  Platform,
  Alert,
} from "react-native";
import { SafeImage } from "@/components/SafeImage";
import { ThemedText } from "@/components/ThemedText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import socketService from "@/services/socket";
import agoraService from "@/services/agoraService";
import { getApiBaseUrl } from "@/constants/config";
import { useCallContext, CallStatus } from "@/contexts/CallContext";
import WebView from "react-native-webview";

/* ─────────────────────────────────────────────
   Audio wave bar component — shown while connected
────────────────────────────────────────────── */
function AudioWaveBars({ isMuted }: { isMuted: boolean }) {
  const bars = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (isMuted) {
      bars.forEach((b) => b.setValue(0.3));
      return;
    }
    const anims = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 80),
          Animated.timing(bar, { toValue: 1, duration: 350 + i * 60, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.25, duration: 350 + i * 60, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [isMuted]);

  return (
    <View style={wavStyles.row}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            wavStyles.bar,
            {
              scaleY: bar,
              opacity: isMuted ? 0.25 : 1,
            },
          ]}
        />
      ))}
    </View>
  );
}
const wavStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, height: 32 },
  bar: { width: 4, height: 28, borderRadius: 3, backgroundColor: "rgba(167,139,250,0.8)" },
});

/* ─────────────────────────────────────────────
   Main VoiceCallScreen
────────────────────────────────────────────── */
export default function VoiceCallScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    userId,
    userName,
    userPhoto,
    isIncoming,
    callData: incomingCallData,
    callerId,
    matchId,
    callAccepted,   // true when navigated from IncomingCallHandler after already accepting
    returnToCall,   // true when returning from minimized state
  } = route.params || {};

  const { token: authToken, user } = useAuth();
  const { post, get } = useApi();
  const { setActiveCall, updateCallStatus, startGlobalTimer, stopGlobalTimer, minimizeCall, clearCall, activeCall } = useCallContext();

  const [callStatus, setCallStatus] = useState<CallStatus>(
    callAccepted ? "connected" : "connecting"
  );
  const [activeCallData, setActiveCallData] = useState<any>(incomingCallData || null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [webviewReady, setWebviewReady] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const pulseAnim3 = useRef(new Animated.Value(1)).current;
  const endCallScaleAnim = useRef(new Animated.Value(1)).current;
  const ringtoneRef = useRef<Audio.Sound | null>(null);
  const shouldRingRef = useRef(false);
  const ringingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  const agoraJoined = useRef(false);
  const activeCallDataRef = useRef<any>(incomingCallData || null);
  const callStatusRef = useRef<CallStatus>(callAccepted ? "connected" : "connecting");

  /* ── helpers ── */
  const setStatus = useCallback((s: CallStatus) => {
    callStatusRef.current = s;
    setCallStatus(s);
    updateCallStatus(s);
  }, [updateCallStatus]);

  const stopRingtoneSound = useCallback(async () => {
    shouldRingRef.current = false;
    try {
      if (ringtoneRef.current) {
        const s = ringtoneRef.current;
        ringtoneRef.current = null;
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      }
      Vibration.cancel();
    } catch (err) {
      console.log("Ringtone cleanup error:", err);
    }
  }, []);

  const playRingtone = useCallback(async () => {
    shouldRingRef.current = true;
    try {
      await stopRingtoneSound();
      if (!shouldRingRef.current) return;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      });
      if (!shouldRingRef.current) return;
      const source = isIncoming
        ? require("../assets/sounds/mixkit-waiting-ringtone-1354.wav")
        : require("../assets/sounds/phone-calling-1b.mp3");
      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
        isLooping: true,
        volume: 1.0,
      });
      if (!shouldRingRef.current) {
        await sound.unloadAsync().catch(() => {});
        return;
      }
      ringtoneRef.current = sound;
      if (isIncoming) Vibration.vibrate([500, 1000, 500], true);
    } catch (err) {
      console.error("Ringtone play error:", err);
      if (isIncoming && shouldRingRef.current) Vibration.vibrate([500, 1000, 500], true);
    }
  }, [isIncoming, stopRingtoneSound]);

  const startTimer = useCallback(() => {
    startGlobalTimer();
  }, [startGlobalTimer]);

  /* ── microphone permission ── */
  const requestMicPermission = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status === "granted") {
        setPermissionGranted(true);
        return true;
      }
      Alert.alert(
        "Microphone Access Required",
        "Please allow microphone access in Settings to make voice calls.",
        [{ text: "OK" }]
      );
      return false;
    } catch {
      return false;
    }
  }, []);

  /* ── WebView bridge ── */
  const sendToWebView = useCallback((msg: any) => {
    webViewRef.current?.postMessage(JSON.stringify(msg));
  }, []);

  /* ── Agora join ── */
  const joinAgoraVoice = useCallback(async (callDataObj: any) => {
    if (agoraJoined.current) return;
    agoraJoined.current = true;

    // Ensure mic permission
    const hasPerm = await requestMicPermission();
    if (!hasPerm) return;

    let joinToken = callDataObj.token;
    let joinUid = callDataObj.uid || 0;

    // Incoming callee needs their own token
    if (isIncoming && authToken) {
      try {
        const res = await get<{ token: string; uid: number }>(
          `/agora/token`,
          { channelName: callDataObj.channelName, uid: 0, role: "publisher" },
          authToken
        );
        if (res.success && res.data?.token) {
          joinToken = res.data.token;
          joinUid = 0;
        }
      } catch (e) {
        console.log("Receiver token fetch failed, using shared token");
      }
    }

    if (Platform.OS === "web") {
      agoraService.joinVoiceCall(callDataObj.appId, callDataObj.channelName, joinToken, joinUid);
    } else {
      sendToWebView({
        action: "join",
        appId: callDataObj.appId,
        channel: callDataObj.channelName,
        token: joinToken,
        uid: joinUid,
        callType: "voice",
      });
    }
  }, [isIncoming, authToken, get, sendToWebView, requestMicPermission]);

  /* ── End call ── */
  const handleEndCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const wasConnected = callStatusRef.current === "connected";
    const currentDuration = activeCall?.duration || 0;
    setStatus("ended");
    await stopRingtoneSound();
    stopGlobalTimer();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);

    if (Platform.OS === "web") {
      agoraService.leave();
    } else {
      sendToWebView({ action: "leave" });
    }

    socketService.endCall({
      targetUserId: isIncoming ? callerId : userId,
      callType: "audio",
      duration: currentDuration,
      wasAnswered: wasConnected,
    });

    clearCall();
    setTimeout(() => {
      if (navigation.canGoBack()) navigation.goBack();
    }, 600);
  }, [callerId, userId, isIncoming, duration, stopRingtoneSound, sendToWebView, clearCall, navigation, setStatus]);

  /* ── Minimize (return to app without ending call) ── */
  const handleMinimize = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    minimizeCall();
    if (navigation.canGoBack()) navigation.goBack();
  }, [minimizeCall, navigation]);

  /* ── Premium 5-min limit ── */
  const duration = activeCall?.duration || 0;
  useEffect(() => {
    const isPremium = user?.premium?.isActive;
    if (isPremium || callStatus !== "connected") return;
    if (duration === 240) {
      Alert.alert(
        "1 Minute Remaining",
        "Free calls are limited to 5 minutes. Upgrade to Premium for unlimited call time.",
        [{ text: "OK" }]
      );
    }
    if (duration >= 300) handleEndCall();
  }, [duration, callStatus, user, handleEndCall]);

  /* ── Accept incoming ── */
  const handleAccept = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await stopRingtoneSound();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    socketService.acceptCall({ callerId, callData: activeCallData });
    setStatus("connected");
    startTimer();
    if (activeCallData) joinAgoraVoice(activeCallData);
  }, [callerId, activeCallData, stopRingtoneSound, joinAgoraVoice, startTimer, setStatus]);

  /* ── Decline incoming ── */
  const handleDecline = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await stopRingtoneSound();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    socketService.declineCall({ callerId, callType: "audio" });
    if (authToken && isIncoming) {
      post("/call/decline", { callerId, type: "audio" }, authToken).catch(() => {});
    }
    setStatus("declined");
    clearCall();
    setTimeout(() => navigation.canGoBack() && navigation.goBack(), 900);
  }, [callerId, isIncoming, authToken, post, stopRingtoneSound, clearCall, navigation, setStatus]);

  /* ── Toggle mute ── */
  const toggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted((prev) => {
      const next = !prev;
      if (Platform.OS === "web") agoraService.toggleMute(next);
      else sendToWebView({ action: "mute", muted: next });
      return next;
    });
  }, [sendToWebView]);

  /* ── Toggle speaker ── */
  const toggleSpeaker = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: !next,
      });
    } catch (e) {
      console.log("Speaker toggle error:", e);
    }
  }, [isSpeakerOn]);

  /* ── Initiate outgoing call ── */
  const initiateCall = useCallback(async () => {
    if (!authToken || !userId) return setStatus("failed");

    // Check mic permission before initiating
    const hasPerm = await requestMicPermission();
    if (!hasPerm) {
      setStatus("failed");
      return;
    }

    try {
      const response = await post<any>(
        "/agora/call/initiate",
        { targetUserId: userId, callType: "voice" },
        authToken
      );
      if (response.success && response.data?.callData) {
        const cd = response.data.callData;
        setActiveCallData(cd);
        activeCallDataRef.current = cd;
        setStatus("ringing");

        const photoVal = user?.photos?.[0];
        const photoUrl = typeof photoVal === "string" ? photoVal : (photoVal as any)?.url || "";
        socketService.initiateCall({
          targetUserId: userId,
          callData: cd,
          callerInfo: { name: user?.name || "User", photo: photoUrl, id: user?.id || "" },
        });

        // 30-second ring timeout → missed
        ringingTimeout.current = setTimeout(() => {
          if (callStatusRef.current === "ringing") {
            setStatus("missed");
            socketService.missedCall?.({ targetUserId: userId, callType: "voice" });
            clearCall();
            setTimeout(() => navigation.canGoBack() && navigation.goBack(), 2000);
          }
        }, 30000);
      } else {
        setStatus("failed");
      }
    } catch {
      setStatus("failed");
    }
  }, [authToken, userId, post, user, navigation, requestMicPermission, setStatus, clearCall]);

  /* ── Main setup effect ── */
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    // Register call in context
    setActiveCall({
      userId: userId || callerId || "",
      userName: userName || "Unknown",
      userPhoto,
      isIncoming: !!isIncoming,
      callStatus: callAccepted ? "connected" : "connecting",
      duration: 0,
    });

    if (callAccepted) {
      // Already accepted in IncomingCallHandler — jump straight to connected
      setStatus("connected");
      startTimer();
      if (activeCallDataRef.current) {
        // Join Agora after WebView loads (for native) or immediately (for web)
        if (Platform.OS === "web") {
          joinAgoraVoice(activeCallDataRef.current);
        }
        // Native: handled in webviewReady effect below
      }
    } else if (returnToCall) {
      // Returning from minimized state — restore connected UI
      setStatus("connected");
    } else if (isIncoming) {
      setStatus("ringing");
    } else {
      initiateCall();
    }

    /* Socket listeners */
    socketService.onCallAccepted(async () => {
      await stopRingtoneSound();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setStatus("connected");
      startTimer();
      if (activeCallDataRef.current) joinAgoraVoice(activeCallDataRef.current);
    });

    socketService.onCallDeclined(async () => {
      await stopRingtoneSound();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setStatus("declined");
      clearCall();
      setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1500);
    });

    socketService.onCallBusy(async () => {
      await stopRingtoneSound();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setStatus("busy");
      clearCall();
      setTimeout(() => navigation.canGoBack() && navigation.goBack(), 2000);
    });

    socketService.onCallEnded(async () => {
      await stopRingtoneSound();
      if (Platform.OS === "web") agoraService.leave();
      else sendToWebView({ action: "leave" });
      setStatus("ended");
      stopGlobalTimer();
      clearCall();
      setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1200);
    });

    return () => {
      stopRingtoneSound();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      socketService.off("call:accepted");
      socketService.off("call:declined");
      socketService.off("call:busy");
      socketService.off("call:ended");
      // Note: global timer continues running in CallContext so FloatingCallBar stays live
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Ringtone based on status ── */
  useEffect(() => {
    if (callStatus === "ringing") playRingtone();
    else stopRingtoneSound();
  }, [callStatus]);

  /* ── Pulse animation for ringing / connecting ── */
  useEffect(() => {
    if (callStatus === "ringing" || callStatus === "connecting") {
      const makeLoop = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1.28, duration: 900, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
          ])
        );
      const l1 = makeLoop(pulseAnim, 0);
      const l2 = makeLoop(pulseAnim2, 300);
      const l3 = makeLoop(pulseAnim3, 600);
      l1.start(); l2.start(); l3.start();
      return () => { l1.stop(); l2.stop(); l3.stop(); };
    } else {
      pulseAnim.setValue(1);
      pulseAnim2.setValue(1);
      pulseAnim3.setValue(1);
    }
  }, [callStatus]);

  /* ── WebView ready: join Agora for native ── */
  useEffect(() => {
    if (
      webviewReady &&
      (callStatus === "connected" || callAccepted) &&
      activeCallDataRef.current &&
      !agoraJoined.current
    ) {
      joinAgoraVoice(activeCallDataRef.current);
    }
  }, [webviewReady]);

  /* ── Helpers ── */
  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const getStatusText = () => {
    switch (callStatus) {
      case "connecting": return "Connecting…";
      case "ringing":    return isIncoming ? "Incoming voice call…" : "Ringing…";
      case "connected":  return formatDuration(duration);
      case "ended":      return "Call ended";
      case "declined":   return "Call declined";
      case "busy":       return "User is currently busy";
      case "missed":     return "No answer";
      case "failed":     return "Call failed";
      default:           return "";
    }
  };

  const isTerminal = ["ended", "declined", "missed", "failed", "busy"].includes(callStatus);
  const isOutgoingWaiting = !isIncoming && callStatus === "ringing";
  const showConnected = callStatus === "connected";
  const showIncomingButtons = isIncoming && callStatus === "ringing";

  const agoraCallUrl = `${getApiBaseUrl()}/public/agora-call.html`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background gradient */}
      <LinearGradient
        colors={["#12003a", "#1a0a50", "#0b1a2c"]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Ambient blobs */}
      <View style={styles.blobTop} />
      <View style={styles.blobMid} />
      <View style={styles.blobBottom} />

      {/* Hidden WebView for Agora audio on native */}
      {Platform.OS !== "web" && (
        <WebView
          ref={webViewRef}
          source={{ uri: agoraCallUrl }}
          style={{ width: 0, height: 0, position: "absolute" }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          javaScriptEnabled
          domStorageEnabled
          onPermissionRequest={(req) => req.grant(req.resources)}
          onLoad={() => setWebviewReady(true)}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === "joined")  console.log("Voice WebView joined:", data.uid);
              if (data.type === "error")   console.log("Voice WebView error:", data.message);
            } catch {}
          }}
        />
      )}

      <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>

        {/* ── TOP BAR: minimize + call type pill ── */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          {/* Minimize button — only when connected */}
          {showConnected ? (
            <Pressable style={styles.minimizeBtn} onPress={handleMinimize} hitSlop={12}>
              <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.75)" />
            </Pressable>
          ) : (
            <View style={styles.minimizePlaceholder} />
          )}

          {/* Call type pill */}
          <View style={styles.callTypePill}>
            <Ionicons name="call" size={11} color="#c4b5fd" />
            <ThemedText style={styles.callTypePillText}>
              {isIncoming && callStatus === "ringing" ? "Incoming Voice Call" : "Voice Call"}
            </ThemedText>
          </View>

          <View style={styles.minimizePlaceholder} />
        </View>

        {/* ── NAME & STATUS ── */}
        <View style={styles.topSection}>
          <ThemedText style={styles.userName} numberOfLines={1}>
            {userName || "Unknown"}
          </ThemedText>

          <ThemedText style={styles.statusText}>{getStatusText()}</ThemedText>

          {/* Connected: live badge + wave bars */}
          {showConnected && (
            <View style={styles.connectedInfo}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <ThemedText style={styles.liveBadgeText}>Connected</ThemedText>
              </View>
              <AudioWaveBars isMuted={isMuted} />
            </View>
          )}

          {/* Ringing / connecting: encryption badge */}
          {(callStatus === "ringing" || callStatus === "connecting") && (
            <View style={styles.encryptedBadge}>
              <Ionicons name="lock-closed" size={10} color="rgba(196,181,253,0.7)" />
              <ThemedText style={styles.encryptedText}>End-to-end encrypted</ThemedText>
            </View>
          )}

          {/* Error states */}
          {isTerminal && callStatus !== "ended" && (
            <View style={styles.errorBadge}>
              <Ionicons
                name={callStatus === "failed" ? "warning-outline" : "close-circle-outline"}
                size={14} color="#f87171"
              />
              <ThemedText style={styles.errorText}>
                {callStatus === "busy"     ? "User is currently in another call" :
                 callStatus === "declined" ? "Your call was declined" :
                 callStatus === "missed"   ? "No answer — try again later" :
                                             "Unable to connect"}
              </ThemedText>
            </View>
          )}
        </View>

        {/* ── AVATAR + PULSE RINGS ── */}
        <View style={styles.avatarSection}>
          {(callStatus === "ringing" || callStatus === "connecting") && (
            <>
              <Animated.View style={[styles.ring, styles.ring3, { transform: [{ scale: pulseAnim3 }] }]} />
              <Animated.View style={[styles.ring, styles.ring2, { transform: [{ scale: pulseAnim2 }] }]} />
              <Animated.View style={[styles.ring, styles.ring1, { transform: [{ scale: pulseAnim }] }]} />
            </>
          )}

          {/* Muted indicator ring */}
          {showConnected && isMuted && (
            <View style={styles.mutedRing} />
          )}

          <View style={[styles.avatarFrame, showConnected && styles.avatarFrameConnected]}>
            <View style={styles.avatarInner}>
              <SafeImage
                source={{ uri: userPhoto || "https://via.placeholder.com/150" }}
                style={styles.avatar}
              />
            </View>
          </View>

          {/* Muted mic badge */}
          {showConnected && isMuted && (
            <View style={styles.mutedBadge}>
              <Ionicons name="mic-off" size={14} color="#fff" />
            </View>
          )}
        </View>

        {/* ── BOTTOM CONTROLS ── */}
        <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 28 }]}>

          {/* INCOMING: decline / accept */}
          {showIncomingButtons && (
            <View style={styles.incomingRow}>
              <View style={styles.callActionWrap}>
                <Pressable style={[styles.circleBtn, styles.declineBtn]} onPress={handleDecline}>
                  <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                </Pressable>
                <ThemedText style={styles.btnLabel}>Decline</ThemedText>
              </View>
              <View style={styles.callActionWrap}>
                <Pressable style={[styles.circleBtn, styles.acceptBtn]} onPress={handleAccept}>
                  <Ionicons name="call" size={28} color="#FFF" />
                </Pressable>
                <ThemedText style={styles.btnLabel}>Accept</ThemedText>
              </View>
            </View>
          )}

          {/* CONNECTED: controls grid + hang up */}
          {showConnected && (
            <View style={styles.glassPanel}>
              {/* Secondary controls row */}
              <View style={styles.controlsGrid}>

                {/* Mute */}
                <View style={styles.controlWrap}>
                  <Pressable
                    style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
                    onPress={toggleMute}
                  >
                    <Ionicons
                      name={isMuted ? "mic-off" : "mic"}
                      size={22}
                      color={isMuted ? "#1a0533" : "#FFF"}
                    />
                  </Pressable>
                  <ThemedText style={styles.btnLabel}>{isMuted ? "Unmute" : "Mute"}</ThemedText>
                </View>

                {/* Speaker */}
                <View style={styles.controlWrap}>
                  <Pressable
                    style={[styles.controlBtn, isSpeakerOn && styles.controlBtnActive]}
                    onPress={toggleSpeaker}
                  >
                    <Ionicons
                      name={isSpeakerOn ? "volume-high" : "ear"}
                      size={22}
                      color={isSpeakerOn ? "#1a0533" : "#FFF"}
                    />
                  </Pressable>
                  <ThemedText style={styles.btnLabel}>
                    {isSpeakerOn ? "Earpiece" : "Speaker"}
                  </ThemedText>
                </View>

                {/* Keypad placeholder (future) */}
                <View style={styles.controlWrap}>
                  <View style={[styles.controlBtn, { opacity: 0.35 }]}>
                    <MaterialCommunityIcons name="dialpad" size={22} color="#FFF" />
                  </View>
                  <ThemedText style={[styles.btnLabel, { opacity: 0.35 }]}>Keypad</ThemedText>
                </View>

              </View>

              {/* Hang up */}
              <View style={styles.hangupWrap}>
                <Animated.View style={{ transform: [{ scale: endCallScaleAnim }] }}>
                  <Pressable
                    style={styles.hangupBtn}
                    onPress={handleEndCall}
                    onPressIn={() =>
                      Animated.spring(endCallScaleAnim, {
                        toValue: 0.88,
                        useNativeDriver: true,
                        tension: 250,
                        friction: 8,
                      }).start()
                    }
                    onPressOut={() =>
                      Animated.spring(endCallScaleAnim, {
                        toValue: 1,
                        useNativeDriver: true,
                        tension: 250,
                        friction: 8,
                      }).start()
                    }
                  >
                    <Ionicons
                      name="call"
                      size={32}
                      color="#FFF"
                      style={{ transform: [{ rotate: "135deg" }] }}
                    />
                  </Pressable>
                </Animated.View>
                <ThemedText style={styles.btnLabel}>Hang Up</ThemedText>
              </View>
            </View>
          )}

          {/* OUTGOING RINGING / CONNECTING: cancel */}
          {(callStatus === "connecting" || isOutgoingWaiting) && (
            <View style={styles.cancelWrap}>
              <Pressable style={[styles.circleBtn, styles.declineBtn]} onPress={handleEndCall}>
                <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
              </Pressable>
              <ThemedText style={styles.btnLabel}>Cancel</ThemedText>
            </View>
          )}

          {/* TERMINAL: close */}
          {(isTerminal || callStatus === "ended") && (
            <View style={styles.cancelWrap}>
              <Pressable style={[styles.circleBtn, styles.dismissBtn]} onPress={() => {
                clearCall();
                navigation.canGoBack() && navigation.goBack();
              }}>
                <Ionicons name="close" size={28} color="#FFF" />
              </Pressable>
              <ThemedText style={styles.btnLabel}>Close</ThemedText>
            </View>
          )}

        </View>
      </Animated.View>
    </View>
  );
}

/* ─────────────────────────────────────────────
   Styles
────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1 },
  screen: { flex: 1, flexDirection: "column", justifyContent: "space-between" },

  /* blobs */
  blobTop:    { position: "absolute", top: -100, left: -70,  width: 320, height: 320, borderRadius: 160, backgroundColor: "rgba(124,58,237,0.20)" },
  blobMid:    { position: "absolute", top: 280,  right: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(79,70,229,0.12)"  },
  blobBottom: { position: "absolute", bottom:-80, left: -40, width: 260, height: 260, borderRadius: 130, backgroundColor: "rgba(37,99,235,0.15)"  },

  /* top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  minimizeBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  minimizePlaceholder: { width: 36 },
  callTypePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(124,58,237,0.18)",
    borderWidth: 1, borderColor: "rgba(196,181,253,0.3)",
  },
  callTypePillText: { fontSize: 12, color: "#c4b5fd", fontWeight: "600", letterSpacing: 0.3 },

  /* top section */
  topSection: {
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 8,
  },
  userName: {
    fontSize: 30, fontWeight: "800", color: "#FFFFFF",
    letterSpacing: 0.2, textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10,
  },
  statusText: {
    fontSize: 15, color: "rgba(255,255,255,0.55)",
    fontWeight: "500", letterSpacing: 0.8, textAlign: "center",
  },

  /* connected info */
  connectedInfo: { alignItems: "center", gap: 10, marginTop: 4 },
  liveBadge: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(16,185,129,0.14)",
    borderWidth: 1, borderColor: "rgba(16,185,129,0.35)",
    gap: 7,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#10B981" },
  liveBadgeText: { fontSize: 12, color: "#10B981", fontWeight: "700" },

  /* encrypted badge */
  encryptedBadge: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  encryptedText: { fontSize: 11, color: "rgba(196,181,253,0.65)", fontWeight: "500" },

  /* error badge */
  errorBadge: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12, backgroundColor: "rgba(248,113,113,0.12)",
    borderWidth: 1, borderColor: "rgba(248,113,113,0.3)",
  },
  errorText: { fontSize: 13, color: "#f87171", fontWeight: "500", flex: 1, textAlign: "center" },

  /* avatar */
  avatarSection: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  ring: { position: "absolute", borderRadius: 999 },
  ring1: { width: 178, height: 178, backgroundColor: "rgba(124,58,237,0.14)", borderWidth: 1.5, borderColor: "rgba(167,139,250,0.3)" },
  ring2: { width: 220, height: 220, backgroundColor: "rgba(124,58,237,0.07)", borderWidth: 1,   borderColor: "rgba(167,139,250,0.15)" },
  ring3: { width: 264, height: 264, backgroundColor: "rgba(124,58,237,0.03)", borderWidth: 1,   borderColor: "rgba(167,139,250,0.07)" },

  mutedRing: {
    position: "absolute",
    width: 168, height: 168, borderRadius: 84,
    borderWidth: 2.5, borderColor: "rgba(239,68,68,0.55)",
  },
  avatarFrame: {
    width: 152, height: 152, borderRadius: 76,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 2.5, borderColor: "rgba(196,181,253,0.4)",
    shadowColor: "#7c3aed", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 24, elevation: 14,
  },
  avatarFrameConnected: {
    borderColor: "rgba(16,185,129,0.6)",
    shadowColor: "#10B981",
  },
  avatarInner: { flex: 1, borderRadius: 72, overflow: "hidden" },
  avatar: { width: "100%", height: "100%" },

  mutedBadge: {
    position: "absolute",
    bottom: -2, right: "50%",
    marginRight: -52,
    backgroundColor: "#ef4444",
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
    flexDirection: "row", alignItems: "center", gap: 3,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)",
  },

  /* bottom */
  bottomContainer: { width: "100%", alignItems: "center", paddingHorizontal: 24 },

  /* incoming row */
  incomingRow: {
    flexDirection: "row", justifyContent: "space-evenly",
    width: "100%", paddingHorizontal: 20,
  },
  callActionWrap: { alignItems: "center", gap: 10 },

  /* glass panel — connected */
  glassPanel: {
    width: "100%", alignItems: "center", gap: 22,
    paddingHorizontal: 16, paddingTop: 22, paddingBottom: 20,
    backgroundColor: "rgba(10,6,25,0.65)",
    borderRadius: 28,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },

  /* controls grid */
  controlsGrid: { flexDirection: "row", justifyContent: "space-evenly", width: "100%", gap: 8 },
  controlWrap: { alignItems: "center", gap: 8, flex: 1 },
  controlBtn: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  controlBtnActive: {
    backgroundColor: "#c4b5fd",
    borderColor: "rgba(196,181,253,0.5)",
  },

  /* hang up */
  hangupWrap: { alignItems: "center", gap: 8 },
  hangupBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#dc2626",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#dc2626", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5, shadowRadius: 12, elevation: 8,
  },

  /* cancel / dismiss */
  cancelWrap: { alignItems: "center", gap: 10 },
  circleBtn: {
    width: 70, height: 70, borderRadius: 35,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  declineBtn: { backgroundColor: "#dc2626" },
  acceptBtn:  { backgroundColor: "#16a34a" },
  dismissBtn: { backgroundColor: "rgba(255,255,255,0.15)" },

  btnLabel: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "500" },
});

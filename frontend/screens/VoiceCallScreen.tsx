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
      callType: "voice",
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

      {/* Full-screen blurred avatar as background */}
      <SafeImage
        source={{ uri: userPhoto || "https://via.placeholder.com/400" }}
        style={styles.bgPhoto}
        blurRadius={Platform.OS === "ios" ? 60 : 18}
      />
      <LinearGradient
        colors={["rgba(4,0,18,0.88)", "rgba(8,0,28,0.72)", "rgba(4,0,18,0.94)"]}
        style={StyleSheet.absoluteFill}
      />

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

        {/* ── TOP BAR ── */}
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          {showConnected ? (
            <Pressable style={styles.minimizeBtn} onPress={handleMinimize} hitSlop={12}>
              <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.85)" />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
          <View style={styles.callTypePill}>
            <Ionicons name="call" size={11} color="#a78bfa" />
            <ThemedText style={styles.callTypePillText}>
              {isIncoming && callStatus === "ringing" ? "Incoming Voice Call" : "Voice Call"}
            </ThemedText>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* ── NAME + STATUS ── */}
        <View style={[styles.nameSection, { marginTop: insets.top + 52 }]}>
          <ThemedText style={styles.userName} numberOfLines={1}>{userName || "Unknown"}</ThemedText>
          <ThemedText style={[styles.statusText, isTerminal && { color: "#f87171" }]}>
            {getStatusText()}
          </ThemedText>

          {showConnected && (
            <View style={styles.connectedRow}>
              <View style={styles.liveGreen} />
              <ThemedText style={styles.liveText}>Connected</ThemedText>
              <AudioWaveBars isMuted={isMuted} />
            </View>
          )}

          {(callStatus === "ringing" || callStatus === "connecting") && (
            <View style={styles.encryptBadge}>
              <Ionicons name="lock-closed" size={10} color="rgba(167,139,250,0.8)" />
              <ThemedText style={styles.encryptText}>End-to-end encrypted</ThemedText>
            </View>
          )}

          {isTerminal && callStatus !== "ended" && (
            <View style={styles.errorPill}>
              <Ionicons name="close-circle" size={14} color="#f87171" />
              <ThemedText style={styles.errorPillText}>
                {callStatus === "busy"     ? "User is in another call" :
                 callStatus === "declined" ? "Call was declined" :
                 callStatus === "missed"   ? "No answer" : "Unable to connect"}
              </ThemedText>
            </View>
          )}
        </View>

        {/* ── AVATAR + PULSE RINGS ── */}
        <View style={styles.avatarSection}>
          {(callStatus === "ringing" || callStatus === "connecting") && (
            <>
              <Animated.View style={[styles.ringOuter, { transform: [{ scale: pulseAnim3 }] }]} />
              <Animated.View style={[styles.ringMid,   { transform: [{ scale: pulseAnim2 }] }]} />
              <Animated.View style={[styles.ringInner, { transform: [{ scale: pulseAnim  }] }]} />
            </>
          )}
          {showConnected && isMuted && <View style={styles.mutedRing} />}

          <View style={[
            styles.avatarFrame,
            showConnected && styles.avatarFrameConnected,
            showConnected && isMuted && styles.avatarFrameMuted,
          ]}>
            <SafeImage
              source={{ uri: userPhoto || "https://via.placeholder.com/150" }}
              style={styles.avatar}
            />
          </View>

          {showConnected && isMuted && (
            <View style={styles.mutedBadge}>
              <Ionicons name="mic-off" size={13} color="#fff" />
              <ThemedText style={{ fontSize: 11, color: "#fff", fontWeight: "600" }}>Muted</ThemedText>
            </View>
          )}
        </View>

        {/* ── BOTTOM CONTROLS ── */}
        <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 32 }]}>

          {/* INCOMING */}
          {showIncomingButtons && (
            <View style={styles.incomingRow}>
              <View style={styles.actionWrap}>
                <Pressable style={[styles.bigBtn, styles.redBtn]} onPress={handleDecline}>
                  <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                </Pressable>
                <ThemedText style={styles.btnLabel}>Decline</ThemedText>
              </View>
              <View style={styles.actionWrap}>
                <Pressable style={[styles.bigBtn, styles.greenBtn]} onPress={handleAccept}>
                  <Ionicons name="call" size={30} color="#FFF" />
                </Pressable>
                <ThemedText style={styles.btnLabel}>Accept</ThemedText>
              </View>
            </View>
          )}

          {/* CONNECTED */}
          {showConnected && (
            <View style={styles.glassPanel}>
              <View style={styles.controlsRow}>
                <View style={styles.ctrlItem}>
                  <Pressable style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]} onPress={toggleMute}>
                    <Ionicons name={isMuted ? "mic-off" : "mic"} size={22} color={isMuted ? "#12003a" : "#FFF"} />
                  </Pressable>
                  <ThemedText style={styles.ctrlLabel}>{isMuted ? "Unmute" : "Mute"}</ThemedText>
                </View>
                <View style={styles.ctrlItem}>
                  <Pressable style={[styles.ctrlBtn, isSpeakerOn && styles.ctrlBtnActive]} onPress={toggleSpeaker}>
                    <Ionicons name={isSpeakerOn ? "volume-high" : "ear"} size={22} color={isSpeakerOn ? "#12003a" : "#FFF"} />
                  </Pressable>
                  <ThemedText style={styles.ctrlLabel}>{isSpeakerOn ? "Earpiece" : "Speaker"}</ThemedText>
                </View>
                <View style={styles.ctrlItem}>
                  <View style={[styles.ctrlBtn, { opacity: 0.3 }]}>
                    <MaterialCommunityIcons name="dialpad" size={22} color="#FFF" />
                  </View>
                  <ThemedText style={[styles.ctrlLabel, { opacity: 0.3 }]}>Keypad</ThemedText>
                </View>
              </View>

              <Animated.View style={{ transform: [{ scale: endCallScaleAnim }] }}>
                <Pressable
                  style={styles.endCallBtn}
                  onPress={handleEndCall}
                  onPressIn={() => Animated.spring(endCallScaleAnim, { toValue: 0.88, useNativeDriver: true, tension: 220, friction: 8 }).start()}
                  onPressOut={() => Animated.spring(endCallScaleAnim, { toValue: 1, useNativeDriver: true, tension: 220, friction: 8 }).start()}
                >
                  <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                </Pressable>
              </Animated.View>
              <ThemedText style={styles.btnLabel}>End Call</ThemedText>
            </View>
          )}

          {/* RINGING / CONNECTING: cancel */}
          {(callStatus === "connecting" || isOutgoingWaiting) && (
            <View style={styles.actionWrap}>
              <Pressable style={[styles.bigBtn, styles.redBtn]} onPress={handleEndCall}>
                <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
              </Pressable>
              <ThemedText style={styles.btnLabel}>Cancel</ThemedText>
            </View>
          )}

          {/* TERMINAL */}
          {(isTerminal || callStatus === "ended") && (
            <View style={styles.actionWrap}>
              <Pressable
                style={[styles.bigBtn, { backgroundColor: "rgba(255,255,255,0.13)", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" }]}
                onPress={() => { clearCall(); navigation.canGoBack() && navigation.goBack(); }}
              >
                <Ionicons name="close" size={30} color="#FFF" />
              </Pressable>
              <ThemedText style={styles.btnLabel}>Close</ThemedText>
            </View>
          )}

        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bgPhoto: { ...StyleSheet.absoluteFillObject as any },
  screen: { flex: 1 },

  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingBottom: 4,
  },
  minimizeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center", alignItems: "center",
  },
  callTypePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: "rgba(109,40,217,0.22)",
    borderWidth: 1, borderColor: "rgba(167,139,250,0.35)",
  },
  callTypePillText: { fontSize: 12, color: "#a78bfa", fontWeight: "700", letterSpacing: 0.4 },

  nameSection: { alignItems: "center", paddingHorizontal: 28, gap: 8 },
  userName: {
    fontSize: 36, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.1,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 14,
  },
  statusText: {
    fontSize: 16, color: "rgba(255,255,255,0.5)", fontWeight: "500",
    letterSpacing: 0.7, textAlign: "center",
  },
  connectedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  liveGreen:   { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  liveText:    { fontSize: 13, color: "#10B981", fontWeight: "700" },
  encryptBadge:{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  encryptText: { fontSize: 11, color: "rgba(167,139,250,0.7)", fontWeight: "500" },
  errorPill:   {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 14, backgroundColor: "rgba(248,113,113,0.12)",
    borderWidth: 1, borderColor: "rgba(248,113,113,0.3)",
  },
  errorPillText: { fontSize: 13, color: "#f87171", fontWeight: "500" },

  avatarSection: { flex: 1, alignItems: "center", justifyContent: "center" },
  ringOuter: {
    position: "absolute", width: 290, height: 290, borderRadius: 145,
    backgroundColor: "rgba(109,40,217,0.06)",
    borderWidth: 1, borderColor: "rgba(167,139,250,0.1)",
  },
  ringMid: {
    position: "absolute", width: 232, height: 232, borderRadius: 116,
    backgroundColor: "rgba(109,40,217,0.1)",
    borderWidth: 1.2, borderColor: "rgba(167,139,250,0.2)",
  },
  ringInner: {
    position: "absolute", width: 186, height: 186, borderRadius: 93,
    backgroundColor: "rgba(109,40,217,0.16)",
    borderWidth: 1.5, borderColor: "rgba(167,139,250,0.32)",
  },
  mutedRing: {
    position: "absolute", width: 176, height: 176, borderRadius: 88,
    borderWidth: 2.5, borderColor: "rgba(239,68,68,0.65)",
  },
  avatarFrame: {
    width: 158, height: 158, borderRadius: 79,
    overflow: "hidden",
    borderWidth: 3, borderColor: "rgba(167,139,250,0.55)",
    shadowColor: "#7c3aed", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75, shadowRadius: 30, elevation: 20,
  },
  avatarFrameConnected: { borderColor: "rgba(16,185,129,0.65)", shadowColor: "#10B981" },
  avatarFrameMuted:     { borderColor: "rgba(239,68,68,0.55)",  shadowColor: "#ef4444" },
  avatar: { width: "100%", height: "100%" },
  mutedBadge: {
    position: "absolute", bottom: -10,
    backgroundColor: "#ef4444", borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 5,
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.25)",
  },

  bottomContainer: { width: "100%", alignItems: "center", paddingHorizontal: 24 },
  incomingRow: {
    flexDirection: "row", justifyContent: "space-around",
    width: "100%", paddingHorizontal: 20,
  },
  actionWrap: { alignItems: "center", gap: 12 },
  bigBtn: {
    width: 76, height: 76, borderRadius: 38,
    justifyContent: "center", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
  },
  redBtn:   { backgroundColor: "#dc2626", shadowColor: "#dc2626" },
  greenBtn: { backgroundColor: "#16a34a", shadowColor: "#16a34a" },
  btnLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: "600", letterSpacing: 0.3 },

  glassPanel: {
    width: "100%", alignItems: "center", gap: 20,
    paddingHorizontal: 20, paddingTop: 26, paddingBottom: 22,
    backgroundColor: "rgba(6,2,22,0.75)",
    borderRadius: 36,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 14,
  },
  controlsRow: { flexDirection: "row", justifyContent: "space-evenly", width: "100%" },
  ctrlItem:    { alignItems: "center", gap: 8, flex: 1 },
  ctrlBtn: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  ctrlBtnActive: { backgroundColor: "#c4b5fd", borderColor: "rgba(196,181,253,0.5)" },
  ctrlLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: "500", letterSpacing: 0.2 },
  endCallBtn: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: "#dc2626",
    justifyContent: "center", alignItems: "center",
    shadowColor: "#dc2626", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6, shadowRadius: 18, elevation: 12,
  },
});

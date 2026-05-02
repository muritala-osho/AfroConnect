import logger from '@/utils/logger';
import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  StatusBar,
  Vibration,
  Platform,
  Alert,
  Dimensions,
  BackHandler,
} from "react-native";
import { SafeImage } from "@/components/SafeImage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Audio } from "../utils/expoAvCompat";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import socketService from "@/services/socket";
import agoraService from "@/services/agoraService";
import { ensureMicPermission } from "@/utils/callPermissions";
import { useCallContext, CallStatus } from "@/contexts/CallContext";
import { getApiBaseUrl } from "@/constants/config";
import WebView from "react-native-webview";

const { width: SW } = Dimensions.get("window");
const AVATAR_SIZE = Math.min(SW * 0.42, 170);

/* ─────────────────────────────────────────────────────────────────
   Pulse ring — one animated ring, rendered 3x with staggered delay
───────────────────────────────────────────────────────────────── */
function PulseRing({ anim, size }: { anim: Animated.Value; size: number }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: "#10b981",
        transform: [{ scale: anim }],
        opacity: anim.interpolate({ inputRange: [1, 1.28], outputRange: [0.6, 0] }),
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────
   Audio wave bars — 5 bars that animate when not muted
───────────────────────────────────────────────────────────────── */
function WaveBars({ active }: { active: boolean }) {
  const bars = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(0.3)),
  ).current;

  useEffect(() => {
    if (!active) {
      bars.forEach((b) => b.setValue(0.3));
      return;
    }
    const anims = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 70),
          Animated.timing(bar, { toValue: 1, duration: 320 + i * 50, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.25, duration: 320 + i * 50, useNativeDriver: true }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [active]);

  return (
    <View style={wave.row}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[wave.bar, { transform: [{ scaleY: bar }], opacity: active ? 0.9 : 0.2 }]}
        />
      ))}
    </View>
  );
}
const wave = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, height: 26 },
  bar: { width: 4, height: 22, borderRadius: 3, backgroundColor: "#34d399" },
});

/* ─────────────────────────────────────────────────────────────────
   Control button — circle icon + label
───────────────────────────────────────────────────────────────── */
function CtrlBtn({
  icon,
  label,
  active = false,
  danger = false,
  large = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  danger?: boolean;
  large?: boolean;
  onPress?: () => void;
}) {
  const size = large ? 68 : 56;
  const iconSize = large ? 30 : 24;
  const bg = danger
    ? "#dc2626"
    : active
    ? "#10b981"
    : "rgba(255,255,255,0.12)";

  return (
    <Pressable style={ctrl.wrap} onPress={onPress}>
      <View
        style={[
          ctrl.btn,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: bg,
            shadowColor: danger ? "#dc2626" : active ? "#10b981" : "transparent",
            shadowOpacity: danger || active ? 0.45 : 0,
            shadowRadius: 12,
            elevation: danger || active ? 8 : 0,
          },
        ]}
      >
        <Ionicons name={icon} size={iconSize} color="#fff" />
      </View>
      <Text style={ctrl.label}>{label}</Text>
    </Pressable>
  );
}
const ctrl = StyleSheet.create({
  wrap: { alignItems: "center", gap: 6 },
  btn: { alignItems: "center", justifyContent: "center" },
  label: { fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: "500" },
});

/* ─────────────────────────────────────────────────────────────────
   Main VoiceCallScreen
───────────────────────────────────────────────────────────────── */
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
    callAccepted,
    returnToCall,
  } = route.params || {};

  const { token: authToken, user } = useAuth();
  const { post, get } = useApi();
  const {
    setActiveCall,
    updateCallStatus,
    startGlobalTimer,
    stopGlobalTimer,
    minimizeCall,
    maximizeCall,
    clearCall,
    activeCall,
    setIsOnCallScreen,
  } = useCallContext();

  /* ── State ── */
  const [callStatus, setCallStatus] = useState<CallStatus>(
    callAccepted ? "connected" : "connecting",
  );
  const [activeCallData, setActiveCallData] = useState<any>(incomingCallData || null);
  const [isMuted, setIsMuted] = useState(false);
  /* Speaker is ON by default. Earpiece mode (playThroughEarpieceAndroid:true)
   * forces Android into MODE_IN_CALL, which prevents the WebView WebRTC
   * pipeline from accessing the microphone — both sides go silent. The user
   * can switch to earpiece via the in-call control if they want. */
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [webviewReady, setWebviewReady] = useState(false);
  const webviewReadyRef = useRef(false);

  /* ── Animated values ── */
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const pulseAnim1  = useRef(new Animated.Value(1)).current;
  const pulseAnim2  = useRef(new Animated.Value(1)).current;
  const pulseAnim3  = useRef(new Animated.Value(1)).current;
  const endBtnScale = useRef(new Animated.Value(1)).current;

  /* ── Refs ── */
  const ringtoneRef       = useRef<Audio.Sound | null>(null);
  const shouldRingRef     = useRef(false);
  const ringingTimeout    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webViewRef        = useRef<WebView | null>(null);
  const agoraJoined       = useRef(false);
  const pendingJoinRef    = useRef<object | null>(null);
  const activeCallDataRef = useRef<any>(incomingCallData || null);
  const callStatusRef     = useRef<CallStatus>(callAccepted ? "connected" : "connecting");
  /* Always-current speaker state — avoids stale-closure issues in onMessage */
  const isSpeakerOnRef    = useRef(true);

  const duration = activeCall?.duration || 0;

  /* ── setStatus helper ── */
  const setStatus = useCallback(
    (s: CallStatus) => {
      callStatusRef.current = s;
      setCallStatus(s);
      updateCallStatus(s);
    },
    [updateCallStatus],
  );

  /* ── Stop ringtone ── */
  const stopRingtone = useCallback(async () => {
    shouldRingRef.current = false;
    Vibration.cancel();
    try {
      if (ringtoneRef.current) {
        const snd = ringtoneRef.current;
        ringtoneRef.current = null;
        await snd.stopAsync().catch(() => {});
        await snd.unloadAsync().catch(() => {});
      }
    } catch {}
    /* Reset audio session so mic is available for the call.
     *
     * IMPORTANT: keep `playThroughEarpieceAndroid: false` here. Setting it to
     * true switches the system into MODE_IN_CALL, which prevents the WebView's
     * WebRTC pipeline from accessing the microphone — the AgoraRTC mic track
     * fails silently and BOTH sides go mute after accept. The user can
     * explicitly toggle the speaker via the in-call control which sets the
     * mode for the duration of the toggle. */
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: false,
      });
    } catch {}
  }, []);

  /* ── Play ringtone ── */
  const playRingtone = useCallback(async () => {
    await stopRingtone();
    shouldRingRef.current = true;
    try {
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
        shouldPlay: false,
        isLooping: true,
        volume: 1.0,
      });
      if (!shouldRingRef.current) {
        await sound.unloadAsync().catch(() => {});
        return;
      }
      ringtoneRef.current = sound;
      /* Final guard: stopRingtone may have fired while the sound was being created */
      if (!shouldRingRef.current) {
        ringtoneRef.current = null;
        await sound.stopAsync().catch(() => {});
        await sound.unloadAsync().catch(() => {});
        return;
      }
      await sound.playAsync().catch(() => {});
      if (isIncoming) Vibration.vibrate([500, 1000, 500], true);
    } catch (err) {
      logger.error("Ringtone error:", err);
      if (isIncoming && shouldRingRef.current) Vibration.vibrate([500, 1000, 500], true);
    }
  }, [isIncoming, stopRingtone]);

  /* ── Mic permission (with one-tap Settings shortcut on hard-deny) ── */
  const requestMicPermission = useCallback(async () => {
    return ensureMicPermission();
  }, []);

  /* ── WebView bridge ── */
  const sendToWebView = useCallback((msg: object) => {
    webViewRef.current?.postMessage(JSON.stringify(msg));
  }, []);

  /* ── Join Agora voice ── */
  const joinAgoraVoice = useCallback(
    async (callDataObj: any) => {
      if (agoraJoined.current) return;
      agoraJoined.current = true;

      const hasPerm = await requestMicPermission();
      if (!hasPerm) { agoraJoined.current = false; return; }

      let joinToken = callDataObj.token;
      let joinUid = callDataObj.uid || 0;

      if (isIncoming && authToken) {
        try {
          const res = await get<{ token: string; uid: number }>(
            `/agora/token`,
            { channelName: callDataObj.channelName, uid: 0, role: "publisher" },
            authToken,
          );
          if (res.success && res.data?.token) {
            joinToken = res.data.token;
            joinUid = 0;
          }
        } catch {
          logger.log("Token fallback — using shared token");
        }
      }

      if (Platform.OS === "web") {
        agoraService.joinVoiceCall(callDataObj.appId, callDataObj.channelName, joinToken, joinUid);
        return;
      }

      const msg = {
        action: "join",
        appId: callDataObj.appId,
        channel: callDataObj.channelName,
        token: joinToken,
        uid: joinUid,
        callType: "voice",
      };

      /* Queue the join message so the webviewReady effect can flush it if the
       * WebView hasn't loaded yet. If the WebView is already ready, send
       * immediately using webviewReadyRef — a plain ref that is always current
       * regardless of when this callback closure was captured. This prevents a
       * stale-closure bug: socket handlers (onCallAccepted etc.) are registered
       * once on mount and capture the initial joinAgoraVoice; by the time the
       * remote side accepts, the WebView has already loaded but the stale
       * closure still sees webviewReady===false and silently drops the message. */
      pendingJoinRef.current = msg;
      if (webviewReadyRef.current && webViewRef.current) {
        webViewRef.current.postMessage(JSON.stringify(msg));
        pendingJoinRef.current = null;
      }
    },
    [isIncoming, authToken, get, requestMicPermission],
  );

  /* ── End call ── */
  const handleEndCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const wasConnected = callStatusRef.current === "connected";
    const dur = activeCall?.duration || 0;
    setStatus("ended");
    await stopRingtone();
    stopGlobalTimer();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    if (Platform.OS === "web") agoraService.leave();
    else sendToWebView({ action: "leave" });
    socketService.endCall({
      targetUserId: isIncoming ? callerId : userId,
      callType: "voice",
      duration: dur,
      wasAnswered: wasConnected,
    });
    clearCall();
    setTimeout(() => navigation.canGoBack() && navigation.goBack(), 600);
  }, [callerId, userId, isIncoming, stopRingtone, sendToWebView, clearCall, navigation, setStatus, activeCall, stopGlobalTimer]);

  /* ── Minimize ── */
  const handleMinimize = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    minimizeCall();
    if (navigation.canGoBack()) navigation.goBack();
  }, [minimizeCall, navigation]);

  /* ── Accept incoming ── */
  const handleAccept = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await stopRingtone();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    socketService.acceptCall({ callerId, callData: activeCallData });
    setStatus("connected");
    startGlobalTimer();
    if (activeCallData) joinAgoraVoice(activeCallData);
  }, [callerId, activeCallData, stopRingtone, joinAgoraVoice, startGlobalTimer, setStatus]);

  /* ── Decline incoming ── */
  const handleDecline = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await stopRingtone();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    socketService.declineCall({ callerId, callType: "voice" });
    if (authToken && isIncoming) {
      post("/call/decline", { callerId, type: "audio" }, authToken).catch(() => {});
    }
    setStatus("declined");
    clearCall();
    setTimeout(() => navigation.canGoBack() && navigation.goBack(), 900);
  }, [callerId, isIncoming, authToken, post, stopRingtone, clearCall, navigation, setStatus]);

  /* ── Unified back press handler (UI button + Android hardware back) ── */
  const handleBackPress = useCallback(() => {
    const status = callStatusRef.current;
    if (status === "connected") {
      handleMinimize();
    } else if (isIncoming && status === "ringing") {
      handleDecline();
    } else if (["ended", "declined", "missed", "failed", "busy"].includes(status)) {
      clearCall();
      if (navigation.canGoBack()) navigation.goBack();
    } else {
      handleEndCall();
    }
    return true;
  }, [isIncoming, handleMinimize, handleDecline, handleEndCall, clearCall, navigation]);

  /* ── Android hardware back button ── */
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
      return () => sub.remove();
    }, [handleBackPress])
  );

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
    isSpeakerOnRef.current = next;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: !next,
      });
    } catch (e) {
      logger.log("Speaker error:", e);
    }
    if (Platform.OS !== "web") sendToWebView({ action: "speaker", on: next });
  }, [isSpeakerOn, sendToWebView]);

  /* ── Initiate outgoing call ── */
  const initiateCall = useCallback(async () => {
    if (!authToken || !userId) return setStatus("failed");
    const hasPerm = await requestMicPermission();
    if (!hasPerm) { setStatus("failed"); return; }

    try {
      const response = await post<any>(
        "/agora/call/initiate",
        { targetUserId: userId, callType: "voice" },
        authToken,
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

  /* ── Setup effect ── */
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    /* Tell the FloatingCallBar we are on a call screen — hide it */
    setIsOnCallScreen(true);
    maximizeCall();

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
      setStatus("connected");
      startGlobalTimer();
      if (activeCallDataRef.current)
        joinAgoraVoice(activeCallDataRef.current);
    } else if (returnToCall) {
      setStatus("connected");
    } else if (isIncoming) {
      setStatus("ringing");
      /* Auto-decline if not answered within 60 seconds */
      ringingTimeout.current = setTimeout(async () => {
        if (callStatusRef.current === "ringing") {
          await stopRingtone();
          socketService.declineCall({ callerId, callType: "voice" });
          setStatus("missed");
          clearCall();
          setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1500);
        }
      }, 60000);
    } else {
      initiateCall();
    }

    socketService.onCallAccepted(async () => {
      await stopRingtone();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setStatus("connected");
      startGlobalTimer();
      if (activeCallDataRef.current) joinAgoraVoice(activeCallDataRef.current);
    });
    socketService.onCallDeclined(async () => {
      await stopRingtone();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setStatus("declined");
      clearCall();
      setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1500);
    });
    socketService.onCallBusy(async () => {
      await stopRingtone();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setStatus("busy");
      clearCall();
      setTimeout(() => navigation.canGoBack() && navigation.goBack(), 2000);
    });
    /* Cold-start armor: when the user accepts a voice call from a push
     * notification while the app was killed, the original caller's
     * pending-call may have already expired by the time we cold-launch.
     * The backend then bounces a `call:ended` to us — which used to
     * dismiss the screen the moment it mounted. Give the WebView + Agora
     * join pipeline a brief window before honouring `call:ended`. */
    const coldStartAccept = !!callAccepted;
    const acceptArmedAt = Date.now();
    socketService.onCallEnded(async () => {
      const withinGrace = coldStartAccept && Date.now() - acceptArmedAt < 8000;
      if (withinGrace && !agoraJoined.current) {
        logger.log("[VoiceCall] Ignoring stale call:ended during cold-start join window");
        return;
      }
      await stopRingtone();
      if (Platform.OS === "web") agoraService.leave();
      else sendToWebView({ action: "leave" });
      setStatus("ended");
      stopGlobalTimer();
      clearCall();
      setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1200);
    });

    return () => {
      setIsOnCallScreen(false);
      stopRingtone();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      socketService.off("call:accepted");
      socketService.off("call:declined");
      socketService.off("call:busy");
      socketService.off("call:ended");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Ringtone on status change ── */
  useEffect(() => {
    if (callStatus === "ringing") playRingtone();
    else stopRingtone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus]);

  /* ── Set audio mode for active call (enables AEC to prevent echo) ── */
  useEffect(() => {
    if (callStatus !== "connected") return;
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      playThroughEarpieceAndroid: !isSpeakerOn,
    }).catch(() => {});
    // Sync the WebView's speaker routing with the current isSpeakerOn state so
    // audio routes correctly from the moment the call connects (default: earpiece).
    if (Platform.OS !== "web") {
      sendToWebView({ action: "speaker", on: isSpeakerOn });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus]);

  /* ── Pulse rings animation ── */
  useEffect(() => {
    if (callStatus === "ringing" || callStatus === "connecting") {
      const loop = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1.3, duration: 950, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 1, duration: 950, useNativeDriver: true }),
          ]),
        );
      const l1 = loop(pulseAnim1, 0);
      const l2 = loop(pulseAnim2, 320);
      const l3 = loop(pulseAnim3, 640);
      l1.start(); l2.start(); l3.start();
      return () => { l1.stop(); l2.stop(); l3.stop(); };
    } else {
      pulseAnim1.setValue(1);
      pulseAnim2.setValue(1);
      pulseAnim3.setValue(1);
    }
  }, [callStatus]);

  /* ── WebView ready → flush pending join or join if already connected ── */
  useEffect(() => {
    if (!webviewReady) return;
    /* Flush any join message that was queued before WebView finished loading */
    if (pendingJoinRef.current) {
      webViewRef.current?.postMessage(JSON.stringify(pendingJoinRef.current));
      pendingJoinRef.current = null;
      return;
    }
    /* Handle case where call was already accepted before the screen mounted */
    if ((callStatus === "connected" || callAccepted) && activeCallDataRef.current && !agoraJoined.current) {
      joinAgoraVoice(activeCallDataRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webviewReady]);

  /* ── Free-tier 5-min limit ── */
  useEffect(() => {
    if (user?.premium?.isActive || callStatus !== "connected") return;
    if (duration === 240) {
      Alert.alert(
        "1 Minute Remaining",
        "Free calls are limited to 5 minutes. Upgrade to Premium for unlimited calls.",
        [{ text: "OK" }],
      );
    }
    if (duration >= 300) handleEndCall();
  }, [duration, callStatus, user, handleEndCall]);

  /* ── Derived state ── */
  const isConnected  = callStatus === "connected";
  const isTerminal   = ["ended", "declined", "missed", "failed", "busy"].includes(callStatus);
  const isWaiting    = !isIncoming && callStatus === "ringing";
  const showIncoming = isIncoming && callStatus === "ringing";
  const showCancel   = callStatus === "connecting" || isWaiting;
  const agoraUrl     = `${getApiBaseUrl()}/public/agora-call.html`;

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const statusText = (): string => {
    switch (callStatus) {
      case "connecting": return "Connecting…";
      case "ringing":    return isIncoming ? "Incoming voice call" : "Ringing…";
      case "connected":  return "Connected";
      case "ended":      return "Call ended";
      case "declined":   return "Call declined";
      case "busy":       return "User is busy";
      case "missed":     return "No answer";
      case "failed":     return "Call failed";
      default:           return "";
    }
  };

  const terminalMsg = (): string => {
    if (callStatus === "busy")    return "User is in another call";
    if (callStatus === "declined") return "Call was declined";
    if (callStatus === "missed")   return "No answer";
    return "Unable to connect";
  };

  /* ── Render ── */
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background gradient */}
      <LinearGradient
        colors={["#030d08", "#051a0f", "#062517", "#07301e"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Subtle photo tint when connected */}
      {userPhoto && isConnected && (
        <SafeImage
          source={{ uri: userPhoto }}
          style={[StyleSheet.absoluteFillObject as any, { opacity: 0.06 }]}
          blurRadius={Platform.OS === "ios" ? 80 : 20}
        />
      )}

      {/* Hidden Agora WebView — loads from HTTPS backend for getUserMedia permission */}
      {Platform.OS !== "web" && (
        <WebView
          ref={webViewRef}
          source={{ uri: agoraUrl }}
          /* A small transparent webview keeps the WebRTC media pipeline alive
           * on Android — a 0×0 view can have its layer skipped by the
           * compositor, silently muting audio. 4×4 is safely non-zero but
           * invisible via opacity:0. */
          style={{ width: 4, height: 4, position: "absolute", opacity: 0, top: 0, left: 0 }}
          originWhitelist={["*"]}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          mixedContentMode="always"
          javaScriptEnabled
          domStorageEnabled
          /* Android: WebView denies getUserMedia by default. Without this the
           * mic is never granted, so AgoraRTC.createMicrophoneAudioTrack()
           * fails silently and neither side hears anything. Grant exactly
           * what the page is asking for (mic for voice, mic+camera for video). */
          onPermissionRequest={(event: any) => {
            try {
              event?.nativeEvent?.grant?.(event.nativeEvent.resources);
            } catch {}
          }}
          onLoad={() => { webviewReadyRef.current = true; setWebviewReady(true); }}
          onLoadEnd={() => { webviewReadyRef.current = true; setWebviewReady(true); }}
          onMessage={(e) => {
            try {
              const d = JSON.parse(e.nativeEvent.data);
              if (d.type === "sdk-ready") logger.log("Voice: Agora SDK ready");
              if (d.type === "joined") logger.log("Voice joined:", d.uid);
              if (d.type === "remote-user-joined") {
                logger.log("Voice: remote audio started, uid:", d.uid);
                /* Re-apply audio routing now that the remote track is live.
                 * The earlier sendToWebView({ action: "speaker" }) fires when
                 * callStatus becomes "connected", but at that moment
                 * client.remoteUsers is still empty so setSpeaker is a no-op.
                 * This second pass (triggered by the track appearing) is what
                 * actually routes audio to the speaker on Android. */
                Audio.setAudioModeAsync({
                  allowsRecordingIOS: true,
                  playsInSilentModeIOS: true,
                  staysActiveInBackground: true,
                  playThroughEarpieceAndroid: !isSpeakerOnRef.current,
                }).catch(() => {});
                sendToWebView({ action: "speaker", on: isSpeakerOnRef.current });
              }
              if (d.type === "remote-user-left") {
                if (callStatusRef.current === "connected") handleEndCall();
              }
              if (d.type === "connectionState") logger.log("Voice connection state:", d.state);
              if (d.type === "error") logger.warn("Voice WebView error:", d.message);
            } catch {}
          }}
        />
      )}

      {/* ── FULL-SCREEN OVERLAY (absolute fill — immune to nav height issues) ── */}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]}>

        {/* ── BACK / MINIMIZE button — top-left only, no title bar ── */}
        <Pressable
          style={[s.backBtn, { top: insets.top + 12 }]}
          hitSlop={16}
          onPress={handleBackPress}
        >
          <Ionicons
            name={isConnected ? "chevron-down" : "arrow-back"}
            size={22}
            color="#fff"
          />
        </Pressable>

        {/* ── NAME + STATUS — top-center header area ── */}
        <View style={[s.topNameBlock, { top: insets.top + 12 }]}>
          <Text style={s.callerName} numberOfLines={1}>{userName || "Unknown"}</Text>
          <Text style={[s.statusText, isConnected && s.statusConnected, isTerminal && s.statusError]}>
            {statusText()}
          </Text>
          {(callStatus === "ringing" || callStatus === "connecting") && (
            <View style={s.e2eBadge}>
              <Ionicons name="lock-closed" size={10} color="#34d399" />
              <Text style={s.e2eText}>End-to-end encrypted</Text>
            </View>
          )}
        </View>

        {/* ── AVATAR — centered in the middle ── */}
        <View style={s.avatarCenter}>
          <View style={s.avatarRing}>
            {userPhoto ? (
              <SafeImage
                source={{ uri: userPhoto }}
                style={s.avatar}
                contentFit="cover"
              />
            ) : (
              <LinearGradient colors={["#059669", "#10b981", "#34d399"]} style={s.avatar}>
                <Text style={s.avatarInitial}>{(userName || "?").charAt(0).toUpperCase()}</Text>
              </LinearGradient>
            )}
          </View>

          {isConnected && (
            <View style={s.liveRow}>
              <View style={s.liveDot} />
              <WaveBars active={!isMuted} />
            </View>
          )}

          {isConnected && isMuted && (
            <View style={s.mutedBadge}>
              <Ionicons name="mic-off" size={12} color="#fff" />
              <Text style={s.mutedText}>Muted</Text>
            </View>
          )}

          {isTerminal && callStatus !== "ended" && (
            <View style={s.errorPill}>
              <Ionicons name="close-circle" size={14} color="#f87171" />
              <Text style={s.errorText}>{terminalMsg()}</Text>
            </View>
          )}
        </View>

        {/* ── CONTROLS — pinned to the bottom ── */}
        <View style={[s.controlsPanel, { paddingBottom: insets.bottom + 28 }]}>
          <View style={s.glass}>

            {showIncoming && (
              <View style={s.btnRow}>
                <CtrlBtn icon="call" label="Decline" danger onPress={handleDecline} />
                <View style={s.acceptWrap}>
                  <Pressable style={s.acceptBtn} onPress={handleAccept}>
                    <Ionicons name="call" size={30} color="#fff" />
                  </Pressable>
                  <Text style={ctrl.label}>Accept</Text>
                </View>
              </View>
            )}

            {isConnected && (
              <View style={s.btnRow}>
                <CtrlBtn
                  icon={isMuted ? "mic-off" : "mic"}
                  label={isMuted ? "Unmute" : "Mute"}
                  active={isMuted}
                  onPress={toggleMute}
                />
                <CtrlBtn
                  icon={isSpeakerOn ? "volume-high" : "volume-mute"}
                  label="Speaker"
                  active={isSpeakerOn}
                  onPress={toggleSpeaker}
                />
                <CtrlBtn
                  icon="bluetooth"
                  label="Bluetooth"
                  onPress={() =>
                    Alert.alert(
                      "Bluetooth Audio",
                      "Connect a Bluetooth headset and audio will automatically route to it. Manage devices in your phone's Bluetooth settings.",
                      [{ text: "OK" }],
                    )
                  }
                />
              </View>
            )}

            {showCancel && (
              <View style={s.btnRow}>
                <CtrlBtn
                  icon={isSpeakerOn ? "volume-high" : "volume-mute"}
                  label="Speaker"
                  active={isSpeakerOn}
                  onPress={toggleSpeaker}
                />
              </View>
            )}

            {isTerminal && (
              <View style={s.btnRow}>
                <CtrlBtn
                  icon="close"
                  label="Close"
                  onPress={() => { clearCall(); navigation.canGoBack() && navigation.goBack(); }}
                />
              </View>
            )}

            {(isConnected || showCancel) && (
              <View style={s.endRow}>
                <Animated.View style={{ transform: [{ scale: endBtnScale }] }}>
                  <Pressable
                    style={s.endBtn}
                    onPress={handleEndCall}
                    onPressIn={() =>
                      Animated.spring(endBtnScale, { toValue: 0.88, useNativeDriver: true, tension: 220, friction: 8 }).start()
                    }
                    onPressOut={() =>
                      Animated.spring(endBtnScale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 8 }).start()
                    }
                  >
                    <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
                  </Pressable>
                </Animated.View>
                <Text style={s.endLabel}>End Call</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Styles
───────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#030d08" },

  /* Back / minimize button — top-left, no title bar */
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 20,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.30)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Name + status pinned at the top-center, below the back button */
  topNameBlock: {
    position: "absolute",
    left: 60,
    right: 60,
    alignItems: "center",
    zIndex: 10,
  },

  /* Avatar center — fills screen minus header/controls, avatar only */
  avatarCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 140,    /* clear the top name block */
    paddingBottom: 220, /* clear the controls panel */
  },
  avatarRing: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "rgba(52,211,153,0.55)",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 28,
    elevation: 18,
  },
  avatar: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  avatarInitial: {
    fontSize: AVATAR_SIZE * 0.38,
    fontWeight: "800",
    color: "#fff",
  },

  callerName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  statusText: {
    marginTop: 5,
    fontSize: 15,
    color: "rgba(255,255,255,0.50)",
    fontWeight: "500",
    textAlign: "center",
  },
  statusConnected: { color: "#34d399", fontVariant: ["tabular-nums"], letterSpacing: 1.5 },
  statusError:     { color: "#f87171" },

  e2eBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(52,211,153,0.10)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.25)",
  },
  e2eText: { fontSize: 11, color: "rgba(52,211,153,0.80)", fontWeight: "500" },

  liveRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#34d399" },

  mutedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "rgba(239,68,68,0.20)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.40)",
  },
  mutedText: { fontSize: 11, color: "#fca5a5", fontWeight: "600" },

  errorPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(248,113,113,0.10)",
    borderWidth: 1,
    borderColor: "rgba(248,113,113,0.25)",
  },
  errorText: { fontSize: 13, color: "#f87171", fontWeight: "500" },

  /* Controls panel — absolutely pinned to the bottom */
  controlsPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  glass: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  btnRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
    marginBottom: 20,
  },

  /* Accept button (large green) */
  acceptWrap: { alignItems: "center", gap: 6 },
  acceptBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },

  /* End call button */
  endRow: { alignItems: "center", gap: 6 },
  endBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 12,
  },
  endLabel: { fontSize: 12, color: "rgba(255,255,255,0.40)", textAlign: "center" },
});

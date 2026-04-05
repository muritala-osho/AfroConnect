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
  Dimensions,
} from "react-native";
import { SafeImage } from "@/components/SafeImage";
import { ThemedText } from "@/components/ThemedText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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

const { width: SW } = Dimensions.get("window");

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Audio wave bars â€” shown when call is live
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
    <View style={wav.row}>
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={[
            wav.bar,
            { transform: [{ scaleY: bar }], opacity: isMuted ? 0.2 : 0.9 },
          ]}
        />
      ))}
    </View>
  );
}
const wav = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, height: 28 },
  bar: { width: 4, height: 24, borderRadius: 3, backgroundColor: "#a78bfa" },
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Main VoiceCallScreen
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
    clearCall,
    activeCall,
  } = useCallContext();

  /* â”€â”€ State â”€â”€ */
  const [callStatus, setCallStatus] = useState<CallStatus>(
    callAccepted ? "connected" : "connecting"
  );
  const [activeCallData, setActiveCallData] = useState<any>(incomingCallData || null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [webviewReady, setWebviewReady] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  /* â”€â”€ Animated values â”€â”€ */
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const pulseAnim3 = useRef(new Animated.Value(1)).current;
  const endBtnScale = useRef(new Animated.Value(1)).current;

  /* â”€â”€ Refs â”€â”€ */
  const ringtoneRef        = useRef<Audio.Sound | null>(null);
  const shouldRingRef      = useRef(false);
  const ringingTimeout     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webViewRef         = useRef<WebView | null>(null);
  const agoraJoined        = useRef(false);
  const activeCallDataRef  = useRef<any>(incomingCallData || null);
  const callStatusRef      = useRef<CallStatus>(callAccepted ? "connected" : "connecting");

  /* â”€â”€ Derived â”€â”€ */
  const duration = activeCall?.duration || 0;

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const setStatus = useCallback((s: CallStatus) => {
    callStatusRef.current = s;
    setCallStatus(s);
    updateCallStatus(s);
  }, [updateCallStatus]);

  const stopRingtone = useCallback(async () => {
    shouldRingRef.current = false;
    try {
      if (ringtoneRef.current) {
        const s = ringtoneRef.current;
        ringtoneRef.current = null;
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      }
      Vibration.cancel();
    } catch {}
  }, []);

  const playRingtone = useCallback(async () => {
    shouldRingRef.current = true;
    try {
      await stopRingtone();
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
  }, [isIncoming, stopRingtone]);

  /* â”€â”€ Microphone permission â”€â”€ */
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

  /* â”€â”€ WebView bridge â”€â”€ */
  const sendToWebView = useCallback((msg: any) => {
    webViewRef.current?.postMessage(JSON.stringify(msg));
  }, []);

  /* â”€â”€ Agora join â”€â”€ */
  const joinAgoraVoice = useCallback(async (callDataObj: any) => {
    if (agoraJoined.current) return;
    agoraJoined.current = true;

    const hasPerm = await requestMicPermission();
    if (!hasPerm) return;

    let joinToken = callDataObj.token;
    let joinUid   = callDataObj.uid || 0;

    // Incoming callee fetches their own Agora token
    if (isIncoming && authToken) {
      try {
        const res = await get<{ token: string; uid: number }>(
          `/agora/token`,
          { channelName: callDataObj.channelName, uid: 0, role: "publisher" },
          authToken
        );
        if (res.success && res.data?.token) {
          joinToken = res.data.token;
          joinUid   = 0;
        }
      } catch {
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

  /* â”€â”€ End call â”€â”€ */
  const handleEndCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const wasConnected  = callStatusRef.current === "connected";
    const currentDuration = activeCall?.duration || 0;
    setStatus("ended");
    await stopRingtone();
    stopGlobalTimer();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);

    if (Platform.OS === "web") agoraService.leave();
    else sendToWebView({ action: "leave" });

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
  }, [callerId, userId, isIncoming, stopRingtone, sendToWebView, clearCall, navigation, setStatus, activeCall, stopGlobalTimer]);

  /* â”€â”€ Minimize (keep call alive, leave screen) â”€â”€ */
  const handleMinimize = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    minimizeCall();
    if (navigation.canGoBack()) navigation.goBack();
  }, [minimizeCall, navigation]);

  /* â”€â”€ Accept incoming â”€â”€ */
  const handleAccept = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await stopRingtone();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    socketService.acceptCall({ callerId, callData: activeCallData });
    setStatus("connected");
    startGlobalTimer();
    if (activeCallData) joinAgoraVoice(activeCallData);
  }, [callerId, activeCallData, stopRingtone, joinAgoraVoice, startGlobalTimer, setStatus]);

  /* â”€â”€ Decline incoming â”€â”€ */
  const handleDecline = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await stopRingtone();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    socketService.declineCall({ callerId, callType: "audio" });
    if (authToken && isIncoming) {
      post("/call/decline", { callerId, type: "audio" }, authToken).catch(() => {});
    }
    setStatus("declined");
    clearCall();
    setTimeout(() => navigation.canGoBack() && navigation.goBack(), 900);
  }, [callerId, isIncoming, authToken, post, stopRingtone, clearCall, navigation, setStatus]);

  /* â”€â”€ Toggle mute â”€â”€ */
  const toggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted((prev) => {
      const next = !prev;
      if (Platform.OS === "web") agoraService.toggleMute(next);
      else sendToWebView({ action: "mute", muted: next });
      return next;
    });
  }, [sendToWebView]);

  /* â”€â”€ Toggle speaker â”€â”€ */
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

  /* â”€â”€ Initiate outgoing call â”€â”€ */
  const initiateCall = useCallback(async () => {
    if (!authToken || !userId) return setStatus("failed");

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

        // 30-second timeout â†’ missed
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

  /* â”€â”€ Main setup effect â”€â”€ */
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

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
      if (activeCallDataRef.current && Platform.OS === "web") {
        joinAgoraVoice(activeCallDataRef.current);
      }
    } else if (returnToCall) {
      setStatus("connected");
    } else if (isIncoming) {
      setStatus("ringing");
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

    socketService.onCallEnded(async () => {
      await stopRingtone();
      if (Platform.OS === "web") agoraService.leave();
      else sendToWebView({ action: "leave" });
      setStatus("ended");
      stopGlobalTimer();
      clearCall();
      setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1200);
    });

    return () => {
      stopRingtone();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      socketService.off("call:accepted");
      socketService.off("call:declined");
      socketService.off("call:busy");
      socketService.off("call:ended");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* â”€â”€ Ringtone on status change â”€â”€ */
  useEffect(() => {
    if (callStatus === "ringing") playRingtone();
    else stopRingtone();
  }, [callStatus]);

  /* â”€â”€ Pulse animation for ringing / connecting â”€â”€ */
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

  /* â”€â”€ WebView ready: join Agora on native â”€â”€ */
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

  /* â”€â”€ 5-min free-tier limit â”€â”€ */
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

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const getStatusText = (): string => {
    switch (callStatus) {
      case "connecting": return "Connectingâ€¦";
      case "ringing":    return isIncoming ? "Incoming voice call" : "Ringingâ€¦";
      case "connected":  return formatDuration(duration);
      case "ended":      return "Call ended";
      case "declined":   return "Call declined";
      case "busy":       return "User is busy";
      case "missed":     return "No answer";
      case "failed":     return "Call failed";
      default:           return "";
    }
  };

  const isTerminal         = ["ended", "declined", "missed", "failed", "busy"].includes(callStatus);
  const isWaiting          = !isIncoming && callStatus === "ringing";
  const isConnected        = callStatus === "connected";
  const showIncoming       = isIncoming && callStatus === "ringing";
  const showCancelBtn      = callStatus === "connecting" || isWaiting;
  const agoraCallUrl       = `${getApiBaseUrl()}/public/agora-call.html`;

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full-screen blurred avatar background */}
      <SafeImage
        source={{ uri: userPhoto || "https://via.placeholder.com/400" }}
        style={StyleSheet.absoluteFillObject as any}
        blurRadius={Platform.OS === "ios" ? 60 : 18}
      />
      {/* Dark purple overlay â€” gives the whole screen a cohesive tint */}
      <LinearGradient
        colors={["rgba(10,4,30,0.90)", "rgba(30,8,60,0.78)", "rgba(10,4,30,0.96)"]}
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
              if (data.type === "joined") console.log("Voice WebView joined:", data.uid);
              if (data.type === "error")  console.log("Voice WebView error:", data.message);
            } catch {}
          }}
        />
      )}

      <Animated.View style={[s.screen, { opacity: fadeAnim }]}>

        {/* â”€â”€ TOP BAR â”€â”€ */}
        <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
          {/* Minimize button â€” only shown when connected */}
          {isConnected ? (
            <Pressable style={s.topIconBtn} onPress={handleMinimize} hitSlop={12}>
              <Ionicons name="chevron-down" size={22} color="rgba(255,255,255,0.85)" />
            </Pressable>
          ) : (
            <View style={s.topIconPlaceholder} />
          )}

          {/* Call type label */}
          <View style={s.callTypePill}>
            <Ionicons name="call" size={11} color="#c4b5fd" />
            <ThemedText style={s.callTypePillText}>Voice Call</ThemedText>
          </View>

          <View style={s.topIconPlaceholder} />
        </View>

        {/* â”€â”€ CALLER INFO SECTION â”€â”€ */}
        <View style={s.callerSection}>
          {/* Avatar with animated pulse rings */}
          <View style={s.avatarArea}>
            {(callStatus === "ringing" || callStatus === "connecting") && (
              <>
                <Animated.View style={[s.ring3, { transform: [{ scale: pulseAnim3 }] }]} />
                <Animated.View style={[s.ring2, { transform: [{ scale: pulseAnim2 }] }]} />
                <Animated.View style={[s.ring1, { transform: [{ scale: pulseAnim  }] }]} />
              </>
            )}

            {/* Muted indicator ring */}
            {isConnected && isMuted && <View style={s.mutedRing} />}

            {/* Avatar frame â€” border changes color with call state */}
            <View style={[
              s.avatarFrame,
              isConnected  && s.avatarFrameConnected,
              isConnected && isMuted && s.avatarFrameMuted,
              isTerminal   && s.avatarFrameTerminal,
            ]}>
              <SafeImage
                source={{ uri: userPhoto || "https://via.placeholder.com/150" }}
                style={s.avatar}
              />
            </View>

            {/* Muted badge below avatar */}
            {isConnected && isMuted && (
              <View style={s.mutedBadge}>
                <Ionicons name="mic-off" size={12} color="#fff" />
                <ThemedText style={s.mutedBadgeText}>Muted</ThemedText>
              </View>
            )}
          </View>

          {/* Name */}
          <ThemedText style={s.callerName} numberOfLines={1}>
            {userName || "Unknown"}
          </ThemedText>

          {/* Status / timer */}
          <ThemedText style={[s.statusText, isTerminal && s.statusTextError]}>
            {getStatusText()}
          </ThemedText>

          {/* Audio wave + "Connected" indicator */}
          {isConnected && (
            <View style={s.connectedRow}>
              <View style={s.liveGreenDot} />
              <ThemedText style={s.liveText}>Connected</ThemedText>
              <AudioWaveBars isMuted={isMuted} />
            </View>
          )}

          {/* Encryption badge â€” shown while waiting */}
          {(callStatus === "ringing" || callStatus === "connecting") && (
            <View style={s.encryptBadge}>
              <Ionicons name="lock-closed" size={10} color="rgba(196,181,253,0.75)" />
              <ThemedText style={s.encryptText}>End-to-end encrypted</ThemedText>
            </View>
          )}

          {/* Error pill â€” terminal states */}
          {isTerminal && callStatus !== "ended" && (
            <View style={s.errorPill}>
              <Ionicons name="close-circle" size={14} color="#f87171" />
              <ThemedText style={s.errorPillText}>
                {callStatus === "busy"     ? "User is in another call"
                : callStatus === "declined"? "Call was declined"
                : callStatus === "missed"  ? "No answer"
                :                            "Unable to connect"}
              </ThemedText>
            </View>
          )}
        </View>

        {/* â”€â”€ BOTTOM CONTROLS â”€â”€ */}
        <View style={[s.bottomArea, { paddingBottom: insets.bottom + 36 }]}>

          {/* â”€ INCOMING CALL: Accept / Decline â”€ */}
          {showIncoming && (
            <View style={s.incomingRow}>
              <View style={s.incomingAction}>
                <Pressable
                  style={[s.callActionBtn, s.declineBtn]}
                  onPress={handleDecline}
                  android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true, radius: 38 }}
                >
                  <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                </Pressable>
                <ThemedText style={s.actionLabel}>Decline</ThemedText>
              </View>

              <View style={s.incomingAction}>
                <Pressable
                  style={[s.callActionBtn, s.acceptBtn]}
                  onPress={handleAccept}
                  android_ripple={{ color: "rgba(255,255,255,0.15)", borderless: true, radius: 38 }}
                >
                  <Ionicons name="call" size={30} color="#FFF" />
                </Pressable>
                <ThemedText style={s.actionLabel}>Accept</ThemedText>
              </View>
            </View>
          )}

          {/* â”€ CONNECTED: Mute / Speaker / End â”€ */}
          {isConnected && (
            <View style={s.connectedPanel}>
              {/* Secondary controls row */}
              <View style={s.controlsRow}>
                {/* Mute */}
                <View style={s.controlItem}>
                  <Pressable
                    style={[s.controlBtn, isMuted && s.controlBtnActive]}
                    onPress={toggleMute}
                  >
                    <Ionicons
                      name={isMuted ? "mic-off" : "mic"}
                      size={22}
                      color={isMuted ? "#0f0a2e" : "#FFF"}
                    />
                  </Pressable>
                  <ThemedText style={s.controlLabel}>{isMuted ? "Unmute" : "Mute"}</ThemedText>
                </View>

                {/* Speaker */}
                <View style={s.controlItem}>
                  <Pressable
                    style={[s.controlBtn, isSpeakerOn && s.controlBtnActive]}
                    onPress={toggleSpeaker}
                  >
                    <Ionicons
                      name={isSpeakerOn ? "volume-high" : "ear"}
                      size={22}
                      color={isSpeakerOn ? "#0f0a2e" : "#FFF"}
                    />
                  </Pressable>
                  <ThemedText style={s.controlLabel}>{isSpeakerOn ? "Earpiece" : "Speaker"}</ThemedText>
                </View>

                {/* Keypad (disabled placeholder) */}
                <View style={[s.controlItem, { opacity: 0.3 }]}>
                  <View style={s.controlBtn}>
                    <Ionicons name="keypad" size={22} color="#FFF" />
                  </View>
                  <ThemedText style={s.controlLabel}>Keypad</ThemedText>
                </View>
              </View>

              {/* End Call button */}
              <Animated.View style={{ transform: [{ scale: endBtnScale }] }}>
                <Pressable
                  style={s.endCallBtn}
                  onPress={handleEndCall}
                  onPressIn={() =>
                    Animated.spring(endBtnScale, { toValue: 0.9, useNativeDriver: true, tension: 220, friction: 8 }).start()
                  }
                  onPressOut={() =>
                    Animated.spring(endBtnScale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 8 }).start()
                  }
                  android_ripple={{ color: "rgba(255,255,255,0.2)", borderless: true, radius: 40 }}
                >
                  <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                </Pressable>
              </Animated.View>
              <ThemedText style={s.actionLabel}>End Call</ThemedText>
            </View>
          )}

          {/* â”€ OUTGOING RINGING / CONNECTING: Cancel â”€ */}
          {showCancelBtn && (
            <View style={s.cancelArea}>
              <Pressable style={[s.callActionBtn, s.declineBtn]} onPress={handleEndCall}>
                <Ionicons name="call" size={30} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
              </Pressable>
              <ThemedText style={s.actionLabel}>Cancel</ThemedText>
            </View>
          )}

          {/* â”€ TERMINAL: Close â”€ */}
          {isTerminal && (
            <View style={s.cancelArea}>
              <Pressable
                style={[s.callActionBtn, s.closeBtn]}
                onPress={() => { clearCall(); navigation.canGoBack() && navigation.goBack(); }}
              >
                <Ionicons name="close" size={30} color="#FFF" />
              </Pressable>
              <ThemedText style={s.actionLabel}>Close</ThemedText>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Styles
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const AVATAR_SIZE = Math.min(SW * 0.44, 186);

const s = StyleSheet.create({
  root:   { flex: 1 },
  screen: { flex: 1 },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  topIconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  topIconPlaceholder: { width: 42 },
  callTypePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 18, paddingVertical: 9,
    borderRadius: 24,
    backgroundColor: "rgba(109,40,217,0.22)",
    borderWidth: 1, borderColor: "rgba(196,181,253,0.3)",
  },
  callTypePillText: {
    fontSize: 12, color: "#c4b5fd", fontWeight: "700", letterSpacing: 0.4,
  },

  /* Caller section â€” fills the flex space */
  callerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },

  /* Avatar + pulse rings */
  avatarArea: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  ring3: {
    position: "absolute",
    width: AVATAR_SIZE + 110, height: AVATAR_SIZE + 110,
    borderRadius: (AVATAR_SIZE + 110) / 2,
    backgroundColor: "rgba(109,40,217,0.06)",
    borderWidth: 1, borderColor: "rgba(196,181,253,0.08)",
  },
  ring2: {
    position: "absolute",
    width: AVATAR_SIZE + 70, height: AVATAR_SIZE + 70,
    borderRadius: (AVATAR_SIZE + 70) / 2,
    backgroundColor: "rgba(109,40,217,0.10)",
    borderWidth: 1, borderColor: "rgba(196,181,253,0.16)",
  },
  ring1: {
    position: "absolute",
    width: AVATAR_SIZE + 36, height: AVATAR_SIZE + 36,
    borderRadius: (AVATAR_SIZE + 36) / 2,
    backgroundColor: "rgba(109,40,217,0.16)",
    borderWidth: 1.5, borderColor: "rgba(196,181,253,0.28)",
  },
  mutedRing: {
    position: "absolute",
    width: AVATAR_SIZE + 12, height: AVATAR_SIZE + 12,
    borderRadius: (AVATAR_SIZE + 12) / 2,
    borderWidth: 2.5, borderColor: "rgba(239,68,68,0.6)",
  },
  avatarFrame: {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
    borderWidth: 3, borderColor: "rgba(196,181,253,0.5)",
    shadowColor: "#7c3aed", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 28, elevation: 18,
  },
  avatarFrameConnected: {
    borderColor: "rgba(16,185,129,0.7)",
    shadowColor: "#10B981",
  },
  avatarFrameMuted: {
    borderColor: "rgba(239,68,68,0.6)",
    shadowColor: "#ef4444",
  },
  avatarFrameTerminal: {
    borderColor: "rgba(255,255,255,0.18)",
    shadowOpacity: 0.2,
  },
  avatar: { width: "100%", height: "100%" },
  mutedBadge: {
    position: "absolute",
    bottom: -4,
    backgroundColor: "#ef4444",
    borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 5,
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.25)",
    shadowColor: "#ef4444", shadowOpacity: 0.5, shadowRadius: 8, elevation: 6,
  },
  mutedBadgeText: { fontSize: 11, color: "#fff", fontWeight: "700" },

  /* Caller text */
  callerName: {
    fontSize: 34,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  statusText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.52)",
    fontWeight: "500",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  statusTextError: { color: "#f87171" },

  connectedRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  liveGreenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  liveText: { fontSize: 13, color: "#10B981", fontWeight: "700" },

  encryptBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  encryptText: {
    fontSize: 11, color: "rgba(196,181,253,0.65)", fontWeight: "500",
  },

  errorPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(248,113,113,0.12)",
    borderWidth: 1, borderColor: "rgba(248,113,113,0.28)",
  },
  errorPillText: { fontSize: 13, color: "#f87171", fontWeight: "500" },

  /* Bottom area */
  bottomArea: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 0,
  },

  /* Incoming call buttons */
  incomingRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  incomingAction: { alignItems: "center", gap: 12 },
  callActionBtn: {
    width: 78, height: 78, borderRadius: 39,
    alignItems: "center", justifyContent: "center",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 14, elevation: 10,
  },
  declineBtn: { backgroundColor: "#dc2626", shadowColor: "#dc2626" },
  acceptBtn:  { backgroundColor: "#16a34a", shadowColor: "#16a34a" },
  closeBtn:   {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
    shadowColor: "#000",
  },
  actionLabel: {
    fontSize: 13, color: "rgba(255,255,255,0.72)", fontWeight: "600", letterSpacing: 0.3,
  },

  /* Connected panel */
  connectedPanel: {
    width: "100%",
    alignItems: "center",
    gap: 18,
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 20,
    backgroundColor: "rgba(8,4,24,0.78)",
    borderRadius: 36,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000", shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5, shadowRadius: 28, elevation: 16,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
  },
  controlItem: { alignItems: "center", gap: 8, flex: 1 },
  controlBtn: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
  },
  controlBtnActive: {
    backgroundColor: "#c4b5fd",
    borderColor: "rgba(196,181,253,0.5)",
  },
  controlLabel: {
    fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: "500", letterSpacing: 0.2,
  },
  endCallBtn: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#dc2626",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#dc2626", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.65, shadowRadius: 18, elevation: 14,
  },

  /* Cancel / close area */
  cancelArea: { alignItems: "center", gap: 12 },
});
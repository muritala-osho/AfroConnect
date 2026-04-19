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
  Text,
} from "react-native";
import { SafeImage } from "@/components/SafeImage";
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Audio wave bars â€“ shown when call is live
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
          style={[wav.bar, { transform: [{ scaleY: bar }], opacity: isMuted ? 0.2 : 0.9 }]}
        />
      ))}
    </View>
  );
}
const wav = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, height: 28 },
  bar: { width: 4, height: 24, borderRadius: 3, backgroundColor: "#34d399" },
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Ripple rings â€“ 3 animated pulse rings around avatar
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function RippleRings({ size }: { size: number }) {
  const anims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 600),
          Animated.timing(a, { toValue: 1, duration: 2400, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  const rings = [size + 80, size + 160, size + 240];
  return (
    <>
      {rings.map((ringSize, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            borderWidth: 1,
            borderColor: "rgba(52,211,153,0.6)",
            opacity: anims[i],
            transform: [{ scale: anims[i].interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
          }}
          pointerEvents="none"
        />
      ))}
    </>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   ActionButton â€“ icon button with label
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function ActionButton({
  icon,
  label,
  active = false,
  danger = false,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  danger?: boolean;
  onPress?: () => void;
}) {
  let btnStyle = ab.btn;
  if (active) btnStyle = { ...ab.btn, ...ab.btnActive };
  if (danger)  btnStyle = { ...ab.btn, ...ab.btnDanger };
  return (
    <Pressable style={ab.wrap} onPress={onPress}>
      <View style={btnStyle}>{icon}</View>
      <Text style={ab.label}>{label}</Text>
    </Pressable>
  );
}
const ab = StyleSheet.create({
  wrap:      { alignItems: "center", gap: 6 },
  btn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  btnActive: { backgroundColor: "#10b981" },
  btnDanger: {
    backgroundColor: "#dc2626",
    shadowColor: "#dc2626",
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  label: { fontSize: 12, color: "rgba(255,255,255,0.60)", fontWeight: "500" },
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Signal bars
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function SignalBars() {
  const heights = [4, 7, 10, 13];
  return (
    <View style={sb.row}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={[sb.bar, { height: h, backgroundColor: i < 3 ? "#34d399" : "rgba(255,255,255,0.25)" }]}
        />
      ))}
      <Text style={sb.label}>HD Voice</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  row:   { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  bar:   { width: 4, borderRadius: 2 },
  label: { fontSize: 11, color: "rgba(255,255,255,0.40)", marginLeft: 4 },
});

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Main VoiceCallScreen
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const pulseAnim2  = useRef(new Animated.Value(1)).current;
  const pulseAnim3  = useRef(new Animated.Value(1)).current;
  const endBtnScale = useRef(new Animated.Value(1)).current;

  /* â”€â”€ Refs â”€â”€ */
  const ringtoneRef       = useRef<Audio.Sound | null>(null);
  const shouldRingRef     = useRef(false);
  const ringingTimeout    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webViewRef        = useRef<WebView | null>(null);
  const agoraJoined       = useRef(false);
  const activeCallDataRef = useRef<any>(incomingCallData || null);
  const callStatusRef     = useRef<CallStatus>(callAccepted ? "connected" : "connecting");

  /* â”€â”€ Derived â”€â”€ */
  const duration = activeCall?.duration || 0;

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

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
      shouldRingRef.current = true;
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
    if (isIncoming && authToken) {
      try {
        const res = await get<{ token: string; uid: number }>(
          `/agora/token`,
          { channelName: callDataObj.channelName, uid: 0, role: "publisher" },
          authToken
        );
        if (res.success && res.data?.token) { joinToken = res.data.token; joinUid = 0; }
      } catch { console.log("Receiver token fetch failed, using shared token"); }
    }
    if (Platform.OS === "web") {
      agoraService.joinVoiceCall(callDataObj.appId, callDataObj.channelName, joinToken, joinUid);
    } else {
      sendToWebView({ action: "join", appId: callDataObj.appId, channel: callDataObj.channelName, token: joinToken, uid: joinUid, callType: "voice" });
    }
  }, [isIncoming, authToken, get, sendToWebView, requestMicPermission]);

  /* â”€â”€ End call â”€â”€ */
  const handleEndCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const wasConnected    = callStatusRef.current === "connected";
    const currentDuration = activeCall?.duration || 0;
    setStatus("ended");
    await stopRingtone();
    stopGlobalTimer();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    if (Platform.OS === "web") agoraService.leave();
    else sendToWebView({ action: "leave" });
    socketService.endCall({ targetUserId: isIncoming ? callerId : userId, callType: "audio", duration: currentDuration, wasAnswered: wasConnected });
    clearCall();
    setTimeout(() => { if (navigation.canGoBack()) navigation.goBack(); }, 600);
  }, [callerId, userId, isIncoming, stopRingtone, sendToWebView, clearCall, navigation, setStatus, activeCall, stopGlobalTimer]);

  /* â”€â”€ Minimize â”€â”€ */
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
    } catch (e) { console.log("Speaker toggle error:", e); }
  }, [isSpeakerOn]);

  /* â”€â”€ Initiate outgoing call â”€â”€ */
  const initiateCall = useCallback(async () => {
    if (!authToken || !userId) return setStatus("failed");
    const hasPerm = await requestMicPermission();
    if (!hasPerm) { setStatus("failed"); return; }
    try {
      const response = await post<any>("/agora/call/initiate", { targetUserId: userId, callType: "voice" }, authToken);
      if (response.success && response.data?.callData) {
        const cd = response.data.callData;
        setActiveCallData(cd);
        activeCallDataRef.current = cd;
        setStatus("ringing");
        const photoVal = user?.photos?.[0];
        const photoUrl = typeof photoVal === "string" ? photoVal : (photoVal as any)?.url || "";
        socketService.initiateCall({ targetUserId: userId, callData: cd, callerInfo: { name: user?.name || "User", photo: photoUrl, id: user?.id || "" } });
        ringingTimeout.current = setTimeout(() => {
          if (callStatusRef.current === "ringing") {
            setStatus("missed");
            socketService.missedCall?.({ targetUserId: userId, callType: "voice" });
            clearCall();
            setTimeout(() => navigation.canGoBack() && navigation.goBack(), 2000);
          }
        }, 30000);
      } else { setStatus("failed"); }
    } catch { setStatus("failed"); }
  }, [authToken, userId, post, user, navigation, requestMicPermission, setStatus, clearCall]);

  /* â”€â”€ Main setup effect â”€â”€ */
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    setActiveCall({ userId: userId || callerId || "", userName: userName || "Unknown", userPhoto, isIncoming: !!isIncoming, callStatus: callAccepted ? "connected" : "connecting", callType: "voice", duration: 0 });
    if (callAccepted) { setStatus("connected"); startGlobalTimer(); if (activeCallDataRef.current && Platform.OS === "web") joinAgoraVoice(activeCallDataRef.current); }
    else if (returnToCall) { setStatus("connected"); }
    else if (isIncoming) { setStatus("ringing"); }
    else { initiateCall(); }
    socketService.onCallAccepted(async () => { await stopRingtone(); if (ringingTimeout.current) clearTimeout(ringingTimeout.current); setStatus("connected"); startGlobalTimer(); if (activeCallDataRef.current) joinAgoraVoice(activeCallDataRef.current); });
    socketService.onCallDeclined(async () => { await stopRingtone(); if (ringingTimeout.current) clearTimeout(ringingTimeout.current); setStatus("declined"); clearCall(); setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1500); });
    socketService.onCallBusy(async () => { await stopRingtone(); if (ringingTimeout.current) clearTimeout(ringingTimeout.current); setStatus("busy"); clearCall(); setTimeout(() => navigation.canGoBack() && navigation.goBack(), 2000); });
    socketService.onCallEnded(async () => { await stopRingtone(); if (Platform.OS === "web") agoraService.leave(); else sendToWebView({ action: "leave" }); setStatus("ended"); stopGlobalTimer(); clearCall(); setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1200); });
    return () => { stopRingtone(); if (ringingTimeout.current) clearTimeout(ringingTimeout.current); socketService.off("call:accepted"); socketService.off("call:declined"); socketService.off("call:busy"); socketService.off("call:ended"); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* â”€â”€ Ringtone on status change â”€â”€ */
  useEffect(() => {
    if (callStatus === "ringing") playRingtone();
    else stopRingtone();
  }, [callStatus]);

  /* â”€â”€ Pulse animation â”€â”€ */
  useEffect(() => {
    if (callStatus === "ringing" || callStatus === "connecting") {
      const makeLoop = (anim: Animated.Value, delay: number) =>
        Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(anim, { toValue: 1.28, duration: 900, useNativeDriver: true }), Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true })]));
      const l1 = makeLoop(pulseAnim, 0); const l2 = makeLoop(pulseAnim2, 300); const l3 = makeLoop(pulseAnim3, 600);
      l1.start(); l2.start(); l3.start();
      return () => { l1.stop(); l2.stop(); l3.stop(); };
    } else { pulseAnim.setValue(1); pulseAnim2.setValue(1); pulseAnim3.setValue(1); }
  }, [callStatus]);

  /* â”€â”€ WebView ready â”€â”€ */
  useEffect(() => {
    if (webviewReady && (callStatus === "connected" || callAccepted) && activeCallDataRef.current && !agoraJoined.current) {
      joinAgoraVoice(activeCallDataRef.current);
    }
  }, [webviewReady]);

  /* â”€â”€ 5-min free-tier limit â”€â”€ */
  useEffect(() => {
    const isPremium = user?.premium?.isActive;
    if (isPremium || callStatus !== "connected") return;
    if (duration === 240) Alert.alert("1 Minute Remaining", "Free calls are limited to 5 minutes. Upgrade to Premium for unlimited call time.", [{ text: "OK" }]);
    if (duration >= 300) handleEndCall();
  }, [duration, callStatus, user, handleEndCall]);

  /* â”€â”€ Helpers â”€â”€ */
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

  const isTerminal    = ["ended", "declined", "missed", "failed", "busy"].includes(callStatus);
  const isWaiting     = !isIncoming && callStatus === "ringing";
  const isConnected   = callStatus === "connected";
  const showIncoming  = isIncoming && callStatus === "ringing";
  const showCancelBtn = callStatus === "connecting" || isWaiting;
  const agoraCallUrl  = `${getApiBaseUrl()}/public/agora-call.html`;

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Render â”€â”€â”€â”€ */
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Emerald gradient background */}
      <LinearGradient
        colors={["#022c22", "#064e3b", "#065f46", "#047857"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Blurred user photo tint when connected */}
      {userPhoto && (
        <SafeImage
          source={{ uri: userPhoto }}
          style={[StyleSheet.absoluteFillObject as any, { opacity: 0.08 }]}
          blurRadius={Platform.OS === "ios" ? 60 : 18}
        />
      )}

      {/* Hidden Agora WebView (native only) */}
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

        {/* â”€â”€ TOP BAR: back | title | menu â”€â”€ */}
        <View style={[s.topBar, { paddingTop: insets.top + 12 }]}>
          <Pressable
            style={s.iconBtn}
            onPress={isConnected ? handleMinimize : () => navigation.canGoBack() && navigation.goBack()}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.9)" />
          </Pressable>
          <Text style={s.topBarTitle}>Voice Call</Text>
          <Pressable style={s.iconBtn} hitSlop={12}>
            <Ionicons name="ellipsis-vertical" size={20} color="rgba(255,255,255,0.9)" />
          </Pressable>
        </View>

        {/* â”€â”€ AVATAR SECTION â”€â”€ */}
        <View style={s.avatarSection}>
          {/* Ripple rings */}
          <View style={s.rippleContainer}>
            <RippleRings size={AVATAR_SIZE} />
          </View>

          {/* Avatar circle */}
          <View style={s.avatarFrame}>
            {userPhoto ? (
              <SafeImage source={{ uri: userPhoto }} style={s.avatar} />
            ) : (
              <LinearGradient
                colors={["#059669", "#10b981", "#34d399"]}
                style={s.avatarGradient}
              >
                <Text style={s.avatarInitials}>
                  {(userName || "?").charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
            )}
          </View>

          {/* Name + status */}
          <View style={s.callerInfo}>
            <Text style={s.callerName} numberOfLines={1}>{userName || "Unknown"}</Text>
            <Text style={s.callerSub}>{getStatusText()}</Text>
          </View>

          {/* Live timer (connected) */}
          {isConnected && (
            <View style={s.timerRow}>
              <View style={s.timerDot} />
              <Text style={s.timerText}>{formatDuration(duration)}</Text>
            </View>
          )}

          {/* Signal bars (connected) */}
          {isConnected && (
            <View style={s.signalRow}>
              <SignalBars />
            </View>
          )}

          {/* E2E badge (waiting/ringing) */}
          {(callStatus === "ringing" || callStatus === "connecting") && (
            <View style={s.encryptRow}>
              <Ionicons name="lock-closed" size={10} color="rgba(52,211,153,0.75)" />
              <Text style={s.encryptText}>End-to-end encrypted</Text>
            </View>
          )}

          {/* Muted badge */}
          {isConnected && isMuted && (
            <View style={s.mutedBadge}>
              <Ionicons name="mic-off" size={12} color="#fff" />
              <Text style={s.mutedBadgeText}>Muted</Text>
            </View>
          )}

          {/* Connected wave bars */}
          {isConnected && (
            <View style={s.waveRow}>
              <AudioWaveBars isMuted={isMuted} />
            </View>
          )}

          {/* Terminal error pill */}
          {isTerminal && callStatus !== "ended" && (
            <View style={s.errorPill}>
              <Ionicons name="close-circle" size={14} color="#f87171" />
              <Text style={s.errorPillText}>
                {callStatus === "busy"     ? "User is in another call"
                : callStatus === "declined"? "Call was declined"
                : callStatus === "missed"  ? "No answer"
                :                            "Unable to connect"}
              </Text>
            </View>
          )}
        </View>

        {/* â”€â”€ RECENT MESSAGE STRIP â”€â”€ */}
        <View style={[s.messageStrip, { marginBottom: 16 }]}>
          <View style={s.messageInner}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#34d399" />
            <Text style={s.messageText} numberOfLines={1}>
              {isConnected ? `"Running 5 mins late, be there soon!"` : "Waiting to connectâ€¦"}
            </Text>
          </View>
        </View>

        {/* â”€â”€ CONTROL PANEL (frosted glass card) â”€â”€ */}
        <View style={[s.controlPanel, { paddingBottom: insets.bottom + 28 }]}>
          <View style={s.glassCard}>

            {/* INCOMING â€” Decline + Accept */}
            {showIncoming && (
              <View style={s.controlRow}>
                <ActionButton
                  icon={<Ionicons name="call" size={26} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />}
                  label="Decline"
                  danger
                  onPress={handleDecline}
                />
                <ActionButton
                  icon={<Ionicons name="call" size={26} color="#FFF" />}
                  label="Accept"
                  active
                  onPress={handleAccept}
                />
              </View>
            )}

            {/* CONNECTED â€” Mute + Speaker + Bluetooth */}
            {isConnected && (
              <View style={s.controlRow}>
                <ActionButton
                  icon={<Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color="#FFF" />}
                  label={isMuted ? "Unmute" : "Mute"}
                  active={isMuted}
                  onPress={toggleMute}
                />
                <ActionButton
                  icon={<Ionicons name={isSpeakerOn ? "volume-high" : "volume-mute"} size={24} color="#FFF" />}
                  label="Speaker"
                  active={isSpeakerOn}
                  onPress={toggleSpeaker}
                />
                <ActionButton
                  icon={<Ionicons name="bluetooth" size={24} color="#FFF" />}
                  label="Bluetooth"
                />
              </View>
            )}

            {/* OUTGOING RINGING / CONNECTING â€” Speaker only */}
            {showCancelBtn && (
              <View style={s.controlRow}>
                <ActionButton
                  icon={<Ionicons name={isSpeakerOn ? "volume-high" : "volume-mute"} size={24} color="#FFF" />}
                  label="Speaker"
                  active={isSpeakerOn}
                  onPress={toggleSpeaker}
                />
              </View>
            )}

            {/* TERMINAL â€” Close */}
            {isTerminal && (
              <View style={s.controlRow}>
                <ActionButton
                  icon={<Ionicons name="close" size={26} color="#FFF" />}
                  label="Close"
                  onPress={() => { clearCall(); navigation.canGoBack() && navigation.goBack(); }}
                />
              </View>
            )}

            {/* END CALL button (centered, below row) â€” shown when connected or outgoing */}
            {(isConnected || showCancelBtn) && (
              <>
                <Animated.View style={[s.endCallWrap, { transform: [{ scale: endBtnScale }] }]}>
                  <Pressable
                    style={s.endCallBtn}
                    onPress={handleEndCall}
                    onPressIn={() => Animated.spring(endBtnScale, { toValue: 0.88, useNativeDriver: true, tension: 220, friction: 8 }).start()}
                    onPressOut={() => Animated.spring(endBtnScale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 8 }).start()}
                  >
                    <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                  </Pressable>
                </Animated.View>
                <Text style={s.endCallLabel}>End Call</Text>
              </>
            )}

          </View>
        </View>

      </Animated.View>
    </View>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Styles â”€â”€â”€â”€ */
const AVATAR_SIZE = Math.min(SW * 0.44, 180);

const s = StyleSheet.create({
  root:   { flex: 1 },
  screen: { flex: 1 },

  /* Top bar */
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.10)",
    alignItems: "center", justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.75)", letterSpacing: 0.5,
  },

  /* Avatar section */
  avatarSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
  },
  rippleContainer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    width: AVATAR_SIZE + 260,
    height: AVATAR_SIZE + 260,
  },
  avatarFrame: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "rgba(52,211,153,0.6)",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 32,
    elevation: 20,
  },
  avatar:         { width: "100%", height: "100%" },
  avatarGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: AVATAR_SIZE * 0.38, fontWeight: "800", color: "#fff" },

  callerInfo: { alignItems: "center", marginTop: 24, gap: 4 },
  callerName: {
    fontSize: 24, fontWeight: "700", color: "#FFF",
    letterSpacing: 0.2, textAlign: "center",
  },
  callerSub: {
    fontSize: 14, color: "rgba(255,255,255,0.55)", fontWeight: "500", textAlign: "center",
  },

  timerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  timerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#34d399" },
  timerText: { fontSize: 16, color: "#34d399", fontWeight: "600", fontVariant: ["tabular-nums"], letterSpacing: 2 },

  signalRow: { marginTop: 8 },

  encryptRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
  encryptText: { fontSize: 11, color: "rgba(52,211,153,0.75)", fontWeight: "500" },

  mutedBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#ef4444", borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 5, marginTop: 8,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.2)",
  },
  mutedBadgeText: { fontSize: 11, color: "#fff", fontWeight: "700" },

  waveRow: { marginTop: 10 },

  errorPill: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14,
    backgroundColor: "rgba(248,113,113,0.12)",
    borderWidth: 1, borderColor: "rgba(248,113,113,0.28)",
  },
  errorPillText: { fontSize: 13, color: "#f87171", fontWeight: "500" },

  /* Message strip */
  messageStrip: {
    paddingHorizontal: 20,
  },
  messageInner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12,
  },
  messageText: {
    fontSize: 12, color: "rgba(255,255,255,0.60)", flex: 1,
  },

  /* Control panel */
  controlPanel: {
    paddingHorizontal: 20,
  },
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: "center",
    gap: 0,
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
    marginBottom: 20,
  },
  endCallWrap: { marginTop: 0 },
  endCallBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#dc2626",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 14, elevation: 10,
  },
  endCallLabel: {
    fontSize: 12, color: "rgba(255,255,255,0.40)", textAlign: "center", marginTop: 6,
  },
});
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
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
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
      shouldRingRef.current = true; // re-assert after stopRingtone clears it
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


  /* ──────────────────────────────────── Render ──── */
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Blurred avatar as full-screen background */}
      <SafeImage
        source={{ uri: userPhoto || "https://via.placeholder.com/400" }}
        style={StyleSheet.absoluteFillObject as any}
        blurRadius={Platform.OS === "ios" ? 60 : 18}
      />
      <LinearGradient
        colors={["rgba(10,4,30,0.92)", "rgba(30,8,60,0.80)", "rgba(10,4,30,0.97)"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Hidden Agora WebView (native only) */}
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

        {/* ── Back / minimize button strip ── */}
        <View style={[s.headerStrip, { paddingTop: insets.top + 8 }]}>
          <Pressable
            style={s.backBtn}
            onPress={isConnected ? handleMinimize : () => navigation.canGoBack() && navigation.goBack()}
            hitSlop={12}
          >
            <Ionicons
              name={isConnected ? "chevron-down" : "arrow-back"}
              size={22}
              color="rgba(255,255,255,0.9)"
            />
          </Pressable>
        </View>

        {/* ── AVATAR — centered in the upper section ── */}
        <View style={s.avatarSection}>
          {(callStatus === "ringing" || callStatus === "connecting") && (
            <>
              <Animated.View style={[s.ring3, { transform: [{ scale: pulseAnim3 }] }]} />
              <Animated.View style={[s.ring2, { transform: [{ scale: pulseAnim2 }] }]} />
              <Animated.View style={[s.ring1, { transform: [{ scale: pulseAnim  }] }]} />
            </>
          )}
          {isConnected && isMuted && <View style={s.mutedRing} />}

          <View style={[
            s.avatarFrame,
            isConnected && s.avatarFrameConnected,
            isConnected && isMuted && s.avatarFrameMuted,
            isTerminal && s.avatarFrameTerminal,
          ]}>
            <SafeImage
              source={{ uri: userPhoto || "https://via.placeholder.com/150" }}
              style={s.avatar}
            />
          </View>
        </View>

        {/* ── INFO — name, status, badges all BELOW the avatar ── */}
        <View style={s.infoSection}>
          <ThemedText style={s.callerName} numberOfLines={1}>
            {userName || "Unknown"}
          </ThemedText>

          <ThemedText style={[s.statusText, isTerminal && s.statusTextError]}>
            {getStatusText()}
          </ThemedText>

          {(callStatus === "ringing" || callStatus === "connecting") && (
            <View style={s.encryptRow}>
              <Ionicons name="lock-closed" size={10} color="rgba(196,181,253,0.75)" />
              <ThemedText style={s.encryptText}>End-to-end encrypted</ThemedText>
            </View>
          )}

          {isConnected && (
            <View style={s.connectedRow}>
              <View style={s.liveGreenDot} />
              <ThemedText style={s.liveText}>Connected</ThemedText>
              <AudioWaveBars isMuted={isMuted} />
            </View>
          )}

          {isConnected && isMuted && (
            <View style={s.mutedBadge}>
              <Ionicons name="mic-off" size={12} color="#fff" />
              <ThemedText style={s.mutedBadgeText}>Muted</ThemedText>
            </View>
          )}

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

        {/* ── CONTROLS at bottom ── */}
        <View style={[s.bottomBar, { paddingBottom: insets.bottom + 24 }]}>
          <View style={s.bottomPill}>

            {/* INCOMING */}
            {showIncoming && (
              <>
                <View style={s.pillItem}>
                  <Pressable style={[s.pillBtn, s.declineBtn]} onPress={handleDecline}>
                    <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                  </Pressable>
                  <ThemedText style={s.pillLabel}>Decline</ThemedText>
                </View>
                <View style={s.pillItem}>
                  <Pressable style={[s.pillBtn, s.acceptBtn]} onPress={handleAccept}>
                    <Ionicons name="call" size={28} color="#FFF" />
                  </Pressable>
                  <ThemedText style={s.pillLabel}>Accept</ThemedText>
                </View>
              </>
            )}

            {/* CONNECTED */}
            {isConnected && (
              <>
                <View style={s.pillItem}>
                  <Pressable style={[s.pillBtn, isMuted && s.pillBtnActive]} onPress={toggleMute}>
                    <Ionicons
                      name={isMuted ? "mic-off" : "mic"}
                      size={24}
                      color={isMuted ? "#0f0a2e" : "#FFF"}
                    />
                  </Pressable>
                  <ThemedText style={s.pillLabel}>{isMuted ? "Unmute" : "Mute"}</ThemedText>
                </View>
                <View style={s.pillItem}>
                  <Pressable style={[s.pillBtn, isSpeakerOn && s.pillBtnActive]} onPress={toggleSpeaker}>
                    <Ionicons
                      name={isSpeakerOn ? "volume-high" : "ear"}
                      size={24}
                      color={isSpeakerOn ? "#0f0a2e" : "#FFF"}
                    />
                  </Pressable>
                  <ThemedText style={s.pillLabel}>{isSpeakerOn ? "Earpiece" : "Speaker"}</ThemedText>
                </View>
                <View style={s.pillItem}>
                  <Animated.View style={{ transform: [{ scale: endBtnScale }] }}>
                    <Pressable
                      style={[s.pillBtn, s.declineBtn]}
                      onPress={handleEndCall}
                      onPressIn={() =>
                        Animated.spring(endBtnScale, { toValue: 0.88, useNativeDriver: true, tension: 220, friction: 8 }).start()
                      }
                      onPressOut={() =>
                        Animated.spring(endBtnScale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 8 }).start()
                      }
                    >
                      <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                    </Pressable>
                  </Animated.View>
                  <ThemedText style={s.pillLabel}>End Call</ThemedText>
                </View>
              </>
            )}

            {/* OUTGOING RINGING / CONNECTING */}
            {showCancelBtn && (
              <>
                <View style={s.pillItem}>
                  <Pressable style={[s.pillBtn, isSpeakerOn && s.pillBtnActive]} onPress={toggleSpeaker}>
                    <Ionicons
                      name={isSpeakerOn ? "volume-high" : "volume-medium"}
                      size={24}
                      color={isSpeakerOn ? "#0f0a2e" : "#FFF"}
                    />
                  </Pressable>
                  <ThemedText style={s.pillLabel}>{isSpeakerOn ? "Earpiece" : "Speaker"}</ThemedText>
                </View>
                <View style={s.pillItem}>
                  <Pressable style={[s.pillBtn, s.declineBtn]} onPress={handleEndCall}>
                    <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                  </Pressable>
                  <ThemedText style={s.pillLabel}>Cancel</ThemedText>
                </View>
              </>
            )}

            {/* TERMINAL */}
            {isTerminal && (
              <View style={s.pillItem}>
                <Pressable
                  style={[s.pillBtn, s.closeBtn]}
                  onPress={() => { clearCall(); navigation.canGoBack() && navigation.goBack(); }}
                >
                  <Ionicons name="close" size={28} color="#FFF" />
                </Pressable>
                <ThemedText style={s.pillLabel}>Close</ThemedText>
              </View>
            )}

          </View>
        </View>

      </Animated.View>
    </View>
  );
}

/* ──────────────────────────────────── Styles ──── */
const AVATAR_SIZE = Math.min(SW * 0.56, 230);

const s = StyleSheet.create({
  root:   { flex: 1 },
  screen: { flex: 1 },

  /* Header strip — just the back button, no title */
  headerStrip: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
    alignSelf: "flex-start",
  },

  /* Avatar — takes the upper space, centered */
  avatarSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Pulse rings */
  ring3: {
    position: "absolute",
    width: AVATAR_SIZE + 120, height: AVATAR_SIZE + 120,
    borderRadius: (AVATAR_SIZE + 120) / 2,
    backgroundColor: "rgba(109,40,217,0.05)",
    borderWidth: 1, borderColor: "rgba(196,181,253,0.07)",
  },
  ring2: {
    position: "absolute",
    width: AVATAR_SIZE + 74, height: AVATAR_SIZE + 74,
    borderRadius: (AVATAR_SIZE + 74) / 2,
    backgroundColor: "rgba(109,40,217,0.09)",
    borderWidth: 1, borderColor: "rgba(196,181,253,0.15)",
  },
  ring1: {
    position: "absolute",
    width: AVATAR_SIZE + 36, height: AVATAR_SIZE + 36,
    borderRadius: (AVATAR_SIZE + 36) / 2,
    backgroundColor: "rgba(109,40,217,0.15)",
    borderWidth: 1.5, borderColor: "rgba(196,181,253,0.30)",
  },
  mutedRing: {
    position: "absolute",
    width: AVATAR_SIZE + 14, height: AVATAR_SIZE + 14,
    borderRadius: (AVATAR_SIZE + 14) / 2,
    borderWidth: 2.5, borderColor: "rgba(239,68,68,0.6)",
  },
  avatarFrame: {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
    borderWidth: 4, borderColor: "rgba(196,181,253,0.55)",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.75, shadowRadius: 36, elevation: 22,
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
    borderColor: "rgba(255,255,255,0.15)",
    shadowOpacity: 0.15,
  },
  avatar: { width: "100%", height: "100%" },

  /* Info section — name, status, badges BELOW avatar */
  infoSection: {
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 20,
    gap: 8,
  },
  callerName: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  statusText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "500",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  statusTextError: { color: "#f87171" },
  encryptRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
  },
  encryptText: {
    fontSize: 11, color: "rgba(196,181,253,0.7)", fontWeight: "500",
  },
  connectedRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  liveGreenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  liveText:     { fontSize: 13, color: "#10B981", fontWeight: "700" },
  mutedBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 5,
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.2)",
  },
  mutedBadgeText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  errorPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "rgba(248,113,113,0.12)",
    borderWidth: 1, borderColor: "rgba(248,113,113,0.28)",
  },
  errorPillText: { fontSize: 13, color: "#f87171", fontWeight: "500" },

  /* Bottom controls */
  bottomBar: {
    width: "100%",
    paddingHorizontal: 20,
  },
  bottomPill: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-start",
    backgroundColor: "rgba(8,4,24,0.85)",
    borderRadius: 32,
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.07)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5, shadowRadius: 24, elevation: 16,
  },
  pillItem: {
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  pillBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.13)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  pillBtnActive: {
    backgroundColor: "#c4b5fd",
    borderColor: "rgba(196,181,253,0.4)",
  },
  declineBtn: {
    backgroundColor: "#dc2626",
    borderColor: "rgba(220,38,38,0.3)",
    shadowColor: "#dc2626",
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  acceptBtn: {
    backgroundColor: "#16a34a",
    borderColor: "rgba(22,163,74,0.3)",
    shadowColor: "#16a34a",
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  closeBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.18)",
  },
  pillLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    fontWeight: "600",
    letterSpacing: 0.2,
    textAlign: "center",
  },
});

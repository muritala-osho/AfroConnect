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

const { width: SW, height: SH } = Dimensions.get("window");
const AVATAR_FALLBACK = Math.min(SW * 0.38, 160);

/* ─── Main Screen ─── */
export default function VideoCallScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const {
    userId, userName, userPhoto, isIncoming,
    callData: incomingCallData, callerId,
    callAccepted, returnToCall,
  } = route.params || {};

  const { token: authToken, user } = useAuth();
  const { post, get } = useApi();
  const {
    setActiveCall, updateCallStatus, startGlobalTimer,
    stopGlobalTimer, minimizeCall, clearCall, activeCall,
  } = useCallContext();

  const [callStatus, setCallStatusState] = useState<CallStatus>(
    callAccepted ? "connected" : "connecting"
  );
  const [activeCallData, setActiveCallData] = useState<any>(incomingCallData || null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [webviewReady, setWebviewReady] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const fadeAnim      = useRef(new Animated.Value(0)).current;
  const controlsAnim  = useRef(new Animated.Value(1)).current;
  const pulseAnim     = useRef(new Animated.Value(1)).current;
  const pulseAnim2    = useRef(new Animated.Value(1)).current;
  const pulseAnim3    = useRef(new Animated.Value(1)).current;
  const endBtnScale   = useRef(new Animated.Value(1)).current;

  const ringtoneRef       = useRef<Audio.Sound | null>(null);
  const shouldRingRef     = useRef(false);
  const ringingTimeout    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webViewRef        = useRef<WebView | null>(null);
  const agoraJoined       = useRef(false);
  const activeCallDataRef = useRef<any>(incomingCallData || null);
  const callStatusRef     = useRef<CallStatus>(callAccepted ? "connected" : "connecting");
  const controlsTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const duration = activeCall?.duration || 0;

  const setStatus = useCallback((s: CallStatus) => {
    callStatusRef.current = s;
    setCallStatusState(s);
    updateCallStatus(s);
  }, [updateCallStatus]);

  /* ── Auto-hide controls after 4s when connected ── */
  const showControlsTemporarily = useCallback(() => {
    if (callStatusRef.current !== "connected") return;
    setControlsVisible(true);
    Animated.timing(controlsAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      Animated.timing(controlsAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() =>
        setControlsVisible(false)
      );
    }, 4000);
  }, [controlsAnim]);

  /* ── Ringtone ── */
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
  }, []);

  const playRingtone = useCallback(async () => {
    if (ringtoneRef.current) {
      const snd = ringtoneRef.current;
      ringtoneRef.current = null;
      await snd.stopAsync().catch(() => {});
      await snd.unloadAsync().catch(() => {});
    }
    Vibration.cancel();
    shouldRingRef.current = true;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false, playsInSilentModeIOS: true,
        staysActiveInBackground: true, playThroughEarpieceAndroid: false,
      });
      if (!shouldRingRef.current) return;

      const source = isIncoming
        ? require("../assets/sounds/mixkit-waiting-ringtone-1354.wav")
        : require("../assets/sounds/phone-calling-1b.mp3");

      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true, isLooping: true, volume: 1.0,
      });

      if (!shouldRingRef.current) {
        await sound.unloadAsync().catch(() => {});
        return;
      }
      ringtoneRef.current = sound;
      if (isIncoming) Vibration.vibrate([500, 1000, 500], true);
    } catch (err) {
      console.error("Video ringtone error:", err);
      if (isIncoming && shouldRingRef.current) Vibration.vibrate([500, 1000, 500], true);
    }
  }, [isIncoming]);

  /* ── WebView bridge ── */
  const sendToWebView = useCallback((msg: any) => {
    webViewRef.current?.postMessage(JSON.stringify(msg));
  }, []);

  /* ── Agora join ── */
  const joinAgoraVideo = useCallback(async (callDataObj: any) => {
    if (agoraJoined.current) return;
    agoraJoined.current = true;

    let joinToken = callDataObj.token;
    let joinUid = callDataObj.uid || 0;

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
      } catch { console.log("Video token fallback"); }
    }

    if (Platform.OS === "web") {
      agoraService.joinVideoCall(callDataObj.appId, callDataObj.channelName, joinToken, joinUid);
    } else {
      sendToWebView({
        action: "join", appId: callDataObj.appId,
        channel: callDataObj.channelName, token: joinToken,
        uid: joinUid, callType: "video",
      });
    }
  }, [isIncoming, authToken, get, sendToWebView]);

  /* ── End call ── */
  const handleEndCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const wasConnected = callStatusRef.current === "connected";
    const dur = activeCall?.duration || 0;
    setStatus("ended");
    await stopRingtone();
    stopGlobalTimer();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);

    if (Platform.OS === "web") agoraService.leave();
    else sendToWebView({ action: "leave" });

    socketService.endCall({
      targetUserId: isIncoming ? callerId : userId,
      callType: "video", duration: dur, wasAnswered: wasConnected,
    });
    clearCall();
    setTimeout(() => { if (navigation.canGoBack()) navigation.goBack(); }, 600);
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
    showControlsTemporarily();
    if (activeCallData) joinAgoraVideo(activeCallData);
  }, [callerId, activeCallData, stopRingtone, joinAgoraVideo, startGlobalTimer, setStatus, showControlsTemporarily]);

  /* ── Decline incoming ── */
  const handleDecline = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await stopRingtone();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    socketService.declineCall({ callerId, callType: "video" });
    if (authToken && isIncoming) post("/call/decline", { callerId, type: "video" }, authToken).catch(() => {});
    setStatus("declined");
    clearCall();
    setTimeout(() => navigation.canGoBack() && navigation.goBack(), 900);
  }, [callerId, isIncoming, authToken, post, stopRingtone, clearCall, navigation, setStatus]);

  /* ── Toggle mute ── */
  const toggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted((prev) => {
      const next = !prev;
      if (Platform.OS === "web") agoraService.toggleMute(next);
      else sendToWebView({ action: "mute", muted: next });
      return next;
    });
    showControlsTemporarily();
  }, [sendToWebView, showControlsTemporarily]);

  /* ── Toggle camera ── */
  const toggleCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCameraOff((prev) => {
      const next = !prev;
      if (Platform.OS === "web") agoraService.toggleCamera(next);
      else sendToWebView({ action: "camera", off: next });
      return next;
    });
    showControlsTemporarily();
  }, [sendToWebView, showControlsTemporarily]);

  /* ── Flip camera ── */
  const flipCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "web") agoraService.switchCamera();
    else sendToWebView({ action: "switch-camera" });
    showControlsTemporarily();
  }, [sendToWebView, showControlsTemporarily]);

  /* ── Speaker ── */
  const toggleSpeaker = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false, playsInSilentModeIOS: true,
        staysActiveInBackground: true, playThroughEarpieceAndroid: !next,
      });
    } catch {}
    showControlsTemporarily();
  }, [isSpeakerOn, showControlsTemporarily]);

  /* ── Initiate outgoing ── */
  const initiateCall = useCallback(async () => {
    if (!authToken || !userId) return setStatus("failed");

    try {
      const res = await post<any>("/agora/call/initiate", { targetUserId: userId, callType: "video" }, authToken);
      if (res.success && res.data?.callData) {
        const cd = res.data.callData;
        setActiveCallData(cd);
        activeCallDataRef.current = cd;
        setStatus("ringing");

        const photoVal = user?.photos?.[0];
        const photoUrl = typeof photoVal === "string" ? photoVal : (photoVal as any)?.url || "";
        socketService.initiateCall({
          targetUserId: userId, callData: cd,
          callerInfo: { name: user?.name || "User", photo: photoUrl, id: user?.id || "" },
        });

        ringingTimeout.current = setTimeout(() => {
          if (callStatusRef.current === "ringing") {
            setStatus("missed");
            socketService.missedCall?.({ targetUserId: userId, callType: "video" });
            clearCall();
            setTimeout(() => navigation.canGoBack() && navigation.goBack(), 2000);
          }
        }, 30000);
      } else {
        setStatus("failed");
      }
    } catch { setStatus("failed"); }
  }, [authToken, userId, post, user, navigation, setStatus, clearCall]);

  /* ── Setup ── */
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    setActiveCall({
      userId: userId || callerId || "",
      userName: userName || "Unknown",
      userPhoto, isIncoming: !!isIncoming,
      callStatus: callAccepted ? "connected" : "connecting",
      callType: "video", duration: 0,
    });

    if (callAccepted) {
      setStatus("connected");
      startGlobalTimer();
      showControlsTemporarily();
      if (activeCallDataRef.current && Platform.OS === "web") joinAgoraVideo(activeCallDataRef.current);
    } else if (returnToCall) {
      setStatus("connected");
      showControlsTemporarily();
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
      showControlsTemporarily();
      if (activeCallDataRef.current) joinAgoraVideo(activeCallDataRef.current);
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
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      socketService.off("call:accepted");
      socketService.off("call:declined");
      socketService.off("call:busy");
      socketService.off("call:ended");
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Ringtone ── */
  useEffect(() => {
    if (callStatus === "ringing") playRingtone();
    else stopRingtone();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus]);

  /* ── Pulse rings ── */
  useEffect(() => {
    if (callStatus === "ringing" || callStatus === "connecting") {
      const makeLoop = (anim: Animated.Value, delay: number) =>
        Animated.loop(Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1.3, duration: 900, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]));
      const l1 = makeLoop(pulseAnim, 0);
      const l2 = makeLoop(pulseAnim2, 300);
      const l3 = makeLoop(pulseAnim3, 600);
      l1.start(); l2.start(); l3.start();
      return () => { l1.stop(); l2.stop(); l3.stop(); };
    } else {
      pulseAnim.setValue(1); pulseAnim2.setValue(1); pulseAnim3.setValue(1);
    }
  }, [callStatus]);

  /* ── WebView ready → join ── */
  useEffect(() => {
    if (webviewReady && (callStatus === "connected" || callAccepted) && activeCallDataRef.current && !agoraJoined.current) {
      joinAgoraVideo(activeCallDataRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webviewReady]);

  /* ── Free tier limit ── */
  useEffect(() => {
    if ((user as any)?.premium?.isActive || callStatus !== "connected") return;
    if (duration === 240) Alert.alert("1 Minute Remaining", "Free calls are limited to 5 minutes. Upgrade to Premium for unlimited call time.", [{ text: "OK" }]);
    if (duration >= 300) handleEndCall();
  }, [duration, callStatus, user, handleEndCall]);

  /* ── Helpers ── */
  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const getStatusText = (): string => {
    switch (callStatus) {
      case "connecting": return "Connecting...";
      case "ringing":    return isIncoming ? "Incoming video call" : "Ringing...";
      case "connected":  return fmt(duration);
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
  const showVideoView = isConnected && Platform.OS !== "web";
  const agoraCallUrl  = `${getApiBaseUrl()}/public/agora-call.html`;

  /* ── Render ── */
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── VIDEO LAYER ── */}
      {showVideoView ? (
        /* Full-screen Agora WebView for native video */
        <WebView
          ref={webViewRef}
          source={{ uri: agoraCallUrl }}
          style={StyleSheet.absoluteFillObject}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grant"
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          bounces={false}
          onLoad={() => setWebviewReady(true)}
          onMessage={(event) => {
            try {
              const d = JSON.parse(event.nativeEvent.data);
              if (d.type === "joined") console.log("Video WebView joined:", d.uid);
              if (d.type === "remote-video-started") setHasRemoteVideo(true);
              if (d.type === "remote-video-stopped") setHasRemoteVideo(false);
              if (d.type === "remote-user-left") setHasRemoteVideo(false);
              if (d.type === "error") console.log("Video WebView error:", d.message);
            } catch {}
          }}
        />
      ) : (
        /* Background: blurred photo for non-video states */
        <>
          <SafeImage
            source={{ uri: userPhoto || "https://via.placeholder.com/400" }}
            style={StyleSheet.absoluteFillObject as any}
            blurRadius={Platform.OS === "ios" ? 60 : 18}
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.85)", "rgba(15,5,35,0.75)", "rgba(0,0,0,0.92)"]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}

      {/* ── OVERLAY: controls & info ── */}
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]}>

        {/* Tap to show controls when connected */}
        {isConnected && (
          <Pressable style={StyleSheet.absoluteFillObject} onPress={showControlsTemporarily} />
        )}

        {/* ── TOP GRADIENT + Header ── */}
        <Animated.View style={[s.topOverlay, { opacity: isConnected ? controlsAnim : 1 }]}>
          <LinearGradient
            colors={["rgba(0,0,0,0.75)", "transparent"]}
            style={s.topGradient}
          >
            <View style={[s.topRow, { paddingTop: insets.top + 10 }]}>
              <Pressable
                style={s.iconBtn}
                onPress={isConnected ? handleMinimize : () => navigation.canGoBack() && navigation.goBack()}
                hitSlop={12}
              >
                <Ionicons
                  name={isConnected ? "chevron-down" : "arrow-back"}
                  size={22}
                  color="#FFF"
                />
              </Pressable>

              <View style={s.topCenter}>
                <ThemedText style={s.topName} numberOfLines={1}>
                  {userName || "Unknown"}
                </ThemedText>
                <ThemedText style={[s.topStatus, isTerminal && { color: "#f87171" }]}>
                  {getStatusText()}
                </ThemedText>
              </View>

              <View style={{ width: 44 }} />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── AVATAR FALLBACK (when not connected / no remote video) ── */}
        {(!isConnected || !hasRemoteVideo) && (
          <View style={s.avatarCenter}>
            {(callStatus === "ringing" || callStatus === "connecting") && (
              <>
                <Animated.View style={[s.ring3, { transform: [{ scale: pulseAnim3 }] }]} />
                <Animated.View style={[s.ring2, { transform: [{ scale: pulseAnim2 }] }]} />
                <Animated.View style={[s.ring1, { transform: [{ scale: pulseAnim }] }]} />
              </>
            )}
            <View style={[s.avatarFrame, isConnected && s.avatarFrameConnected, isTerminal && s.avatarFrameTerminal]}>
              <SafeImage
                source={{ uri: userPhoto || "https://via.placeholder.com/150" }}
                style={s.avatar}
              />
            </View>

            {isTerminal && callStatus !== "ended" && (
              <View style={s.errorPill}>
                <Ionicons name="close-circle" size={14} color="#f87171" />
                <ThemedText style={s.errorPillText}>
                  {callStatus === "busy" ? "User is in another call"
                    : callStatus === "declined" ? "Call was declined"
                    : callStatus === "missed" ? "No answer"
                    : "Unable to connect"}
                </ThemedText>
              </View>
            )}
          </View>
        )}

        {/* ── LOCAL CAMERA OFF indicator ── */}
        {isConnected && isCameraOff && (
          <View style={s.cameraOffBadge}>
            <Ionicons name="videocam-off" size={16} color="#fff" />
            <ThemedText style={s.cameraOffText}>Camera off</ThemedText>
          </View>
        )}

        {/* ── BOTTOM GRADIENT + Controls ── */}
        <Animated.View
          style={[
            s.bottomOverlay,
            { opacity: isConnected ? controlsAnim : 1 },
          ]}
          pointerEvents={isConnected && !controlsVisible ? "none" : "auto"}
        >
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.82)"]}
            style={s.bottomGradient}
          >

            {/* Incoming: Decline + Accept */}
            {showIncoming && (
              <View style={[s.controlsRow, { paddingBottom: insets.bottom + 28 }]}>
                <View style={s.ctrlItem}>
                  <Pressable style={[s.ctrlBtn, s.redBtn]} onPress={handleDecline}>
                    <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                  </Pressable>
                  <ThemedText style={s.ctrlLabel}>Decline</ThemedText>
                </View>
                <View style={s.ctrlItem}>
                  <Pressable style={[s.ctrlBtn, s.greenBtn]} onPress={handleAccept}>
                    <Ionicons name="videocam" size={28} color="#FFF" />
                  </Pressable>
                  <ThemedText style={s.ctrlLabel}>Accept</ThemedText>
                </View>
              </View>
            )}

            {/* Connected: full controls */}
            {isConnected && (
              <View style={[s.controlsRow, { paddingBottom: insets.bottom + 28 }]}>
                <View style={s.ctrlItem}>
                  <Pressable style={[s.ctrlBtn, isMuted && s.ctrlBtnActive]} onPress={toggleMute}>
                    <Ionicons name={isMuted ? "mic-off" : "mic"} size={24} color={isMuted ? "#0f0a2e" : "#FFF"} />
                  </Pressable>
                  <ThemedText style={s.ctrlLabel}>{isMuted ? "Unmute" : "Mute"}</ThemedText>
                </View>
                <View style={s.ctrlItem}>
                  <Pressable style={[s.ctrlBtn, isCameraOff && s.ctrlBtnActive]} onPress={toggleCamera}>
                    <Ionicons name={isCameraOff ? "videocam-off" : "videocam"} size={24} color={isCameraOff ? "#0f0a2e" : "#FFF"} />
                  </Pressable>
                  <ThemedText style={s.ctrlLabel}>{isCameraOff ? "Cam On" : "Cam Off"}</ThemedText>
                </View>
                <View style={s.ctrlItem}>
                  <Pressable style={s.ctrlBtn} onPress={flipCamera}>
                    <Ionicons name="camera-reverse" size={24} color="#FFF" />
                  </Pressable>
                  <ThemedText style={s.ctrlLabel}>Flip</ThemedText>
                </View>
                <View style={s.ctrlItem}>
                  <Pressable style={[s.ctrlBtn, !isSpeakerOn && s.ctrlBtnActive]} onPress={toggleSpeaker}>
                    <Ionicons name={isSpeakerOn ? "volume-high" : "ear"} size={24} color={!isSpeakerOn ? "#0f0a2e" : "#FFF"} />
                  </Pressable>
                  <ThemedText style={s.ctrlLabel}>{isSpeakerOn ? "Speaker" : "Earpiece"}</ThemedText>
                </View>
                <View style={s.ctrlItem}>
                  <Animated.View style={{ transform: [{ scale: endBtnScale }] }}>
                    <Pressable
                      style={[s.ctrlBtn, s.redBtn]}
                      onPress={handleEndCall}
                      onPressIn={() => Animated.spring(endBtnScale, { toValue: 0.88, useNativeDriver: true, tension: 220, friction: 8 }).start()}
                      onPressOut={() => Animated.spring(endBtnScale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 8 }).start()}
                    >
                      <Ionicons name="call" size={26} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                    </Pressable>
                  </Animated.View>
                  <ThemedText style={s.ctrlLabel}>End</ThemedText>
                </View>
              </View>
            )}

            {/* Outgoing ringing / connecting: Cancel */}
            {showCancelBtn && (
              <View style={[s.controlsRow, { paddingBottom: insets.bottom + 28 }]}>
                <View style={s.ctrlItem}>
                  <Pressable style={[s.ctrlBtn, s.redBtn]} onPress={handleEndCall}>
                    <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                  </Pressable>
                  <ThemedText style={s.ctrlLabel}>Cancel</ThemedText>
                </View>
              </View>
            )}

            {/* Terminal */}
            {isTerminal && (
              <View style={[s.controlsRow, { paddingBottom: insets.bottom + 28 }]}>
                <View style={s.ctrlItem}>
                  <Pressable
                    style={[s.ctrlBtn, s.closeBtn]}
                    onPress={() => { clearCall(); navigation.canGoBack() && navigation.goBack(); }}
                  >
                    <Ionicons name="close" size={28} color="#FFF" />
                  </Pressable>
                  <ThemedText style={s.ctrlLabel}>Close</ThemedText>
                </View>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

      </Animated.View>
    </View>
  );
}

/* ─── Styles ─── */
const AVATAR_SIZE = Math.min(SW * 0.42, 170);

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject as any, flexDirection: "column" },

  /* Top */
  topOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  topGradient: { paddingBottom: 40 },
  topRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 16,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  topCenter: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  topName: { fontSize: 18, fontWeight: "700", color: "#FFF", textAlign: "center" },
  topStatus: { fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: "500", marginTop: 2 },

  /* Avatar fallback */
  avatarCenter: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center",
    zIndex: 1,
  },
  ring3: {
    position: "absolute",
    width: AVATAR_SIZE + 100, height: AVATAR_SIZE + 100,
    borderRadius: (AVATAR_SIZE + 100) / 2,
    backgroundColor: "rgba(109,40,217,0.06)",
    borderWidth: 1, borderColor: "rgba(196,181,253,0.08)",
  },
  ring2: {
    position: "absolute",
    width: AVATAR_SIZE + 60, height: AVATAR_SIZE + 60,
    borderRadius: (AVATAR_SIZE + 60) / 2,
    backgroundColor: "rgba(109,40,217,0.10)",
    borderWidth: 1, borderColor: "rgba(196,181,253,0.16)",
  },
  ring1: {
    position: "absolute",
    width: AVATAR_SIZE + 28, height: AVATAR_SIZE + 28,
    borderRadius: (AVATAR_SIZE + 28) / 2,
    backgroundColor: "rgba(109,40,217,0.16)",
    borderWidth: 1.5, borderColor: "rgba(196,181,253,0.28)",
  },
  avatarFrame: {
    width: AVATAR_SIZE, height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2, overflow: "hidden",
    borderWidth: 3.5, borderColor: "rgba(196,181,253,0.5)",
    shadowColor: "#7c3aed", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7, shadowRadius: 28, elevation: 18,
  },
  avatarFrameConnected: { borderColor: "rgba(16,185,129,0.65)", shadowColor: "#10B981" },
  avatarFrameTerminal:  { borderColor: "rgba(255,255,255,0.15)", shadowOpacity: 0.15 },
  avatar: { width: "100%", height: "100%" },
  errorPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 20, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 14, backgroundColor: "rgba(248,113,113,0.14)",
    borderWidth: 1, borderColor: "rgba(248,113,113,0.3)",
  },
  errorPillText: { fontSize: 13, color: "#f87171", fontWeight: "500" },

  /* Camera off badge */
  cameraOffBadge: {
    position: "absolute",
    bottom: 140, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, zIndex: 5,
  },
  cameraOffText: { fontSize: 13, color: "#fff", fontWeight: "500" },

  /* Bottom */
  bottomOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10,
  },
  bottomGradient: { paddingTop: 60 },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    alignItems: "flex-start",
    paddingHorizontal: 12,
    paddingTop: 20,
  },
  ctrlItem: { alignItems: "center", gap: 7, flex: 1 },
  ctrlBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
  },
  ctrlBtnActive: { backgroundColor: "#c4b5fd", borderColor: "rgba(196,181,253,0.4)" },
  redBtn: {
    backgroundColor: "#dc2626",
    borderColor: "rgba(220,38,38,0.3)",
    shadowColor: "#dc2626", shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  greenBtn: {
    backgroundColor: "#16a34a",
    borderColor: "rgba(22,163,74,0.3)",
    shadowColor: "#16a34a", shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  closeBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.2)",
  },
  ctrlLabel: {
    fontSize: 11, color: "rgba(255,255,255,0.75)",
    fontWeight: "600", textAlign: "center",
  },
});

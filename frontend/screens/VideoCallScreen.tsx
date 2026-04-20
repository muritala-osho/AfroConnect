import logger from '@/utils/logger';
import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import socketService from "@/services/socket";
import agoraService from "@/services/agoraService";
import { useCallContext, CallStatus } from "@/contexts/CallContext";
import { getApiBaseUrl } from "@/constants/config";

import Constants from "expo-constants";

/* react-native-agora is a native module — not available in Expo Go.
   We lazy-require it so the screen loads normally in Expo Go (no crash),
   and native rendering is used automatically in real dev/production builds. */
let createAgoraRtcEngine: any = null;
let RtcSurfaceView: any       = null;
let VideoSourceType: any      = {};
let ChannelProfileType: any   = {};
let ClientRoleType: any       = {};
let VideoMirrorModeType: any  = {};
let RenderModeType: any       = {};
let OrientationMode: any      = {};
let DegradationPreference: any = {};

const isExpoGo =
  Constants.executionEnvironment === "storeClient" ||
  Constants.appOwnership === "expo";

if (!isExpoGo && Platform.OS !== "web") {
  try {
    const agora = require("react-native-agora");
    createAgoraRtcEngine = agora.createAgoraRtcEngine;
    RtcSurfaceView       = agora.RtcSurfaceView;
    VideoSourceType      = agora.VideoSourceType;
    ChannelProfileType   = agora.ChannelProfileType;
    ClientRoleType       = agora.ClientRoleType;
    VideoMirrorModeType  = agora.VideoMirrorModeType;
    RenderModeType       = agora.RenderModeType;
    OrientationMode      = agora.OrientationMode;
    DegradationPreference = agora.DegradationPreference;
  } catch (e) {
    logger.log("[VideoCall] Native Agora not available — using fallback");
  }
}

const { width: SW, height: SH } = Dimensions.get("window");
const AVATAR_SIZE = Math.min(SW * 0.44, 175);

/* ─────────────────────────────────────────────────────────────────
   Pulse ring
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
        opacity: anim.interpolate({ inputRange: [1, 1.3], outputRange: [0.55, 0] }),
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────
   Video control button
───────────────────────────────────────────────────────────────── */
function VidBtn({
  icon,
  label,
  active = false,
  danger = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  danger?: boolean;
  onPress?: () => void;
}) {
  const bg = danger ? "#dc2626" : active ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.16)";
  const iconColor = active && !danger ? "#111" : "#fff";

  return (
    <Pressable style={vb.wrap} onPress={onPress}>
      <View
        style={[
          vb.btn,
          {
            backgroundColor: bg,
            shadowColor: danger ? "#dc2626" : "transparent",
            shadowOpacity: danger ? 0.5 : 0,
            shadowRadius: 10,
            elevation: danger ? 8 : 0,
          },
        ]}
      >
        <Ionicons name={icon} size={24} color={iconColor} />
      </View>
      <Text style={vb.label}>{label}</Text>
    </Pressable>
  );
}
const vb = StyleSheet.create({
  wrap: { alignItems: "center", gap: 5 },
  btn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 11, color: "rgba(255,255,255,0.60)", fontWeight: "500" },
});

/* ─────────────────────────────────────────────────────────────────
   Main VideoCallScreen
───────────────────────────────────────────────────────────────── */
export default function VideoCallScreen() {
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
  const [callStatus, setCallStatusState] = useState<CallStatus>(
    callAccepted ? "connected" : "connecting",
  );
  const [activeCallData, setActiveCallData] = useState<any>(incomingCallData || null);
  const [isMuted, setIsMuted]             = useState(false);
  const [isCameraOff, setIsCameraOff]     = useState(false);
  const [isSpeakerOn, setIsSpeakerOn]     = useState(true);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [remoteUid, setRemoteUid]         = useState<number | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [networkQuality, setNetworkQuality] = useState(0);
  const [engineReady,   setEngineReady]    = useState(false);

  /* ── Animated values ── */
  const fadeAnim      = useRef(new Animated.Value(0)).current;
  const controlsAnim  = useRef(new Animated.Value(1)).current;
  const pulseAnim1    = useRef(new Animated.Value(1)).current;
  const pulseAnim2    = useRef(new Animated.Value(1)).current;
  const pulseAnim3    = useRef(new Animated.Value(1)).current;
  const endBtnScale   = useRef(new Animated.Value(1)).current;

  /* ── Refs ── */
  const ringtoneRef       = useRef<Audio.Sound | null>(null);
  const shouldRingRef     = useRef(false);
  const ringingTimeout    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engineRef         = useRef<any>(null);
  const agoraJoined       = useRef(false);
  const activeCallDataRef = useRef<any>(incomingCallData || null);
  const callStatusRef     = useRef<CallStatus>(callAccepted ? "connected" : "connecting");
  const controlsTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const duration = activeCall?.duration || 0;

  /* ── setStatus helper ── */
  const setStatus = useCallback(
    (s: CallStatus) => {
      callStatusRef.current = s;
      setCallStatusState(s);
      updateCallStatus(s);
    },
    [updateCallStatus],
  );

  /* ── Auto-hide controls after 4s when connected ── */
  const showControls = useCallback(() => {
    if (callStatusRef.current !== "connected") return;
    setControlsVisible(true);
    Animated.timing(controlsAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      Animated.timing(controlsAnim, { toValue: 0, duration: 380, useNativeDriver: true }).start(
        () => setControlsVisible(false),
      );
    }, 4000);
  }, [controlsAnim]);

  /* ── Stop ringtone ── */
  const stopRingtone = useCallback(async () => {
    shouldRingRef.current = false;
    Vibration.cancel();
    try {
      if (ringtoneRef.current) {
        const snd = ringtoneRef.current;
        ringtoneRef.current = null;
        snd.stopAsync().catch(() => {}).finally(() => snd.unloadAsync().catch(() => {}));
      }
    } catch {}
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
        await sound.stopAsync().catch(() => {});
        await sound.unloadAsync().catch(() => {});
        return;
      }
      ringtoneRef.current = sound;
      if (!shouldRingRef.current) {
        ringtoneRef.current = null;
        await sound.stopAsync().catch(() => {});
        await sound.unloadAsync().catch(() => {});
        return;
      }
      await sound.playAsync().catch(() => {});
      if (isIncoming) Vibration.vibrate([500, 1000, 500], true);
    } catch (err) {
      logger.error("Video ringtone error:", err);
      if (isIncoming && shouldRingRef.current) Vibration.vibrate([500, 1000, 500], true);
    }
  }, [isIncoming, stopRingtone]);

  /* ── Init native Agora engine ── */
  const initEngine = useCallback((callDataObj: any) => {
    if (engineRef.current || Platform.OS === "web" || isExpoGo || !createAgoraRtcEngine) return;
    try {
      const engine = createAgoraRtcEngine();
      engineRef.current = engine;

      engine.initialize({
        appId: callDataObj.appId,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      engine.enableVideo();
      engine.enableAudio();
      engine.setDefaultAudioRouteToSpeakerphone(true);

      engine.setVideoEncoderConfiguration({
        dimensions:           { width: 1280, height: 720 },
        frameRate:            30,
        bitrate:              2000,
        orientationMode:      OrientationMode.OrientationModeAdaptive,
        degradationPreference: DegradationPreference.MaintainQuality,
        mirrorMode:           VideoMirrorModeType.VideoMirrorModeEnabled,
      });

      engine.addListener("onUserJoined", (_conn: any, uid: any) => {
        setRemoteUid(uid);
        setHasRemoteVideo(true);
      });

      engine.addListener("onUserOffline", (_conn: any, _uid: any, _reason: any) => {
        setRemoteUid(null);
        setHasRemoteVideo(false);
        if (callStatusRef.current === "connected") {
          handleEngineEndCall();
        }
      });

      engine.addListener("onNetworkQuality", (_conn: any, uid: any, txQ: any, rxQ: any) => {
        if (uid === 0) setNetworkQuality(Math.max(txQ, rxQ));
      });

      engine.addListener("onRemoteVideoStateChanged", (_conn: any, _uid: any, state: any) => {
        setHasRemoteVideo(state === 2);
      });

      engine.startPreview();
      setEngineReady(true);
    } catch (e) {
      logger.error("[VideoCall] Engine init error:", e);
    }
  }, []);

  /* ── Internal end-call triggered from engine events ── */
  const handleEngineEndCall = useCallback(() => {
    try { engineRef.current?.leaveChannel(); } catch {}
    setStatus("ended");
    stopGlobalTimer();
    clearCall();
    setTimeout(() => navigation.canGoBack() && navigation.goBack(), 600);
  }, [navigation, setStatus, stopGlobalTimer, clearCall]);

  /* ── Join Agora channel ── */
  const joinAgoraVideo = useCallback(
    async (callDataObj: any) => {
      if (agoraJoined.current) return;
      agoraJoined.current = true;

      if (Platform.OS === "web" || isExpoGo || !createAgoraRtcEngine) {
        if (Platform.OS === "web") agoraService.joinVideoCall(callDataObj.appId, callDataObj.channelName, callDataObj.token, callDataObj.uid || 0);
        return;
      }

      if (!engineRef.current) initEngine(callDataObj);

      let joinToken = callDataObj.token;
      let joinUid   = callDataObj.uid || 0;

      if (isIncoming && authToken) {
        try {
          const res = await get<{ token: string; uid: number }>(
            `/agora/token`,
            { channelName: callDataObj.channelName, uid: 0, role: "publisher" },
            authToken,
          );
          if (res.success && res.data?.token) {
            joinToken = res.data.token;
            joinUid   = 0;
          }
        } catch {
          logger.log("Video token fallback");
        }
      }

      try {
        engineRef.current?.joinChannel(joinToken || null, callDataObj.channelName, joinUid, {
          clientRoleType:       ClientRoleType.ClientRoleBroadcaster,
          publishMicrophoneTrack: true,
          publishCameraTrack:     true,
          autoSubscribeAudio:     true,
          autoSubscribeVideo:     true,
        });
      } catch (e) {
        logger.error("[VideoCall] joinChannel error:", e);
      }
    },
    [isIncoming, authToken, get, initEngine],
  );

  /* ── End call ── */
  const handleEndCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const dur = activeCall?.duration || 0;
    setStatus("ended");
    await stopRingtone();
    stopGlobalTimer();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    if (controlsTimer.current) clearTimeout(controlsTimer.current);

    if (Platform.OS === "web") {
      agoraService.leave();
    } else if (!isExpoGo) {
      try { engineRef.current?.leaveChannel(); } catch {}
    }

    socketService.endCall({
      targetUserId: isIncoming ? callerId : userId,
      callType: "video",
      duration: dur,
      wasAnswered: callStatusRef.current === "connected" || dur > 0,
    });
    clearCall();
    setTimeout(() => navigation.canGoBack() && navigation.goBack(), 600);
  }, [callerId, userId, isIncoming, stopRingtone, clearCall, navigation, setStatus, activeCall, stopGlobalTimer]);

  /* ── Minimize ── */
  const handleMinimize = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    minimizeCall();
    if (navigation.canGoBack()) navigation.goBack();
  }, [minimizeCall, navigation]);

  /* ── Decline incoming ── */
  const handleDecline = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await stopRingtone();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    socketService.declineCall({ callerId, callType: "video" });
    if (authToken && isIncoming) {
      post("/call/decline", { callerId, type: "video" }, authToken).catch(() => {});
    }
    setStatus("declined");
    clearCall();
    setTimeout(() => navigation.canGoBack() && navigation.goBack(), 900);
  }, [callerId, isIncoming, authToken, post, stopRingtone, clearCall, navigation, setStatus]);

  /* ── Unified back press handler ── */
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

  /* ── Accept incoming ── */
  const handleAccept = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await stopRingtone();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    socketService.acceptCall({ callerId, callData: activeCallData });
    setStatus("connected");
    startGlobalTimer();
    showControls();
    if (activeCallData) joinAgoraVideo(activeCallData);
  }, [callerId, activeCallData, stopRingtone, joinAgoraVideo, startGlobalTimer, setStatus, showControls]);

  /* ── Toggle mute ── */
  const toggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted((prev) => {
      const next = !prev;
      if (Platform.OS === "web") agoraService.toggleMute(next);
      else if (!isExpoGo) engineRef.current?.muteLocalAudioStream(next);
      return next;
    });
    showControls();
  }, [showControls]);

  /* ── Toggle camera ── */
  const toggleCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsCameraOff((prev) => {
      const next = !prev;
      if (Platform.OS === "web") agoraService.toggleCamera(next);
      else if (!isExpoGo) engineRef.current?.muteLocalVideoStream(next);
      return next;
    });
    showControls();
  }, [showControls]);

  /* ── Flip camera ── */
  const flipCamera = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === "web") agoraService.switchCamera();
    else if (!isExpoGo) engineRef.current?.switchCamera();
    showControls();
  }, [showControls]);

  /* ── Toggle speaker ── */
  const toggleSpeaker = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        playThroughEarpieceAndroid: !next,
      });
    } catch {}
    if (Platform.OS !== "web" && !isExpoGo) engineRef.current?.setEnableSpeakerphone(next);
    showControls();
  }, [isSpeakerOn, showControls]);

  /* ── Initiate outgoing call ── */
  const initiateCall = useCallback(async () => {
    if (!authToken || !userId) return setStatus("failed");
    try {
      const response = await post<any>(
        "/agora/call/initiate",
        { targetUserId: userId, callType: "video" },
        authToken,
      );
      if (response.success && response.data?.callData) {
        const cd = response.data.callData;
        setActiveCallData(cd);
        activeCallDataRef.current = cd;

        if (Platform.OS !== "web") initEngine(cd);

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
            socketService.missedCall?.({ targetUserId: userId, callType: "video" });
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
  }, [authToken, userId, post, user, navigation, setStatus, clearCall, initEngine]);

  /* ── Release engine on unmount ── */
  const releaseEngine = useCallback(() => {
    if (!engineRef.current || Platform.OS === "web" || isExpoGo) return;
    try {
      engineRef.current.removeAllListeners();
      engineRef.current.leaveChannel();
      engineRef.current.release();
      engineRef.current = null;
      agoraJoined.current = false;
      setEngineReady(false);
    } catch {}
  }, []);

  /* ── Setup effect ── */
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: true }).start();

    setIsOnCallScreen(true);
    maximizeCall();

    setActiveCall({
      userId: userId || callerId || "",
      userName: userName || "Unknown",
      userPhoto,
      isIncoming: !!isIncoming,
      callStatus: callAccepted ? "connected" : "connecting",
      callType: "video",
      duration: 0,
    });

    if (callAccepted) {
      setStatus("connected");
      startGlobalTimer();
      showControls();
      if (activeCallDataRef.current) joinAgoraVideo(activeCallDataRef.current);
    } else if (returnToCall) {
      setStatus("connected");
      showControls();
    } else if (isIncoming) {
      setStatus("ringing");
      ringingTimeout.current = setTimeout(async () => {
        if (callStatusRef.current === "ringing") {
          await stopRingtone();
          socketService.declineCall({ callerId, callType: "video" });
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
      showControls();
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
      else if (!isExpoGo) { try { engineRef.current?.leaveChannel(); } catch {} }
      setStatus("ended");
      stopGlobalTimer();
      clearCall();
      setTimeout(() => navigation.canGoBack() && navigation.goBack(), 1200);
    });

    return () => {
      setIsOnCallScreen(false);
      stopRingtone();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      socketService.off("call:accepted");
      socketService.off("call:declined");
      socketService.off("call:busy");
      socketService.off("call:ended");
      releaseEngine();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Ringtone on status change ── */
  useEffect(() => {
    if (callStatus === "ringing") playRingtone();
    else stopRingtone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus]);

  /* ── Audio mode for active call ── */
  useEffect(() => {
    if (callStatus !== "connected") return;
    Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus]);

  /* ── Pulse ring animation ── */
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

  /* ── Free-tier 5-min limit ── */
  useEffect(() => {
    if (user?.premium?.isActive || callStatus !== "connected") return;
    if (duration === 240) {
      Alert.alert(
        "1 Minute Remaining",
        "Free calls are limited to 5 minutes. Upgrade to Premium for unlimited calls.",
        [
          { text: "Continue", style: "cancel" },
          { text: "Upgrade", style: "default", onPress: () => {} },
        ],
      );
    }
    if (duration >= 300) handleEndCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, callStatus]);

  /* ── Derived state ── */
  const isConnected  = callStatus === "connected";
  const isTerminal   = ["ended", "declined", "missed", "failed", "busy"].includes(callStatus);
  const isWaiting    = !isIncoming && callStatus === "ringing";
  const showIncoming = isIncoming && callStatus === "ringing";
  const showCancel   = callStatus === "connecting" || isWaiting;
  const nativeVideo  = Platform.OS !== "web" && !isExpoGo && !!createAgoraRtcEngine;
  const showVideo    = (isConnected || (!isIncoming && (callStatus === "connecting" || callStatus === "ringing"))) && nativeVideo;

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const statusText = (): string => {
    switch (callStatus) {
      case "connecting": return "Connecting…";
      case "ringing":    return isIncoming ? "Incoming video call" : "Ringing…";
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
    if (callStatus === "busy")     return "User is in another call";
    if (callStatus === "declined") return "Call was declined";
    if (callStatus === "missed")   return "No answer";
    return "Unable to connect";
  };

  /* ── Render ── */
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background blurred avatar — visible until video starts */}
      {!showVideo && (
        <>
          <SafeImage
            source={{ uri: userPhoto || "https://via.placeholder.com/400" }}
            style={StyleSheet.absoluteFillObject as any}
            blurRadius={Platform.OS === "ios" ? 65 : 20}
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.55)", "rgba(5,10,25,0.45)", "rgba(0,0,0,0.60)"]}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}

      {/* ── NATIVE VIDEO VIEWS (iOS / Android, not Expo Go) ── */}
      {nativeVideo && engineReady && RtcSurfaceView && (

        <>
          {/* Remote video — full-screen, shown when connected and remote joined */}
          {isConnected && hasRemoteVideo && remoteUid !== null && (
            <RtcSurfaceView
              canvas={{
                uid: remoteUid,
                renderMode: RenderModeType.RenderModeHidden,
              }}
              style={StyleSheet.absoluteFillObject}
            />
          )}

          {/* Local self-view */}
          {showVideo && !isCameraOff && (
            <RtcSurfaceView
              canvas={{
                uid: 0,
                sourceType: VideoSourceType.VideoSourceCamera,
                renderMode: RenderModeType.RenderModeHidden,
                mirrorMode: VideoMirrorModeType.VideoMirrorModeEnabled,
              }}
              style={isConnected && hasRemoteVideo ? s.localPip : StyleSheet.absoluteFillObject}
            />
          )}

          {/* Camera-off placeholder in PiP */}
          {isConnected && hasRemoteVideo && isCameraOff && (
            <View style={[s.localPip, s.camOffPip]}>
              <Ionicons name="videocam-off" size={18} color="rgba(255,255,255,0.5)" />
            </View>
          )}
        </>
      )}

      {/* ── UI OVERLAY ── */}
      <Animated.View style={[s.overlay, { opacity: fadeAnim }]} pointerEvents="box-none">

        {/* Tap to show controls */}
        {isConnected && !controlsVisible && (
          <Pressable style={StyleSheet.absoluteFillObject} onPress={showControls} />
        )}

        {/* ── TOP GRADIENT + header ── */}
        <Animated.View
          style={[s.topOverlay, { opacity: isConnected ? controlsAnim : 1 }]}
          pointerEvents={isConnected && !controlsVisible ? "none" : "box-none"}
        >
          <LinearGradient
            colors={["rgba(0,0,0,0.50)", "transparent"]}
            style={s.topGrad}
          >
            <View style={[s.topRow, { paddingTop: insets.top + 16 }]}>
              <Pressable style={s.topBtn} hitSlop={12} onPress={handleBackPress}>
                <Ionicons
                  name={isConnected ? "chevron-down" : "arrow-back"}
                  size={22}
                  color="#fff"
                />
              </Pressable>

              <View style={s.topInfo}>
                <Text style={s.topName} numberOfLines={1}>{userName || "Unknown"}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, justifyContent: "center" }}>
                  <Text style={[s.topStatus, isTerminal && { color: "#f87171" }]}>
                    {isConnected && duration > 0 ? formatDuration(duration) : statusText()}
                  </Text>
                  {isConnected && networkQuality >= 4 && (
                    <View style={s.qualityBadge}>
                      <Ionicons name="wifi" size={10} color="#fbbf24" />
                      <Text style={s.qualityText}>
                        {networkQuality === 6 ? "No signal" : "Weak signal"}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {isConnected && isCameraOff ? (
                <View style={s.camOffBadge}>
                  <Ionicons name="videocam-off" size={14} color="#fff" />
                </View>
              ) : (
                <View style={{ width: 38 }} />
              )}
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── AVATAR (when no remote video or not connected) ── */}
        {(!isConnected || !hasRemoteVideo) && (
          <View style={s.avatarCenter}>
            <View style={[
              s.avatarFrame,
              isConnected && s.avatarFrameConnected,
              isTerminal && s.avatarFrameTerminal,
            ]}>
              {(callStatus === "ringing" || callStatus === "connecting") && (
                <>
                  <PulseRing anim={pulseAnim1} size={AVATAR_SIZE + 20} />
                  <PulseRing anim={pulseAnim2} size={AVATAR_SIZE + 40} />
                  <PulseRing anim={pulseAnim3} size={AVATAR_SIZE + 60} />
                </>
              )}
              <SafeImage
                source={{ uri: userPhoto || "https://via.placeholder.com/200" }}
                style={s.avatarImg}
                contentFit="cover"
              />
            </View>

            {isTerminal && callStatus !== "ended" && (
              <View style={s.errorPill}>
                <Ionicons name="close-circle" size={14} color="#f87171" />
                <Text style={s.errorText}>{terminalMsg()}</Text>
              </View>
            )}

            {(callStatus === "ringing" || callStatus === "connecting") && (
              <View style={s.e2eBadge}>
                <Ionicons name="lock-closed" size={10} color="#34d399" />
                <Text style={s.e2eText}>End-to-end encrypted</Text>
              </View>
            )}
          </View>
        )}

        {/* ── BOTTOM GRADIENT + controls ── */}
        <Animated.View
          style={[s.bottomOverlay, { opacity: isConnected ? controlsAnim : 1 }]}
          pointerEvents={isConnected && !controlsVisible ? "none" : "box-none"}
        >
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.60)"]}
            style={s.bottomGrad}
          >
            {/* INCOMING: Decline + Accept */}
            {showIncoming && (
              <View style={[s.ctrlRow, { paddingBottom: insets.bottom + 28 }]}>
                <View style={s.ctrlItem}>
                  <Pressable style={[s.bigBtn, s.redBtn]} onPress={handleDecline}>
                    <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
                  </Pressable>
                  <Text style={s.bigBtnLabel}>Decline</Text>
                </View>
                <View style={s.ctrlItem}>
                  <Pressable style={[s.bigBtn, s.greenBtn]} onPress={handleAccept}>
                    <Ionicons name="videocam" size={30} color="#fff" />
                  </Pressable>
                  <Text style={s.bigBtnLabel}>Accept</Text>
                </View>
              </View>
            )}

            {/* CONNECTED: full controls */}
            {isConnected && (
              <View style={[s.ctrlRow, { paddingBottom: insets.bottom + 28 }]}>
                <VidBtn icon={isMuted ? "mic-off" : "mic"} label={isMuted ? "Unmute" : "Mute"} active={isMuted} onPress={toggleMute} />
                <VidBtn icon={isCameraOff ? "videocam-off" : "videocam"} label={isCameraOff ? "Cam On" : "Cam Off"} active={isCameraOff} onPress={toggleCamera} />
                <VidBtn icon="camera-reverse" label="Flip" onPress={flipCamera} />
                <VidBtn icon={isSpeakerOn ? "volume-high" : "ear"} label={isSpeakerOn ? "Speaker" : "Earpiece"} active={!isSpeakerOn} onPress={toggleSpeaker} />
                <View style={vb.wrap}>
                  <Animated.View style={{ transform: [{ scale: endBtnScale }] }}>
                    <Pressable
                      style={[s.bigBtn, s.redBtn]}
                      onPress={handleEndCall}
                      onPressIn={() => Animated.spring(endBtnScale, { toValue: 0.88, useNativeDriver: true, tension: 220, friction: 8 }).start()}
                      onPressOut={() => Animated.spring(endBtnScale, { toValue: 1, useNativeDriver: true, tension: 220, friction: 8 }).start()}
                    >
                      <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
                    </Pressable>
                  </Animated.View>
                  <Text style={vb.label}>End</Text>
                </View>
              </View>
            )}

            {/* OUTGOING / CONNECTING: Cancel */}
            {showCancel && (
              <View style={[s.ctrlRow, { paddingBottom: insets.bottom + 28 }]}>
                <View style={s.ctrlItem}>
                  <Pressable style={[s.bigBtn, s.redBtn]} onPress={handleEndCall}>
                    <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
                  </Pressable>
                  <Text style={s.bigBtnLabel}>Cancel</Text>
                </View>
              </View>
            )}

            {/* TERMINAL: Close */}
            {isTerminal && (
              <View style={[s.ctrlRow, { paddingBottom: insets.bottom + 28 }]}>
                <View style={s.ctrlItem}>
                  <Pressable style={s.bigBtn} onPress={() => { clearCall(); navigation.canGoBack() && navigation.goBack(); }}>
                    <Ionicons name="close" size={28} color="#fff" />
                  </Pressable>
                  <Text style={s.bigBtnLabel}>Close</Text>
                </View>
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Styles
───────────────────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject },

  topOverlay: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  topGrad:    { paddingBottom: 40 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  topInfo: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  topName: {
    fontSize: 16, fontWeight: "700", color: "#fff",
    textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  topStatus: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 2, fontVariant: ["tabular-nums"] },
  camOffBadge: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(220,38,38,0.70)",
    alignItems: "center", justifyContent: "center",
  },
  qualityBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
    backgroundColor: "rgba(251,191,36,0.18)", borderWidth: 1, borderColor: "rgba(251,191,36,0.35)",
  },
  qualityText: { fontSize: 10, color: "#fbbf24", fontWeight: "600" },

  avatarCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center", justifyContent: "center",
    paddingTop: 100, paddingBottom: 160,
  },
  avatarFrame: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden", borderWidth: 3, borderColor: "rgba(52,211,153,0.50)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#10b981", shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 24, elevation: 16,
  },
  avatarFrameConnected: { borderColor: "rgba(255,255,255,0.30)" },
  avatarFrameTerminal:  { borderColor: "rgba(248,113,113,0.40)" },
  avatarImg: { width: "100%", height: "100%" },

  errorPill: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14,
    backgroundColor: "rgba(248,113,113,0.12)", borderWidth: 1, borderColor: "rgba(248,113,113,0.28)",
  },
  errorText: { fontSize: 13, color: "#f87171", fontWeight: "500" },

  e2eBadge: {
    flexDirection: "row", alignItems: "center", gap: 5, marginTop: 12,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
    backgroundColor: "rgba(52,211,153,0.10)", borderWidth: 1, borderColor: "rgba(52,211,153,0.25)",
  },
  e2eText: { fontSize: 11, color: "rgba(52,211,153,0.80)", fontWeight: "500" },

  bottomOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10 },
  bottomGrad:    { paddingTop: 60 },

  ctrlRow: { flexDirection: "row", justifyContent: "space-evenly", alignItems: "flex-end", paddingHorizontal: 16 },
  ctrlItem: { alignItems: "center", gap: 6 },

  bigBtn: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  redBtn: {
    backgroundColor: "#dc2626",
    shadowColor: "#dc2626", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 12, elevation: 10,
  },
  greenBtn: {
    backgroundColor: "#10b981",
    shadowColor: "#10b981", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55, shadowRadius: 12, elevation: 10,
  },
  bigBtnLabel: { fontSize: 12, color: "rgba(255,255,255,0.65)", fontWeight: "500" },

  /* Native video PiP (self-view when remote is present) */
  localPip: {
    position: "absolute",
    bottom: 170,
    right: 16,
    width: 110,
    height: 150,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    zIndex: 5,
  },
  camOffPip: {
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
});

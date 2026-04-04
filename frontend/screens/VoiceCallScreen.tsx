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
import WebView from "react-native-webview";

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
  } = route.params || {};

  const { token: authToken, user } = useAuth();
  const { post, get } = useApi();

  type CallStatus = "connecting" | "ringing" | "connected" | "ended" | "failed" | "busy" | "declined" | "missed";

  const [callStatus, setCallStatus] = useState<CallStatus>("connecting");
  const [duration, setDuration] = useState(0);
  const [activeCallData, setActiveCallData] = useState<any>(incomingCallData || null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [webviewReady, setWebviewReady] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const pulseAnim3 = useRef(new Animated.Value(1)).current;
  const ringtoneRef = useRef<Audio.Sound | null>(null);
  const shouldRingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ringingTimeout = useRef<NodeJS.Timeout | null>(null);
  const webViewRef = useRef<WebView | null>(null);
  const agoraJoined = useRef(false);
  const activeCallDataRef = useRef<any>(incomingCallData || null);

  const stopRingtoneSound = useCallback(async () => {
    shouldRingRef.current = false;
    try {
      if (ringtoneRef.current) {
        const s = ringtoneRef.current;
        ringtoneRef.current = null;
        await s.stopAsync();
        await s.unloadAsync();
      }
      Vibration.cancel();
    } catch (err) {
      console.log("Ringtone cleanup error:", err);
    }
  }, []);

  const playRingtone = useCallback(async () => {
    shouldRingRef.current = true;
    try {
      if (ringtoneRef.current) {
        const old = ringtoneRef.current;
        ringtoneRef.current = null;
        await old.stopAsync().catch(() => {});
        await old.unloadAsync().catch(() => {});
      }
      Vibration.cancel();
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
  }, [isIncoming]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setDuration((prev) => prev + 1), 1000);
  };

  const sendToWebView = useCallback((msg: any) => {
    if (webViewRef.current) {
      webViewRef.current.postMessage(JSON.stringify(msg));
    }
  }, []);

  const joinAgoraVoice = useCallback(async (callDataObj: any) => {
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
      } catch (e) {
        console.log("Failed to get receiver token, using shared token");
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
  }, [isIncoming, authToken, get, sendToWebView]);

  const handleEndCall = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const wasConnected = callStatus === "connected";
    setCallStatus("ended");
    await stopRingtoneSound();
    if (timerRef.current) clearInterval(timerRef.current);
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);

    if (Platform.OS === "web") {
      agoraService.leave();
    } else {
      sendToWebView({ action: "leave" });
    }

    socketService.endCall({
      targetUserId: isIncoming ? callerId : userId,
      callType: "audio",
      duration,
      wasAnswered: wasConnected,
    });
    setTimeout(() => navigation.goBack(), 500);
  }, [callStatus, duration, callerId, userId, isIncoming, stopRingtoneSound, sendToWebView, navigation]);

  useEffect(() => {
    const isPremium = user?.premium?.isActive;
    if (isPremium || callStatus !== 'connected') return;
    if (duration === 240) {
      Alert.alert(
        '1 Minute Remaining',
        'Free calls are limited to 5 minutes. Upgrade to Premium for unlimited call time.',
        [{ text: 'OK' }]
      );
    }
    if (duration >= 300) {
      handleEndCall();
    }
  }, [duration, callStatus, user, handleEndCall]);

  const handleAccept = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await stopRingtoneSound();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    socketService.acceptCall({ callerId, callData: activeCallData });
    setCallStatus("connected");
    startTimer();
    if (activeCallData) joinAgoraVoice(activeCallData);
  }, [callerId, activeCallData, stopRingtoneSound, joinAgoraVoice]);

  const handleDecline = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await stopRingtoneSound();
    if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
    socketService.declineCall({ callerId, callType: "audio" });
    if (authToken && isIncoming) {
      post("/call/decline", { callerId, type: "audio" }, authToken).catch(() => {});
    }
    setCallStatus("declined");
    setTimeout(() => navigation.goBack(), 1000);
  }, [callerId, isIncoming, authToken, post, stopRingtoneSound, navigation]);

  const toggleMute = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMuted((prev) => {
      const next = !prev;
      if (Platform.OS === "web") {
        agoraService.toggleMute(next);
      } else {
        sendToWebView({ action: "mute", muted: next });
      }
      return next;
    });
  }, [sendToWebView]);

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

  const initiateCall = useCallback(async () => {
    if (!authToken || !userId) return setCallStatus("failed");
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
        setCallStatus("ringing");

        const photoVal = user?.photos?.[0];
        const photoUrl = typeof photoVal === "string" ? photoVal : (photoVal as any)?.url || "";
        socketService.initiateCall({
          targetUserId: userId,
          callData: cd,
          callerInfo: { name: user?.name || "User", photo: photoUrl, id: user?.id || "" },
        });

        ringingTimeout.current = setTimeout(() => {
          setCallStatus("missed");
          socketService.missedCall?.({ targetUserId: userId, callType: "voice" });
          setTimeout(() => navigation.goBack(), 2000);
        }, 30000);
      } else {
        setCallStatus("failed");
      }
    } catch {
      setCallStatus("failed");
    }
  }, [authToken, userId, post, user, navigation]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    if (isIncoming) {
      setCallStatus("ringing");
    } else {
      initiateCall();
    }

    socketService.onCallAccepted(async () => {
      await stopRingtoneSound();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setCallStatus("connected");
      startTimer();
      if (activeCallDataRef.current) joinAgoraVoice(activeCallDataRef.current);
    });

    socketService.onCallDeclined(async () => {
      await stopRingtoneSound();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setCallStatus("declined");
      setTimeout(() => navigation.goBack(), 1500);
    });

    socketService.onCallBusy(async () => {
      await stopRingtoneSound();
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      setCallStatus("busy");
      setTimeout(() => navigation.goBack(), 2000);
    });

    socketService.onCallEnded(async () => {
      await stopRingtoneSound();
      if (Platform.OS === "web") agoraService.leave();
      else sendToWebView({ action: "leave" });
      setCallStatus("ended");
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeout(() => navigation.goBack(), 1200);
    });

    return () => {
      stopRingtoneSound();
      if (Platform.OS === "web") agoraService.leave();
      else sendToWebView({ action: "leave" });
      if (timerRef.current) clearInterval(timerRef.current);
      if (ringingTimeout.current) clearTimeout(ringingTimeout.current);
      socketService.off("call:accepted");
      socketService.off("call:declined");
      socketService.off("call:busy");
      socketService.off("call:ended");
    };
  }, []);

  useEffect(() => {
    if (callStatus === "ringing") playRingtone();
    else stopRingtoneSound();
  }, [callStatus]);

  // Pulse animation - 3 staggered rings
  useEffect(() => {
    if (callStatus === "ringing" || callStatus === "connecting") {
      const makeLoop = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1.25, duration: 900, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
          ])
        );
      const l1 = makeLoop(pulseAnim, 0);
      const l2 = makeLoop(pulseAnim2, 300);
      const l3 = makeLoop(pulseAnim3, 600);
      l1.start();
      l2.start();
      l3.start();
      return () => { l1.stop(); l2.stop(); l3.stop(); };
    } else {
      pulseAnim.setValue(1);
      pulseAnim2.setValue(1);
      pulseAnim3.setValue(1);
    }
  }, [callStatus]);

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const getStatusText = () => {
    switch (callStatus) {
      case "connecting": return "Connecting...";
      case "ringing": return isIncoming ? "Incoming voice call..." : "Ringing...";
      case "connected": return formatDuration(duration);
      case "ended": return "Call ended";
      case "declined": return "Call declined";
      case "busy": return "User is busy";
      case "missed": return "No answer";
      case "failed": return "Call failed";
      default: return "";
    }
  };

  useEffect(() => {
    if (webviewReady && callStatus === 'connected' && activeCallDataRef.current && !agoraJoined.current) {
      joinAgoraVoice(activeCallDataRef.current);
    }
  }, [webviewReady]);

  const agoraCallUrl = `${getApiBaseUrl()}/public/agora-call.html`;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Background gradient */}
      <LinearGradient
        colors={["#12003a", "#1e0a52", "#0b1a2c"]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft ambient blobs */}
      <View style={styles.blobTop} />
      <View style={styles.blobMid} />
      <View style={styles.blobBottom} />

      {/* Hidden WebView for native Agora audio */}
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
          onPermissionRequest={(request) => { request.grant(request.resources); }}
          onLoad={() => { setWebviewReady(true); }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === "joined") console.log("Voice WebView joined:", data.uid);
              if (data.type === "error") console.log("Voice WebView error:", data.message);
            } catch (e) {}
          }}
        />
      )}

      <Animated.View style={[styles.screen, { opacity: fadeAnim }]}>

        {/* ── TOP SECTION ── */}
        <View style={[styles.topSection, { paddingTop: insets.top + 20 }]}>
          {/* Call type pill */}
          <View style={styles.callTypePill}>
            <Ionicons name="call" size={12} color="#c4b5fd" />
            <ThemedText style={styles.callTypePillText}>
              {isIncoming && callStatus === "ringing" ? "Incoming Voice Call" : "Voice Call"}
            </ThemedText>
          </View>

          {/* Name & status directly below pill */}
          <ThemedText style={styles.userName}>{userName || "Unknown"}</ThemedText>
          <ThemedText style={styles.statusText}>{getStatusText()}</ThemedText>

          {/* Connected badge */}
          {callStatus === "connected" && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <ThemedText style={styles.liveBadgeText}>Connected</ThemedText>
            </View>
          )}

          {/* Encrypted badge */}
          {(callStatus === "ringing" || callStatus === "connecting") && (
            <View style={styles.encryptedBadge}>
              <Ionicons name="lock-closed" size={10} color="rgba(196,181,253,0.75)" />
              <ThemedText style={styles.encryptedText}>End-to-end encrypted</ThemedText>
            </View>
          )}
        </View>

        {/* ── MIDDLE SECTION — Avatar with pulse rings ── */}
        <View style={styles.avatarSection}>
          {/* Concentric pulse rings — all sized relative to avatar */}
          <Animated.View style={[styles.ring, styles.ring3, { transform: [{ scale: pulseAnim3 }] }]} />
          <Animated.View style={[styles.ring, styles.ring2, { transform: [{ scale: pulseAnim2 }] }]} />
          <Animated.View style={[styles.ring, styles.ring1, { transform: [{ scale: pulseAnim }] }]} />

          {/* Avatar */}
          <View style={styles.avatarFrame}>
            <View style={styles.avatarInner}>
              <SafeImage
                source={{ uri: userPhoto || "https://via.placeholder.com/150" }}
                style={styles.avatar}
              />
            </View>
          </View>
        </View>

        {/* ── BOTTOM CONTROLS ── */}
        <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 32 }]}>

          {/* INCOMING: decline / accept */}
          {isIncoming && callStatus === "ringing" && (
            <View style={styles.incomingRow}>
              <View style={styles.incomingBtnWrap}>
                <Pressable style={[styles.circleBtn, styles.declineBtn]} onPress={handleDecline}>
                  <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                </Pressable>
                <ThemedText style={styles.btnLabel}>Decline</ThemedText>
              </View>
              <View style={styles.incomingBtnWrap}>
                <Pressable style={[styles.circleBtn, styles.acceptBtn]} onPress={handleAccept}>
                  <Ionicons name="call" size={28} color="#FFF" />
                </Pressable>
                <ThemedText style={styles.btnLabel}>Accept</ThemedText>
              </View>
            </View>
          )}

          {/* CONNECTED: mute / speaker / message + hang up */}
          {callStatus === "connected" && (
            <View style={styles.glassPanel}>
              <View style={styles.secondaryRow}>
                <View style={styles.controlWrap}>
                  <Pressable
                    style={[styles.secondaryBtn, isMuted && styles.secondaryBtnActive]}
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

                <View style={styles.controlWrap}>
                  <Pressable
                    style={[styles.secondaryBtn, isSpeakerOn && styles.secondaryBtnActive]}
                    onPress={toggleSpeaker}
                  >
                    <Ionicons
                      name={isSpeakerOn ? "volume-high" : "ear"}
                      size={22}
                      color={isSpeakerOn ? "#1a0533" : "#FFF"}
                    />
                  </Pressable>
                  <ThemedText style={styles.btnLabel}>{isSpeakerOn ? "Earpiece" : "Speaker"}</ThemedText>
                </View>

              </View>

              {/* Hang up row */}
              <View style={styles.hangupWrap}>
                <Pressable style={styles.hangupBtn} onPress={handleEndCall}>
                  <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
                </Pressable>
                <ThemedText style={styles.btnLabel}>Hang Up</ThemedText>
              </View>
            </View>
          )}

          {/* CONNECTING / OUTGOING RINGING: cancel */}
          {(callStatus === "connecting" || (!isIncoming && callStatus === "ringing")) && (
            <View style={styles.cancelWrap}>
              <Pressable style={[styles.circleBtn, styles.declineBtn]} onPress={handleEndCall}>
                <Ionicons name="call" size={28} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
              </Pressable>
              <ThemedText style={styles.btnLabel}>Cancel</ThemedText>
            </View>
          )}

          {/* ENDED / DECLINED / etc.: dismiss */}
          {(callStatus === "ended" || callStatus === "declined" || callStatus === "missed" || callStatus === "failed" || callStatus === "busy") && (
            <View style={styles.cancelWrap}>
              <Pressable style={[styles.circleBtn, styles.dismissBtn]} onPress={() => navigation.goBack()}>
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

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ── Full-screen animated wrapper ──
  screen: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "space-between",
  },

  // ── Ambient blobs ──
  blobTop: {
    position: "absolute",
    top: -100,
    left: -70,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(124,58,237,0.2)",
  },
  blobMid: {
    position: "absolute",
    top: 280,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(79,70,229,0.12)",
  },
  blobBottom: {
    position: "absolute",
    bottom: -80,
    left: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(37,99,235,0.15)",
  },

  // ── Top section: pill + name + status ──
  topSection: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 12,
    gap: 0,
  },

  callTypePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(124,58,237,0.18)",
    borderWidth: 1,
    borderColor: "rgba(196,181,253,0.3)",
    marginBottom: 20,
  },
  callTypePillText: {
    fontSize: 12,
    color: "#c4b5fd",
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  userName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    marginBottom: 6,
  },
  statusText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.55)",
    fontWeight: "500",
    letterSpacing: 0.8,
    textAlign: "center",
    marginBottom: 4,
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(16,185,129,0.14)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.35)",
    gap: 7,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  liveBadgeText: { fontSize: 12, color: "#10B981", fontWeight: "700" },

  encryptedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    gap: 5,
  },
  encryptedText: {
    fontSize: 11,
    color: "rgba(196,181,253,0.65)",
    fontWeight: "500",
  },

  // ── Avatar section ──
  avatarSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    // extra space so the outermost pulse ring doesn't clip
    paddingVertical: 20,
  },

  // Pulse rings — sized to exceed avatar frame so they appear outside it
  ring: {
    position: "absolute",
    borderRadius: 999,
  },
  ring1: {
    width: 178,
    height: 178,
    backgroundColor: "rgba(124,58,237,0.14)",
    borderWidth: 1.5,
    borderColor: "rgba(167,139,250,0.3)",
  },
  ring2: {
    width: 220,
    height: 220,
    backgroundColor: "rgba(124,58,237,0.07)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.15)",
  },
  ring3: {
    width: 264,
    height: 264,
    backgroundColor: "rgba(124,58,237,0.03)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.07)",
  },

  avatarFrame: {
    width: 152,
    height: 152,
    borderRadius: 76,
    padding: 4,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 2.5,
    borderColor: "rgba(196,181,253,0.4)",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 14,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 72,
    overflow: "hidden",
  },
  avatar: { width: "100%", height: "100%" },

  // ── Bottom controls container ──
  bottomContainer: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  // Incoming call buttons row
  incomingRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
    paddingHorizontal: 20,
  },
  incomingBtnWrap: { alignItems: "center", gap: 10 },

  // Connected state glass panel
  glassPanel: {
    width: "100%",
    alignItems: "center",
    gap: 22,
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 20,
    backgroundColor: "rgba(10,6,25,0.65)",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },

  secondaryRow: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    width: "100%",
  },
  controlWrap: { alignItems: "center", gap: 8, minWidth: 64 },

  hangupWrap: { alignItems: "center", gap: 8 },
  hangupBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 10,
  },

  cancelWrap: { alignItems: "center", gap: 10 },

  // Circle buttons (accept / decline / cancel)
  circleBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
  acceptBtn: {
    backgroundColor: "#10B981",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
  },
  declineBtn: {
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
  },
  dismissBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
  },

  // Small secondary action buttons (mute / speaker / message)
  secondaryBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  secondaryBtnActive: {
    backgroundColor: "#EEE9FF",
    borderColor: "transparent",
  },

  btnLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
    letterSpacing: 0.2,
    textAlign: "center",
  },
});

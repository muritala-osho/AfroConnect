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

  const navigateToChat = useCallback(() => {
    handleEndCall();
    setTimeout(() => {
      navigation.navigate("ChatDetail", {
        userId: isIncoming ? callerId : userId,
        userName,
        matchId,
      });
    }, 600);
  }, [handleEndCall, navigation, isIncoming, callerId, userId, userName, matchId]);

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

  // Pulse animation
  useEffect(() => {
    if (callStatus === "ringing" || callStatus === "connecting") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
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
      <LinearGradient colors={["#0f0c29", "#302b63", "#24243e"]} style={StyleSheet.absoluteFill} />

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
          onPermissionRequest={(request) => {
            request.grant(request.resources);
          }}
          onLoad={() => {
            setWebviewReady(true);
          }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === "joined") console.log("Voice WebView joined:", data.uid);
              if (data.type === "error") console.log("Voice WebView error:", data.message);
            } catch (e) {}
          }}
        />
      )}

      <Animated.View style={[styles.centerSection, { opacity: fadeAnim, paddingTop: insets.top + 20 }]}>
        <Animated.View style={[styles.avatarRing, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.avatarWrapper}>
            <SafeImage
              source={{ uri: userPhoto || "https://via.placeholder.com/150" }}
              style={styles.avatar}
            />
          </View>
        </Animated.View>
        <ThemedText style={styles.userName}>{userName || "Unknown"}</ThemedText>
        <ThemedText style={styles.statusText}>{getStatusText()}</ThemedText>

        {callStatus === "connected" && (
          <View style={styles.callBadge}>
            <View style={styles.liveDot} />
            <ThemedText style={styles.callBadgeText}>Voice Call</ThemedText>
          </View>
        )}
      </Animated.View>

      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 40 }]}>
        {isIncoming && callStatus === "ringing" ? (
          <View style={styles.incomingRow}>
            <View style={styles.incomingBtnWrap}>
              <Pressable style={[styles.circleBtn, styles.declineBtn]} onPress={handleDecline}>
                <Ionicons name="call" size={32} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
              </Pressable>
              <ThemedText style={styles.btnLabel}>Decline</ThemedText>
            </View>
            <View style={styles.incomingBtnWrap}>
              <Pressable style={[styles.circleBtn, styles.acceptBtn]} onPress={handleAccept}>
                <Ionicons name="call" size={32} color="#FFF" />
              </Pressable>
              <ThemedText style={styles.btnLabel}>Accept</ThemedText>
            </View>
          </View>
        ) : callStatus === "connected" ? (
          <>
            <View style={styles.secondaryRow}>
              <View style={styles.controlWrap}>
                <Pressable
                  style={[styles.secondaryBtn, isMuted && styles.secondaryBtnActive]}
                  onPress={toggleMute}
                >
                  <Ionicons
                    name={isMuted ? "mic-off" : "mic"}
                    size={24}
                    color={isMuted ? "#000" : "#FFF"}
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
                    size={24}
                    color={isSpeakerOn ? "#000" : "#FFF"}
                  />
                </Pressable>
                <ThemedText style={styles.btnLabel}>{isSpeakerOn ? "Earpiece" : "Speaker"}</ThemedText>
              </View>

              <View style={styles.controlWrap}>
                <Pressable style={styles.secondaryBtn} onPress={navigateToChat}>
                  <MaterialCommunityIcons name="message-text" size={24} color="#FFF" />
                </Pressable>
                <ThemedText style={styles.btnLabel}>Message</ThemedText>
              </View>
            </View>

            <View style={styles.hangupRow}>
              <Pressable style={[styles.circleBtn, styles.declineBtn, styles.hangupBtn]} onPress={handleEndCall}>
                <Ionicons name="call" size={34} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
              </Pressable>
              <ThemedText style={styles.btnLabel}>Hang Up</ThemedText>
            </View>
          </>
        ) : callStatus === "connecting" || (!isIncoming && callStatus === "ringing") ? (
          <View style={styles.hangupRow}>
            <Pressable style={[styles.circleBtn, styles.declineBtn, styles.hangupBtn]} onPress={handleEndCall}>
              <Ionicons name="call" size={34} color="#FFF" style={{ transform: [{ rotate: "135deg" }] }} />
            </Pressable>
            <ThemedText style={styles.btnLabel}>Cancel</ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  avatarRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    marginBottom: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: "hidden",
  },
  avatar: { width: "100%", height: "100%" },
  userName: { fontSize: 32, fontWeight: "700", color: "#FFF", letterSpacing: 0.3 },
  statusText: {
    fontSize: 17,
    color: "rgba(255,255,255,0.65)",
    marginTop: 10,
    letterSpacing: 1.5,
  },
  callBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(16,185,129,0.15)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    gap: 8,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  callBadgeText: { fontSize: 13, color: "#10B981", fontWeight: "600" },
  bottomContainer: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 24,
  },
  incomingRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
    paddingHorizontal: 30,
  },
  incomingBtnWrap: { alignItems: "center", gap: 10 },
  secondaryRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  controlWrap: { alignItems: "center", gap: 8 },
  hangupRow: { alignItems: "center", gap: 10 },
  circleBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  hangupBtn: { width: 72, height: 72, borderRadius: 36 },
  acceptBtn: { backgroundColor: "#10B981" },
  declineBtn: { backgroundColor: "#E74C3C" },
  secondaryBtn: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  secondaryBtnActive: {
    backgroundColor: "#FFF",
  },
  btnLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});

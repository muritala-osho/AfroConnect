import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  StatusBar,
  Vibration,
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
import socketService from "@/services/socket";
import agoraService from "@/services/agoraService";

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
  } = route.params || {};
  const { token: authToken, user } = useAuth();
  const { post } = useApi();

  const [callStatus, setCallStatus] = useState<
    "connecting" | "ringing" | "connected" | "ended" | "failed" | "busy"
  >("connecting");
  const [duration, setDuration] = useState(0);
  const [activeCallData, setActiveCallData] = useState(
    incomingCallData || null,
  );

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const ringtoneRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stopRingtone = useCallback(async () => {
    try {
      if (ringtoneRef.current) {
        await ringtoneRef.current.stopAsync();
        await ringtoneRef.current.unloadAsync();
        ringtoneRef.current = null;
      }
      Vibration.cancel();
    } catch (err) {
      console.log("Cleanup Error:", err);
    }
  }, []);

  const playRingtone = useCallback(async () => {
    try {
      await stopRingtone();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldRouteThroughEarpieceAndroid: false,
      });

      
      const source = isIncoming
        ? require("../assets/sounds/mixkit-waiting-ringtone-1354.wav")
        : require("../assets/sounds/phone-calling-1b.mp3");

      const { sound } = await Audio.Sound.createAsync(source, {
        shouldPlay: true,
        isLooping: true,
        volume: 1.0,
      });

      ringtoneRef.current = sound;
      if (isIncoming) Vibration.vibrate([500, 1000, 500], true);
    } catch (err) {
      console.error("Audio Playback Error:", err);
      
      if (isIncoming) Vibration.vibrate([500, 1000, 500], true);
    }
  }, [isIncoming, stopRingtone]);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setDuration((prev) => prev + 1), 1000);
  };

  const handleAccept = async () => {
    await stopRingtone();
    if (activeCallData) {
      await (agoraService as any).joinChannel?.(
        activeCallData.token,
        activeCallData.channelName,
        activeCallData.uid,
      );
      setCallStatus("connected");
      socketService.acceptCall({ callerId, targetUserId: user?.id });
      startTimer();
    }
  };

  const handleDecline = async () => {
    await stopRingtone();
    await (agoraService as any).leaveChannel?.();
    socketService.endCall({
      targetUserId: isIncoming ? callerId : userId,
      callType: "audio",
    });
    setCallStatus("ended");
    navigation.goBack();
  };

  const initiateCall = useCallback(async () => {
    if (!authToken || !userId) return setCallStatus("failed");
    try {
      const response = await post<any>(
        "/agora/call/initiate",
        { targetUserId: userId, callType: "voice" },
        authToken,
      );
      if (response.success && response.data?.callData) {
        setActiveCallData(response.data.callData);
        setCallStatus("ringing");
        socketService.initiateCall({
          targetUserId: userId,
          callData: response.data.callData,
          callerInfo: {
            name: user?.name || "User",
            photo: user?.photos?.[0]?.url || "",
            id: user?.id || "",
          },
        });
      }
    } catch {
      setCallStatus("failed");
    }
  }, [authToken, userId, post, user]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
    (agoraService as any).init?.(activeCallData?.appId);

    if (isIncoming) setCallStatus("ringing");
    else initiateCall();

    socketService.onCallAccepted(async () => {
      await stopRingtone();
      if (activeCallData) {
        await (agoraService as any).joinChannel?.(
          activeCallData.token,
          activeCallData.channelName,
          activeCallData.uid,
        );
        setCallStatus("connected");
        startTimer();
      }
    });

    socketService.onCallBusy(async () => {
      await stopRingtone();
      setCallStatus("busy");
      setTimeout(() => navigation.goBack(), 2000);
    });

    socketService.onCallEnded(async () => {
      await stopRingtone();
      await (agoraService as any).leaveChannel?.();
      setCallStatus("ended");
      setTimeout(() => navigation.goBack(), 1200);
    });

    return () => {
      stopRingtone();
      (agoraService as any).leaveChannel?.();
      if (timerRef.current) clearInterval(timerRef.current);
      socketService.off("call:accepted");
      socketService.off("call:busy");
      socketService.off("call:ended");
    };
  }, []);

  useEffect(() => {
    if (callStatus === "ringing") playRingtone();
    else if (callStatus !== "connecting") stopRingtone();
  }, [callStatus]);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />
      <LinearGradient
        colors={["#0f0c29", "#302b63", "#24243e"]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.centerSection, { opacity: fadeAnim }]}>
        <View style={styles.avatarWrapper}>
          <SafeImage
            source={{ uri: userPhoto || "https://via.placeholder.com/150" }}
            style={styles.avatar}
          />
        </View>
        <ThemedText style={styles.userName}>{userName}</ThemedText>
        <ThemedText style={styles.statusText}>
          {callStatus === "connected"
            ? `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}`
            : callStatus === "busy"
            ? "User is on another call"
            : callStatus.toUpperCase()}
        </ThemedText>
      </Animated.View>

      <View
        style={[styles.bottomContainer, { paddingBottom: insets.bottom + 40 }]}
      >
        <View style={styles.mainActions}>
          {isIncoming && callStatus === "ringing" ? (
            <>
              <Pressable
                style={[styles.actionBtn, styles.declineBtn]}
                onPress={handleDecline}
              >
                <Ionicons name="close" size={35} color="#FFF" />
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.acceptBtn]}
                onPress={handleAccept}
              >
                <Ionicons name="call" size={35} color="#FFF" />
              </Pressable>
            </>
          ) : (
            <Pressable
              style={[styles.actionBtn, styles.declineBtn]}
              onPress={handleDecline}
            >
              <Ionicons
                name="call"
                size={35}
                color="#FFF"
                style={{ transform: [{ rotate: "135deg" }] }}
              />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerSection: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarWrapper: {
    width: 160,
    height: 160,
    borderRadius: 80,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.2)",
    marginBottom: 25,
  },
  avatar: { width: "100%", height: "100%" },
  userName: { fontSize: 34, fontWeight: "bold", color: "#FFF" },
  statusText: {
    fontSize: 18,
    color: "rgba(255,255,255,0.6)",
    marginTop: 10,
    letterSpacing: 2,
  },
  bottomContainer: { width: "100%", alignItems: "center" },
  mainActions: { flexDirection: "row", gap: 60 },
  actionBtn: {
    width: 85,
    height: 85,
    borderRadius: 42.5,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
  },
  acceptBtn: { backgroundColor: "#2ECC71" },
  declineBtn: { backgroundColor: "#E74C3C" },
});

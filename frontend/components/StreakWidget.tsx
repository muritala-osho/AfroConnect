import React, { useEffect, useRef, useState } from "react";
import { View, StyleSheet, Pressable, Animated } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";

interface StreakData {
  current: number;
  longest: number;
  lastLoginDate: string | null;
  alreadyCheckedIn?: boolean;
}

interface StreakWidgetProps {
  compact?: boolean;
  onPress?: () => void;
}

export default function StreakWidget({ compact = false, onPress }: StreakWidgetProps) {
  const { theme } = useTheme();
  const { token } = useAuth();
  const api = useApi();
  const [streak, setStreak] = useState<StreakData>({ current: 0, longest: 0, lastLoginDate: null });
  const [showCelebration, setShowCelebration] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!token) return;
    checkIn();
  }, [token]);

  const checkIn = async () => {
    try {
      const res = await api.post<{ success: boolean; streak: StreakData }>('/streak/check-in', {}, token!);
      if (res.success && res.data?.streak) {
        setStreak(res.data.streak);
        if (!res.data.streak.alreadyCheckedIn && res.data.streak.current > 1) {
          triggerCelebration();
        }
      }
    } catch (e) {
    }
  };

  const triggerCelebration = () => {
    setShowCelebration(true);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1.3, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(opacityAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => setShowCelebration(false));
  };

  const getFlameColor = () => {
    if (streak.current >= 30) return ['#FF0000', '#FF6B00'];
    if (streak.current >= 14) return ['#FF6B00', '#FFD700'];
    if (streak.current >= 7) return ['#FF8C00', '#FFD700'];
    if (streak.current >= 3) return ['#FFA500', '#FFD700'];
    return ['#FF6B6B', '#FF8E53'];
  };

  if (compact) {
    return (
      <Pressable onPress={onPress} style={styles.compact}>
        <LinearGradient colors={getFlameColor()} style={styles.compactGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <ThemedText style={styles.compactFlame}>🔥</ThemedText>
          <ThemedText style={styles.compactCount}>{streak.current}</ThemedText>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={[styles.container, { backgroundColor: theme.surface }]}>
      <LinearGradient
        colors={getFlameColor()}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.View style={[styles.innerContent, { transform: [{ scale: scaleAnim }] }]}>
          <ThemedText style={styles.flame}>🔥</ThemedText>
          <View style={styles.textBlock}>
            <ThemedText style={styles.streakCount}>{streak.current} day streak</ThemedText>
            <ThemedText style={styles.streakSub}>Best: {streak.longest} days</ThemedText>
          </View>
        </Animated.View>

        {showCelebration && (
          <Animated.View style={[styles.celebration, { opacity: opacityAnim }]}>
            <ThemedText style={styles.celebrationText}>+1 🎉</ThemedText>
          </Animated.View>
        )}

        <View style={styles.chevron}>
          <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.8)" />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: "hidden",
  },
  gradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  innerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  flame: {
    fontSize: 28,
    marginRight: 10,
  },
  textBlock: {
    flex: 1,
  },
  streakCount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  streakSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  celebration: {
    position: "absolute",
    right: 40,
    top: 8,
  },
  celebrationText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
  chevron: {
    marginLeft: 8,
  },
  compact: {
    borderRadius: 20,
    overflow: "hidden",
  },
  compactGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  compactFlame: {
    fontSize: 16,
  },
  compactCount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
});

import logger from '@/utils/logger';
import React, { useEffect, useCallback, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop, Path } from "react-native-svg";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { ThemedText } from "@/components/ThemedText";
import { getApiBaseUrl } from "@/constants/config";
import { Spacing, BorderRadius, Typography, Shadow } from "@/constants/theme";

const RADAR_SIZE = 56;
const CENTER = RADAR_SIZE / 2;

interface NearbyUser {
  id: string;
  name: string;
  profilePhoto: string | null;
  distance: number;
  angle: number;
  online: boolean;
  gender: string;
}

interface MiniRadarProps {
  onPress: () => void;
  userCount?: number;
}

export default function MiniRadar({ onPress, userCount = 0 }: MiniRadarProps) {
  const { theme } = useTheme();
  const { token, user } = useAuth();
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [loading, setLoading] = useState(true);

  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const fetchNearbyCount = useCallback(async () => {
    if (!token || !user?.location?.lat || !user?.location?.lng) {
      setLoading(false);
      return;
    }

    try {
      const params = new URLSearchParams({
        lat: user.location.lat.toString(),
        lng: user.location.lng.toString(),
        radius: "10",
        ageMin: "18",
        ageMax: "60",
        gender: "any",
      });

      const response = await fetch(
        `${getApiBaseUrl()}/api/radar/nearby-users?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = await response.json();
      if (data.success) {
        setNearbyUsers(data.users?.slice(0, 5) || []);
      }
    } catch (error) {
      logger.error("MiniRadar fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [token, user?.location]);

  useEffect(() => {
    fetchNearbyCount();
    const interval = setInterval(fetchNearbyCount, 60000);
    return () => clearInterval(interval);
  }, [fetchNearbyCount]);

  const scannerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.15], [0.6, 0]),
  }));

  const getUserDotPosition = (index: number, total: number) => {
    const maxRadius = (RADAR_SIZE / 2 - 12);
    const distanceRatio = 0.5 + Math.random() * 0.4;
    const radius = distanceRatio * maxRadius;
    const baseAngle = (index / Math.max(total, 1)) * 360;
    const angleRad = (baseAngle * Math.PI) / 180;
    const x = CENTER + radius * Math.cos(angleRad);
    const y = CENTER + radius * Math.sin(angleRad);
    return { x, y };
  };

  const displayCount = nearbyUsers.length || userCount;

  return (
    <Pressable
      style={[styles.container, { backgroundColor: theme.surface }]}
      onPress={onPress}
    >
      <Svg width={RADAR_SIZE} height={RADAR_SIZE} style={styles.radar}>
        <Defs>
          <RadialGradient id="miniRadarGrad" cx="50%" cy="50%">
            <Stop offset="0%" stopColor={theme.primary} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={theme.primary} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        {[0.5, 1].map((fraction, index) => (
          <Circle
            key={index}
            cx={CENTER}
            cy={CENTER}
            r={(RADAR_SIZE / 2 - 8) * fraction}
            stroke={theme.border}
            strokeWidth="0.5"
            strokeDasharray="2,2"
            fill="none"
            opacity={0.5}
          />
        ))}

        <Circle cx={CENTER} cy={CENTER} r="4" fill={theme.primary} />
      </Svg>

      <Animated.View style={[styles.pulseRing, pulseStyle]}>
        <View style={[styles.ring, { borderColor: theme.primary }]} />
      </Animated.View>

      <Animated.View style={[styles.scannerBeam, scannerStyle]}>
        <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
          <Defs>
            <RadialGradient id="miniBeamGrad" cx="50%" cy="50%">
              <Stop offset="0%" stopColor={theme.primary} stopOpacity="0.4" />
              <Stop offset="100%" stopColor={theme.primary} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Path
            d={`M ${CENTER} ${CENTER} L ${CENTER} 6 A ${CENTER - 6} ${CENTER - 6} 0 0 1 ${RADAR_SIZE - 6} ${CENTER} Z`}
            fill="url(#miniBeamGrad)"
          />
        </Svg>
      </Animated.View>

      {nearbyUsers.slice(0, 3).map((user, index) => {
        const pos = getUserDotPosition(index, nearbyUsers.length);
        const dotColor = user.gender === "female" ? "#FF6B9D" : "#4A90E2";
        return (
          <View
            key={user.id}
            style={[
              styles.userDot,
              {
                left: pos.x - 4,
                top: pos.y - 4,
                backgroundColor: dotColor,
              },
            ]}
          >
            {user.online && <View style={styles.onlineIndicator} />}
          </View>
        );
      })}

      {displayCount > 0 && (
        <View style={[styles.countBadge, { backgroundColor: theme.primary }]}>
          <ThemedText style={styles.countText}>
            {displayCount > 9 ? "9+" : displayCount}
          </ThemedText>
        </View>
      )}

      <View style={[styles.liveBadge, { backgroundColor: theme.online || "#4CAF50" }]}>
        <View style={styles.liveDot} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.small,
    overflow: "visible",
  },
  radar: {
    position: "absolute",
  },
  pulseRing: {
    position: "absolute",
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    width: RADAR_SIZE - 8,
    height: RADAR_SIZE - 8,
    borderRadius: (RADAR_SIZE - 8) / 2,
    borderWidth: 1.5,
  },
  scannerBeam: {
    position: "absolute",
    width: RADAR_SIZE,
    height: RADAR_SIZE,
  },
  userDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#FFF",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4CAF50",
    borderWidth: 0.5,
    borderColor: "#FFF",
  },
  countBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  countText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFF",
  },
  liveBadge: {
    position: "absolute",
    bottom: -2,
    left: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#FFF",
  },
});

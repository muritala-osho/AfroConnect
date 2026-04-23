import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { SafeImage } from '@/components/SafeImage';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { getPhotoSource } from '@/utils/photos';
import * as Haptics from 'expo-haptics';

interface NearbyUser {
  id: string;
  name: string;
  age: number;
  distance: number;
  photos: any[];
  online?: boolean;
  premium?: { isActive: boolean; plan?: string };
}

interface NearbyRadarProps {
  users: NearbyUser[];
  maxDistance: number;
  onUserPress: (userId: string) => void;
  onExpandPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function UserPin({ 
  user, 
  angle, 
  distance, 
  maxDistance, 
  index, 
  onPress,
  theme,
}: { 
  user: NearbyUser; 
  angle: number; 
  distance: number; 
  maxDistance: number;
  index: number;
  onPress: () => void;
  theme: any;
}) {
  const scale = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200, mass: 0.8 });
    if (user.online) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    }
  }, []);

  const radarRadius = 70;
  const safeMaxDistance = maxDistance > 0 ? maxDistance : 1;
  const normalizedDistance = Math.min(distance / safeMaxDistance, 1);
  const pinRadius = radarRadius * (isNaN(normalizedDistance) ? 0 : normalizedDistance) * 0.85;
  
  const x = Math.cos((angle * Math.PI) / 180) * pinRadius;
  const y = Math.sin((angle * Math.PI) / 180) * pinRadius;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x },
      { translateY: y },
      { scale: scale.value },
    ],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.2], [0.5, 0]),
  }));

  const photoSource = user.photos?.[0] ? getPhotoSource(user.photos[0]) : null;

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      style={[styles.userPin, animatedStyle]}
    >
      {user.online ? (
        <Animated.View style={[styles.onlinePulse, pulseStyle, { backgroundColor: theme.online }]} />
      ) : null}
      <View style={[styles.pinContainer, { borderColor: user.online ? theme.online : theme.primary }]}>
        {photoSource ? (
          <SafeImage source={photoSource} style={styles.pinImage} contentFit="cover" />
        ) : (
          <View style={[styles.pinPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="user" size={14} color={theme.textSecondary} />
          </View>
        )}
      </View>
      <View style={[styles.distanceBadge, { backgroundColor: theme.primary }]}>
        <ThemedText style={styles.distanceText}>{user?.premium?.isActive ? `${distance}km` : 'Premium'}</ThemedText>
      </View>
    </AnimatedPressable>
  );
}

export default function NearbyRadar({ users, maxDistance, onUserPress, onExpandPress }: NearbyRadarProps) {
  const { theme } = useTheme();
  const rotation = useSharedValue(0);
  const radarPulse = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
    radarPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(radarPulse.value, [0, 1], [0.3, 1.2]) }],
    opacity: interpolate(radarPulse.value, [0, 0.5, 1], [0.8, 0.4, 0]),
  }));

  const displayUsers = users.slice(0, 8);
  const angleStep = 360 / Math.max(displayUsers.length, 1);

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="radio" size={20} color={theme.primary} />
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Nearby
          </ThemedText>
        </View>
        <Pressable onPress={onExpandPress} style={styles.expandButton}>
          <Feather name="maximize-2" size={18} color={theme.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.radarContainer}>
        <View style={[styles.radarRing, styles.radarRingOuter, { borderColor: `${theme.primary}20` }]} />
        <View style={[styles.radarRing, styles.radarRingMiddle, { borderColor: `${theme.primary}30` }]} />
        <View style={[styles.radarRing, styles.radarRingInner, { borderColor: `${theme.primary}40` }]} />
        
        <Animated.View style={[styles.pulseRing, pulseRingStyle, { borderColor: theme.primary }]} />
        
        <Animated.View style={[styles.scanLine, scanLineStyle]}>
          <View style={[styles.scanGradient, { backgroundColor: `${theme.primary}30` }]} />
        </Animated.View>

        <View style={[styles.centerDot, { backgroundColor: theme.primary }]}>
          <Feather name="user" size={12} color="#FFF" />
        </View>

        {displayUsers.map((user, index) => (
          <UserPin
            key={user.id}
            user={user}
            angle={angleStep * index - 90}
            distance={user.distance}
            maxDistance={maxDistance}
            index={index}
            onPress={() => onUserPress(user.id)}
            theme={theme}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
          {users.length} {users.length === 1 ? 'person' : 'people'} within {maxDistance}km
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    ...Typography.subtitle,
  },
  expandButton: {
    padding: Spacing.xs,
  },
  radarContainer: {
    width: 180,
    height: 180,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  radarRing: {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 9999,
  },
  radarRingOuter: {
    width: 170,
    height: 170,
  },
  radarRingMiddle: {
    width: 120,
    height: 120,
  },
  radarRingInner: {
    width: 70,
    height: 70,
  },
  pulseRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderWidth: 2,
    borderRadius: 80,
  },
  scanLine: {
    position: 'absolute',
    width: 85,
    height: 2,
    right: 90,
  },
  scanGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 1,
  },
  centerDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  userPin: {
    position: 'absolute',
    alignItems: 'center',
  },
  onlinePulse: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  pinContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    overflow: 'hidden',
  },
  pinImage: {
    width: '100%',
    height: '100%',
  },
  pinPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceBadge: {
    position: 'absolute',
    bottom: -8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
    minWidth: 24,
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 8,
    fontWeight: '600',
    color: '#FFF',
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  footerText: {
    ...Typography.caption,
  },
});

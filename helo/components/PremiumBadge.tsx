import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolateColor,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

interface PremiumBadgeProps {
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

const SIZES = {
  small: { badge: 20, icon: 10, glow: 30, outerGlow: 36 },
  medium: { badge: 26, icon: 14, glow: 38, outerGlow: 46 },
  large: { badge: 34, icon: 18, glow: 48, outerGlow: 58 },
};

export function PremiumBadge({ size = 'medium', style }: PremiumBadgeProps) {
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);
  const outerGlowScale = useSharedValue(1);
  const outerGlowOpacity = useSharedValue(0.3);
  const badgeScale = useSharedValue(1);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    outerGlowScale.value = withRepeat(
      withDelay(
        400,
        withSequence(
          withTiming(1.6, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) })
        )
      ),
      -1,
      false
    );
    outerGlowOpacity.value = withRepeat(
      withDelay(
        400,
        withSequence(
          withTiming(0.05, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.25, { duration: 1800, easing: Easing.inOut(Easing.ease) })
        )
      ),
      -1,
      false
    );

    badgeScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    shimmer.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  const outerGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: outerGlowScale.value }],
    opacity: outerGlowOpacity.value,
  }));

  const badgeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));

  const shimmerStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      shimmer.value,
      [0, 1],
      ['#FFB800', '#FFD700']
    );
    return { backgroundColor };
  });

  const dims = SIZES[size];

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.outerGlow,
          {
            width: dims.outerGlow,
            height: dims.outerGlow,
            borderRadius: dims.outerGlow / 2,
          },
          outerGlowStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.glow,
          {
            width: dims.glow,
            height: dims.glow,
            borderRadius: dims.glow / 2,
          },
          glowStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.badge,
          {
            width: dims.badge,
            height: dims.badge,
            borderRadius: dims.badge / 2,
          },
          badgeAnimStyle,
          shimmerStyle,
        ]}
      >
        <Feather name="award" size={dims.icon} color="#FFF" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  outerGlow: {
    position: 'absolute',
    backgroundColor: '#FFD700',
  },
  glow: {
    position: 'absolute',
    backgroundColor: '#FFB800',
  },
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});

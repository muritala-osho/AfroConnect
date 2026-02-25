import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';

interface PremiumBadgeProps {
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

const SIZES = {
  small: { badge: 20, icon: 10, glow: 28 },
  medium: { badge: 26, icon: 14, glow: 36 },
  large: { badge: 34, icon: 18, glow: 46 },
};

export function PremiumBadge({ size = 'medium', style }: PremiumBadgeProps) {
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.6);

  useEffect(() => {
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  const dims = SIZES[size];

  return (
    <View style={[styles.container, style]}>
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
      <View
        style={[
          styles.badge,
          {
            width: dims.badge,
            height: dims.badge,
            borderRadius: dims.badge / 2,
          },
        ]}
      >
        <Feather name="award" size={dims.icon} color="#FFF" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  glow: {
    position: 'absolute',
    backgroundColor: '#FFD700',
  },
  badge: {
    backgroundColor: '#FFB800',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
});

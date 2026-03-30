import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';

interface VerificationBadgeProps {
  verified?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function VerificationBadge({
  verified = false,
  size = 'medium',
}: VerificationBadgeProps) {
  const scale = useSharedValue(1);

  React.useEffect(() => {
    if (verified) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 600 }),
          withTiming(1, { duration: 200 })
        ),
        -1,
        true
      );
    }
  }, [verified]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const sizes = {
    small: 36,
    medium: 48,
    large: 64,
  };

  const badgeSize = sizes[size];

  if (!verified) return null;

  return (
    <AnimatedView style={[styles.container, animatedStyle]}>
      <Image
        source={require('@/assets/icons/verified-tick.png')}
        style={{
          width: badgeSize,
          height: badgeSize,
        }}
        contentFit="contain"
      />
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

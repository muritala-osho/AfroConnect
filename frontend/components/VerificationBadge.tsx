import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VerificationBadgeProps {
  verified?: boolean;
  size?: number | 'small' | 'medium' | 'large';
}

const SIZE_MAP: Record<string, number> = {
  small: 14,
  medium: 18,
  large: 22,
};

export function VerificationBadge({
  verified = true,
  size = 14,
}: VerificationBadgeProps) {
  if (!verified) return null;

  const badgeSize = typeof size === 'number' ? size : (SIZE_MAP[size] ?? 14);
  const iconSize = Math.round(badgeSize * 0.65);

  return (
    <View
      style={[
        styles.badge,
        {
          width: badgeSize,
          height: badgeSize,
          borderRadius: badgeSize / 2,
          marginLeft: 4,
        },
      ]}
    >
      <Ionicons name="checkmark" size={iconSize} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: '#FF6600',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

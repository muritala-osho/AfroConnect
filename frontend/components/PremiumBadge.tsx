import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

interface PremiumBadgeProps {
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

const SIZES = {
  small: { badge: 18, icon: 10 },
  medium: { badge: 24, icon: 13 },
  large: { badge: 32, icon: 17 },
};

const COLORS = {
  light: {
    gradientFrom: '#FFD700',
    gradientTo: '#FFA000',
    border: '#FFFFFF',
    shadow: '#FFB300',
  },
  dark: {
    gradientFrom: '#FFD54F',
    gradientTo: '#FFA000',
    border: 'rgba(255, 255, 255, 0.85)',
    shadow: '#FFB300',
  },
};

export function PremiumBadge({ size = 'medium', style }: PremiumBadgeProps) {
  const { isDark } = useTheme();
  const palette = isDark ? COLORS.dark : COLORS.light;
  const dims = SIZES[size];

  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={[palette.gradientFrom, palette.gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.badge,
          {
            width: dims.badge,
            height: dims.badge,
            borderRadius: dims.badge / 2,
            borderColor: palette.border,
            shadowColor: palette.shadow,
          },
        ]}
      >
        <Feather name="award" size={dims.icon} color="#FFFFFF" />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
});

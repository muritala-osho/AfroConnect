
import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop, Path } from 'react-native-svg';
import { ThemedText } from './ThemedText';
import { Feather } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const RADAR_SIZE = Math.min(width - 80, 280);
const CENTER = RADAR_SIZE / 2;

interface LiveRadarScannerProps {
  theme: any;
  userCount: number;
  maxDistance: number;
}

export default function LiveRadarScanner({ theme, userCount, maxDistance }: LiveRadarScannerProps) {
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    // Continuous rotation for scanning effect
    rotation.value = withRepeat(
      withTiming(360, {
        duration: 4000,
        easing: Easing.linear,
      }),
      -1,
      false
    );

    // Pulse animation for scanning waves
    pulse.value = withRepeat(
      withTiming(1.4, {
        duration: 2000,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true
    );
  }, []);

  const scannerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.4], [0.6, 0]),
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.surface }]}>
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: `${theme.primary}15` }]}>
          <Feather name="radio" size={24} color={theme.primary} />
        </View>
        <View>
          <ThemedText style={[styles.title, { color: theme.text }]}>
            Live Radar Scan
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {userCount > 0 ? `${userCount} people within ${maxDistance}km` : 'Scanning for nearby users...'}
          </ThemedText>
        </View>
      </View>

      <View style={styles.radarContainer}>
        <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
          <Defs>
            <RadialGradient id="radarGrad" cx="50%" cy="50%">
              <Stop offset="0%" stopColor={theme.primary} stopOpacity="0.3" />
              <Stop offset="100%" stopColor={theme.primary} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Distance circles */}
          {[0.25, 0.5, 0.75, 1].map((fraction, index) => (
            <Circle
              key={index}
              cx={CENTER}
              cy={CENTER}
              r={(RADAR_SIZE / 2 - 40) * fraction}
              stroke={theme.border}
              strokeWidth="1"
              strokeDasharray="4,4"
              fill="none"
              opacity={0.3}
            />
          ))}

          {/* Center point */}
          <Circle
            cx={CENTER}
            cy={CENTER}
            r="8"
            fill={theme.primary}
          />
        </Svg>

        {/* Animated pulse rings */}
        <Animated.View style={[styles.pulseRing, pulseStyle]}>
          <View style={[styles.ring, { borderColor: theme.primary }]} />
        </Animated.View>

        {/* Rotating scanner beam */}
        <Animated.View style={[styles.scannerBeam, scannerStyle]}>
          <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
            <Path
              d={`M ${CENTER} ${CENTER} L ${CENTER} 20 A ${CENTER - 20} ${CENTER - 20} 0 0 1 ${RADAR_SIZE - 20} ${CENTER} Z`}
              fill="url(#radarGrad)"
            />
          </Svg>
        </Animated.View>

        {/* Scanning status indicator */}
        <View style={[styles.statusBadge, { backgroundColor: theme.online }]}>
          <View style={styles.statusDot} />
          <ThemedText style={styles.statusText}>Scanning</ThemedText>
        </View>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
          <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>You</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#FF6B9D' }]} />
          <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Female</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#4A90E2' }]} />
          <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Male</ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  radarContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: RADAR_SIZE,
  },
  scannerBeam: {
    position: 'absolute',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
  },
  pulseRing: {
    position: 'absolute',
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: RADAR_SIZE - 80,
    height: RADAR_SIZE - 80,
    borderRadius: (RADAR_SIZE - 80) / 2,
    borderWidth: 2,
    opacity: 0.4,
  },
  statusBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

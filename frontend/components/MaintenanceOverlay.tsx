import React, { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, Animated, Pressable, Dimensions,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMaintenance } from '@/context/MaintenanceContext';
import { BlurView } from 'expo-blur';

const { width: SW, height: SH } = Dimensions.get('window');

const RETRY_DELAY_MS = 15_000; // auto-retry every 15s

export default function MaintenanceOverlay() {
  const { isMaintenance, isOffline, checkHealth } = useMaintenance();
  const visible = isMaintenance || isOffline;

  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(40)).current;
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const spinAnim    = useRef(new Animated.Value(0)).current;

  const [checking, setChecking]   = useState(false);
  const [countdown, setCountdown] = useState(RETRY_DELAY_MS / 1000);
  const countdownRef              = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fade + slide in / out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1,  duration: 350, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0,  useNativeDriver: true, damping: 18, stiffness: 130 }),
      ]).start();
      startCountdown();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      clearCountdown();
    }
    return () => clearCountdown();
  }, [visible]);

  // Pulse the icon
  useEffect(() => {
    if (!visible) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [visible]);

  const startCountdown = () => {
    clearCountdown();
    setCountdown(RETRY_DELAY_MS / 1000);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          retry();
          return RETRY_DELAY_MS / 1000;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const clearCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
  };

  const retry = async () => {
    if (checking) return;
    setChecking(true);
    // Spin animation while checking
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true })
    ).start();
    await checkHealth();
    setChecking(false);
    spinAnim.stopAnimation();
    spinAnim.setValue(0);
    startCountdown();
  };

  if (!visible) return null;

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const isMaint = isMaintenance;

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} pointerEvents="box-none">
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />

      <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
        <LinearGradient
          colors={isMaint ? ['#1E1B4B', '#312E81', '#1E1B4B'] : ['#1A1A2E', '#16213E', '#1A1A2E']}
          style={styles.cardGradient}
        >
          {/* Decorative glow blobs */}
          <View style={[styles.blob, styles.blobTL, { backgroundColor: isMaint ? '#6366F180' : '#0EA5E980' }]} />
          <View style={[styles.blob, styles.blobBR, { backgroundColor: isMaint ? '#818CF830' : '#06B6D430' }]} />

          {/* Icon */}
          <Animated.View style={[
            styles.iconWrap,
            { backgroundColor: isMaint ? '#6366F120' : '#0EA5E920', transform: [{ scale: pulseAnim }] },
          ]}>
            <Ionicons
              name={isMaint ? 'construct-outline' : 'cloud-offline-outline'}
              size={52}
              color={isMaint ? '#818CF8' : '#38BDF8'}
            />
          </Animated.View>

          {/* Title */}
          <ThemedText style={styles.title}>
            {isMaint ? 'We're Under Maintenance' : 'No Connection'}
          </ThemedText>

          {/* Subtitle */}
          <ThemedText style={styles.subtitle}>
            {isMaint
              ? 'AfroConnect is temporarily offline for scheduled maintenance. We'll be back very shortly — thank you for your patience.'
              : 'We can't reach our servers right now. Please check your internet connection and try again.'}
          </ThemedText>

          {/* Status pill */}
          <View style={[styles.statusPill, { backgroundColor: isMaint ? '#6366F115' : '#0EA5E915', borderColor: isMaint ? '#6366F140' : '#0EA5E940' }]}>
            <View style={[styles.statusDot, { backgroundColor: isMaint ? '#818CF8' : '#38BDF8' }]} />
            <ThemedText style={[styles.statusText, { color: isMaint ? '#A5B4FC' : '#7DD3FC' }]}>
              {isMaint ? 'Maintenance in progress' : 'Offline'}
            </ThemedText>
          </View>

          {/* Retry button */}
          <Pressable
            style={[styles.retryBtn, checking && styles.retryBtnDisabled]}
            onPress={retry}
            disabled={checking}
          >
            <LinearGradient
              colors={isMaint ? ['#6366F1', '#4F46E5'] : ['#0EA5E9', '#0284C7']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.retryBtnInner}
            >
              <Animated.View style={{ transform: [{ rotate: checking ? spin : '0deg' }] }}>
                <Ionicons name="refresh" size={18} color="#FFF" />
              </Animated.View>
              <ThemedText style={styles.retryBtnText}>
                {checking ? 'Checking…' : 'Try Again'}
              </ThemedText>
            </LinearGradient>
          </Pressable>

          {/* Auto-retry countdown */}
          {!checking && (
            <ThemedText style={styles.countdownText}>
              Auto-retrying in {countdown}s
            </ThemedText>
          )}
        </LinearGradient>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: SW - 40,
    maxWidth: 380,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 30,
  },
  cardGradient: {
    padding: 36,
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    opacity: 0.6,
  },
  blobTL: { top: -60, left: -60 },
  blobBR: { bottom: -60, right: -60 },

  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#F1F5F9',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(148,163,184,0.90)',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  retryBtn: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    marginTop: 8,
  },
  retryBtnDisabled: { opacity: 0.65 },
  retryBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  retryBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  countdownText: {
    fontSize: 11,
    color: 'rgba(148,163,184,0.55)',
    fontWeight: '600',
  },
});

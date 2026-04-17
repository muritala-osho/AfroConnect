import React, { useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, Animated, Pressable, Dimensions,
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useMaintenance } from '@/context/MaintenanceContext';
import { BlurView } from 'expo-blur';

const { width: SW } = Dimensions.get('window');

const RETRY_DELAY_MS = 15_000;

export default function MaintenanceOverlay() {
  const { isMaintenance, checkHealth } = useMaintenance();

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim  = useRef(new Animated.Value(0)).current;

  const [checking, setChecking]   = useState(false);
  const [countdown, setCountdown] = useState(RETRY_DELAY_MS / 1000);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isMaintenance) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 130 }),
      ]).start();
      startCountdown();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
      clearCountdown();
    }
    return () => clearCountdown();
  }, [isMaintenance]);

  useEffect(() => {
    if (!isMaintenance) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, [isMaintenance]);

  const startCountdown = () => {
    clearCountdown();
    setCountdown(RETRY_DELAY_MS / 1000);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { retry(); return RETRY_DELAY_MS / 1000; }
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
    Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true })
    ).start();
    await checkHealth();
    setChecking(false);
    spinAnim.stopAnimation();
    spinAnim.setValue(0);
    startCountdown();
  };

  if (!isMaintenance) return null;

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} pointerEvents="box-none">
      <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
        <LinearGradient colors={['#1E1B4B', '#312E81', '#1E1B4B']} style={styles.cardGradient}>
          <View style={[styles.blob, styles.blobTL, { backgroundColor: '#6366F180' }]} />
          <View style={[styles.blob, styles.blobBR, { backgroundColor: '#818CF830' }]} />

          <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulseAnim }] }]}>
            <Ionicons name="construct-outline" size={52} color="#818CF8" />
          </Animated.View>

          <ThemedText style={styles.title}>We're Under Maintenance</ThemedText>
          <ThemedText style={styles.subtitle}>
            AfroConnect is temporarily offline for scheduled maintenance. We'll be back very shortly — thank you for your patience.
          </ThemedText>

          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <ThemedText style={styles.statusText}>Maintenance in progress</ThemedText>
          </View>

          <Pressable style={[styles.retryBtn, checking && styles.retryBtnDisabled]} onPress={retry} disabled={checking}>
            <LinearGradient colors={['#6366F1', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.retryBtnInner}>
              <Animated.View style={{ transform: [{ rotate: checking ? spin : '0deg' }] }}>
                <Ionicons name="refresh" size={18} color="#FFF" />
              </Animated.View>
              <ThemedText style={styles.retryBtnText}>{checking ? 'Checking…' : 'Try Again'}</ThemedText>
            </LinearGradient>
          </Pressable>

          {!checking && (
            <ThemedText style={styles.countdownText}>Auto-retrying in {countdown}s</ThemedText>
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
    backgroundColor: '#6366F120',
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
    backgroundColor: '#6366F115',
    borderColor: '#6366F140',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#818CF8',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A5B4FC',
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

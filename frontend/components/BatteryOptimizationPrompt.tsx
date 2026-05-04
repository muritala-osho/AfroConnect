/**
 * BatteryOptimizationPrompt
 *
 * Shows a one-time modal on Android prompting the user to exempt AfroConnect
 * from battery optimisation. Without this exemption, Android can delay or drop
 * the background wake-up that Notifee needs to display an incoming call
 * overlay, even though the FCM data message was delivered successfully.
 *
 * Flow:
 *  1. On first login (Android only), wait 3 s then show this modal.
 *  2. User taps "Open Settings" → Linking.openSettings() lands on the app's
 *     system settings page; they navigate to Battery → select "Unrestricted".
 *  3. Dismissed or confirmed → AsyncStorage key set so it never shows again.
 *
 * Samsung: Settings → Apps → AfroConnect → Battery → Unrestricted
 * Xiaomi:  Settings → Apps → AfroConnect → Battery saver → No restrictions
 * OnePlus: Settings → Apps → AfroConnect → Battery optimisation → Don't optimise
 * Stock:   Settings → Apps → AfroConnect → Battery → Unrestricted
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/hooks/useTheme';

const STORAGE_KEY = 'battery_opt_prompt_shown_v1';
const SHOW_DELAY_MS = 3000;

interface Props {
  userId: string | undefined;
}

export default function BatteryOptimizationPrompt({ userId }: Props) {
  const [visible, setVisible] = useState(false);
  const { isDark } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'android' || !userId) return;

    let timer: ReturnType<typeof setTimeout>;

    (async () => {
      try {
        const alreadyShown = await AsyncStorage.getItem(STORAGE_KEY);
        if (alreadyShown) return;
        timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
      } catch {
        // non-fatal — if storage fails, just don't show
      }
    })();

    return () => clearTimeout(timer);
  }, [userId]);

  const dismiss = async (openSettings: boolean) => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    if (openSettings) {
      Linking.openSettings();
    }
  };

  if (!visible) return null;

  const bg = isDark ? '#1A0A2E' : '#ffffff';
  const text = isDark ? '#ffffff' : '#1A0A2E';
  const subtext = isDark ? '#c0a8e0' : '#555577';
  const divider = isDark ? '#2e1a4e' : '#e0d8f0';

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      statusBarTranslucent
      onRequestClose={() => dismiss(false)}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: bg }]}>

          {/* Icon */}
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>🔋</Text>
          </View>

          {/* Heading */}
          <Text style={[styles.title, { color: text }]}>
            Never miss an incoming call
          </Text>

          {/* Body */}
          <Text style={[styles.body, { color: subtext }]}>
            Android's battery optimiser can block AfroConnect from waking up
            when you receive a call while the app is closed.
          </Text>
          <Text style={[styles.body, { color: subtext, marginTop: 8 }]}>
            To fix this, open your phone's settings and set AfroConnect's
            battery usage to{' '}
            <Text style={{ fontWeight: '700', color: text }}>Unrestricted</Text>
            {' '}(or "Don't optimise").
          </Text>

          {/* Steps */}
          <View style={[styles.stepsBox, { borderColor: divider }]}>
            <Text style={[styles.step, { color: subtext }]}>
              1. Tap <Text style={{ fontWeight: '600', color: text }}>"Open Settings"</Text> below
            </Text>
            <Text style={[styles.step, { color: subtext }]}>
              2. Tap <Text style={{ fontWeight: '600', color: text }}>Battery</Text>
            </Text>
            <Text style={[styles.step, { color: subtext }]}>
              3. Select <Text style={{ fontWeight: '600', color: text }}>Unrestricted</Text>
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: divider }]} />

          {/* Actions */}
          <Pressable
            style={[styles.primaryBtn]}
            onPress={() => dismiss(true)}
            android_ripple={{ color: '#3d1f7a' }}
          >
            <Text style={styles.primaryBtnText}>Open Settings</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => dismiss(false)}
            android_ripple={{ color: '#ddd' }}
          >
            <Text style={[styles.secondaryBtnText, { color: subtext }]}>
              Not now
            </Text>
          </Pressable>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  stepsBox: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 6,
  },
  step: {
    fontSize: 13,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
  primaryBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

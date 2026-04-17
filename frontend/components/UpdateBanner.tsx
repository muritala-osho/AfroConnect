import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { getApiBaseUrl } from '@/constants/config';

const BRAND = '#10B981';

interface VersionInfo {
  latestVersion:  string;
  minimumVersion: string;
  forceUpdate:    boolean;
  message:        string;
  androidUrl:     string;
  iosUrl:         string;
}

/* Compares semver strings — returns true if `a` is less than `b` */
function isOlderThan(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na < nb) return true;
    if (na > nb) return false;
  }
  return false;
}

export default function UpdateBanner() {
  const [info,      setInfo]      = useState<VersionInfo | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const slideAnim = React.useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    const check = async () => {
      try {
        const res  = await fetch(`${getApiBaseUrl()}/api/app-version`);
        const data: VersionInfo = await res.json();
        const current = Constants.expoConfig?.version ?? '0.0.0';

        const needsUpdate  = isOlderThan(current, data.latestVersion);
        const belowMinimum = isOlderThan(current, data.minimumVersion);

        if (belowMinimum || (needsUpdate && data.forceUpdate)) {
          setInfo(data);
          setShowModal(true);
        } else if (needsUpdate) {
          setInfo(data);
          setShowBanner(true);
          Animated.spring(slideAnim, {
            toValue: 0, useNativeDriver: true, tension: 80, friction: 12,
          }).start();
        }
      } catch {
        /* silent — never block the app for a failed version check */
      }
    };

    /* Slight delay so it doesn't fire right as the splash screen hides */
    const t = setTimeout(check, 2500);
    return () => clearTimeout(t);
  }, []);

  const openStore = () => {
    const url = Platform.OS === 'ios' ? info?.iosUrl : info?.androidUrl;
    if (url) Linking.openURL(url).catch(() => {});
  };

  const dismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -80, duration: 260, useNativeDriver: true,
    }).start(() => setShowBanner(false));
  };

  if (!info) return null;

  /* ── Force update modal — cannot be dismissed ── */
  if (showModal) {
    return (
      <Modal visible transparent animationType="fade" statusBarTranslucent>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalIconWrap}>
              <Ionicons name="arrow-up-circle" size={48} color={BRAND} />
            </View>
            <Text style={s.modalTitle}>Update Required</Text>
            <Text style={s.modalBody}>{info.message}</Text>
            <Pressable style={s.modalBtn} onPress={openStore}>
              <Text style={s.modalBtnText}>Update Now</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  /* ── Soft banner — slides down from top, dismissible ── */
  if (showBanner) {
    return (
      <Animated.View
        style={[s.banner, { transform: [{ translateY: slideAnim }] }]}
        pointerEvents="box-none"
      >
        <View style={s.bannerInner}>
          <View style={s.bannerLeft}>
            <View style={s.bannerIconWrap}>
              <Ionicons name="arrow-up-circle" size={20} color={BRAND} />
            </View>
            <View style={s.bannerTextWrap}>
              <Text style={s.bannerTitle}>Update Available</Text>
              <Text style={s.bannerSub} numberOfLines={1}>{info.message}</Text>
            </View>
          </View>
          <View style={s.bannerActions}>
            <Pressable style={s.bannerUpdateBtn} onPress={openStore}>
              <Text style={s.bannerUpdateText}>Update</Text>
            </Pressable>
            <Pressable style={s.bannerDismiss} onPress={dismiss} hitSlop={10}>
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.4)" />
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  }

  return null;
}

const s = StyleSheet.create({
  /* Banner */
  banner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 9999,
  },
  bannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: `${BRAND}30`,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    gap: 12,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  bannerIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: `${BRAND}18`,
    alignItems: 'center', justifyContent: 'center',
  },
  bannerTextWrap: { flex: 1 },
  bannerTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
  bannerSub:   { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 1 },
  bannerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerUpdateBtn: {
    backgroundColor: BRAND,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  bannerUpdateText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  bannerDismiss:    { padding: 4 },

  /* Force modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  modalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: `${BRAND}25`,
  },
  modalIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: `${BRAND}15`,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalBody: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  modalBtn: {
    backgroundColor: BRAND,
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
  },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});

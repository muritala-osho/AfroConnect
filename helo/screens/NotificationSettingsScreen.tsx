import React, { useState } from 'react';
import { View, StyleSheet, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { Spacing, BorderRadius } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function NotificationSettingsScreen() {
  const { theme } = useTheme();
  const { user, token, fetchUser } = useAuth();
  const { put } = useApi();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [pushEnabled, setPushEnabled] = useState(user?.settings?.pushNotifications ?? true);
  const [emailEnabled, setEmailEnabled] = useState(user?.settings?.emailNotifications ?? true);

  const toggleSetting = async (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    if (!token) return;
    try {
      const response = await put('/account/settings', { [key]: value }, token);
      if (response && (response.success || response.settings || response.user)) {
        if (fetchUser) await fetchUser();
      } else {
        setter(!value);
      }
    } catch (error) {
      console.error(`Failed to update ${key}:`, error);
      setter(!value);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16), borderBottomColor: theme.border }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={28} color={theme.text} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Notification Settings</ThemedText>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>NOTIFICATIONS</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={[styles.item, { borderBottomColor: theme.border }]}>
              <View style={styles.itemContent}>
                <Feather name="bell" size={20} color={theme.primary} style={styles.icon} />
                <ThemedText style={styles.label}>Push Notifications</ThemedText>
              </View>
              <Switch 
                value={pushEnabled} 
                onValueChange={(v) => toggleSetting('pushNotifications', v, setPushEnabled)}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
            <View style={styles.item}>
              <View style={styles.itemContent}>
                <Feather name="mail" size={20} color={theme.primary} style={styles.icon} />
                <ThemedText style={styles.label}>Email Notifications</ThemedText>
              </View>
              <Switch 
                value={emailEnabled} 
                onValueChange={(v) => toggleSetting('emailNotifications', v, setEmailEnabled)}
                trackColor={{ false: theme.border, true: theme.primary }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '700', marginBottom: 8, opacity: 0.6 },
  card: { borderRadius: 16, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  itemContent: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: 12 },
  label: { fontSize: 16, fontWeight: '500' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

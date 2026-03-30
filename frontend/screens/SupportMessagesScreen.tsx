import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { getApiBaseUrl } from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';

export default function SupportMessagesScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    fetchSupportMessages();
  }, []);

  const fetchSupportMessages = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/support/my-messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error fetching support messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => (
    <View style={[styles.messageCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.messageHeader}>
        <View style={[styles.typeBadge, { backgroundColor: item.isFromAdmin ? theme.primary : '#6b7280' }]}>
          <Text style={styles.typeText}>{item.isFromAdmin ? 'Admin Response' : 'My Message'}</Text>
        </View>
        <Text style={[styles.dateText, { color: theme.textSecondary }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      <Text style={[styles.subjectText, { color: theme.text }]}>{item.subject}</Text>
      <Text style={[styles.bodyText, { color: theme.textSecondary }]}>{item.message}</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Support Center</Text>
        <View style={{ width: 28 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="mail-unread-outline" size={64} color={theme.textSecondary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No support messages yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  messageCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  dateText: { fontSize: 12 },
  subjectText: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  bodyText: { fontSize: 14, lineHeight: 20 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 16 },
});
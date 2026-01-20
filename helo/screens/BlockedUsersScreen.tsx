import React, { useState, useEffect } from "react";
import { View, StyleSheet, FlatList, ActivityIndicator, Pressable, Image } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { useThemedAlert } from "@/components/ThemedAlert";

export default function BlockedUsersScreen() {
  const { theme } = useTheme();
  const { token } = useAuth();
  const { get, del } = useApi();
  const { showAlert } = useThemedAlert();
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBlockedUsers = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await get<any>('/block/list', token);
      if (response.success) {
        setBlockedUsers(response.blockedUsers);
      }
    } catch (error) {
      console.error('Failed to fetch blocked users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, [token]);

  const handleUnblock = async (userId: string, name: string) => {
    try {
      const response = await del(`/block/${userId}`, token || '');
      if (response.success) {
        setBlockedUsers(prev => prev.filter(u => u._id !== userId));
        showAlert('Success', `${name} has been unblocked`, [{ text: 'OK' }], 'check-circle');
      }
    } catch (error) {
      showAlert('Error', 'Failed to unblock user', [{ text: 'OK' }], 'alert-circle');
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={[styles.userCard, { backgroundColor: theme.settingsItemBg }]}>
      <Image 
        source={{ uri: item.photos?.[0] || 'https://via.placeholder.com/50' }} 
        style={styles.avatar} 
      />
      <View style={styles.userInfo}>
        <ThemedText style={styles.userName}>{item.name}</ThemedText>
        <ThemedText style={{ color: theme.textSecondary }}>Blocked</ThemedText>
      </View>
      <Pressable 
        style={[styles.unblockButton, { borderColor: theme.primary }]} 
        onPress={() => handleUnblock(item._id, item.name)}
      >
        <ThemedText style={{ color: theme.primary, fontWeight: '600' }}>Unblock</ThemedText>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={blockedUsers}
        renderItem={renderItem}
        keyExtractor={item => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="slash" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>No blocked users</ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: Spacing.m },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.m,
    borderRadius: BorderRadius.m,
    marginBottom: Spacing.s,
  },
  avatar: { width: 50, height: 50, borderRadius: 25 },
  userInfo: { flex: 1, marginLeft: Spacing.m },
  userName: { fontSize: 16, fontWeight: 'bold' },
  unblockButton: {
    paddingHorizontal: Spacing.m,
    paddingVertical: Spacing.s,
    borderRadius: BorderRadius.s,
    borderWidth: 1,
  },
  emptyContainer: { flex: 1, alignItems: 'center', marginTop: 100 },
  emptyText: { marginTop: Spacing.m, fontSize: 16 },
});

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/hooks/useTheme';
import { getApiBaseUrl } from '@/constants/config';
import { useUnread } from '@/contexts/UnreadContext';
import { getPhotoSource } from '@/utils/photos';

interface AppNotification {
  _id: string;
  type: 'match' | 'like' | 'super_like' | 'message' | 'profile_view' | 'verification' | 'subscription' | 'system' | 'call' | 'missed_call' | 'story';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  sender?: {
    _id: string;
    name: string;
    photos?: string[];
    verified?: boolean;
  };
  data?: Record<string, any>;
}

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  match:        { icon: 'heart',         color: '#10B981', bg: '#D1FAE5' },
  like:         { icon: 'heart',         color: '#EF4444', bg: '#FEE2E2' },
  super_like:   { icon: 'star',          color: '#3B82F6', bg: '#DBEAFE' },
  message:      { icon: 'message-circle',color: '#10B981', bg: '#D1FAE5' },
  profile_view: { icon: 'eye',           color: '#8B5CF6', bg: '#EDE9FE' },
  verification: { icon: 'check-circle',  color: '#10B981', bg: '#D1FAE5' },
  subscription: { icon: 'award',         color: '#F59E0B', bg: '#FEF3C7' },
  call:         { icon: 'phone',         color: '#10B981', bg: '#D1FAE5' },
  missed_call:  { icon: 'phone-missed',  color: '#EF4444', bg: '#FEE2E2' },
  story:        { icon: 'image',         color: '#EC4899', bg: '#FCE7F3' },
  system:       { icon: 'bell',          color: '#6B7280', bg: '#F3F4F6' },
};

const FILTER_TABS = [
  { id: 'all',          label: 'All' },
  { id: 'match',        label: 'Matches' },
  { id: 'like',         label: 'Likes' },
  { id: 'message',      label: 'Messages' },
  { id: 'system',       label: 'System' },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getGroup(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 1) return 'Today';
  if (days < 7) return 'This Week';
  return 'Earlier';
}

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { setUnreadNotifCount, refreshNotifCount } = useUnread();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const tokenRef = useRef<string | null>(null);

  const getToken = useCallback(async () => {
    if (tokenRef.current) return tokenRef.current;
    const t = await AsyncStorage.getItem('auth_token');
    tokenRef.current = t;
    return t;
  }, []);

  const fetchNotifications = useCallback(async (pageNum = 1, currentFilter = filter, isRefresh = false) => {
    try {
      const token = await getToken();
      if (!token) return;
      const typeParam = currentFilter === 'all' ? '' : `&type=${currentFilter}`;
      const res = await fetch(
        `${getApiBaseUrl()}/api/notifications?page=${pageNum}&limit=20${typeParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      const items: AppNotification[] = data.notifications ?? [];
      setNotifications(prev => (pageNum === 1 || isRefresh) ? items : [...prev, ...items]);
      setHasMore(pageNum < (data.pages ?? 1));
      setPage(pageNum);

      if (typeof data.unreadCount === 'number') {
        setUnreadNotifCount(data.unreadCount);
      }
    } catch {}
  }, [filter, getToken, setUnreadNotifCount]);

  const load = useCallback(async () => {
    setLoading(true);
    await fetchNotifications(1, filter, true);
    setLoading(false);
  }, [fetchNotifications, filter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications(1, filter, true);
    setRefreshing(false);
  }, [fetchNotifications, filter]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    await fetchNotifications(page + 1);
    setLoadingMore(false);
  }, [hasMore, loadingMore, page, fetchNotifications]);

  useEffect(() => { load(); }, [filter]);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications(1, filter, true);
    }, [filter])
  );

  const markAllRead = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`${getApiBaseUrl()}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadNotifCount(0);
    } catch {}
  }, [getToken, setUnreadNotifCount]);

  const markOneRead = useCallback(async (id: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`${getApiBaseUrl()}/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      refreshNotifCount();
    } catch {}
  }, [getToken, refreshNotifCount]);

  const clearAll = useCallback(async () => {
    Alert.alert('Clear All', 'Remove all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive', onPress: async () => {
          try {
            const token = await getToken();
            if (!token) return;
            await fetch(`${getApiBaseUrl()}/api/notifications/clear`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            });
            setNotifications([]);
            setUnreadNotifCount(0);
          } catch {}
        }
      }
    ]);
  }, [getToken, setUnreadNotifCount]);

  const hasUnread = notifications.some(n => !n.read);

  const grouped = React.useMemo(() => {
    const groups: Record<string, AppNotification[]> = {};
    for (const n of notifications) {
      const g = getGroup(n.createdAt);
      if (!groups[g]) groups[g] = [];
      groups[g].push(n);
    }
    const order = ['Today', 'This Week', 'Earlier'];
    return order.filter(k => groups[k]).map(k => ({ title: k, items: groups[k] }));
  }, [notifications]);

  const s = styles(theme);

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Notifications</Text>
        <View style={s.headerActions}>
          {hasUnread && (
            <Pressable onPress={markAllRead} style={s.markReadBtn}>
              <Text style={s.markReadText}>Mark all read</Text>
            </Pressable>
          )}
          {notifications.length > 0 && (
            <Pressable onPress={clearAll} style={s.clearBtn}>
              <Feather name="trash-2" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterScroll}
        contentContainerStyle={s.filterContent}
      >
        {FILTER_TABS.map(tab => (
          <Pressable
            key={tab.id}
            onPress={() => setFilter(tab.id)}
            style={[s.filterTab, filter === tab.id && { backgroundColor: theme.primary }]}
          >
            <Text style={[s.filterTabText, { color: filter === tab.id ? '#fff' : theme.textSecondary }]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={s.center}>
          <View style={[s.emptyIconWrap, { backgroundColor: theme.surface }]}>
            <Feather name="bell-off" size={40} color={theme.textSecondary} />
          </View>
          <Text style={[s.emptyTitle, { color: theme.text }]}>No notifications yet</Text>
          <Text style={[s.emptyBody, { color: theme.textSecondary }]}>
            Matches, likes, and messages will appear here
          </Text>
        </View>
      ) : (
        <ScrollView
          style={s.list}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 60) {
              loadMore();
            }
          }}
          scrollEventThrottle={400}
        >
          {grouped.map(group => (
            <View key={group.title}>
              <Text style={[s.groupLabel, { color: theme.textSecondary }]}>{group.title}</Text>
              {group.items.map(notif => (
                <NotifItem
                  key={notif._id}
                  notif={notif}
                  theme={theme}
                  onPress={() => { if (!notif.read) markOneRead(notif._id); }}
                />
              ))}
            </View>
          ))}
          {loadingMore && (
            <View style={{ paddingVertical: 16 }}>
              <ActivityIndicator color={theme.primary} />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function NotifItem({ notif, theme, onPress }: { notif: AppNotification; theme: any; onPress: () => void }) {
  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.system;
  const photoUrl = notif.sender?.photos?.[0];
  const photoSrc = photoUrl ? getPhotoSource(photoUrl) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        notifItemStyles.row,
        {
          backgroundColor: notif.read
            ? theme.surface
            : `${theme.primary}08`,
          opacity: pressed ? 0.85 : 1,
          borderBottomColor: theme.border,
        },
      ]}
    >
      {/* Avatar + type badge */}
      <View style={notifItemStyles.avatarWrap}>
        {photoSrc ? (
          <Image
            source={photoSrc}
            style={notifItemStyles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={[notifItemStyles.avatarPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="user" size={22} color={theme.textSecondary} />
          </View>
        )}
        <View style={[notifItemStyles.typeBadge, { backgroundColor: cfg.bg }]}>
          <Feather name={cfg.icon as any} size={10} color={cfg.color} />
        </View>
      </View>

      {/* Text */}
      <View style={notifItemStyles.textWrap}>
        <Text style={[notifItemStyles.title, { color: theme.text, fontWeight: notif.read ? '500' : '700' }]} numberOfLines={1}>
          {notif.title}
        </Text>
        <Text style={[notifItemStyles.body, { color: theme.textSecondary }]} numberOfLines={2}>
          {notif.body}
        </Text>
        <Text style={[notifItemStyles.time, { color: theme.textTertiary }]}>
          {timeAgo(notif.createdAt)}
        </Text>
      </View>

      {/* Unread dot */}
      {!notif.read && (
        <View style={[notifItemStyles.unreadDot, { backgroundColor: theme.primary }]} />
      )}
    </Pressable>
  );
}

const notifItemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  time: {
    fontSize: 11,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
});

function styles(theme: any) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: theme.backgroundRoot,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.5,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    markReadBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: theme.surface,
    },
    markReadText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.primary,
    },
    clearBtn: {
      padding: 6,
      borderRadius: 20,
      backgroundColor: theme.surface,
    },
    filterScroll: {
      flexShrink: 0,
      maxHeight: 44,
    },
    filterContent: {
      paddingHorizontal: 16,
      paddingBottom: 8,
      gap: 8,
      flexDirection: 'row',
    },
    filterTab: {
      paddingHorizontal: 16,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: theme.surface,
    },
    filterTabText: {
      fontSize: 13,
      fontWeight: '600',
    },
    list: {
      flex: 1,
    },
    groupLabel: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 6,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      gap: 12,
    },
    emptyIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
    },
    emptyBody: {
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}

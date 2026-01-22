import React, { useState, useCallback, useEffect, useMemo, memo, useRef } from "react";
import { 
  View, 
  StyleSheet, 
  Pressable, 
  TextInput, 
  ScrollView, 
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  StatusBar,
  Animated,
  Dimensions
} from "react-native";
import { Image } from "expo-image";
import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MainTabParamList } from "@/navigation/MainTabNavigator";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import noMessageImg from "../assets/images/no_messages_empty_state.png";

import socketService from "@/services/socket";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ChatsScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Chats">,
  NativeStackNavigationProp<RootStackParamList>
>;

interface ChatsScreenProps {
  navigation: ChatsScreenNavigationProp;
}

interface Conversation {
  id: string;
  matchId: string;
  user: {
    id: string;
    name: string;
    photo?: string;
    online: boolean;
    verified?: boolean;
  };
  lastMessage: string;
  lastMessageType: string;
  timestamp: string;
  unreadCount: number;
  isArchived?: boolean;
  isMuted?: boolean;
  isPinned?: boolean;
}

interface StoryUser {
  id: string;
  name: string;
  photo?: string;
  hasStory: boolean;
  hasNewStory: boolean;
  storyCount?: number;
  stories?: any[];
}

interface CallHistoryItem {
  _id: string;
  caller: {
    _id: string;
    name: string;
    photos?: { url: string }[] | string[];
  };
  receiver: {
    _id: string;
    name: string;
    photos?: { url: string }[] | string[];
  };
  type: 'video' | 'audio';
  status: 'completed' | 'missed' | 'rejected' | 'failed';
  duration: number;
  createdAt: string;
}

const CACHE_KEY = '@conversations_cache';
const ARCHIVED_KEY = '@archived_chats';
const MUTED_KEY = '@muted_chats';
const PINNED_KEY = '@pinned_chats';
const CACHE_DURATION = 120000; // 2 minutes for better UX

const ChatItem = memo(({ 
  item, 
  theme, 
  onPress,
  onLongPress
}: { 
  item: Conversation; 
  theme: any; 
  onPress: () => void;
  onLongPress: () => void;
}) => {
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getMessagePreview = (message: string, type: string) => {
    switch (type) {
      case 'image':
        return '📷 Photo';
      case 'audio':
        return '🎤 Voice message';
      case 'file':
        return '📎 File';
      default:
        return message || 'Start a conversation';
    }
  };

  return (
    <Pressable
      style={[styles.chatItem, { backgroundColor: theme.surface }]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <View style={styles.avatarContainer}>
        {item.user.photo ? (
          <Image source={{ uri: item.user.photo }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="user" size={28} color={theme.textSecondary} />
          </View>
        )}
        {item.user.online && (
          <View style={[styles.onlineBadge, { backgroundColor: '#4CAF50', borderColor: theme.surface }]} />
        )}
      </View>

      <View style={styles.chatContent}>
        <View style={styles.chatHeader}>
          <View style={styles.nameRow}>
            {item.isPinned && (
              <Ionicons name="pin" size={14} color={theme.primary} style={{ marginRight: 4 }} />
            )}
            <ThemedText style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {item.user.name}
            </ThemedText>
            {item.user.verified && (
              <Image source={require("@/assets/icons/verified-tick.png")} style={{ width: 18, height: 18, marginLeft: 4 }} contentFit="contain" />
            )}
            {item.isMuted && (
              <Ionicons name="notifications-off" size={14} color={theme.textSecondary} style={{ marginLeft: 4 }} />
            )}
          </View>
          <ThemedText style={[styles.timestamp, { color: theme.textSecondary }]}>
            {formatTimestamp(item.timestamp)}
          </ThemedText>
        </View>
        <View style={styles.chatFooter}>
          <ThemedText
            style={[
              styles.lastMessage,
              { color: theme.textSecondary },
              item.unreadCount > 0 && !item.isMuted && { color: theme.text, fontWeight: "600" },
            ]}
            numberOfLines={1}
          >
            {getMessagePreview(item.lastMessage, item.lastMessageType)}
          </ThemedText>
          {item.unreadCount > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: item.isMuted ? theme.textSecondary : theme.primary }]}>
              <ThemedText style={styles.unreadText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </ThemedText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
});

const CallHistoryItemComponent = memo(({ 
  item, 
  theme, 
  currentUserId,
  onPress 
}: { 
  item: CallHistoryItem; 
  theme: any; 
  currentUserId: string;
  onPress: () => void;
}) => {
  const isOutgoing = item.caller._id === currentUserId;
  const otherUser = isOutgoing ? item.receiver : item.caller;
  const photo = otherUser.photos?.[0];
  const photoUrl = typeof photo === 'string' ? photo : photo?.url;
  
  const formatDuration = (seconds: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getStatusIcon = () => {
    if (item.status === 'missed' || item.status === 'rejected') {
      return { name: isOutgoing ? 'call-outline' : 'call', color: '#FF5252' };
    }
    return { name: isOutgoing ? 'call-outline' : 'call', color: '#4CAF50' };
  };

  const statusIcon = getStatusIcon();

  return (
    <Pressable style={[styles.callHistoryItem, { backgroundColor: theme.surface }]} onPress={onPress}>
      <View style={styles.callHistoryAvatarContainer}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.callHistoryAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.callHistoryAvatarPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="user" size={18} color={theme.textSecondary} />
          </View>
        )}
        <View style={[styles.callTypeIcon, { backgroundColor: item.type === 'video' ? '#2196F3' : '#4CAF50' }]}>
          <Ionicons name={item.type === 'video' ? 'videocam' : 'call'} size={10} color="#FFF" />
        </View>
      </View>
      <View style={styles.callHistoryInfo}>
        <ThemedText style={[styles.callHistoryName, { color: theme.text }]} numberOfLines={1}>
          {otherUser.name?.split(' ')[0] || 'Unknown'}
        </ThemedText>
        <View style={styles.callHistoryStatus}>
          <Ionicons name={statusIcon.name as any} size={12} color={statusIcon.color} />
          <ThemedText style={[styles.callHistoryTime, { color: theme.textSecondary }]}>
            {formatTime(item.createdAt)}
          </ThemedText>
        </View>
      </View>
    </Pressable>
  );
});

  const StoryItem = memo(({ 
    item, 
    theme, 
    onPress,
    user,
    navigation
  }: { 
    item: StoryUser; 
    theme: any; 
    onPress: () => void;
    user: any;
    navigation: any;
  }) => {
    const isOwnStory = item.id === user?.id || item.name === 'Your Story' || item.name === user?.name;
    
    return (
      <Pressable style={styles.storyItem} onPress={() => {
        if (isOwnStory && item.hasStory) {
          navigation.navigate("StoryViewer" as any, { 
            userId: user.id, 
            userName: user.name || 'You',
            userPhoto: typeof user.photos?.[0] === 'string' ? user.photos?.[0] : user.photos?.[0]?.url,
            isOwnStory: true
          });
        } else if (isOwnStory) {
          navigation.navigate('StoryUpload');
        } else {
          onPress();
        }
      }}>
      <LinearGradient
        colors={item.hasNewStory 
          ? ['#FF6B6B', '#FF8E53', '#FFC93C'] 
          : item.hasStory 
            ? [theme.primary, theme.primary] 
            : [theme.border, theme.border]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.storyGradientRing}
      >
        <View style={[styles.storyInnerRing, { backgroundColor: theme.background }]}>
          {item.photo ? (
            <Image source={{ uri: item.photo }} style={styles.storyAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.storyAvatarPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="user" size={22} color={theme.textSecondary} />
            </View>
          )}
        </View>
      </LinearGradient>
      {isOwnStory && (
        <Pressable 
          style={[styles.storyPlusBadge, { backgroundColor: theme.primary, borderColor: theme.background }]}
          onPress={(e) => {
            e.stopPropagation();
            navigation.navigate('StoryUpload');
          }}
        >
          <Ionicons name="add" size={12} color="#fff" />
        </Pressable>
      )}
      {item.hasNewStory && !isOwnStory && (
        <View style={styles.storyNewDot} />
      )}
      <ThemedText style={[styles.storyName, { color: theme.text }]} numberOfLines={1}>
        {isOwnStory ? "Your Story" : item.name.split(' ')[0]}
      </ThemedText>
    </Pressable>
    );
  });

export default function ChatsScreen({ navigation }: ChatsScreenProps) {
  const { theme, isDark } = useTheme();
  const { user, token } = useAuth();
  const { get, put, del, post } = useApi();
  const insets = useSafeAreaInsets();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archivedChats, setArchivedChats] = useState<Set<string>>(new Set());
  const [mutedChats, setMutedChats] = useState<Set<string>>(new Set());
  const [pinnedChats, setPinnedChats] = useState<Set<string>>(new Set());
  const [storyUsers, setStoryUsers] = useState<StoryUser[]>([]);
  const [userHasStory, setUserHasStory] = useState(false);
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [chatMenuVisible, setChatMenuVisible] = useState(false);

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('MainTabs', { screen: 'Discovery' });
    }
  }, [navigation]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchConversationsFromServer(undefined, false);
  }, [fetchConversationsFromServer]);

  const loadLocalSettings = useCallback(async () => {
    try {
      const [archived, muted, pinned] = await Promise.all([
        AsyncStorage.getItem(ARCHIVED_KEY),
        AsyncStorage.getItem(MUTED_KEY),
        AsyncStorage.getItem(PINNED_KEY)
      ]);
      if (archived) setArchivedChats(new Set(JSON.parse(archived)));
      if (muted) setMutedChats(new Set(JSON.parse(muted)));
      if (pinned) setPinnedChats(new Set(JSON.parse(pinned)));
    } catch (e) {
      console.log('Settings load error:', e);
    }
  }, []);

  const saveLocalSettings = useCallback(async (key: string, data: Set<string>) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify([...data]));
    } catch (e) {
      console.log('Settings save error:', e);
    }
  }, []);

  const loadCachedData = useCallback(async (showImmediately = true) => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isValid = Date.now() - timestamp < CACHE_DURATION;
        // Show cached data immediately even if stale, for faster perceived loading
        if (showImmediately) {
          setConversations(data.conversations || []);
          setStoryUsers(data.stories || []);
          setLoading(false);
        }
        return isValid;
      }
    } catch (e) {
      console.log('Cache load error:', e);
    }
    // No cache found - set loading false to show empty state faster
    if (showImmediately) {
      setLoading(false);
    }
    return false;
  }, []);

  const fetchMyStories = useCallback(async () => {
    if (!token) return false;
    try {
      const response = await get<{ stories: any[] }>('/stories/my-stories', token);
      if (response.success && response.data?.stories && response.data.stories.length > 0) {
        setUserHasStory(true);
        return true;
      }
    } catch (error) {
      console.log('My stories fetch error:', error);
    }
    setUserHasStory(false);
    return false;
  }, [token, get]);

  const fetchStories = useCallback(async () => {
    if (!token) return [];
    try {
      const response = await get<{ stories: StoryUser[] }>('/stories/active', token);
      if (response.success && response.data?.stories) {
        // Filter out my own story from the general stories list since we handle it separately
        // and ensure we don't have duplicates by checking IDs
        const filtered = response.data.stories.filter(s => s.hasStory && s.id !== user?.id && s.name !== 'Your Story');
        const unique = filtered.filter((s, index, self) => 
          index === self.findIndex(t => t.id === s.id)
        );
        return unique;
      }
    } catch (error) {
      console.log('Stories fetch error:', error);
    }
    return [];
  }, [token, get, user?.id]);

  const fetchCallHistory = useCallback(async () => {
    if (!token) return;
    try {
      const response = await get<{ calls: CallHistoryItem[] }>('/call/history', token);
      if (response.success && response.data?.calls) {
        setCallHistory(response.data.calls);
      }
    } catch (error) {
      console.log('Call history fetch error:', error);
    }
  }, [token, get]);

  const fetchConversations = useCallback(async (search?: string, isRefresh = false) => {
    if (!token) {
      setLoading(false);
      return;
    }
    
    if (!isRefresh && !search) {
      // Load cache immediately, then fetch fresh data in background
      const cacheIsValid = await loadCachedData(true);
      // Always fetch fresh data, but as background if we showed cached
      fetchConversationsFromServer(search, cacheIsValid);
      return;
    }
    
    await fetchConversationsFromServer(search, false);
  }, [token, loadCachedData]);

  const fetchConversationsFromServer = async (search?: string, isBackground = false) => {
    if (!token) return;
    
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : '';
      const response = await get<{ conversations: Conversation[] }>(`/chat/conversations${query}`, token);
      
      if (response.success && response.data) {
        const uniqueConversations = response.data.conversations
          .filter((conv, index, self) => 
            index === self.findIndex(c => c.user.id === conv.user.id)
          )
          .map(conv => ({
            ...conv,
            isArchived: archivedChats.has(conv.user.id),
            isMuted: mutedChats.has(conv.user.id),
            isPinned: pinnedChats.has(conv.user.id)
          }));
        setConversations(uniqueConversations);
        
        // Background Pre-fetching for each conversation
        if (!search && !isBackground) {
          uniqueConversations.slice(0, 10).forEach(async (conv) => {
            try {
              const mId = conv.matchId || conv.id;
              const cacheKey = `chat_messages_${conv.user.id}`;
              const messagesResponse = await get<{ messages: any[] }>(`/chat/${mId}`, token);
              if (messagesResponse.success && messagesResponse.data) {
                await AsyncStorage.setItem(cacheKey, JSON.stringify(messagesResponse.data.messages));
              }
            } catch (e) {
              console.log('Pre-fetch error for', conv.user.name, e);
            }
          });
        }

        const stories = await fetchStories();
        if (stories.length > 0) {
          setStoryUsers(stories);
        }
        
        if (!search) {
          try {
            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
              data: { conversations: uniqueConversations, stories },
              timestamp: Date.now()
            }));
          } catch (e) {}
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
      setRefreshing(false);
      setIsSearching(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const checkAndLoad = async () => {
        const [refreshNeeded, storyPosted] = await Promise.all([
          AsyncStorage.getItem('@chats_refresh_needed'),
          AsyncStorage.getItem('@story_posted')
        ]);
        
        if (refreshNeeded) {
          await AsyncStorage.removeItem('@chats_refresh_needed');
          await AsyncStorage.removeItem(CACHE_KEY);
        }
        
        if (storyPosted) {
          await AsyncStorage.removeItem('@story_posted');
        }
        
        const loadPromises = [
          loadLocalSettings(),
          fetchConversations(undefined, !!refreshNeeded),
          fetchCallHistory()
        ];
        
        await Promise.all(loadPromises);
        
        if (storyPosted) {
          await fetchMyStories();
        } else {
          fetchMyStories();
        }
      };
      checkAndLoad().catch(console.log);
    }, [fetchConversations, loadLocalSettings, fetchMyStories, fetchCallHistory])
  );

  // Listen for real-time online/offline status updates
  useEffect(() => {
    const handleUserStatus = (data: { userId: string; isOnline: boolean }) => {
      setConversations(prev => prev.map(conv => 
        conv.user.id === data.userId 
          ? { ...conv, user: { ...conv.user, online: data.isOnline } }
          : conv
      ));
    };

    if (socketService && typeof socketService.on === 'function') {
      socketService.on('user:status', handleUserStatus);
    }
    
    return () => {
      if (socketService && typeof socketService.off === 'function') {
        socketService.off('user:status', handleUserStatus);
      }
    };
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    const timer = setTimeout(() => {
      fetchConversationsFromServer(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleMarkAllRead = async () => {
    setMenuVisible(false);
    if (!token) return;
    try {
      await put('/chat/mark-all-read', {}, token);
      setConversations(prev => prev.map(c => ({ ...c, unreadCount: 0 })));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error marking all read:', error);
    }
  };

  const handleMuteAllNotifications = () => {
    setMenuVisible(false);
    Alert.alert(
      'Mute All Notifications',
      'Do you want to mute notifications for all chats?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mute All',
          onPress: async () => {
            const allUserIds = conversations.map(c => c.user.id);
            const newMuted = new Set(allUserIds);
            setMutedChats(newMuted);
            await saveLocalSettings(MUTED_KEY, newMuted);
            setConversations(prev => prev.map(c => ({ ...c, isMuted: true })));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      ]
    );
  };

  const handleArchivedChats = () => {
    setMenuVisible(false);
    setShowArchived(!showArchived);
  };

  const handleDeleteAllChats = () => {
    setMenuVisible(false);
    Alert.alert(
      'Delete All Chats',
      'Are you sure you want to delete all your chats? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete All', 
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await del('/chat/delete-all', token);
              setConversations([]);
              await AsyncStorage.removeItem(CACHE_KEY);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Error deleting chats:', error);
              Alert.alert('Error', 'Failed to delete chats. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleChatLongPress = (chat: Conversation) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedChat(chat);
    setChatMenuVisible(true);
  };

  const handlePinChat = async () => {
    if (!selectedChat) return;
    setChatMenuVisible(false);
    
    const newPinned = new Set(pinnedChats);
    if (newPinned.has(selectedChat.user.id)) {
      newPinned.delete(selectedChat.user.id);
    } else {
      newPinned.add(selectedChat.user.id);
    }
    setPinnedChats(newPinned);
    await saveLocalSettings(PINNED_KEY, newPinned);
    setConversations(prev => prev.map(c => 
      c.user.id === selectedChat.user.id ? { ...c, isPinned: newPinned.has(c.user.id) } : c
    ));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleMuteChat = async () => {
    if (!selectedChat) return;
    setChatMenuVisible(false);
    
    const newMuted = new Set(mutedChats);
    if (newMuted.has(selectedChat.user.id)) {
      newMuted.delete(selectedChat.user.id);
    } else {
      newMuted.add(selectedChat.user.id);
    }
    setMutedChats(newMuted);
    await saveLocalSettings(MUTED_KEY, newMuted);
    setConversations(prev => prev.map(c => 
      c.user.id === selectedChat.user.id ? { ...c, isMuted: newMuted.has(c.user.id) } : c
    ));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleArchiveChat = async () => {
    if (!selectedChat) return;
    setChatMenuVisible(false);
    
    const newArchived = new Set(archivedChats);
    if (newArchived.has(selectedChat.user.id)) {
      newArchived.delete(selectedChat.user.id);
    } else {
      newArchived.add(selectedChat.user.id);
    }
    setArchivedChats(newArchived);
    await saveLocalSettings(ARCHIVED_KEY, newArchived);
    setConversations(prev => prev.map(c => 
      c.user.id === selectedChat.user.id ? { ...c, isArchived: newArchived.has(c.user.id) } : c
    ));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDeleteChat = () => {
    if (!selectedChat) return;
    setChatMenuVisible(false);
    
    Alert.alert(
      'Delete Chat',
      `Delete your conversation with ${selectedChat.user.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!token || !selectedChat.matchId) {
              Alert.alert('Error', 'Unable to delete chat. Please try again.');
              return;
            }
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              const response = await del(`/chat/${selectedChat.matchId}`, token);
              if (response.success) {
                setConversations(prev => prev.filter(c => c.user.id !== selectedChat.user.id));
                await AsyncStorage.removeItem(CACHE_KEY);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              } else {
                Alert.alert('Error', 'Failed to delete chat. Please try again.');
              }
            } catch (error) {
              console.error('Error deleting chat:', error);
              Alert.alert('Error', 'Failed to delete chat. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleBlockUser = () => {
    if (!selectedChat) return;
    setChatMenuVisible(false);
    
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${selectedChat.user.name}? They won't be able to contact you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
              await post(`/block/${selectedChat.user.id}`, {}, token);
              setConversations(prev => prev.filter(c => c.user.id !== selectedChat.user.id));
              Alert.alert('Blocked', `${selectedChat.user.name} has been blocked`);
            } catch (error) {
              Alert.alert('Error', 'Failed to block user');
            }
          }
        }
      ]
    );
  };

  const filteredConversations = useMemo(() => {
    let filtered = conversations;
    
    if (showArchived) {
      filtered = filtered.filter(c => archivedChats.has(c.user.id));
    } else {
      filtered = filtered.filter(c => !archivedChats.has(c.user.id));
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.user.name.toLowerCase().includes(query) ||
        c.lastMessage?.toLowerCase().includes(query)
      );
    }
    
    return filtered.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [conversations, searchQuery, showArchived, archivedChats]);

  const archivedCount = useMemo(() => 
    conversations.filter(c => archivedChats.has(c.user.id)).length
  , [conversations, archivedChats]);

  const handleViewOwnStory = () => {
    if (userHasStory && user?.id) {
      const ownStoryUser = storyUsers.find(u => u.id === user.id);
      
      navigation.navigate("StoryViewer" as any, { 
        userId: user.id, 
        userName: user.name || 'You',
        userPhoto: typeof user.photos?.[0] === 'string' ? user.photos?.[0] : user.photos?.[0]?.url,
        stories: (ownStoryUser as any)?.stories || []
      });
    }
  };

  const handleAddStory = () => {
    navigation.navigate('StoryUpload' as any);
  };

  const renderAddStoryButton = () => (
    <View style={styles.storyItem}>
      <View style={styles.storyPhotoContainer}>
        <Pressable 
          onPress={() => {
            if (userHasStory) {
              handleViewOwnStory();
            } else {
              handleAddStory();
            }
          }}
          style={styles.storyPhotoTouchable}
        >
          <LinearGradient
            colors={userHasStory 
              ? ['#FF6B6B', '#FF8E53', '#FFC93C'] 
              : [theme.primary, theme.primary + '80']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addStoryGradient}
          >
            <View style={[styles.addStoryInner, { backgroundColor: theme.background }]}>
              {user?.photos?.[0] ? (
                <Image 
                  source={{ uri: typeof user.photos[0] === 'string' ? user.photos[0] : user.photos[0].url }} 
                  style={styles.storyAvatar} 
                  contentFit="cover" 
                />
              ) : (
                <View style={[styles.storyAvatarPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name="user" size={22} color={theme.textSecondary} />
                </View>
              )}
            </View>
          </LinearGradient>
        </Pressable>
        <Pressable 
          style={[styles.addStoryBadge, { backgroundColor: theme.primary, zIndex: 10 }]}
          onPress={handleAddStory}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="plus" size={10} color="#FFF" />
        </Pressable>
      </View>
      <ThemedText style={[styles.storyName, { color: theme.text }]}>
        {userHasStory ? 'Your Story' : 'Add Story'}
      </ThemedText>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Image 
        source={noMessageImg} 
        style={styles.emptyImage} 
        contentFit="contain"
      />
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No Messages</ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Start a conversation with your matches to see them here!
      </ThemedText>
    </View>
  );

  const renderSkeletonItem = () => (
    <View style={[styles.chatItem, { backgroundColor: theme.surface }]}>
      <View style={[styles.avatarPlaceholder, styles.skeletonPulse, { backgroundColor: theme.backgroundSecondary }]} />
      <View style={styles.chatContent}>
        <View style={[styles.skeletonLine, styles.skeletonPulse, { width: '60%', backgroundColor: theme.backgroundSecondary }]} />
        <View style={[styles.skeletonLine, styles.skeletonPulse, { width: '80%', marginTop: 8, backgroundColor: theme.backgroundSecondary }]} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <LinearGradient
        colors={isDark ? ['#1a1a2e', '#16213e', '#0f0f1a'] : ['#f8f9ff', '#ffffff', '#f0f4ff']}
        style={styles.container}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        <View style={[styles.safeHeader, { paddingTop: insets.top }]}>
          <View style={styles.header}>
          </View>
        </View>
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i}>{renderSkeletonItem()}</View>
          ))}
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={isDark ? ['#1a1a2e', '#16213e', '#0f0f1a'] : ['#f8f9ff', '#ffffff', '#f0f4ff']}
      style={styles.container}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      <View style={[styles.safeHeader, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {showArchived && (
              <Pressable onPress={() => setShowArchived(false)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </Pressable>
            )}
            <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
              {showArchived ? 'Archived' : 'Chats'}
            </ThemedText>
          </View>
          <Pressable 
            style={[styles.menuButton, { backgroundColor: theme.surface }]}
            onPress={() => setMenuVisible(true)}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={theme.text} />
          </Pressable>
        </View>

        {!searchQuery && !showArchived && (
          <>
            <View style={styles.storiesSection}>
              <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary }]}>Stories</ThemedText>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storiesContainer}
              >
                {renderAddStoryButton()}
                {storyUsers.map((storyUser) => {
                  const isOwnStory = storyUser.id === user?.id;
                  return (
                    <StoryItem
                      key={`story-${storyUser.id}`}
                      item={storyUser}
                      theme={theme}
                      user={user}
                      navigation={navigation}
                      onPress={() => {
                        if (isOwnStory) {
                          handleViewOwnStory();
                        } else {
                          navigation.navigate("StoryViewer" as any, { userId: storyUser.id, userName: storyUser.name, userPhoto: storyUser.photo });
                        }
                      }}
                    />
                  );
                })}
              </ScrollView>
            </View>
          </>
        )}

        <View style={[styles.searchContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search messages..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {isSearching && <ActivityIndicator size="small" color={theme.primary} />}
          {searchQuery.length > 0 && !isSearching && (
            <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
              <Feather name="x-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        {!searchQuery && !showArchived && callHistory.length > 0 && (
          <View style={styles.callHistorySection}>
            <View style={styles.callHistoryHeader}>
              <Ionicons name="call" size={16} color={theme.primary} />
              <ThemedText style={[styles.callHistorySectionTitle, { color: theme.text }]}>
                Recent Calls
              </ThemedText>
            </View>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.callHistoryContainer}
            >
              {callHistory.slice(0, 10).map((call) => {
                const isOutgoing = call.caller._id === user?.id;
                const otherUser = isOutgoing ? call.receiver : call.caller;
                const photo = otherUser.photos?.[0];
                const photoUrl = typeof photo === 'string' ? photo : (photo as any)?.url;
                return (
                  <CallHistoryItemComponent
                    key={call._id}
                    item={call}
                    theme={theme}
                    currentUserId={user?.id || ''}
                    onPress={() => navigation.navigate("ChatDetail", { 
                      userId: otherUser._id, 
                      userName: otherUser.name, 
                      userPhoto: photoUrl 
                    })}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        {!searchQuery && filteredConversations.length > 0 && (
          <ThemedText style={[styles.sectionLabel, { color: theme.textSecondary, marginTop: 8 }]}>
            Messages
          </ThemedText>
        )}
      </View>

      <FlatList
        data={filteredConversations}
        renderItem={({ item }) => (
          <ChatItem 
            item={item} 
            theme={theme}
            onPress={() => navigation.navigate("ChatDetail", { userId: item.user.id, userName: item.user.name, userPhoto: item.user.photo })}
            onLongPress={() => handleChatLongPress(item)}
          />
        )}
        keyExtractor={(item) => item.id || item.user.id}
        contentContainerStyle={[
          styles.listContent,
          filteredConversations.length === 0 && styles.emptyListContent
        ]}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={15}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      />

      {/* Main Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuContainer, { backgroundColor: theme.surface, top: insets.top + 50 }]}>
            <Pressable style={styles.menuItem} onPress={handleMarkAllRead}>
              <View style={[styles.menuIconCircle, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="checkmark-done" size={18} color={theme.primary} />
              </View>
              <ThemedText style={[styles.menuItemText, { color: theme.text }]}>
                Mark all as read
              </ThemedText>
            </Pressable>
            <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
            <Pressable style={styles.menuItem} onPress={handleArchivedChats}>
              <View style={[styles.menuIconCircle, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="archive-outline" size={18} color={theme.text} />
              </View>
              <View style={styles.menuItemContent}>
                <ThemedText style={[styles.menuItemText, { color: theme.text }]}>
                  {showArchived ? 'View all chats' : 'Archived chats'}
                </ThemedText>
                {archivedCount > 0 && !showArchived && (
                  <View style={[styles.menuBadge, { backgroundColor: theme.primary }]}>
                    <ThemedText style={styles.menuBadgeText}>{archivedCount}</ThemedText>
                  </View>
                )}
              </View>
            </Pressable>
            <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
            <Pressable style={styles.menuItem} onPress={handleMuteAllNotifications}>
              <View style={[styles.menuIconCircle, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="notifications-off-outline" size={18} color={theme.text} />
              </View>
              <ThemedText style={[styles.menuItemText, { color: theme.text }]}>
                Mute all notifications
              </ThemedText>
            </Pressable>
            <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
            <Pressable style={styles.menuItem} onPress={handleDeleteAllChats}>
              <View style={[styles.menuIconCircle, { backgroundColor: '#FF525220' }]}>
                <Ionicons name="trash-outline" size={18} color="#FF5252" />
              </View>
              <ThemedText style={[styles.menuItemText, { color: '#FF5252' }]}>
                Delete all chats
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Chat Long Press Menu Modal */}
      <Modal
        visible={chatMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChatMenuVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setChatMenuVisible(false)}>
          <View style={[styles.chatMenuContainer, { backgroundColor: theme.surface }]}>
            {selectedChat && (
              <>
                <View style={[styles.chatMenuHeader, { borderBottomColor: theme.border }]}>
                  {selectedChat.user.photo ? (
                    <Image source={{ uri: selectedChat.user.photo }} style={styles.chatMenuAvatar} contentFit="cover" />
                  ) : (
                    <View style={[styles.chatMenuAvatarPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
                      <Feather name="user" size={20} color={theme.textSecondary} />
                    </View>
                  )}
                  <ThemedText style={[styles.chatMenuName, { color: theme.text }]}>
                    {selectedChat.user.name}
                  </ThemedText>
                </View>

                <View style={styles.chatMenuOptions}>
                  <Pressable style={styles.chatMenuOption} onPress={handlePinChat}>
                    <View style={[styles.chatMenuIconCircle, { backgroundColor: theme.primary + '20' }]}>
                      <Ionicons name={pinnedChats.has(selectedChat.user.id) ? "pin-outline" : "pin"} size={20} color={theme.primary} />
                    </View>
                    <ThemedText style={[styles.chatMenuOptionText, { color: theme.text }]}>
                      {pinnedChats.has(selectedChat.user.id) ? 'Unpin chat' : 'Pin chat'}
                    </ThemedText>
                  </Pressable>

                  <Pressable style={styles.chatMenuOption} onPress={handleMuteChat}>
                    <View style={[styles.chatMenuIconCircle, { backgroundColor: '#FF9800' + '20' }]}>
                      <Ionicons name={mutedChats.has(selectedChat.user.id) ? "notifications" : "notifications-off"} size={20} color="#FF9800" />
                    </View>
                    <ThemedText style={[styles.chatMenuOptionText, { color: theme.text }]}>
                      {mutedChats.has(selectedChat.user.id) ? 'Unmute' : 'Mute notifications'}
                    </ThemedText>
                  </Pressable>

                  <Pressable style={styles.chatMenuOption} onPress={handleArchiveChat}>
                    <View style={[styles.chatMenuIconCircle, { backgroundColor: '#9C27B0' + '20' }]}>
                      <Ionicons name={archivedChats.has(selectedChat.user.id) ? "archive" : "archive-outline"} size={20} color="#9C27B0" />
                    </View>
                    <ThemedText style={[styles.chatMenuOptionText, { color: theme.text }]}>
                      {archivedChats.has(selectedChat.user.id) ? 'Unarchive' : 'Archive chat'}
                    </ThemedText>
                  </Pressable>

                  <Pressable 
                    style={styles.chatMenuOption} 
                    onPress={() => {
                      setChatMenuVisible(false);
                      navigation.navigate('ProfileDetail', { userId: selectedChat.user.id });
                    }}
                  >
                    <View style={[styles.chatMenuIconCircle, { backgroundColor: '#2196F3' + '20' }]}>
                      <Ionicons name="person-outline" size={20} color="#2196F3" />
                    </View>
                    <ThemedText style={[styles.chatMenuOptionText, { color: theme.text }]}>
                      View profile
                    </ThemedText>
                  </Pressable>

                  <View style={[styles.chatMenuDivider, { backgroundColor: theme.border }]} />

                  <Pressable style={styles.chatMenuOption} onPress={handleDeleteChat}>
                    <View style={[styles.chatMenuIconCircle, { backgroundColor: '#FF5252' + '20' }]}>
                      <Ionicons name="trash-outline" size={20} color="#FF5252" />
                    </View>
                    <ThemedText style={[styles.chatMenuOptionText, { color: '#FF5252' }]}>
                      Delete chat
                    </ThemedText>
                  </Pressable>

                  <Pressable style={styles.chatMenuOption} onPress={handleBlockUser}>
                    <View style={[styles.chatMenuIconCircle, { backgroundColor: '#FF5252' + '20' }]}>
                      <Ionicons name="ban-outline" size={20} color="#FF5252" />
                    </View>
                    <ThemedText style={[styles.chatMenuOptionText, { color: '#FF5252' }]}>
                      Block user
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    ...Typography.body,
  },
  safeHeader: {
    zIndex: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.lg,
    marginBottom: 8,
  },
  storiesSection: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  storiesContainer: {
    paddingHorizontal: Spacing.lg,
    gap: 14,
  },
  storyItem: {
    alignItems: "center",
    width: 70,
    position: 'relative',
  },
  storyGradientRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  storyInnerRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  storyAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  storyAvatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
  storyNewDot: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF6B6B',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  storyPhotoContainer: {
    position: 'relative',
  },
  storyPhotoTouchable: {
    zIndex: 1,
  },
  addStoryGradient: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  addStoryInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  addStoryBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: '#FFF',
    zIndex: 10,
  },
  storyName: {
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
    fontWeight: '500',
  },
  listContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: 8,
  },
  emptyListContent: {
    flex: 1,
  },
  chatItem: {
    flexDirection: "row",
    padding: Spacing.md,
    borderRadius: 16,
    gap: Spacing.md,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  chatContent: {
    flex: 1,
    justifyContent: "center",
    gap: 4,
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    marginLeft: 8,
  },
  chatFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  emptyImage: {
    width: 200,
    height: 200,
    marginBottom: 20,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  emptyButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  menuContainer: {
    position: "absolute",
    right: Spacing.lg,
    borderRadius: 16,
    padding: 8,
    minWidth: 220,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "500",
  },
  menuBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  menuBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  menuDivider: {
    height: 1,
    marginVertical: 4,
    marginHorizontal: 12,
  },
  chatMenuContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  chatMenuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.md,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    gap: 12,
  },
  chatMenuAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  chatMenuAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMenuName: {
    fontSize: 18,
    fontWeight: '700',
  },
  chatMenuOptions: {
    gap: 4,
  },
  chatMenuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  chatMenuIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatMenuOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  chatMenuDivider: {
    height: 1,
    marginVertical: 8,
  },
  skeletonContainer: {
    flex: 1,
    paddingTop: Spacing.sm,
  },
  skeletonPulse: {
    opacity: 0.6,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
  },
  callHistorySection: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  callHistoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: 8,
  },
  callHistorySectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  callHistoryCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  callHistoryContainer: {
    paddingHorizontal: Spacing.lg,
    gap: 12,
  },
  callHistoryItem: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    minWidth: 80,
  },
  callHistoryAvatarContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  callHistoryAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  callHistoryAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callTypeIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  callHistoryInfo: {
    alignItems: 'center',
  },
  callHistoryName: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    maxWidth: 70,
  },
  callHistoryStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  callHistoryTime: {
    fontSize: 10,
  },
  emptyCallHistoryContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  emptyCallHistoryText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});

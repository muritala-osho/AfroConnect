import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, Dimensions, Keyboard } from "react-native";
import { Image } from "expo-image";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useApi } from "@/hooks/useApi";
import socketService from "@/services/socket";
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPhotoSource } from "@/utils/photos";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ChatDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "ChatDetail">;
type ChatDetailScreenRouteProp = RouteProp<RootStackParamList, "ChatDetail">;

interface ChatDetailScreenProps {
  navigation: ChatDetailScreenNavigationProp;
  route: ChatDetailScreenRouteProp;
}

interface Message {
  _id: string;
  id?: string;
  sender: string | { _id: string; id?: string };
  content?: string;
  text?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'story_reaction' | 'story_reply' | 'call' | 'system';
  imageUrl?: string;
  createdAt: string;
  status?: 'sent' | 'delivered' | 'seen';
  readBy?: string[];
}

export default function ChatDetailScreen({ navigation, route }: ChatDetailScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { userId, userName, userPhoto } = route.params as any;
  const { get, post } = useApi();

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [otherUserVerified, setOtherUserVerified] = useState(false);
  const [lastSeenDate, setLastSeenDate] = useState<Date | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getStatusText = useCallback(() => {
    if (isTyping) return "typing...";
    if (isOnline) return "Online";
    if (!lastSeenDate) return "Offline";
    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return lastSeenDate.toLocaleDateString();
  }, [isOnline, isTyping, lastSeenDate]);

  useEffect(() => {
    if (!userId) return;
    socketService.onUserStatus((data: { userId: string; status: string }) => {
      if (data.userId === userId) {
        setIsOnline(data.status === 'online');
        if (data.status === 'offline') setLastSeenDate(new Date());
      }
    });
    return () => { socketService.off('user:status'); };
  }, [userId]);

  const handleVoiceCall = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('VoiceCall' as any, { userId, userName, userPhoto });
  }, [navigation, userId, userName, userPhoto]);

  const handleVideoCall = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('VideoCall' as any, { userId, userName, userPhoto });
  }, [navigation, userId, userName, userPhoto]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const loadChat = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const matchesResponse = await get<{ matches: any[] }>('/match/my-matches', token);
      if (matchesResponse.success && matchesResponse.data) {
        const match = matchesResponse.data.matches.find((m: any) => 
          m.users.some((u: any) => u._id === userId || u.id === userId)
        );
        if (match) {
          const mId = match._id || match.id;
          setMatchId(mId);
          const otherUser = match.users.find((u: any) => u._id === userId || u.id === userId);
          if (otherUser) {
            setIsOnline(otherUser.isOnline || false);
            setOtherUserVerified(otherUser.verified || false);
            if (otherUser.lastSeen) setLastSeenDate(new Date(otherUser.lastSeen));
          }
          const messagesResponse = await get<{ messages: Message[] }>(`/chat/${mId}`, token);
          if (messagesResponse.success && messagesResponse.data) {
            setMessages(messagesResponse.data.messages || []);
          }
        }
      }
    } catch (error) {
      console.error('Chat load error:', error);
    } finally {
      setLoading(false);
    }
  }, [token, userId, get]);

  useEffect(() => { loadChat(); }, [loadChat]);

  useEffect(() => {
    if (!matchId) return;
    const handleNewMessage = (data: any) => {
      if (data.matchId === matchId) {
        setMessages(prev => [...prev, data.message]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };
    const handleTyping = (data: any) => {
      if (data.matchId === matchId && data.userId === userId) {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    };
    socketService.on('message:new', handleNewMessage);
    socketService.on('typing', handleTyping);
    return () => {
      socketService.off('message:new');
      socketService.off('typing');
    };
  }, [matchId, userId]);

  const sendMessage = async () => {
    if (!message.trim() || !matchId || !token || sending) return;
    const text = message.trim();
    setMessage("");
    setSending(true);
    Keyboard.dismiss();
    
    const tempMessage: Message = {
      _id: `temp_${Date.now()}`,
      sender: user?.id || '',
      content: text,
      type: 'text',
      createdAt: new Date().toISOString(),
      status: 'sent'
    };
    setMessages(prev => [...prev, tempMessage]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await post<{ message: Message }>(`/chat/${matchId}/message`, { content: text, type: 'text' }, token);
      if (response.success && response.data?.message) {
        setMessages(prev => prev.map(m => m._id === tempMessage._id ? response.data!.message : m));
      }
    } catch (error) {
      console.error('Send error:', error);
      setMessages(prev => prev.filter(m => m._id !== tempMessage._id));
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleTypingIndicator = useCallback(() => {
    if (matchId && token) {
      socketService.emit('typing', { matchId, userId: user?.id });
    }
  }, [matchId, token, user?.id]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const shouldShowDateHeader = (currentMsg: Message, prevMsg: Message | null) => {
    if (!prevMsg) return true;
    const currentDate = new Date(currentMsg.createdAt).toDateString();
    const prevDate = new Date(prevMsg.createdAt).toDateString();
    return currentDate !== prevDate;
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const senderId = typeof item.sender === 'string' ? item.sender : item.sender?._id || (item.sender as any)?.id;
    const currentUserId = user?.id || (user as any)?._id;
    const isMe = senderId === currentUserId;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showDateHeader = shouldShowDateHeader(item, prevMessage);
    const messageText = item.content || item.text || '';

    return (
      <View>
        {showDateHeader && (
          <View style={styles.dateHeaderContainer}>
            <View style={[styles.dateHeader, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
              <ThemedText style={[styles.dateHeaderText, { color: theme.textSecondary }]}>
                {formatDateHeader(item.createdAt)}
              </ThemedText>
            </View>
          </View>
        )}
        
        <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>
          {!isMe && (
            <Image
              source={getPhotoSource(userPhoto) || { uri: 'https://via.placeholder.com/40' }}
              style={styles.messageAvatar}
              contentFit="cover"
            />
          )}
          
          <View style={[
            styles.messageBubble,
            isMe ? styles.myBubble : styles.theirBubble,
            { backgroundColor: isMe ? theme.primary : (isDark ? '#2A2A2A' : '#F0F0F0') }
          ]}>
            {item.type === 'image' && item.imageUrl && (
              <Image source={{ uri: item.imageUrl }} style={styles.messageImage} contentFit="cover" />
            )}
            
            {messageText ? (
              <ThemedText style={[styles.messageText, { color: isMe ? '#FFF' : theme.text }]}>
                {messageText}
              </ThemedText>
            ) : null}
            
            <View style={styles.messageFooter}>
              <ThemedText style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                {formatTime(item.createdAt)}
              </ThemedText>
              {isMe && (
                <Ionicons 
                  name={item.status === 'seen' ? 'checkmark-done' : item.status === 'delivered' ? 'checkmark-done' : 'checkmark'} 
                  size={14} 
                  color={item.status === 'seen' ? '#4FC3F7' : 'rgba(255,255,255,0.5)'} 
                  style={{ marginLeft: 4 }}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const photoSource = getPhotoSource(userPhoto);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </Pressable>
        
        <Pressable 
          style={styles.headerProfile}
          onPress={() => navigation.navigate('ProfileDetail' as any, { userId })}
        >
          <View style={styles.avatarContainer}>
            <Image
              source={photoSource || { uri: 'https://via.placeholder.com/50' }}
              style={styles.headerAvatar}
              contentFit="cover"
            />
            {isOnline && <View style={styles.onlineIndicator} />}
          </View>
          
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <ThemedText style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
                {userName}
              </ThemedText>
              {otherUserVerified && (
                <Image source={require("@/assets/icons/verified-tick.png")} style={styles.verifiedBadge} contentFit="contain" />
              )}
            </View>
            <ThemedText style={[styles.headerStatus, { color: isTyping ? theme.primary : (isOnline ? '#4CAF50' : theme.textSecondary) }]}>
              {getStatusText()}
            </ThemedText>
          </View>
        </Pressable>
        
        <View style={styles.headerActions}>
          <Pressable onPress={handleVoiceCall} style={styles.headerActionButton}>
            <Feather name="phone" size={22} color={theme.primary} />
          </Pressable>
          <Pressable onPress={handleVideoCall} style={styles.headerActionButton}>
            <Feather name="video" size={22} color={theme.primary} />
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: theme.primary + '20' }]}>
                <Feather name="message-circle" size={40} color={theme.primary} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>Start the conversation</ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Say hello to {userName}!
              </ThemedText>
            </View>
          }
        />
      )}

      {isTyping && (
        <View style={styles.typingIndicator}>
          <View style={[styles.typingBubble, { backgroundColor: isDark ? '#2A2A2A' : '#F0F0F0' }]}>
            <View style={styles.typingDots}>
              <View style={[styles.typingDot, { backgroundColor: theme.textSecondary }]} />
              <View style={[styles.typingDot, { backgroundColor: theme.textSecondary, marginHorizontal: 4 }]} />
              <View style={[styles.typingDot, { backgroundColor: theme.textSecondary }]} />
            </View>
          </View>
        </View>
      )}

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', paddingBottom: insets.bottom + 8 }]}>
          <Pressable style={styles.attachButton}>
            <Feather name="plus-circle" size={26} color={theme.primary} />
          </Pressable>
          
          <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5' }]}>
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Type a message..."
              placeholderTextColor={theme.textSecondary}
              value={message}
              onChangeText={(text) => {
                setMessage(text);
                handleTypingIndicator();
              }}
              multiline
              maxLength={1000}
            />
            <Pressable style={styles.emojiButton}>
              <Feather name="smile" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
          
          {message.trim() ? (
            <Pressable 
              onPress={sendMessage} 
              style={[styles.sendButton, { backgroundColor: theme.primary }]}
              disabled={sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name="send" size={20} color="#FFF" />
              )}
            </Pressable>
          ) : (
            <Pressable style={styles.micButton}>
              <Feather name="mic" size={24} color={theme.primary} />
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  avatarContainer: {
    position: 'relative',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
  },
  verifiedBadge: {
    width: 18,
    height: 18,
    marginLeft: 6,
  },
  headerStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    padding: 10,
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexGrow: 1,
  },
  dateHeaderContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dateHeaderText: {
    fontSize: 12,
    fontWeight: '500',
  },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  myBubble: {
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 6,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingBubble: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  attachButton: {
    padding: 8,
    marginBottom: 4,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
    minHeight: 44,
    maxHeight: 120,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingTop: 0,
    paddingBottom: 0,
  },
  emojiButton: {
    padding: 4,
    marginLeft: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  micButton: {
    padding: 10,
    marginBottom: 4,
  },
});

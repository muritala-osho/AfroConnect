import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, Linking, Animated, Dimensions, ScrollView } from "react-native";
import Constants from 'expo-constants';
import { useThemedAlert } from "@/components/ThemedAlert";
import { Image } from "expo-image";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius, Typography, Shadow } from "@/constants/theme";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useApi } from "@/hooks/useApi";
import socketService from "@/services/socket";
import { LinearGradient } from 'expo-linear-gradient';
import { getApiBaseUrl } from "@/constants/config";
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  videoUrl?: string;
  audioUrl?: string;
  audioDuration?: number;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  callType?: 'video' | 'audio';
  callStatus?: 'missed' | 'declined' | 'completed';
  callDuration?: number;
  createdAt: string;
  status?: 'sent' | 'delivered' | 'seen';
  readBy?: string[];
  storyReaction?: {
    storyId: string;
    emoji: string;
    storyType?: string;
    storyPreview?: string;
  };
  replyTo?: {
    messageId: string;
    content: string;
    type: string;
    senderName: string;
  };
}

export default function ChatDetailScreen({ navigation, route }: ChatDetailScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { userId, userName, userPhoto } = route.params as any;
  const { showAlert } = useThemedAlert();

  const { get, post } = useApi();
  const { token } = useAuth();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const [matchId, setMatchId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [lastSeenDate, setLastSeenDate] = useState<Date | null>(null);

  const getStatusText = useCallback(() => {
    if (isOnline) return "Online";
    if (!lastSeenDate) return "Offline";

    const now = new Date();
    const diffMs = now.getTime() - lastSeenDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Offline";
    if (diffMins < 60) return `Online ${diffMins}m ago`;
    if (diffHours < 24) return `Online ${diffHours}h ago`;
    return `Online ${diffDays}d ago`;
  }, [isOnline, lastSeenDate]);

  useEffect(() => {
    if (!userId) return;

    // Listen for status updates
    socketService.onUserStatus((data: { userId: string; status: string }) => {
      if (data.userId === userId) {
        setIsOnline(data.status === 'online');
        if (data.status === 'offline') {
          setLastSeenDate(new Date());
        }
      }
    });

    return () => {
      socketService.off('user:status');
    };
  }, [userId]);
  const [otherUserVerified, setOtherUserVerified] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const saveMediaToGallery = async (uri: string, type: 'image' | 'video') => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your media library to save media.');
        return;
      }
      const asset = await MediaLibrary.createAssetAsync(uri);
      await MediaLibrary.createAlbumAsync('AfroConnect', asset, false);
      Alert.alert('Success', `${type === 'video' ? 'Video' : 'Image'} saved to gallery`);
    } catch (error) {
      console.error('Error saving media:', error);
      Alert.alert('Error', 'Failed to save media to gallery');
    }
  };

  const saveImageToGallery = async (imageUri: string) => {
    return saveMediaToGallery(imageUri, 'image');
  };

  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [aiSuggestionsLoading, setAiSuggestionsLoading] = useState(false);

  const [likedMessages, setLikedMessages] = useState<{[key: string]: boolean}>({});

  const handleToggleLike = async (messageId: string) => {
    if (!token) return;
    try {
      const response = await post<{ success: boolean; liked: boolean }>(`/chat/message-likes/${messageId}`, {}, token);
      if (response.success && response.data) {
        setLikedMessages(prev => ({
          ...prev,
          [messageId]: response.data!.liked
        }));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleAiSuggest = async () => {
    if (!token) return;
    setAiSuggestionsLoading(true);
    try {
      const response = await post<{ suggestions: string[] }>('/ai/suggest-message', { targetUserId: userId }, token);
      if (response.success && response.data) {
        setAiSuggestions(response.data.suggestions);
        setShowAiSuggestions(true);
      }
    } catch (error) {
      console.error('AI suggestions error:', error);
    } finally {
      setAiSuggestionsLoading(false);
    }
  };

  const [translatedMessages, setTranslatedMessages] = useState<{[key: string]: string}>({});
  const [isTranslating, setIsTranslating] = useState<string | null>(null);
  const [preferredLanguage, setPreferredLanguage] = useState<string>("English");
  const [showLanguageModal, setShowLanguageModal] = useState(false);

  const LANGUAGES = [
    "English", "Swahili", "Amharic", "Yoruba", "Oromo", "Igbo", "Hausa", 
    "Zulu", "Shona", "Arabic", "Portuguese", "French", "Wolof", "Twi", 
    "Lingala", "Luganda", "Somali", "Afrikaans", "Xhosa", "Sotho", "Tswana",
    "Venda", "Tsonga", "Ndebele", "Kinyarwanda", "Kirundi", "Chewa", "Luo",
    "Bambara", "Fulani", "Kanuri", "Ewe", "Ga", "Dagbani", "Mende", "Temne"
  ];

  const handleTranslate = async (messageId: string, text: string) => {
    if (!token) return;
    setIsTranslating(messageId);
    try {
      const response = await post<{ translatedText: string }>(
        '/ai/translate',
        { text, targetLanguage: preferredLanguage },
        token
      );
      if (response.success && response.data) {
        setTranslatedMessages(prev => ({
          ...prev,
          [messageId]: response.data!.translatedText
        }));
      }
    } catch (error) {
      console.error('Translation error:', error);
      Alert.alert('Error', 'Failed to translate message');
    } finally {
      setIsTranslating(null);
    }
  };

  const [audioProgress, setAudioProgress] = useState<{[key: string]: number}>({});
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState<string>('');
  const [reportMessage, setReportMessage] = useState<string>('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingDots = useRef(new Animated.Value(0)).current;
  const isSharingRef = useRef(false);

  const handleVoiceCall = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('VoiceCall' as any, { userId, userName, userPhoto });
  }, [navigation, userId, userName, userPhoto]);

  const handleVideoCall = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('VideoCall' as any, { userId, userName, userPhoto });
  }, [navigation, userId, userName, userPhoto]);

  const handleBlockUser = useCallback(() => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${userName}? They won't be able to contact you anymore.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await post(`/block/${userId}`, {}, token || '');
              if (response.success) {
                Alert.alert('Blocked', `${userName} has been blocked`);
                navigation.goBack();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to block user');
            }
          }
        }
      ]
    );
  }, [userName, userId, post, token, navigation]);

  const handleReportUserCallback = useCallback(() => {
    Alert.alert(
      'Report User',
      'Why are you reporting this user?',
      [
        { text: 'Inappropriate Content', onPress: () => { setReportReason('inappropriate'); setShowReportModal(true); } },
        { text: 'Harassment', onPress: () => { setReportReason('harassment'); setShowReportModal(true); } },
        { text: 'Spam', onPress: () => { setReportReason('spam'); setShowReportModal(true); } },
        { text: 'Fake Profile', onPress: () => { setReportReason('fake'); setShowReportModal(true); } },
        { text: 'Other', onPress: () => { setReportReason('other'); setShowReportModal(true); } },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleContainer}>
          <Pressable 
            onPress={() => navigation.navigate('ProfileDetail' as any, { userId, name: userName, photo: userPhoto })}
            style={styles.headerInfo}
          >
            <Image 
              source={userPhoto || 'https://via.placeholder.com/150'} 
              style={styles.headerAvatar} 
            />
            <View>
              <View style={styles.nameContainer}>
                <ThemedText style={styles.headerName}>{userName}</ThemedText>
                {otherUserVerified && (
                  <Ionicons name="checkmark-circle" size={16} color={theme.primary} style={{ marginLeft: 4 }} />
                )}
              </View>
              <ThemedText style={[styles.headerStatus, { color: isOnline ? '#4CAF50' : theme.textSecondary }]}>
                {getStatusText()}
              </ThemedText>
            </View>
          </Pressable>
        </View>
      ),
      headerRight: () => (
        <View style={styles.headerRight}>
          <Pressable onPress={handleVoiceCall} style={styles.headerIcon}>
            <Feather name="phone" size={20} color={theme.text} />
          </Pressable>
          <Pressable onPress={handleVideoCall} style={styles.headerIcon}>
            <Feather name="video" size={20} color={theme.text} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, userName, userPhoto, isOnline, getStatusText, otherUserVerified, theme, handleVoiceCall, handleVideoCall, userId]);

  const loadChat = useCallback(async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const cacheKey = `chat_messages_${userId}`;
      const draftKey = `chat_draft_${userId}`;
      
      const [cachedMessages, draft] = await Promise.all([
        AsyncStorage.getItem(cacheKey),
        AsyncStorage.getItem(draftKey)
      ]);
      
      if (cachedMessages) {
        try {
          setMessages(JSON.parse(cachedMessages));
        } catch (e) {
          console.error('Failed to parse cached messages');
        }
      }
      
      if (draft) {
        setMessage(draft);
      }
      
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
            if (otherUser.lastSeen) {
              const date = new Date(otherUser.lastSeen);
              setLastSeenDate(date);
              setLastSeen(date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
            }
          }
          
          const messagesResponse = await get<{ messages: Message[] }>(`/chat/${mId}`, token);
          if (messagesResponse.success && messagesResponse.data) {
            setMessages(messagesResponse.data.messages);
            AsyncStorage.setItem(cacheKey, JSON.stringify(messagesResponse.data.messages));
          }
        }
      }
    } catch (error) {
      console.error('Chat load error:', error);
    } finally {
      setLoading(false);
    }
  }, [token, userId, get]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  return (
    <ThemedView style={styles.container}>
      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => {
            const senderId = typeof item.sender === 'string' ? item.sender : item.sender?._id || (item.sender as any)?.id;
            const currentUserId = user?.id || (user as any)?._id;
            const isMe = senderId === currentUserId;
            
            return (
              <Pressable 
                onLongPress={() => item.type === 'text' && handleTranslate(item._id, item.content || item.text || '')}
                style={[
                  styles.messageWrapper,
                  isMe ? styles.myMessage : styles.theirMessage
                ]}
              >
                <ThemedText style={{ color: isMe ? '#FFF' : theme.text }}>
                  {translatedMessages[item._id] || item.content || item.text}
                </ThemedText>
                {translatedMessages[item._id] && (
                  <ThemedText style={styles.translationLabel}>Translated to {preferredLanguage}</ThemedText>
                )}
                {isTranslating === item._id && (
                  <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 5 }} />
                )}
              </Pressable>
            );
          }}
        />
      )}
      <Modal visible={showLanguageModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ThemedView style={styles.languageModal}>
            <ThemedText style={styles.modalTitle}>Select Language</ThemedText>
            {LANGUAGES.map(lang => (
              <Pressable 
                key={lang} 
                style={styles.languageOption}
                onPress={() => {
                  setPreferredLanguage(lang);
                  setShowLanguageModal(false);
                }}
              >
                <ThemedText style={{ color: preferredLanguage === lang ? theme.primary : theme.text }}>{lang}</ThemedText>
              </Pressable>
            ))}
            <Pressable style={styles.closeButton} onPress={() => setShowLanguageModal(false)}>
              <ThemedText style={{ color: theme.primary }}>Close</ThemedText>
            </Pressable>
          </ThemedView>
        </View>
      </Modal>
      <View style={styles.inputContainer}>
        <Pressable onPress={() => setShowLanguageModal(true)} style={styles.langPicker}>
          <MaterialCommunityIcons name="translate" size={24} color={theme.primary} />
        </Pressable>
        <TextInput 
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
          placeholder="Type a message..."
          placeholderTextColor={theme.textSecondary}
          value={message}
          onChangeText={setMessage}
        />
        <Pressable onPress={() => {/* send logic */}} style={styles.sendButton}>
          <Ionicons name="send" size={24} color={theme.primary} />
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerStatus: {
    fontSize: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    padding: 8,
    marginLeft: 4,
  },
  messageWrapper: {
    padding: 12,
    marginVertical: 4,
    marginHorizontal: 12,
    borderRadius: 20,
    maxWidth: '80%',
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#FF4B6E',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
    borderBottomLeftRadius: 4,
  },
  translationLabel: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 4,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 15,
    marginHorizontal: 10,
  },
  langPicker: { padding: 5 },
  sendButton: { padding: 5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  languageModal: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  languageOption: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  closeButton: {
    marginTop: 10,
    alignItems: 'center',
    padding: 10,
  },
});
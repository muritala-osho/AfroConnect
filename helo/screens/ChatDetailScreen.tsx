import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, Dimensions, Keyboard, ScrollView, ImageBackground, Animated, PanResponder, Linking } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { Audio, Video, ResizeMode } from "expo-av";
import { useApi } from "@/hooks/useApi";
import socketService from "@/services/socket";
import { getPhotoSource } from "@/utils/photos";
import { getApiBaseUrl } from "@/constants/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ScreenCapture from "expo-screen-capture";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ChatDetailScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "ChatDetail">;
type ChatDetailScreenRouteProp = RouteProp<RootStackParamList, "ChatDetail">;

interface ChatDetailScreenProps {
  navigation: ChatDetailScreenNavigationProp;
  route: ChatDetailScreenRouteProp;
}

interface Message {
  _id: string;
  sender: string | { _id: string };
  content?: string;
  text?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'system' | 'location' | 'call';
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  createdAt: string;
  status?: 'sent' | 'delivered' | 'seen';
  replyTo?: { messageId: string; content: string; type: string; senderName: string };
  deletedForEveryone?: boolean;
  deletedFor?: string[];
}

const EMOJI_LIST = ['😀', '😂', '😍', '🥰', '😘', '🤗', '😊', '🙂', '😉', '😎', '🤩', '🥳', '😋', '🤤', '😜', '🤪', '😝', '🤑', '🤔', '🤭', '🤫', '🤐', '😏', '😌', '😔', '😪', '🤒', '😷', '🤕', '🤢', '🤮', '🥵', '🥶', '😱', '😨', '😰', '😥', '😢', '😭', '😤', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '👍', '👎', '👏', '🙌', '🤝', '🤲', '🙏', '✌️', '🤟', '🤘', '🤙', '👋', '🖐️', '✋', '👌', '🤌', '🔥', '✨', '⭐', '🌟', '💫', '💥', '💢', '💦', '💨', '🎉', '🎊', '🎁', '🎈', '🎀', '🏆', '🥇', '🥈', '🥉'];

const REPORT_REASONS = [
  { id: 'inappropriate', label: 'Inappropriate Content', icon: 'alert-circle' },
  { id: 'harassment', label: 'Harassment or Bullying', icon: 'user-x' },
  { id: 'spam', label: 'Spam or Scam', icon: 'mail' },
  { id: 'fake', label: 'Fake Profile', icon: 'user-check' },
  { id: 'underage', label: 'Underage User', icon: 'shield-off' },
  { id: 'other', label: 'Other', icon: 'more-horizontal' },
];

const CHAT_THEMES = [
  { id: 'default', name: 'Default', image: null },
  { id: 'luxury', name: 'Luxury', image: require('@/assets/chat-themes/afroconnect_luxury.png') },
  { id: 'blue_doodle', name: 'Blue Doodle', image: require('@/assets/chat-themes/theme-blue-doodle.png') },
  { id: 'cats', name: 'Cats', image: require('@/assets/chat-themes/theme_cats.png') },
  { id: 'dark_doodle', name: 'Dark Doodle', image: require('@/assets/chat-themes/theme-dark-doodle.png') },
  { id: 'dots', name: 'Dots', image: require('@/assets/chat-themes/theme-dots.png') },
  { id: 'geometry', name: 'Geometry', image: require('@/assets/chat-themes/theme-geometry.jpg') },
  { id: 'hearts_outline', name: 'Hearts Outline', image: require('@/assets/chat-themes/theme_hearts_outline.png') },
  { id: 'hearts_purple', name: 'Hearts Purple', image: require('@/assets/chat-themes/theme_hearts_purple.png') },
  { id: 'light_doodle', name: 'Light Doodle', image: require('@/assets/chat-themes/theme-light-doodle.png') },
  { id: 'love_dark', name: 'Love Dark', image: require('@/assets/chat-themes/theme_love_dark.png') },
  { id: 'love_pink', name: 'Love Pink', image: require('@/assets/chat-themes/theme_love_pink.png') },
  { id: 'magic', name: 'Magic', image: require('@/assets/chat-themes/theme-magic.jpg') },
  { id: 'rainbow', name: 'Rainbow', image: require('@/assets/chat-themes/theme-rainbow.png') },
  { id: 'sky_doodle', name: 'Sky Doodle', image: require('@/assets/chat-themes/theme-sky-doodle.png') },
  { id: 'valentine_black', name: 'Valentine Black', image: require('@/assets/chat-themes/theme_valentine_black.png') },
];

const AI_SUGGESTIONS = [
  "Hey! How's your day going? 😊",
  "I love your profile! What are your hobbies?",
  "What's your favorite thing to do on weekends?",
  "I noticed we have similar interests! Tell me more about yourself",
  "You seem really interesting! What do you do for fun?",
  "Hi there! What made you swipe right on me? 😄",
  "I'd love to get to know you better!",
  "What's the best trip you've ever taken?",
];

const SwipeableMessage = React.memo(({ item, isMe, children, onReply, themeTextSecondary }: { item: Message; isMe: boolean; children: React.ReactNode; onReply: (item: Message) => void; themeTextSecondary: string }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const itemRef = useRef(item);
  const onReplyRef = useRef(onReply);
  itemRef.current = item;
  onReplyRef.current = onReply;
  
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10 && gestureState.dx < 0;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -80));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -50) {
          onReplyRef.current(itemRef.current);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  return (
    <View style={{ overflow: 'hidden' }}>
      <View style={[{ position: 'absolute', right: isMe ? undefined : 8, left: isMe ? 8 : undefined, top: 0, bottom: 0, justifyContent: 'center' }]}>
        <Feather name="corner-up-left" size={20} color={themeTextSecondary} />
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
});

export default function ChatDetailScreen({ navigation, route }: ChatDetailScreenProps) {
  const { theme, isDark, setThemeMode, chatBubbleStyle, hapticFeedback: hapticEnabled } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { userId, userName, userPhoto } = route.params as any;
  const { get, post, put, del } = useApi();

  const myId = useMemo(() => (user as any)?._id || user?.id || '', [user]);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [otherUserVerified, setOtherUserVerified] = useState(false);
  const [lastSeenDate, setLastSeenDate] = useState<Date | null>(null);
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  
  const [chatTheme, setChatTheme] = useState<string>('default');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>(AI_SUGGESTIONS);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingVideo, setViewingVideo] = useState<string | null>(null);
  const [failedThumbnails, setFailedThumbnails] = useState<Set<string>>(new Set());
  
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [translatedText, setTranslatedText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [translateTargetLang, setTranslateTargetLang] = useState('');
  const [screenshotProtection, setScreenshotProtection] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingDurationRef = useRef<number>(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  const [typingDotAnim1] = useState(new Animated.Value(0));
  const [typingDotAnim2] = useState(new Animated.Value(0));
  const [typingDotAnim3] = useState(new Animated.Value(0));
  const [recordingPulse] = useState(new Animated.Value(1));

  useEffect(() => {
    if (isTyping) {
      const createDotAnimation = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
          ])
        );
      const a1 = createDotAnimation(typingDotAnim1, 0);
      const a2 = createDotAnimation(typingDotAnim2, 150);
      const a3 = createDotAnimation(typingDotAnim3, 300);
      a1.start(); a2.start(); a3.start();
      return () => { a1.stop(); a2.stop(); a3.stop(); typingDotAnim1.setValue(0); typingDotAnim2.setValue(0); typingDotAnim3.setValue(0); };
    }
  }, [isTyping]);

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingPulse, { toValue: 1.4, duration: 600, useNativeDriver: true }),
          Animated.timing(recordingPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => { pulse.stop(); recordingPulse.setValue(1); };
    }
  }, [isRecording]);

  useEffect(() => {
    const loadChatTheme = async () => {
      const savedTheme = await AsyncStorage.getItem(`chat_theme_${userId}`);
      if (savedTheme) setChatTheme(savedTheme);
    };
    loadChatTheme();
  }, [userId]);

  useEffect(() => {
    return () => {
      if (Platform.OS !== 'web') {
        try { ScreenCapture.allowScreenCaptureAsync(); } catch (e) {}
      }
    };
  }, [userId]);

  useEffect(() => {
    if (!matchId) return;
    const handleProtectionUpdate = (data: any) => {
      if (data.chatId === matchId) {
        setScreenshotProtection(data.enabled);
        if (Platform.OS !== 'web') {
          try {
            if (data.enabled) {
              ScreenCapture.preventScreenCaptureAsync();
            } else {
              ScreenCapture.allowScreenCaptureAsync();
            }
          } catch (e) {}
        }
        if (String(data.updatedBy) !== String(myId)) {
          Alert.alert(
            data.enabled ? 'Screenshot Protection Enabled' : 'Screenshot Protection Disabled',
            data.enabled ? `${userName} enabled screenshot protection for this chat.` : `${userName} disabled screenshot protection for this chat.`
          );
        }
      }
    };
    socketService.on('chat:screenshot-protection-updated', handleProtectionUpdate);
    return () => { socketService.off('chat:screenshot-protection-updated'); };
  }, [matchId, myId, userName]);

  const toggleScreenshotProtection = useCallback(async () => {
    const newValue = !screenshotProtection;
    setScreenshotProtection(newValue);
    if (Platform.OS !== 'web') {
      try {
        if (newValue) {
          await ScreenCapture.preventScreenCaptureAsync();
        } else {
          await ScreenCapture.allowScreenCaptureAsync();
        }
      } catch (e) {}
    }
    if (matchId) {
      socketService.emit('chat:screenshot-protection', {
        chatId: matchId,
        enabled: newValue,
        userId: myId
      });
    }
    Alert.alert(
      newValue ? 'Screenshot Protection On' : 'Screenshot Protection Off',
      newValue ? 'Screenshots and screen recording are now blocked for both users in this chat.' : 'Screenshot protection has been disabled for this chat.'
    );
  }, [screenshotProtection, matchId, myId]);

  const saveChatTheme = async (themeId: string) => {
    setChatTheme(themeId);
    await AsyncStorage.setItem(`chat_theme_${userId}`, themeId);
    setShowThemeModal(false);
  };

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
    socketService.onUserStatus((data: any) => {
      if (data.userId === userId) {
        const online = data.isOnline === true || data.status === 'online';
        setIsOnline(online);
        if (!online) setLastSeenDate(new Date());
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
    navigation.setOptions({ headerShown: false });
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
          if (match.screenshotProtection) {
            setScreenshotProtection(true);
            if (Platform.OS !== 'web') {
              try { await ScreenCapture.preventScreenCaptureAsync(); } catch (e) {}
            }
          }
          const otherUser = match.users.find((u: any) => u._id === userId || u.id === userId);
          if (otherUser) {
            setIsOnline(otherUser.onlineStatus === 'online' || false);
            setOtherUserVerified(otherUser.verified || false);
            if (otherUser.lastActive) setLastSeenDate(new Date(otherUser.lastActive));
          }
          const messagesResponse = await get<{ messages: Message[] }>(`/chat/${mId}`, token);
          if (messagesResponse.success && messagesResponse.data) {
            setMessages(messagesResponse.data.messages || []);
          }
          put(`/chat/${mId}/read`, {}, token).catch(() => {});
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
    socketService.joinChat(matchId);
    const handleNewMessage = (data: any) => {
      const msg = data.message || data;
      const msgMatchId = data.matchId || msg.matchId;
      if (msgMatchId === matchId || msg.matchId === matchId) {
        const senderId = typeof msg.sender === 'string' ? msg.sender : msg.sender?._id;
        if (String(senderId) !== String(myId)) {
          setMessages(prev => {
            if (prev.some(m => m._id === msg._id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
        }
      }
    };
    const handleTyping = (data: any) => {
      const typingUserId = data.userId || data.senderId;
      if (typingUserId && String(typingUserId) !== String(myId)) {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    };
    socketService.on('chat:new-message', handleNewMessage);
    socketService.on('message:new', handleNewMessage);
    socketService.on('chat:user-typing', handleTyping);
    return () => {
      socketService.off('chat:new-message');
      socketService.off('message:new');
      socketService.off('chat:user-typing');
    };
  }, [matchId, userId, myId]);

  const sendMessage = async (content?: string, type: string = 'text', extraData?: any) => {
    const textToSend = content || message.trim();
    if (!textToSend && type === 'text') return;
    if (!matchId || !token || sending) return;
    
    setMessage("");
    setSending(true);
    Keyboard.dismiss();
    setShowEmojiPicker(false);
    setShowAISuggestions(false);

    let replyData: any = undefined;
    if (replyingTo) {
      const replySenderId = typeof replyingTo.sender === 'string' ? replyingTo.sender : replyingTo.sender?._id;
      replyData = {
        messageId: replyingTo._id,
        content: replyingTo.content || replyingTo.text || '',
        type: replyingTo.type,
        senderName: String(replySenderId) === String(myId) ? 'You' : userName
      };
    }
    
    const tempMessage: Message = {
      _id: `temp_${Date.now()}`,
      sender: myId,
      content: textToSend,
      type: type as any,
      createdAt: new Date().toISOString(),
      status: 'sent',
      ...(replyData ? { replyTo: replyData } : {}),
      ...extraData
    };
    setMessages(prev => [...prev, tempMessage]);
    setReplyingTo(null);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await post<{ message: Message }>(`/chat/${matchId}/message`, { 
        content: textToSend, 
        type,
        ...(replyData ? { replyTo: replyData } : {}),
        ...extraData
      }, token);
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
      socketService.emit('chat:typing', { chatId: matchId, userId: myId, isTyping: true });
    }
  }, [matchId, token, myId]);

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
  };

  const handlePickImage = async () => {
    setShowAttachmentMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as ImagePicker.MediaType[],
      quality: 0.8,
      allowsEditing: true,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        const formData = new FormData();
        formData.append('image', {
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: 'chat_image.jpg',
        } as any);
        
        const apiBase = getApiBaseUrl();
        const uploadResponse = await fetch(`${apiBase}/api/upload/chat-image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        
        const uploadData = await uploadResponse.json();
        if (uploadData.success && uploadData.url) {
          await sendMessage('📷 Photo', 'image', { imageUrl: uploadData.url });
        } else {
          Alert.alert('Upload Failed', uploadData.message || 'Could not upload image. Please try again.');
        }
      } catch (error) {
        console.error('Image upload error:', error);
        Alert.alert('Error', 'Failed to upload image. Check your connection.');
      }
    }
  };

  const handlePickVideo = async () => {
    setShowAttachmentMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'] as ImagePicker.MediaType[],
      quality: 0.8,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        const formData = new FormData();
        formData.append('video', {
          uri: result.assets[0].uri,
          type: 'video/mp4',
          name: 'chat_video.mp4',
        } as any);

        const apiBase = getApiBaseUrl();
        const uploadResponse = await fetch(`${apiBase}/api/upload/chat-video`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const uploadData = await uploadResponse.json();
        if (uploadData.success && uploadData.url) {
          await sendMessage('🎬 Video', 'video', { videoUrl: uploadData.url });
        } else {
          Alert.alert('Upload Failed', uploadData.message || 'Could not upload video. Please try again.');
        }
      } catch (error) {
        console.error('Video upload error:', error);
        Alert.alert('Error', 'Failed to upload video. Check your connection.');
      }
    }
  };

  const handleTakePhoto = async () => {
    setShowAttachmentMenu(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Needed', 'Camera permission is required to take photos');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        const formData = new FormData();
        formData.append('image', {
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: 'chat_photo.jpg',
        } as any);
        
        const uploadResponse = await fetch(`${getApiBaseUrl()}/api/upload/chat-image`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        
        const uploadData = await uploadResponse.json();
        if (uploadData.success && uploadData.url) {
          await sendMessage('📷 Photo', 'image', { imageUrl: uploadData.url });
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to upload photo');
      }
    }
  };

  const handleShareLocation = async () => {
    setShowAttachmentMenu(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to share your location');
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      
      let address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      try {
        const [geocode] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode) {
          address = [geocode.street, geocode.city, geocode.country].filter(Boolean).join(', ');
        }
      } catch (e) {}
      
      await sendMessage(`📍 ${address}`, 'location', { latitude, longitude, address });
    } catch (error) {
      Alert.alert('Error', 'Could not get your location');
    }
  };

  const startRecording = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Voice recording is only available in the mobile app');
      return;
    }

    if (isRecording || recordingRef.current) return;
    
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Microphone permission is required');
        return;
      }

      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch (_) {}
        soundRef.current = null;
        setPlayingAudioId(null);
        setAudioProgress(0);
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      
      recordingIntervalRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Recording error:', error);
      recordingRef.current = null;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
      Alert.alert('Error', 'Could not start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) {
      setIsRecording(false);
      return;
    }
    
    try {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      
      const recording = recordingRef.current;
      const duration = recordingDurationRef.current;
      recordingRef.current = null;
      setIsRecording(false);
      
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
      const uri = recording.getURI();
      
      if (uri && duration >= 1) {
        try {
          const ext = uri.split('.').pop()?.toLowerCase() || 'm4a';
          const mimeMap: Record<string, string> = {
            'm4a': 'audio/m4a',
            'mp4': 'audio/mp4',
            'caf': 'audio/x-caf',
            'wav': 'audio/wav',
            '3gp': 'audio/3gpp',
            'aac': 'audio/aac',
            'webm': 'audio/webm',
          };
          const mimeType = mimeMap[ext] || (Platform.OS === 'android' ? 'application/octet-stream' : 'audio/m4a');
          const fileName = `voice_message.${ext}`;
          const formData = new FormData();
          formData.append('audio', {
            uri,
            type: mimeType,
            name: fileName,
          } as any);
          formData.append('duration', duration.toString());
          
          const uploadResponse = await fetch(`${getApiBaseUrl()}/api/upload/audio`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          
          const uploadData = await uploadResponse.json();
          if (uploadData.success && uploadData.url) {
            await sendMessage(`🎤 Voice message (${duration}s)`, 'audio', { 
              audioUrl: uploadData.url,
              audioDuration: duration 
            });
          } else {
            Alert.alert('Upload Failed', uploadData.message || 'Could not upload voice message');
          }
        } catch (error) {
          console.error('Voice upload error:', error);
          Alert.alert('Error', 'Failed to upload voice message');
        }
      } else if (uri && duration < 1) {
        Alert.alert('Too Short', 'Voice message must be at least 1 second long');
      }
      
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Stop recording error:', error);
      setIsRecording(false);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      }).catch(() => {});
    }
  };

  const cancelRecording = async () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    if (!recordingRef.current) {
      setIsRecording(false);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      return;
    }
    
    try {
      if (Platform.OS !== 'web') {
        const recording = recordingRef.current;
        recordingRef.current = null;
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        }).catch(() => {});
      } else {
        recordingRef.current = null;
      }
    } catch (error) {
      console.log('Cancel recording cleanup:', error);
    }
    
    setIsRecording(false);
    setRecordingDuration(0);
    recordingDurationRef.current = 0;
  };

  const playAudio = async (audioUrl: string, messageId: string) => {
    try {
      if (!audioUrl || audioUrl.trim() === '') {
        Alert.alert('Error', 'No audio URL available for this voice message');
        return;
      }

      if (soundRef.current) {
        try {
          const status: any = await soundRef.current.getStatusAsync();
          if (status.isLoaded) {
            if (playingAudioId === messageId && status.isPlaying) {
              await soundRef.current.pauseAsync();
              setPlayingAudioId('paused:' + messageId);
              return;
            }
            if (playingAudioId === 'paused:' + messageId && !status.isPlaying) {
              await soundRef.current.playAsync();
              setPlayingAudioId(messageId);
              return;
            }
          }
        } catch (e) {
          console.log('Status check error:', e);
        }
      }

      if (soundRef.current) {
        try {
          await soundRef.current.stopAsync();
          await soundRef.current.unloadAsync();
        } catch (cleanupErr) {
          console.log('Audio cleanup error:', cleanupErr);
        }
        soundRef.current = null;
      }

      setPlayingAudioId(null);
      setAudioProgress(0);

      if (Platform.OS === 'web') {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
          });

          const { sound } = await Audio.Sound.createAsync(
            { uri: audioUrl },
            { shouldPlay: true, progressUpdateIntervalMillis: 100 },
            (status: any) => {
              if (status.isLoaded) {
                if (status.durationMillis > 0) {
                  setAudioProgress(status.positionMillis / status.durationMillis);
                }
                if (status.didJustFinish) {
                  setPlayingAudioId(null);
                  setAudioProgress(0);
                  if (soundRef.current) {
                    soundRef.current.unloadAsync().catch(() => {});
                    soundRef.current = null;
                  }
                }
              }
            }
          );
          soundRef.current = sound;
          setPlayingAudioId(messageId);
        } catch (expoError) {
          console.log('expo-av failed on web, trying HTML5 Audio fallback:', expoError);
          try {
            const htmlAudio = new window.Audio(audioUrl);
            htmlAudio.onended = () => {
              setPlayingAudioId(null);
              setAudioProgress(0);
            };
            htmlAudio.ontimeupdate = () => {
              if (htmlAudio.duration > 0) {
                setAudioProgress(htmlAudio.currentTime / htmlAudio.duration);
              }
            };
            htmlAudio.onerror = () => {
              setPlayingAudioId(null);
              setAudioProgress(0);
              Alert.alert('Playback Error', 'Could not play this voice message. The audio format may not be supported.');
            };
            await htmlAudio.play();
            setPlayingAudioId(messageId);
          } catch (htmlError: any) {
            console.error('HTML5 Audio fallback also failed:', htmlError);
            Alert.alert('Playback Error', `Could not play voice message: ${htmlError.message || 'Unknown error'}`);
          }
        }
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });

      console.log('Playing audio URL:', audioUrl);
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 100 },
        (status: any) => {
          if (status.isLoaded) {
            if (status.durationMillis > 0) {
              setAudioProgress(status.positionMillis / status.durationMillis);
            }
            if (status.didJustFinish) {
              setPlayingAudioId(null);
              setAudioProgress(0);
              if (soundRef.current) {
                soundRef.current.unloadAsync().catch(() => {});
                soundRef.current = null;
              }
            }
          }
        }
      );
      soundRef.current = sound;
      setPlayingAudioId(messageId);
    } catch (error: any) {
      console.error('Audio playback error for URL:', audioUrl, error);
      Alert.alert('Playback Error', `Could not play voice message: ${error.message || 'Unknown error'}`);
    }
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      if (recordingRef.current) {
        const rec = recordingRef.current;
        recordingRef.current = null;
        rec.stopAndUnloadAsync()
          .then(() => Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }))
          .catch(() => {});
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      recordingDurationRef.current = 0;
    };
  }, []);

  const saveImage = async (imageUrl: string) => {
    try {
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `afroconnect_${Date.now()}.jpg`;
        link.target = '_blank';
        link.click();
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}afroconnect_${Date.now()}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);

      if (downloadResult.status !== 200) {
        Alert.alert('Error', 'Failed to download image.');
        return;
      }

      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
          Alert.alert('Saved', 'Image saved to your gallery.');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return;
        }
      } catch (_permError) {}

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'image/jpeg',
          dialogTitle: 'Save Image',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', 'Cannot save images in this environment. Try a development build.');
      }
    } catch (error) {
      console.error('Save image error:', error);
      Alert.alert('Error', 'Could not save image.');
    }
  };

  const saveVideo = async (url: string) => {
    try {
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = url;
        link.download = `afroconnect_${Date.now()}.mp4`;
        link.target = '_blank';
        link.click();
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}afroconnect_${Date.now()}.mp4`;
      const downloadResult = await FileSystem.downloadAsync(url, fileUri);

      if (downloadResult.status !== 200) {
        Alert.alert('Error', 'Failed to download video.');
        return;
      }

      try {
        const { status } = await MediaLibrary.requestPermissionsAsync();
        if (status === 'granted') {
          await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
          Alert.alert('Saved!', 'Video saved to your gallery');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return;
        }
      } catch (_permError) {}

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType: 'video/mp4',
          dialogTitle: 'Save Video',
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', 'Cannot save videos in this environment. Try a development build.');
      }
    } catch (error) {
      console.error('Save video error:', error);
      Alert.alert('Error', 'Failed to save video');
    }
  };

  const fetchAISuggestions = async () => {
    if (!token) return;
    setShowAISuggestions(true);
    
    try {
      const response = await post<{ suggestions: string[] }>('/ai/chat-suggestions', {
        recipientName: userName,
        context: messages.slice(-5).map(m => m.content).join(' ')
      }, token);
      
      if (response.success && response.data?.suggestions) {
        setAiSuggestions(response.data.suggestions);
      }
    } catch (error) {
      setAiSuggestions(AI_SUGGESTIONS);
    }
  };

  const handleBlockUser = async () => {
    setShowOptionsMenu(false);
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
  };

  const handleMessageLongPress = useCallback((msg: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(msg);
    setShowMessageMenu(true);
  }, []);

  const handleReply = useCallback(() => {
    const msg = selectedMessage;
    setShowMessageMenu(false);
    setSelectedMessage(null);
    if (msg) {
      setReplyingTo(msg);
    }
  }, [selectedMessage]);

  const handleDeleteForMe = useCallback(async () => {
    if (!selectedMessage || !token) return;
    setShowMessageMenu(false);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/chat/message/${selectedMessage._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success || response.ok) {
        setMessages(prev => prev.filter(m => m._id !== selectedMessage._id));
      } else {
        Alert.alert('Error', data.message || 'Failed to delete message');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete message');
    }
    setSelectedMessage(null);
  }, [selectedMessage, token]);

  const handleDeleteForEveryone = useCallback(async () => {
    if (!selectedMessage || !token) return;
    setShowMessageMenu(false);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/chat/message/${selectedMessage._id}?deleteForEveryone=true`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success || response.ok) {
        setMessages(prev => prev.map(m =>
          m._id === selectedMessage._id
            ? { ...m, content: 'This message was deleted', text: 'This message was deleted', type: 'system' as const, deletedForEveryone: true }
            : m
        ));
      } else {
        Alert.alert('Error', data.message || 'Failed to delete message');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete message');
    }
    setSelectedMessage(null);
  }, [selectedMessage, token]);

  const handleTranslateOpen = useCallback(() => {
    setShowMessageMenu(false);
    setTranslatedText('');
    setTranslateTargetLang('');
    setShowTranslateModal(true);
  }, []);

  const handleTranslate = useCallback(async (targetLanguage: string) => {
    if (!selectedMessage || !token) return;
    const textToTranslate = selectedMessage.content || selectedMessage.text || '';
    if (!textToTranslate) return;
    setTranslating(true);
    try {
      const response = await post<{ translatedText: string }>('/ai/translate', { text: textToTranslate, targetLanguage, sourceLanguage: 'en' }, token);
      if (response.success && response.data?.translatedText) {
        setTranslatedText(response.data.translatedText);
      } else {
        Alert.alert('Error', response.message || 'Translation failed');
      }
    } catch (error) {
      Alert.alert('Error', (error as any)?.message || 'Translation failed');
    } finally {
      setTranslating(false);
    }
  }, [selectedMessage, token, post]);

  const handleCopyTranslation = useCallback(async () => {
    if (translatedText) {
      await Clipboard.setStringAsync(translatedText);
      Alert.alert('Copied', 'Translation copied to clipboard');
    }
  }, [translatedText]);

  useEffect(() => {
    if (!matchId) return;
    const handleMessageDeleted = (data: any) => {
      if (data.messageId) {
        setMessages(prev => prev.map(m =>
          m._id === data.messageId
            ? { ...m, content: 'This message was deleted', text: 'This message was deleted', type: 'system' as const, deletedForEveryone: true }
            : m
        ));
      }
    };
    socketService.on('chat:message-deleted', handleMessageDeleted);
    return () => { socketService.off('chat:message-deleted'); };
  }, [matchId]);

  const handleSubmitReport = async () => {
    if (!selectedReportReason) {
      Alert.alert('Select Reason', 'Please select a reason for reporting');
      return;
    }
    
    setSubmittingReport(true);
    try {
      const response = await post('/reports', {
        reportedUserId: userId,
        reason: selectedReportReason,
        description: reportDetails,
        matchId
      }, token || '');
      
      if (response.success) {
        setShowReportModal(false);
        setSelectedReportReason(null);
        setReportDetails("");
        Alert.alert('Report Submitted', 'Thank you for your report. Our team will review it shortly.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setSubmittingReport(false);
    }
  };

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

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSwipeReply = useCallback((item: Message) => {
    setReplyingTo(item);
  }, []);

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const senderId = typeof item.sender === 'string' ? item.sender : item.sender?._id;
    const isMe = String(senderId) === String(myId);
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showDateHeader = shouldShowDateHeader(item, prevMessage);
    const messageText = item.deletedForEveryone ? 'This message was deleted' : (item.content || item.text || '');

    return (
      <View>
        {showDateHeader && (
          <View style={styles.dateHeaderContainer}>
            <View style={[styles.dateHeader, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
              <ThemedText style={[styles.dateHeaderText, { color: '#FFF' }]}>
                {formatDateHeader(item.createdAt)}
              </ThemedText>
            </View>
          </View>
        )}
        
        {(item.type === 'system' || item.type === 'call' || item.deletedForEveryone) ? (
          <View style={styles.systemMessageContainer}>
            <View style={[styles.systemMessage, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
              <Ionicons name={item.type === 'call' ? 'call' : item.deletedForEveryone ? 'trash-outline' : 'information-circle'} size={14} color="#FFF" style={{ marginRight: 6 }} />
              <ThemedText style={styles.systemMessageText}>{messageText}</ThemedText>
            </View>
          </View>
        ) : (
          <SwipeableMessage item={item} isMe={isMe} onReply={handleSwipeReply} themeTextSecondary={theme.textSecondary}>
            <Pressable onLongPress={() => handleMessageLongPress(item)} delayLongPress={400}>
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
                  { backgroundColor: isMe ? theme.primary : (isDark ? 'rgba(42,42,42,0.95)' : 'rgba(255,255,255,0.95)') },
                  chatBubbleStyle === 'sharp' && { borderRadius: 6 },
                  chatBubbleStyle === 'sharp' && (isMe ? { borderBottomRightRadius: 2 } : { borderBottomLeftRadius: 2 }),
                  chatBubbleStyle === 'minimal' && { borderRadius: 14, borderBottomRightRadius: isMe ? 14 : undefined, borderBottomLeftRadius: !isMe ? 14 : undefined },
                  item.type === 'image' && !messageText ? { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 0 } : {},
                  item.type === 'video' && !messageText ? { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 0 } : {},
                  item.type === 'location' ? { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 0 } : {}
                ]}>
                  {item.replyTo && (
                    <View style={[styles.replyPreviewInBubble, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)', borderLeftColor: isMe ? '#FFF' : theme.primary }]}>
                      <ThemedText style={[styles.replyPreviewName, { color: isMe ? 'rgba(255,255,255,0.9)' : theme.primary }]} numberOfLines={1}>
                        {item.replyTo.senderName}
                      </ThemedText>
                      <ThemedText style={[styles.replyPreviewText, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]} numberOfLines={2}>
                        {item.replyTo.type === 'image' ? '📷 Photo' : item.replyTo.type === 'video' ? '🎬 Video' : item.replyTo.type === 'audio' ? '🎤 Voice message' : item.replyTo.content}
                      </ThemedText>
                    </View>
                  )}

                  {item.type === 'image' && item.imageUrl && (
                    <Pressable onPress={() => setViewingImage(item.imageUrl!)} onLongPress={() => saveImage(item.imageUrl!)}>
                      <Image source={{ uri: item.imageUrl }} style={styles.messageImage} contentFit="cover" />
                      <Pressable 
                        style={styles.imageSaveButton} 
                        onPress={() => saveImage(item.imageUrl!)}
                      >
                        <Ionicons name="download-outline" size={16} color="#FFF" />
                      </Pressable>
                    </Pressable>
                  )}

                  {item.type === 'video' && (item.videoUrl || item.imageUrl) && (
                    <Pressable onPress={() => { const url = item.videoUrl || item.imageUrl; if (url) setViewingVideo(url); }} style={styles.videoContainer}>
                      {failedThumbnails.has(item._id) ? (
                        <View style={[styles.videoThumbnail, { backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="videocam" size={48} color="rgba(255,255,255,0.7)" />
                          <ThemedText style={{ color: '#FFF', fontSize: 12, marginTop: 4 }}>Tap to play</ThemedText>
                        </View>
                      ) : (
                        <Image 
                          source={{ uri: (() => {
                            const url = item.videoUrl || item.imageUrl || '';
                            if (url.includes('cloudinary.com')) {
                              return url.replace('/upload/', '/upload/so_0,w_400,h_300,c_fill/').replace(/\.(mp4|mov|avi|webm)$/i, '.jpg');
                            }
                            return url.replace(/\.[^.]+$/, '.jpg');
                          })() }}
                          style={styles.videoThumbnail}
                          contentFit="cover"
                          onError={() => setFailedThumbnails(prev => new Set(prev).add(item._id))}
                        />
                      )}
                      <View style={styles.videoOverlay}>
                        <View style={styles.videoPlayButton}>
                          <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                        </View>
                      </View>
                      <Pressable 
                        style={styles.imageSaveButton} 
                        onPress={(e: any) => { e.stopPropagation(); saveVideo(item.videoUrl || item.imageUrl!); }}
                      >
                        <Ionicons name="download-outline" size={16} color="#FFF" />
                      </Pressable>
                    </Pressable>
                  )}

                  {item.type === 'audio' && item.audioUrl && (
                    <Pressable 
                      style={[styles.audioPlayer, { backgroundColor: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)' }]}
                      onPress={() => playAudio(item.audioUrl!, item._id)}
                    >
                      <Ionicons 
                        name={playingAudioId === item._id ? 'pause' : 'play'} 
                        size={24} 
                        color={isMe ? '#FFF' : theme.primary} 
                      />
                      <View style={styles.audioWaveform}>
                        <View style={[styles.audioProgressBar, { backgroundColor: isMe ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)' }]}>
                          <View style={[
                            styles.audioProgressFill, 
                            { 
                              width: (playingAudioId === item._id || playingAudioId === 'paused:' + item._id) ? `${audioProgress * 100}%` : '0%',
                              backgroundColor: isMe ? '#FFF' : theme.primary 
                            }
                          ]} />
                        </View>
                      </View>
                      <Ionicons name="mic" size={14} color={isMe ? 'rgba(255,255,255,0.6)' : theme.textSecondary} />
                    </Pressable>
                  )}

                  {item.type === 'location' && item.latitude != null && item.longitude != null && (() => {
                    const lat = item.latitude!;
                    const lng = item.longitude!;
                    const z = 15;
                    const n = Math.pow(2, z);
                    const fx = (lng + 180) / 360 * n;
                    const fy = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n;
                    const cx = Math.floor(fx);
                    const cy = Math.floor(fy);
                    const subTileX = (fx - cx) * 256;
                    const subTileY = (fy - cy) * 256;
                    const MAP_W = 240;
                    const MAP_H = 160;
                    const gridLeft = -(256 + subTileX - MAP_W / 2);
                    const gridTop = -(256 + subTileY - MAP_H / 2);
                    const tiles = [];
                    for (let dy = -1; dy <= 1; dy++) {
                      for (let dx = -1; dx <= 1; dx++) {
                        tiles.push({ x: cx + dx, y: cy + dy, dx, dy });
                      }
                    }
                    return (
                      <Pressable
                        onPress={() => {
                          const label = item.address || `${lat}, ${lng}`;
                          const url = Platform.select({
                            ios: `maps:0,0?q=${label}@${lat},${lng}`,
                            android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`,
                            default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
                          });
                          Linking.openURL(url!).catch(() => {
                            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
                          });
                        }}
                        style={styles.locationBubble}
                      >
                        <View style={styles.locationMapContainer}>
                          <View style={[styles.locationTileGrid, { top: gridTop, left: gridLeft }]}>
                            {tiles.map((t, i) => (
                              <Image
                                key={i}
                                source={{ uri: `https://tile.openstreetmap.org/${z}/${t.x}/${t.y}.png` }}
                                style={styles.locationTile}
                                contentFit="cover"
                              />
                            ))}
                          </View>
                          <View style={styles.locationGradientOverlay}>
                            <View style={styles.locationGradientLayer1} />
                            <View style={styles.locationGradientLayer2} />
                            <View style={styles.locationGradientLayer3} />
                          </View>
                          <View style={styles.locationPinOverlay}>
                            <View style={styles.locationPinShadow} />
                            <Ionicons name="location-sharp" size={32} color="#E53935" style={{ marginTop: -16, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }} />
                          </View>
                        </View>
                        <View style={[styles.locationInfoRow, { backgroundColor: isMe ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.03)' }]}>
                          <View style={[styles.locationIconCircle, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : theme.primary + '18' }]}>
                            <Ionicons name="navigate" size={14} color={isMe ? '#FFF' : theme.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <ThemedText style={[styles.locationAddress, { color: isMe ? '#FFF' : theme.text }]} numberOfLines={2}>
                              {item.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
                            </ThemedText>
                            <View style={styles.locationTapHint}>
                              <ThemedText style={[styles.locationTapText, { color: isMe ? 'rgba(255,255,255,0.6)' : theme.textSecondary }]}>
                                Tap to open in maps
                              </ThemedText>
                              <Feather name="external-link" size={10} color={isMe ? 'rgba(255,255,255,0.5)' : theme.textSecondary} />
                            </View>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })()}
                  
                  {messageText && item.type !== 'audio' && item.type !== 'location' ? (
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
            </Pressable>
          </SwipeableMessage>
        )}
      </View>
    );
  }, [myId, messages, theme, isDark, userPhoto, handleMessageLongPress, handleSwipeReply]);

  const keyExtractor = useCallback((item: Message) => item._id, []);

  const currentTheme = CHAT_THEMES.find(t => t.id === chatTheme);
  const photoSource = getPhotoSource(userPhoto);

  const chatContent = (
    <>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          maxToRenderPerBatch={10}
          windowSize={10}
          removeClippedSubviews={true}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Feather name="message-circle" size={40} color="#FFF" />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: '#FFF' }]}>Start the conversation</ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: 'rgba(255,255,255,0.7)' }]}>
                Say hello to {userName}!
              </ThemedText>
              <Pressable 
                style={[styles.aiSuggestButton, { backgroundColor: theme.primary }]}
                onPress={fetchAISuggestions}
              >
                <MaterialCommunityIcons name="robot" size={18} color="#FFF" />
                <ThemedText style={styles.aiSuggestButtonText}>Get AI Suggestions</ThemedText>
              </Pressable>
            </View>
          }
        />
      )}

      {isTyping && (
        <View style={styles.typingIndicator}>
          <View style={[styles.typingBubble, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }]}>
            <View style={styles.typingDots}>
              <Animated.View style={[styles.typingDot, { backgroundColor: theme.primary, transform: [{ scale: typingDotAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }], opacity: typingDotAnim1.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]} />
              <Animated.View style={[styles.typingDot, { backgroundColor: theme.primary, marginHorizontal: 5, transform: [{ scale: typingDotAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }], opacity: typingDotAnim2.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]} />
              <Animated.View style={[styles.typingDot, { backgroundColor: theme.primary, transform: [{ scale: typingDotAnim3.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }], opacity: typingDotAnim3.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }]} />
            </View>
            <ThemedText style={[styles.typingLabel, { color: theme.textSecondary }]}>typing</ThemedText>
          </View>
        </View>
      )}
    </>
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
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
          {screenshotProtection && (
            <View style={styles.headerActionButton}>
              <Feather name="shield" size={20} color="#4CAF50" />
            </View>
          )}
          <Pressable onPress={handleVoiceCall} style={styles.headerActionButton}>
            <Feather name="phone" size={22} color={theme.primary} />
          </Pressable>
          <Pressable onPress={handleVideoCall} style={styles.headerActionButton}>
            <Feather name="video" size={22} color={theme.primary} />
          </Pressable>
          <Pressable onPress={() => setShowOptionsMenu(true)} style={styles.headerActionButton}>
            <Feather name="more-vertical" size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}>
      {currentTheme?.image ? (
        <ImageBackground source={currentTheme.image} style={styles.chatBackground} resizeMode="cover">
          {chatContent}
        </ImageBackground>
      ) : (
        <View style={[styles.chatBackground, { backgroundColor: isDark ? '#1A1A1A' : '#E8E8E8' }]}>
          {chatContent}
        </View>
      )}

      {showAISuggestions && (
        <View style={[styles.aiSuggestionsContainer, { backgroundColor: theme.background, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
          <View style={styles.aiSuggestionsHeader}>
            <MaterialCommunityIcons name="robot" size={18} color={theme.primary} />
            <ThemedText style={[styles.aiSuggestionsTitle, { color: theme.text }]}>AI Suggestions</ThemedText>
            <Pressable onPress={() => setShowAISuggestions(false)}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aiSuggestionsScroll}>
            {aiSuggestions.map((suggestion, index) => (
              <Pressable 
                key={index} 
                style={[styles.aiSuggestionChip, { backgroundColor: theme.primary + '20', borderColor: theme.primary }]}
                onPress={() => sendMessage(suggestion)}
              >
                <ThemedText style={[styles.aiSuggestionText, { color: theme.primary }]} numberOfLines={2}>
                  {suggestion}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {showEmojiPicker && (
        <View style={[styles.emojiPicker, { backgroundColor: theme.background, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiScrollContent}>
            {EMOJI_LIST.map((emoji, index) => (
              <Pressable key={index} onPress={() => handleEmojiSelect(emoji)} style={styles.emojiButton}>
                <ThemedText style={styles.emojiText}>{emoji}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {replyingTo && (
        <View style={[styles.replyBar, { backgroundColor: theme.background, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
          <View style={[styles.replyBarAccent, { backgroundColor: theme.primary }]} />
          <View style={styles.replyBarContent}>
            <ThemedText style={[styles.replyBarName, { color: theme.primary }]} numberOfLines={1}>
              {(() => {
                const sid = typeof replyingTo.sender === 'string' ? replyingTo.sender : replyingTo.sender?._id;
                return String(sid) === String(myId) ? 'You' : userName;
              })()}
            </ThemedText>
            <ThemedText style={[styles.replyBarText, { color: theme.textSecondary }]} numberOfLines={1}>
              {replyingTo.type === 'image' ? '📷 Photo' : replyingTo.type === 'video' ? '🎬 Video' : replyingTo.type === 'audio' ? '🎤 Voice message' : (replyingTo.content || replyingTo.text || '')}
            </ThemedText>
          </View>
          <Pressable onPress={() => setReplyingTo(null)} style={styles.replyBarClose}>
            <Feather name="x" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      )}

        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', paddingBottom: Math.max(insets.bottom, 4) + 4 }]}>
          {isRecording ? (
            <View style={styles.recordingContainer}>
              <Pressable onPress={cancelRecording} style={styles.cancelRecordButton}>
                <Feather name="x" size={24} color="#F44336" />
              </Pressable>
              <View style={styles.recordingInfo}>
                <Animated.View style={[styles.recordingDot, { transform: [{ scale: recordingPulse }] }]} />
                <ThemedText style={[styles.recordingTime, { color: theme.text }]}>
                  {formatRecordingTime(recordingDuration)}
                </ThemedText>
                <ThemedText style={[styles.recordingLabel, { color: theme.textSecondary }]}>Recording</ThemedText>
              </View>
              <Pressable onPress={stopRecording} style={[styles.sendRecordButton, { backgroundColor: theme.primary }]}>
                <Feather name="send" size={20} color="#FFF" />
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable style={styles.attachButton} onPress={() => setShowAttachmentMenu(true)}>
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
                <Pressable style={styles.emojiToggle} onPress={() => setShowEmojiPicker(!showEmojiPicker)}>
                  <Feather name="smile" size={22} color={showEmojiPicker ? theme.primary : theme.textSecondary} />
                </Pressable>
              </View>
              
              <Pressable style={styles.aiButton} onPress={fetchAISuggestions}>
                <MaterialCommunityIcons name="robot" size={24} color={showAISuggestions ? theme.primary : theme.textSecondary} />
              </Pressable>
              
              {message.trim() ? (
                <Pressable 
                  onPress={() => sendMessage()} 
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
                <Pressable 
                  style={styles.micButton}
                  onPress={startRecording}
                >
                  <Feather name="mic" size={24} color={theme.primary} />
                </Pressable>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showAttachmentMenu} transparent animationType="fade" onRequestClose={() => setShowAttachmentMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAttachmentMenu(false)}>
          <View style={[styles.attachmentMenu, { backgroundColor: theme.background }]}>
            <ThemedText style={[styles.attachmentTitle, { color: theme.text }]}>Send Attachment</ThemedText>
            
            <View style={styles.attachmentOptions}>
              <Pressable style={styles.attachmentOption} onPress={handleTakePhoto}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#FF6B6B20' }]}>
                  <Feather name="camera" size={24} color="#FF6B6B" />
                </View>
                <ThemedText style={[styles.attachmentLabel, { color: theme.text }]}>Camera</ThemedText>
              </Pressable>
              
              <Pressable style={styles.attachmentOption} onPress={handlePickImage}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#4ECDC420' }]}>
                  <Feather name="image" size={24} color="#4ECDC4" />
                </View>
                <ThemedText style={[styles.attachmentLabel, { color: theme.text }]}>Gallery</ThemedText>
              </Pressable>
              
              <Pressable style={styles.attachmentOption} onPress={handlePickVideo}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#9B59B620' }]}>
                  <Feather name="video" size={24} color="#9B59B6" />
                </View>
                <ThemedText style={[styles.attachmentLabel, { color: theme.text }]}>Video</ThemedText>
              </Pressable>
              
              <Pressable style={styles.attachmentOption} onPress={handleShareLocation}>
                <View style={[styles.attachmentIcon, { backgroundColor: '#45B7D120' }]}>
                  <Feather name="map-pin" size={24} color="#45B7D1" />
                </View>
                <ThemedText style={[styles.attachmentLabel, { color: theme.text }]}>Location</ThemedText>
              </Pressable>
            </View>
            
            <Pressable style={[styles.cancelButton, { borderColor: theme.textSecondary }]} onPress={() => setShowAttachmentMenu(false)}>
              <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showOptionsMenu} transparent animationType="fade" onRequestClose={() => setShowOptionsMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowOptionsMenu(false)}>
          <View style={[styles.optionsMenu, { backgroundColor: theme.background }]}>
            <ThemedText style={[styles.optionsTitle, { color: theme.text }]}>Options</ThemedText>
            
            <Pressable style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); toggleScreenshotProtection(); }}>
              <Feather name="shield" size={22} color={screenshotProtection ? '#4CAF50' : theme.text} />
              <ThemedText style={[styles.optionText, { color: theme.text }]}>
                {screenshotProtection ? 'Disable Screenshot Protection' : 'Enable Screenshot Protection'}
              </ThemedText>
              {screenshotProtection && <Feather name="check-circle" size={18} color="#4CAF50" />}
            </Pressable>
            
            <Pressable style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); setShowThemeModal(true); }}>
              <Feather name="image" size={22} color={theme.primary} />
              <ThemedText style={[styles.optionText, { color: theme.text }]}>Chat Theme</ThemedText>
            </Pressable>
            
            <Pressable style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); setThemeMode(isDark ? 'light' : 'dark'); }}>
              <Feather name={isDark ? 'sun' : 'moon'} size={22} color={theme.text} />
              <ThemedText style={[styles.optionText, { color: theme.text }]}>
                {isDark ? 'Light Mode' : 'Dark Mode'}
              </ThemedText>
            </Pressable>
            
            <Pressable style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); setShowReportModal(true); }}>
              <Feather name="flag" size={22} color="#FF9800" />
              <ThemedText style={[styles.optionText, { color: theme.text }]}>Report User</ThemedText>
            </Pressable>
            
            <Pressable style={styles.optionItem} onPress={handleBlockUser}>
              <Feather name="slash" size={22} color="#F44336" />
              <ThemedText style={[styles.optionText, { color: '#F44336' }]}>Block User</ThemedText>
            </Pressable>
            
            <Pressable style={[styles.cancelButton, { borderColor: theme.textSecondary, marginTop: 16 }]} onPress={() => setShowOptionsMenu(false)}>
              <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showThemeModal} transparent animationType="slide" onRequestClose={() => setShowThemeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.themeModal, { backgroundColor: theme.background }]}>
            <View style={styles.themeHeader}>
              <ThemedText style={[styles.themeTitle, { color: theme.text }]}>Chat Theme</ThemedText>
              <Pressable onPress={() => setShowThemeModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            
            <ScrollView contentContainerStyle={styles.themeGrid}>
              {CHAT_THEMES.map((themeItem) => (
                <Pressable
                  key={themeItem.id}
                  style={[
                    styles.themeItem,
                    chatTheme === themeItem.id && { borderColor: theme.primary, borderWidth: 3 }
                  ]}
                  onPress={() => saveChatTheme(themeItem.id)}
                >
                  {themeItem.image ? (
                    <Image source={themeItem.image} style={styles.themePreview} contentFit="cover" />
                  ) : (
                    <View style={[styles.themePreview, { backgroundColor: isDark ? '#1A1A1A' : '#E8E8E8' }]}>
                      <ThemedText style={{ color: theme.textSecondary }}>Default</ThemedText>
                    </View>
                  )}
                  <ThemedText style={[styles.themeName, { color: theme.text }]} numberOfLines={1}>
                    {themeItem.name}
                  </ThemedText>
                  {chatTheme === themeItem.id && (
                    <View style={[styles.themeCheck, { backgroundColor: theme.primary }]}>
                      <Feather name="check" size={12} color="#FFF" />
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.reportModal, { backgroundColor: theme.background }]}>
            <View style={styles.reportHeader}>
              <ThemedText style={[styles.reportTitle, { color: theme.text }]}>Report {userName}</ThemedText>
              <Pressable onPress={() => setShowReportModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            
            <ThemedText style={[styles.reportSubtitle, { color: theme.textSecondary }]}>
              Why are you reporting this user?
            </ThemedText>
            
            <ScrollView style={styles.reportReasons}>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason.id}
                  style={[
                    styles.reportReasonItem,
                    selectedReportReason === reason.id && { backgroundColor: theme.primary + '20', borderColor: theme.primary },
                    { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }
                  ]}
                  onPress={() => setSelectedReportReason(reason.id)}
                >
                  <Feather name={reason.icon as any} size={20} color={selectedReportReason === reason.id ? theme.primary : theme.text} />
                  <ThemedText style={[styles.reportReasonText, { color: theme.text }]}>{reason.label}</ThemedText>
                  {selectedReportReason === reason.id && (
                    <Feather name="check-circle" size={20} color={theme.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
            
            <TextInput
              style={[styles.reportInput, { color: theme.text, backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
              placeholder="Add more details (optional)"
              placeholderTextColor={theme.textSecondary}
              value={reportDetails}
              onChangeText={setReportDetails}
              multiline
              numberOfLines={3}
            />
            
            <Pressable
              style={[styles.submitReportButton, { backgroundColor: theme.primary, opacity: selectedReportReason ? 1 : 0.5 }]}
              onPress={handleSubmitReport}
              disabled={!selectedReportReason || submittingReport}
            >
              {submittingReport ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <ThemedText style={styles.submitReportText}>Submit Report</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={!!viewingImage} transparent animationType="fade" onRequestClose={() => setViewingImage(null)}>
        <View style={styles.imageViewerOverlay}>
          <Pressable style={styles.imageViewerClose} onPress={() => setViewingImage(null)}>
            <Feather name="x" size={28} color="#FFF" />
          </Pressable>
          <View style={styles.imageViewerActions}>
            <Pressable style={styles.imageViewerActionBtn} onPress={() => viewingImage && saveImage(viewingImage)}>
              <Ionicons name="download-outline" size={24} color="#FFF" />
            </Pressable>
          </View>
          {viewingImage && (
            <Image source={{ uri: viewingImage }} style={styles.imageViewerImage} contentFit="contain" />
          )}
        </View>
      </Modal>

      <Modal visible={!!viewingVideo} transparent animationType="fade" onRequestClose={() => setViewingVideo(null)}>
        <View style={styles.imageViewerOverlay}>
          <Pressable style={styles.imageViewerClose} onPress={() => setViewingVideo(null)}>
            <Feather name="x" size={28} color="#FFF" />
          </Pressable>
          <View style={styles.imageViewerActions}>
            <Pressable style={styles.imageViewerActionBtn} onPress={() => viewingVideo && saveVideo(viewingVideo)}>
              <Ionicons name="download-outline" size={24} color="#FFF" />
            </Pressable>
          </View>
          {viewingVideo && (
            <Video
              source={{ uri: viewingVideo }}
              style={{ width: '100%', height: '80%' }}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping={false}
            />
          )}
        </View>
      </Modal>

      <Modal visible={showMessageMenu} transparent animationType="fade" onRequestClose={() => { setShowMessageMenu(false); setSelectedMessage(null); }}>
        <Pressable style={styles.modalOverlay} onPress={() => { setShowMessageMenu(false); setSelectedMessage(null); }}>
          <View style={[styles.messageMenuModal, { backgroundColor: theme.background }]}>
            {selectedMessage && (
              <View style={[styles.messageMenuPreview, { backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5' }]}>
                <ThemedText style={[styles.messageMenuPreviewText, { color: theme.text }]} numberOfLines={2}>
                  {selectedMessage.content || selectedMessage.text || (selectedMessage.type === 'image' ? '📷 Photo' : selectedMessage.type === 'video' ? '🎬 Video' : '🎤 Voice')}
                </ThemedText>
              </View>
            )}
            
            <Pressable style={styles.messageMenuItem} onPress={handleReply}>
              <Feather name="corner-up-left" size={22} color={theme.primary} />
              <ThemedText style={[styles.messageMenuItemText, { color: theme.text }]}>Reply</ThemedText>
            </Pressable>
            
            <Pressable style={styles.messageMenuItem} onPress={handleTranslateOpen}>
              <MaterialCommunityIcons name="translate" size={22} color={theme.primary} />
              <ThemedText style={[styles.messageMenuItemText, { color: theme.text }]}>Translate</ThemedText>
            </Pressable>
            
            <Pressable style={styles.messageMenuItem} onPress={handleDeleteForMe}>
              <Feather name="trash-2" size={22} color="#FF9800" />
              <ThemedText style={[styles.messageMenuItemText, { color: theme.text }]}>Delete for Me</ThemedText>
            </Pressable>
            
            {selectedMessage && (() => {
              const sid = typeof selectedMessage.sender === 'string' ? selectedMessage.sender : selectedMessage.sender?._id;
              return String(sid) === String(myId);
            })() && (
              <Pressable style={styles.messageMenuItem} onPress={handleDeleteForEveryone}>
                <Feather name="trash" size={22} color="#F44336" />
                <ThemedText style={[styles.messageMenuItemText, { color: '#F44336' }]}>Delete for Everyone</ThemedText>
              </Pressable>
            )}
            
            <Pressable style={[styles.cancelButton, { borderColor: theme.textSecondary, marginTop: 12 }]} onPress={() => { setShowMessageMenu(false); setSelectedMessage(null); }}>
              <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showTranslateModal} transparent animationType="slide" onRequestClose={() => { setShowTranslateModal(false); setSelectedMessage(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.translateModal, { backgroundColor: theme.background }]}>
            <View style={styles.translateHeader}>
              <ThemedText style={[styles.translateTitle, { color: theme.text }]}>Translate Message</ThemedText>
              <Pressable onPress={() => { setShowTranslateModal(false); setSelectedMessage(null); }}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            
            {selectedMessage && (
              <View style={[styles.translateOriginal, { backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5' }]}>
                <ThemedText style={[styles.translateOriginalLabel, { color: theme.textSecondary }]}>Original</ThemedText>
                <ThemedText style={[styles.translateOriginalText, { color: theme.text }]} numberOfLines={3}>
                  {selectedMessage.content || selectedMessage.text || ''}
                </ThemedText>
              </View>
            )}
            
            {translating ? (
              <View style={styles.translateLoading}>
                <ActivityIndicator size="large" color={theme.primary} />
                <ThemedText style={[styles.translateLoadingText, { color: theme.textSecondary }]}>Translating...</ThemedText>
              </View>
            ) : translatedText ? (
              <View style={[styles.translateResult, { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}>
                <ThemedText style={[styles.translateResultLabel, { color: theme.primary }]}>Translation</ThemedText>
                <ThemedText style={[styles.translateResultText, { color: theme.text }]}>{translatedText}</ThemedText>
                <Pressable style={[styles.translateCopyBtn, { backgroundColor: theme.primary }]} onPress={handleCopyTranslation}>
                  <Feather name="copy" size={16} color="#FFF" />
                  <ThemedText style={styles.translateCopyText}>Copy</ThemedText>
                </Pressable>
              </View>
            ) : (
              <View>
                <ThemedText style={[styles.translatePickLabel, { color: theme.textSecondary }]}>Enter target language</ThemedText>
                <TextInput
                  style={[styles.translateLangInput, { color: theme.text, backgroundColor: isDark ? '#2A2A2A' : '#F5F5F5', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}
                  placeholder="Type any language (e.g., Swahili, Korean, Tagalog...)"
                  placeholderTextColor={theme.textSecondary}
                  value={translateTargetLang}
                  onChangeText={setTranslateTargetLang}
                  autoFocus
                />
                <Pressable
                  style={[styles.translateButton, { backgroundColor: theme.primary, opacity: translateTargetLang.trim() ? 1 : 0.5 }]}
                  onPress={() => translateTargetLang.trim() && handleTranslate(translateTargetLang.trim())}
                  disabled={!translateTargetLang.trim()}
                >
                  <MaterialCommunityIcons name="translate" size={20} color="#FFF" />
                  <ThemedText style={styles.translateButtonText}>Translate</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1 },
  backButton: { padding: 8 },
  headerProfile: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  avatarContainer: { position: 'relative' },
  headerAvatar: { width: 44, height: 44, borderRadius: 22 },
  onlineIndicator: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: '#4CAF50', borderWidth: 2, borderColor: '#FFF' },
  headerInfo: { marginLeft: 12, flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  headerName: { fontSize: 17, fontWeight: '700' },
  verifiedBadge: { width: 18, height: 18, marginLeft: 6 },
  headerStatus: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerActionButton: { padding: 10, marginLeft: 4 },
  chatBackground: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesList: { paddingHorizontal: 12, paddingVertical: 16, flexGrow: 1 },
  dateHeaderContainer: { alignItems: 'center', marginVertical: 16 },
  dateHeader: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  dateHeaderText: { fontSize: 12, fontWeight: '500' },
  systemMessageContainer: { alignItems: 'center', marginVertical: 8 },
  systemMessage: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  systemMessageText: { color: '#FFF', fontSize: 13 },
  messageRow: { flexDirection: 'row', marginVertical: 4, alignItems: 'flex-end' },
  messageRowLeft: { justifyContent: 'flex-start' },
  messageRowRight: { justifyContent: 'flex-end' },
  messageAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  messageBubble: { maxWidth: '75%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  myBubble: { borderBottomRightRadius: 4 },
  theirBubble: { borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 21 },
  messageImage: { width: 200, height: 150, borderRadius: 16, marginBottom: 6, overflow: 'hidden' as const },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  messageTime: { fontSize: 11 },
  typingIndicator: { paddingHorizontal: 16, paddingVertical: 6 },
  typingBubble: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderBottomLeftRadius: 4, gap: 8 },
  typingDots: { flexDirection: 'row', alignItems: 'center' },
  typingDot: { width: 7, height: 7, borderRadius: 4 },
  typingLabel: { fontSize: 12, fontWeight: '500' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyIconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20 },
  aiSuggestButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 },
  aiSuggestButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  aiSuggestionsContainer: { borderTopWidth: 1, paddingVertical: 12 },
  aiSuggestionsHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  aiSuggestionsTitle: { flex: 1, fontSize: 14, fontWeight: '600', marginLeft: 8 },
  aiSuggestionsScroll: { paddingHorizontal: 12 },
  aiSuggestionChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1, marginHorizontal: 4, maxWidth: 200 },
  aiSuggestionText: { fontSize: 13 },
  emojiPicker: { borderTopWidth: 1, paddingVertical: 12 },
  emojiScrollContent: { paddingHorizontal: 12 },
  emojiButton: { padding: 6 },
  emojiText: { fontSize: 28 },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8, paddingTop: 8, borderTopWidth: 1 },
  recordingContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancelRecordButton: { padding: 12 },
  recordingInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F44336' },
  recordingTime: { fontSize: 18, fontWeight: '600' },
  recordingLabel: { fontSize: 13, fontWeight: '500' },
  sendRecordButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  attachButton: { padding: 6, marginBottom: 2 },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 6, marginHorizontal: 4, minHeight: 40, maxHeight: 120 },
  textInput: { flex: 1, fontSize: 16, maxHeight: 100, paddingTop: 0, paddingBottom: 0 },
  emojiToggle: { padding: 4, marginLeft: 8 },
  aiButton: { padding: 6, marginBottom: 2 },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  micButton: { padding: 8, marginBottom: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  attachmentMenu: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  attachmentTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  attachmentOptions: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
  attachmentOption: { alignItems: 'center' },
  attachmentIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  attachmentLabel: { fontSize: 14, fontWeight: '500' },
  cancelButton: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: '600' },
  optionsMenu: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  optionsTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' },
  optionText: { fontSize: 16, marginLeft: 16, flex: 1 },
  themeModal: { margin: 20, borderRadius: 20, padding: 20, maxHeight: '80%' },
  themeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  themeTitle: { fontSize: 20, fontWeight: '700' },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  themeItem: { width: '31%', marginBottom: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' },
  themePreview: { width: '100%', aspectRatio: 0.8, justifyContent: 'center', alignItems: 'center' },
  themeName: { fontSize: 12, fontWeight: '500', textAlign: 'center', paddingVertical: 6 },
  themeCheck: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  reportModal: { margin: 20, borderRadius: 20, padding: 24, maxHeight: '80%' },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reportTitle: { fontSize: 20, fontWeight: '700' },
  reportSubtitle: { fontSize: 14, marginBottom: 20 },
  reportReasons: { maxHeight: 280 },
  reportReasonItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  reportReasonText: { flex: 1, marginLeft: 12, fontSize: 15 },
  reportInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginTop: 16, minHeight: 80, textAlignVertical: 'top' },
  submitReportButton: { marginTop: 20, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitReportText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  imageSaveButton: { 
    position: 'absolute' as const, 
    bottom: 12, 
    right: 8, 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center' as const, 
    alignItems: 'center' as const 
  },
  audioPlayer: { 
    flexDirection: 'row' as const, 
    alignItems: 'center' as const, 
    paddingHorizontal: 10, 
    paddingVertical: 8, 
    borderRadius: 16, 
    minWidth: 180,
    gap: 8
  },
  audioWaveform: { flex: 1 },
  audioProgressBar: { 
    height: 4, 
    borderRadius: 2, 
    overflow: 'hidden' as const 
  },
  audioProgressFill: { 
    height: '100%' as const, 
    borderRadius: 2 
  },
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute' as const,
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  imageViewerActions: {
    position: 'absolute' as const,
    top: 50,
    left: 20,
    zIndex: 10,
    flexDirection: 'row' as const,
    gap: 16,
  },
  imageViewerActionBtn: {
    padding: 8,
  },
  imageViewerImage: {
    width: SCREEN_WIDTH,
    height: '80%',
  },
  replyPreviewInBubble: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderLeftWidth: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  replyPreviewName: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyPreviewText: {
    fontSize: 12,
  },
  replyBar: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  replyBarAccent: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    minHeight: 36,
  },
  replyBarContent: {
    flex: 1,
    marginLeft: 10,
  },
  replyBarName: {
    fontSize: 13,
    fontWeight: '700',
  },
  replyBarText: {
    fontSize: 13,
    marginTop: 2,
  },
  replyBarClose: {
    padding: 8,
  },
  messageMenuModal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  messageMenuPreview: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  messageMenuPreviewText: {
    fontSize: 14,
  },
  messageMenuItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  messageMenuItemText: {
    fontSize: 16,
    marginLeft: 16,
    flex: 1,
  },
  translateModal: {
    margin: 20,
    borderRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  translateHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  translateTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  translateOriginal: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  translateOriginalLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  translateOriginalText: {
    fontSize: 14,
  },
  translateLoading: {
    alignItems: 'center' as const,
    paddingVertical: 40,
  },
  translateLoadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  translateResult: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  translateResultLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  translateResultText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  translateCopyBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-end' as const,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  translateCopyText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  translatePickLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  translateLangInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 16,
  },
  translateButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  translateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  videoContainer: {
    width: 200,
    height: 150,
    borderRadius: 16,
    overflow: 'hidden' as const,
    marginBottom: 6,
    position: 'relative' as const,
  },
  videoThumbnail: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
  },
  videoPlayButton: {
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  locationBubble: {
    width: 240,
    borderRadius: 16,
    overflow: 'hidden' as const,
    marginBottom: 4,
  },
  locationMapContainer: {
    width: 240,
    height: 160,
    position: 'relative' as const,
    backgroundColor: '#E0E0E0',
    overflow: 'hidden' as const,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  locationTileGrid: {
    width: 256 * 3,
    height: 256 * 3,
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    position: 'absolute' as const,
  },
  locationTile: {
    width: 256,
    height: 256,
  },
  locationGradientOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },
  locationGradientLayer1: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  locationGradientLayer2: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  locationGradientLayer3: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  locationPinOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  locationPinShadow: {
    position: 'absolute' as const,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.25)',
    top: '53%' as any,
  },
  locationInfoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  locationIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  locationAddress: {
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
    lineHeight: 17,
  },
  locationTapHint: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    marginTop: 2,
  },
  locationTapText: {
    fontSize: 10,
  },
});

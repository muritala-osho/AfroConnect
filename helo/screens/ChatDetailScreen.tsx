import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { View, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, Dimensions, Keyboard, ScrollView, ImageBackground } from "react-native";
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
import { Audio } from "expo-av";
import { useApi } from "@/hooks/useApi";
import socketService from "@/services/socket";
import { getPhotoSource } from "@/utils/photos";
import { getApiBaseUrl } from "@/constants/config";
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
  sender: string | { _id: string };
  content?: string;
  text?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'system' | 'location' | 'call';
  imageUrl?: string;
  audioUrl?: string;
  createdAt: string;
  status?: 'sent' | 'delivered' | 'seen';
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

export default function ChatDetailScreen({ navigation, route }: ChatDetailScreenProps) {
  const { theme, isDark, setThemeMode } = useTheme();
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
  
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    const loadChatTheme = async () => {
      const savedTheme = await AsyncStorage.getItem(`chat_theme_${userId}`);
      if (savedTheme) setChatTheme(savedTheme);
    };
    loadChatTheme();
  }, [userId]);

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
          post(`/chat/${mId}/read`, {}, token).catch(() => {});
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
        const myId = user?.id || (user as any)?._id;
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
      if ((data.chatId === matchId || data.matchId === matchId) && typingUserId === userId) {
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
  }, [matchId, userId]);

  const sendMessage = async (content?: string, type: string = 'text', extraData?: any) => {
    const textToSend = content || message.trim();
    if (!textToSend && type === 'text') return;
    if (!matchId || !token || sending) return;
    
    setMessage("");
    setSending(true);
    Keyboard.dismiss();
    setShowEmojiPicker(false);
    setShowAISuggestions(false);
    
    const tempMessage: Message = {
      _id: `temp_${Date.now()}`,
      sender: user?.id || '',
      content: textToSend,
      type: type as any,
      createdAt: new Date().toISOString(),
      status: 'sent',
      ...extraData
    };
    setMessages(prev => [...prev, tempMessage]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await post<{ message: Message }>(`/chat/${matchId}/message`, { 
        content: textToSend, 
        type,
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
      socketService.emit('chat:typing', { chatId: matchId, userId: user?.id });
    }
  }, [matchId, token, user?.id]);

  const handleEmojiSelect = (emoji: string) => {
    setMessage(prev => prev + emoji);
  };

  const handlePickImage = async () => {
    setShowAttachmentMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Needed', 'Microphone permission is required');
        return;
      }
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Recording error:', error);
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
      recordingRef.current = null;
      setIsRecording(false);
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri && recordingDuration >= 1) {
        try {
          const formData = new FormData();
          formData.append('audio', {
            uri,
            type: 'audio/m4a',
            name: 'voice_message.m4a',
          } as any);
          formData.append('duration', recordingDuration.toString());
          
          const uploadResponse = await fetch(`${getApiBaseUrl()}/api/upload/audio`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          
          const uploadData = await uploadResponse.json();
          if (uploadData.success && uploadData.url) {
            await sendMessage(`🎤 Voice message (${recordingDuration}s)`, 'audio', { 
              audioUrl: uploadData.url,
              audioDuration: recordingDuration 
            });
          } else {
            Alert.alert('Upload Failed', 'Could not upload voice message');
          }
        } catch (error) {
          Alert.alert('Error', 'Failed to upload voice message');
        }
      }
      
      setRecordingDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Stop recording error:', error);
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
      return;
    }
    
    try {
      if (Platform.OS !== 'web') {
        const recording = recordingRef.current;
        recordingRef.current = null;
        await recording.stopAndUnloadAsync();
      } else {
        recordingRef.current = null;
      }
    } catch (error) {
      console.log('Cancel recording cleanup:', error);
    }
    
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const playAudio = async (audioUrl: string, messageId: string) => {
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      if (playingAudioId === messageId) {
        setPlayingAudioId(null);
        setAudioProgress(0);
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        (status: any) => {
          if (status.isLoaded) {
            if (status.durationMillis > 0) {
              setAudioProgress(status.positionMillis / status.durationMillis);
            }
            if (status.didJustFinish) {
              setPlayingAudioId(null);
              setAudioProgress(0);
              soundRef.current = null;
            }
          }
        }
      );
      soundRef.current = sound;
      setPlayingAudioId(messageId);
    } catch (error) {
      console.error('Audio playback error:', error);
      Alert.alert('Error', 'Could not play voice message');
    }
  };

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
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

      const { status } = await MediaLibrary.requestPermissionsAsync(true, ['photo', 'video']);
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to save images to your gallery.');
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}afroconnect_${Date.now()}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
      
      if (downloadResult.status === 200) {
        await MediaLibrary.saveToLibraryAsync(downloadResult.uri);
        Alert.alert('Saved', 'Image saved to your gallery.');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', 'Failed to download image.');
      }
    } catch (error) {
      console.error('Save image error:', error);
      if (Platform.OS !== 'web') {
        try {
          const fileUri = `${FileSystem.cacheDirectory}afroconnect_${Date.now()}.jpg`;
          const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
          if (downloadResult.status === 200 && await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(downloadResult.uri);
          }
        } catch (shareError) {
          Alert.alert('Error', 'Could not save image.');
        }
      }
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

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const senderId = typeof item.sender === 'string' ? item.sender : item.sender?._id;
    const currentUserId = user?.id || (user as any)?._id;
    const isMe = senderId === currentUserId;
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showDateHeader = shouldShowDateHeader(item, prevMessage);
    const messageText = item.content || item.text || '';

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
        
        {(item.type === 'system' || item.type === 'call') ? (
          <View style={styles.systemMessageContainer}>
            <View style={[styles.systemMessage, { backgroundColor: 'rgba(0,0,0,0.3)' }]}>
              <Ionicons name={item.type === 'call' ? 'call' : 'information-circle'} size={14} color="#FFF" style={{ marginRight: 6 }} />
              <ThemedText style={styles.systemMessageText}>{messageText}</ThemedText>
            </View>
          </View>
        ) : (
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
              { backgroundColor: isMe ? theme.primary : (isDark ? 'rgba(42,42,42,0.95)' : 'rgba(255,255,255,0.95)') }
            ]}>
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
                          width: playingAudioId === item._id ? `${audioProgress * 100}%` : '0%',
                          backgroundColor: isMe ? '#FFF' : theme.primary 
                        }
                      ]} />
                    </View>
                  </View>
                  <Ionicons name="mic" size={14} color={isMe ? 'rgba(255,255,255,0.6)' : theme.textSecondary} />
                </Pressable>
              )}
              
              {messageText && item.type !== 'audio' ? (
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
        )}
      </View>
    );
  };

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
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
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
          <View style={[styles.typingBubble, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
            <View style={styles.typingDots}>
              <View style={[styles.typingDot, { backgroundColor: theme.textSecondary }]} />
              <View style={[styles.typingDot, { backgroundColor: theme.textSecondary, marginHorizontal: 4 }]} />
              <View style={[styles.typingDot, { backgroundColor: theme.textSecondary }]} />
            </View>
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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', paddingBottom: insets.bottom + 8 }]}>
          {isRecording ? (
            <View style={styles.recordingContainer}>
              <Pressable onPress={cancelRecording} style={styles.cancelRecordButton}>
                <Feather name="x" size={24} color="#F44336" />
              </Pressable>
              <View style={styles.recordingInfo}>
                <View style={styles.recordingDot} />
                <ThemedText style={[styles.recordingTime, { color: theme.text }]}>
                  {formatRecordingTime(recordingDuration)}
                </ThemedText>
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
                  onPressIn={startRecording}
                  onPressOut={stopRecording}
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
  messageImage: { width: 200, height: 150, borderRadius: 12, marginBottom: 6 },
  messageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  messageTime: { fontSize: 11 },
  typingIndicator: { paddingHorizontal: 16, paddingVertical: 8 },
  typingBubble: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20, borderBottomLeftRadius: 4 },
  typingDots: { flexDirection: 'row', alignItems: 'center' },
  typingDot: { width: 8, height: 8, borderRadius: 4, opacity: 0.6 },
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
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  recordingContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cancelRecordButton: { padding: 12 },
  recordingInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  recordingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F44336', marginRight: 10 },
  recordingTime: { fontSize: 18, fontWeight: '600' },
  sendRecordButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  attachButton: { padding: 8, marginBottom: 4 },
  inputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, marginHorizontal: 4, minHeight: 44, maxHeight: 120 },
  textInput: { flex: 1, fontSize: 16, maxHeight: 100, paddingTop: 0, paddingBottom: 0 },
  emojiToggle: { padding: 4, marginLeft: 8 },
  aiButton: { padding: 8, marginBottom: 4 },
  sendButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  micButton: { padding: 10, marginBottom: 4 },
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
});

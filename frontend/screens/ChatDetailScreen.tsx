import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Dimensions,
  Keyboard,
  ScrollView,
  ImageBackground,
  Animated,
  PanResponder,
  Linking,
  DeviceEventEmitter,
} from "react-native";
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
import { useFocusEffect } from "@react-navigation/native";
import { setChatScreenOpen } from "@/context/UnreadContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type ChatDetailScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "ChatDetail"
>;
type ChatDetailScreenRouteProp = RouteProp<RootStackParamList, "ChatDetail">;

interface ChatDetailScreenProps {
  navigation: ChatDetailScreenNavigationProp;
  route: ChatDetailScreenRouteProp;
}

interface MessageReaction {
  user: string | { _id: string };
  emoji: string;
}

interface Message {
  _id: string;
  sender: string | { _id: string };
  content?: string;
  text?: string;
  type: "text" | "image" | "video" | "audio" | "system" | "location" | "call";
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  createdAt: string;
  status?: "sent" | "delivered" | "seen";
  replyTo?: {
    messageId: string;
    content: string;
    type: string;
    senderName: string;
  };
  deletedForEveryone?: boolean;
  deletedFor?: string[];
  reactions?: MessageReaction[];
  viewOnce?: boolean;
  viewOnceOpenedBy?: string[];
  edited?: boolean;
  editedAt?: string;
}

const EMOJI_LIST = [
  "😀","😂","😍","🥰","😘","🤗","😊","🙂","😉","😎","🤩","🥳","😋","🤤",
  "😜","🤪","😏","😌","😓","😪","🤒","😷",
  "🤕","🤢","🤮","🥵","🥶","😱","😨","😰","😥","😢","😭","😤","😠","🤬",
  "😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖","🎃","😺",
  "😸","😹","😻","😼","😽","🙀","😿","😾","❤️","🧡","💛","💚","💙","💜",
  "🖤","🤍","🤎","💓","💕","💕","💞","💓","💗","💖","💘","💑","💎",
  "👍","🙌","🤝","✌️","🤟","🤘","🤙","👋","🖖","✋","👌","🤌",
  "🔥","✨","⭐","🎈","🎀",
  "🏆","🥇","🥈","🥉",
];

const REPORT_REASONS = [
  { id: "inappropriate", label: "Inappropriate Content", icon: "alert-circle" },
  { id: "harassment", label: "Harassment or Bullying", icon: "user-x" },
  { id: "spam", label: "Spam or Scam", icon: "mail" },
  { id: "fake", label: "Fake Profile", icon: "user-check" },
  { id: "underage", label: "Underage User", icon: "shield-off" },
  { id: "other", label: "Other", icon: "more-horizontal" },
];

const CHAT_THEMES = [
  { id: "default", name: "Default", image: null },
  { id: "luxury", name: "Luxury", image: require("@/assets/chat-themes/afroconnect_luxury.png") },
  { id: "blue_doodle", name: "Blue Doodle", image: require("@/assets/chat-themes/theme-blue-doodle.png") },
  { id: "cats", name: "Cats", image: require("@/assets/chat-themes/theme_cats.png") },
  { id: "dark_doodle", name: "Dark Doodle", image: require("@/assets/chat-themes/theme-dark-doodle.png") },
  { id: "dots", name: "Dots", image: require("@/assets/chat-themes/theme-dots.png") },
  { id: "geometry", name: "Geometry", image: require("@/assets/chat-themes/theme-geometry.jpg") },
  { id: "hearts_outline", name: "Hearts Outline", image: require("@/assets/chat-themes/theme_hearts_outline.png") },
  { id: "hearts_purple", name: "Hearts Purple", image: require("@/assets/chat-themes/theme_hearts_purple.png") },
  { id: "light_doodle", name: "Light Doodle", image: require("@/assets/chat-themes/theme-light-doodle.png") },
  { id: "love_dark", name: "Love Dark", image: require("@/assets/chat-themes/theme_love_dark.png") },
  { id: "love_pink", name: "Love Pink", image: require("@/assets/chat-themes/theme_love_pink.png") },
  { id: "magic", name: "Magic", image: require("@/assets/chat-themes/theme-magic.jpg") },
  { id: "rainbow", name: "Rainbow", image: require("@/assets/chat-themes/theme-rainbow.png") },
  { id: "sky_doodle", name: "Sky Doodle", image: require("@/assets/chat-themes/theme-sky-doodle.png") },
  { id: "valentine_black", name: "Valentine Black", image: require("@/assets/chat-themes/theme_valentine_black.png") },
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


const SwipeableMessage = React.memo(
  ({
    item,
    isMe,
    children,
    onReply,
    themeTextSecondary,
  }: {
    item: Message;
    isMe: boolean;
    children: React.ReactNode;
    onReply: (item: Message) => void;
    themeTextSecondary: string;
  }) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const itemRef = useRef(item);
    const onReplyRef = useRef(onReply);
    itemRef.current = item;
    onReplyRef.current = onReply;

    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            Math.abs(gestureState.dx) > 10 &&
            Math.abs(gestureState.dy) < 10 &&
            gestureState.dx < 0
          );
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
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        },
      }),
    ).current;

    return (
      <View style={{ overflow: "hidden" }}>
        <View
          style={{
            position: "absolute",
            right: isMe ? undefined : 8,
            left: isMe ? 8 : undefined,
            top: 0,
            bottom: 0,
            justifyContent: "center",
          }}
        >
          <Feather name="corner-up-left" size={20} color={themeTextSecondary} />
        </View>
        <Animated.View
          style={{ transform: [{ translateX }] }}
          {...panResponder.panHandlers}
        >
          {children}
        </Animated.View>
      </View>
    );
  },
);


const WAVEFORM_HEIGHTS = [
  0.3, 0.5, 0.8, 0.6, 1.0, 0.7, 0.4, 0.9, 0.5, 0.7,
  1.0, 0.6, 0.4, 0.8, 0.5, 0.9, 0.6, 0.3, 0.7, 0.5,
  0.8, 1.0, 0.4, 0.6, 0.9, 0.5, 0.7, 0.3, 0.8, 0.6,
];

const WavyWaveform = ({
  isPlaying,
  progress,
  isMe,
  theme,
  duration,
}: {
  isPlaying: boolean;
  progress: number;
  isMe: boolean;
  theme: any;
  duration?: number;
}) => {
  const BAR_COUNT = 30;
  const [animations] = useState(() =>
    WAVEFORM_HEIGHTS.slice(0, BAR_COUNT).map((h) => new Animated.Value(h)),
  );
  const loopsRef = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    if (isPlaying) {
      loopsRef.current.forEach((l) => l.stop());
      loopsRef.current = animations.map((anim, i) => {
        const baseH = WAVEFORM_HEIGHTS[i % WAVEFORM_HEIGHTS.length];
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: baseH * (0.3 + Math.random() * 0.7) + 0.4,
              duration: 200 + (i % 5) * 60,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: baseH * 0.6,
              duration: 180 + (i % 4) * 50,
              useNativeDriver: false,
            }),
          ]),
        );
        loop.start();
        return loop;
      });
    } else {
      loopsRef.current.forEach((l) => l.stop());
      loopsRef.current = [];
      animations.forEach((anim, i) => {
        Animated.spring(anim, {
          toValue: WAVEFORM_HEIGHTS[i % WAVEFORM_HEIGHTS.length],
          useNativeDriver: false,
          tension: 60,
          friction: 8,
        }).start();
      });
    }
    return () => {
      loopsRef.current.forEach((l) => l.stop());
      loopsRef.current = [];
    };
  }, [isPlaying]);

  const formatDuration = (secs?: number) => {
    if (!secs) return "";
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 28,
          gap: 2,
          flex: 1,
          overflow: "hidden",
        }}
      >
        {animations.map((anim, i) => {
          const barProgress = i / BAR_COUNT;
          const isActive = barProgress <= progress;
          const isPast = progress > 0 && barProgress < progress;
          return (
            <Animated.View
              key={i}
              style={{
                width: 3,
                borderRadius: 2,
                height: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [3, 22],
                }),
                backgroundColor: isPast || isActive
                  ? isMe ? "rgba(255,255,255,0.95)" : theme.primary
                  : isMe ? "rgba(255,255,255,0.35)" : theme.border + "AA",
              }}
            />
          );
        })}
      </View>
      {duration !== undefined && duration > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
          <ThemedText style={{ fontSize: 10, color: isMe ? "rgba(255,255,255,0.6)" : theme.textSecondary }}>
            {progress > 0 ? formatDuration(progress * duration) : "0:00"}
          </ThemedText>
          <ThemedText style={{ fontSize: 10, color: isMe ? "rgba(255,255,255,0.6)" : theme.textSecondary }}>
            {formatDuration(duration)}
          </ThemedText>
        </View>
      )}
    </View>
  );
};


export default function ChatDetailScreen({
  navigation,
  route,
}: ChatDetailScreenProps) {
  const {
    theme,
    isDark,
    setThemeMode,
    chatBubbleStyle,
    hapticFeedback: hapticEnabled,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { userId, userName, userPhoto } = route.params as any;
  const { get, post, put, patch } = useApi();

  const myId = useMemo(() => (user as any)?._id || user?.id || "", [user]);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isOtherRecording, setIsOtherRecording] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [otherUserVerified, setOtherUserVerified] = useState(false);
  const [lastSeenDate, setLastSeenDate] = useState<Date | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messageSkip, setMessageSkip] = useState(0);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState<string | null>(null);
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const [chatTheme, setChatTheme] = useState<string>("default");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>(AI_SUGGESTIONS);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const playingAudioIdRef = useRef<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<number>(0);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [viewingVideo, setViewingVideo] = useState<string | null>(null);
  const [failedThumbnails, setFailedThumbnails] = useState<Set<string>>(new Set());

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showTranslateModal, setShowTranslateModal] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const [savedTranslateLang, setSavedTranslateLang] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editText, setEditText] = useState("");
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [translateTargetLang, setTranslateTargetLang] = useState("");
  const [screenshotProtection, setScreenshotProtection] = useState(false);
  const [viewOnceMode, setViewOnceMode] = useState(false);
  const viewOnceModeRef = React.useRef(false);
  const [viewOnceSent, setViewOnceSent] = useState(false);
  const [openedViewOnceIds, setOpenedViewOnceIds] = useState<Set<string>>(new Set());
  const [viewOnceViewerActive, setViewOnceViewerActive] = useState(false);
  const viewOnceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  
  const setViewOnceModeSync = (val: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof val === 'function' ? val(viewOnceModeRef.current) : val;
    viewOnceModeRef.current = next;
    setViewOnceMode(next);
  };

  // Load draft + saved translation language on mount
  useEffect(() => {
    const loadDraft = async () => {
      if (!userId) return;
      try {
        const [savedDraft, savedLang] = await Promise.all([
          AsyncStorage.getItem(`chat_draft_${userId}`),
          AsyncStorage.getItem("@afroconnect_translate_lang"),
        ]);
        if (savedDraft) setMessage(savedDraft);
        if (savedLang) setSavedTranslateLang(savedLang);
      } catch (error) {
        console.error("Failed to load draft:", error);
      }
    };
    loadDraft();
  }, [userId]);

  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingDurationRef = useRef<number>(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const htmlAudioRef = useRef<any>(null);
  const sendMessageRef = useRef<any>(null);
  // Keep matchId accessible in screenshot callback without stale closure
  const matchIdRef = useRef<string | null>(null);

  const [typingDotAnim1] = useState(new Animated.Value(0));
  const [typingDotAnim2] = useState(new Animated.Value(0));
  const [typingDotAnim3] = useState(new Animated.Value(0));
  // FIX: only declared once here â€” was also incorrectly inside WavyWaveform
  const [recordingPulse] = useState(new Animated.Value(1));

  useFocusEffect(
    useCallback(() => {
      // Tell the UnreadContext that the user is viewing a chat — suppress badge counting
      setChatScreenOpen(true);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => {
        clearTimeout(timer);
        // User left the chat screen — badge counting can resume
        setChatScreenOpen(false);
      };
    }, [])
  );

  // Typing dots animation
  useEffect(() => {
    if (isTyping) {
      const createDotAnimation = (anim: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
          ]),
        );
      const a1 = createDotAnimation(typingDotAnim1, 0);
      const a2 = createDotAnimation(typingDotAnim2, 150);
      const a3 = createDotAnimation(typingDotAnim3, 300);
      a1.start(); a2.start(); a3.start();
      return () => {
        a1.stop(); a2.stop(); a3.stop();
        typingDotAnim1.setValue(0); typingDotAnim2.setValue(0); typingDotAnim3.setValue(0);
      };
    }
  }, [isTyping]);

  // Recording pulse animation
  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingPulse, { toValue: 1.4, duration: 600, useNativeDriver: true }),
          Animated.timing(recordingPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      return () => { pulse.stop(); recordingPulse.setValue(1); };
    }
  }, [isRecording]);

  // Track keyboard visibility — removes bottom-inset gap and scrolls to latest message
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
      if (Platform.OS === "android") {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Web keyboard
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const vv = typeof window !== "undefined" ? (window as any).visualViewport : null;
    if (!vv) return;
    const handleResize = () => {
      const kbHeight = Math.max(0, window.innerHeight - vv.height);
      if (kbHeight > 50) setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    };
    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    return () => { vv.removeEventListener("resize", handleResize); vv.removeEventListener("scroll", handleResize); };
  }, []);

  // Load chat theme
  useEffect(() => {
    AsyncStorage.getItem(`chat_theme_${userId}`)
      .then((v) => { if (v) setChatTheme(v); })
      .catch(() => {});
  }, [userId]);

  // Screenshot protection
  useEffect(() => {
    let subscription: ScreenCapture.Subscription | null = null;
    const setupListener = async () => {
      if (Platform.OS !== "web") {
        try {
          subscription = ScreenCapture.addScreenshotListener(async () => {
            // Only notify if protection is OFF (if it's ON, screenshot is already blocked by OS)
            if (!screenshotProtection && matchIdRef.current && token) {
              const systemMsg = {
                _id: `screenshot_${Date.now()}`,
                content: "📸 A screenshot was taken!",
                type: "system",
                sender: myId,
                matchId: matchIdRef.current,
                createdAt: new Date().toISOString(),
                status: "sent",
              };
              setMessages((prev) => [...prev, systemMsg as any]);
              post(`/chat/${matchIdRef.current}/message`, { content: "📸 A screenshot was taken!", type: "system" }, token).catch(() => {});
            }
          });
          if (screenshotProtection) {
            await ScreenCapture.preventScreenCaptureAsync();
          } else {
            await ScreenCapture.allowScreenCaptureAsync();
          }
        } catch (e) {
          console.log("Screenshot listener error:", e);
        }
      }
    };
    setupListener();
    return () => {
      if (subscription) subscription.remove();
      // Only lift the protection on cleanup if it is NOT enabled.
      // When protection is ON it should remain active app-wide even after navigating away.
      if (Platform.OS !== "web" && !screenshotProtection) {
        try { ScreenCapture.allowScreenCaptureAsync(); } catch (e) {}
      }
    };
  }, [screenshotProtection, user, matchId]);

  useEffect(() => {
    if (!matchId) return;
    const handleProtectionUpdate = (data: any) => {
      if (data.chatId === matchId) {
        setScreenshotProtection(data.enabled);
        if (Platform.OS !== "web") {
          try {
            if (data.enabled) ScreenCapture.preventScreenCaptureAsync();
            else ScreenCapture.allowScreenCaptureAsync();
          } catch (e) {}
        }
      }
    };
    socketService.on("chat:screenshot-protection-updated", handleProtectionUpdate);
    return () => socketService.off("chat:screenshot-protection-updated");
  }, [matchId, myId, userName]);

  const toggleScreenshotProtection = useCallback(async () => {
    const newValue = !screenshotProtection;
    setScreenshotProtection(newValue);
    if (Platform.OS !== "web") {
      try {
        if (newValue) await ScreenCapture.preventScreenCaptureAsync();
        else await ScreenCapture.allowScreenCaptureAsync();
      } catch (e) {}
    }
    if (matchId) {
      socketService.emit("chat:screenshot-protection", { chatId: matchId, enabled: newValue, userId: myId });
    }
    Alert.alert(
      newValue ? "Screenshot Protection On" : "Screenshot Protection Off",
      newValue ? "Screenshots and screen recording are now blocked for both users in this chat." : "Screenshot protection has been disabled for this chat.",
    );
  }, [screenshotProtection, matchId, myId]);

  const saveChatTheme = async (themeId: string) => {
    setChatTheme(themeId);
    await AsyncStorage.setItem(`chat_theme_${userId}`, themeId);
    setShowThemeModal(false);
  };

  const getStatusText = useCallback(() => {
    if (isOtherRecording) return "recording voice...";
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
  }, [isOnline, isTyping, isOtherRecording, lastSeenDate]);

  useEffect(() => {
    if (!userId) return;
    socketService.onUserStatus((data: any) => {
      if (data.userId === userId) {
        const online = data.isOnline === true || data.status === "online";
        setIsOnline(online);
        if (!online) setLastSeenDate(new Date());
      }
    });
    return () => socketService.off("user:status");
  }, [userId]);

  const handleVoiceCall = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("VoiceCall" as any, { userId, userName, userPhoto });
  }, [navigation, userId, userName, userPhoto]);

  const handleVideoCall = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("VideoCall" as any, { userId, userName, userPhoto });
  }, [navigation, userId, userName, userPhoto]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // â”€â”€â”€ Load chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadChat = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const matchesResponse = await get<{ matches: any[] }>("/match/my-matches", token);
      if (matchesResponse.success && matchesResponse.data) {
        const match = matchesResponse.data.matches.find((m: any) =>
          m.users.some((u: any) => u._id === userId || u.id === userId),
        );
        if (match) {
          const mId = match._id || match.id;
          setMatchId(mId);
          matchIdRef.current = mId;

          if (match.screenshotProtection) {
            setScreenshotProtection(true);
            if (Platform.OS !== "web") {
              try { await ScreenCapture.preventScreenCaptureAsync(); } catch (e) {}
            }
          }
          const otherUser = match.users.find((u: any) => u._id === userId || u.id === userId);
          if (otherUser) {
            setIsOnline(otherUser.onlineStatus === "online" || false);
            setOtherUserVerified(otherUser.verified || false);
            if (otherUser.lastActive) setLastSeenDate(new Date(otherUser.lastActive));
          }

          // FIX: load ALL messages with high limit
          const messagesResponse = await get<{ messages: Message[]; pagination: any }>(
            `/chat/${mId}?limit=1000`,
            token,
          );
          if (messagesResponse.success && messagesResponse.data) {
            setMessages(messagesResponse.data.messages || []);
            const pagination = messagesResponse.data.pagination;
            if (pagination) {
              setHasMoreMessages(pagination.hasMore);
              setMessageSkip(pagination.limit);
            }
          }

          // Mark all as read on open
          put(`/chat/${mId}/read`, {}, token).catch(() => {});
        }
      }
    } catch (error) {
      console.error("Chat load error:", error);
    } finally {
      setLoading(false);
    }
  }, [token, userId, get, put]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  // Load older messages when user scrolls to top
  const loadMoreMessages = useCallback(async () => {
    if (!matchId || !token || loadingMore || !hasMoreMessages) return;
    setLoadingMore(true);
    try {
      const response = await get<{ messages: Message[]; pagination: any }>(
        `/chat/${matchId}?limit=500&skip=${messageSkip}`,
        token,
      );
      if (response.success && response.data) {
        const older = response.data.messages || [];
        setMessages((prev) => [...older, ...prev]);
        const pagination = response.data.pagination;
        if (pagination) {
          setHasMoreMessages(pagination.hasMore);
          setMessageSkip((prev) => prev + older.length);
        }
      }
    } catch (error) {
      console.error("Load more error:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [matchId, token, loadingMore, hasMoreMessages, messageSkip, get]);

  // â”€â”€â”€ Socket listeners â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!matchId) return;

    DeviceEventEmitter.emit("chat:read-local", matchId);
    socketService.joinChat(matchId);
    socketService.markMessagesRead({ chatId: matchId, userId: myId });

    // â”€â”€ New message â”€â”€
    const handleNewMessage = (data: any) => {
      const msg = data.message || data;
      const msgMatchId = data.matchId || msg.matchId;
      if (msgMatchId !== matchId && msg.matchId !== matchId) return;

      const senderId = typeof msg.sender === "string" ? msg.sender : msg.sender?._id;
      if (String(senderId) === String(myId)) return; // ignore own echo

      setMessages((prev) => {
        if (prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      // Since we are actively in the chat, immediately mark as read
      // This makes ticks turn blue on sender's side without them refreshing
      socketService.markMessagesRead({ chatId: matchId, userId: myId, messageId: msg._id });
      put(`/chat/${matchId}/read`, {}, token || "").catch(() => {});
      DeviceEventEmitter.emit("chat:read-local", matchId);
    };

    // â”€â”€ Delivered: sender's single tick â†’ double grey tick â”€â”€
    // FIX: this listener was completely missing in the original
    const handleMessageDelivered = (data: any) => {
      if (!data.messageId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId && m.status === "sent"
            ? { ...m, status: "delivered" }
            : m,
        ),
      );
    };

    // â”€â”€ Read receipt: double grey â†’ double blue â”€â”€
    // FIX: removed the dangerous `|| (!msgMatchId && !readByUserId)` fallthrough
    // FIX: works for ALL users not just premium (the backend now emits for everyone)
    const handleMessagesRead = (data: any) => {
      const msgMatchId = data.matchId || data.chatId || data.roomId;
      const readByUserId = data.userId || data.readBy;

      // Only process read receipts from the OTHER user.
      // When we open the chat, the server emits userId === myId.
      // We ignore that  our own read action must not flip our sent messages to "seen".
      if (!readByUserId || String(readByUserId) === String(myId)) return;

      const matchesByRoom = msgMatchId && msgMatchId === matchId;
      const matchesByUser = String(readByUserId) === String(userId);
      if (!matchesByRoom && !matchesByUser) return;

      setMessages((prev) =>
        prev.map((m) => {
          const senderId = typeof m.sender === "string" ? m.sender : m.sender?._id;
          // Only upgrade MY sent messages, never downgrade
          if (String(senderId) === String(myId) && m.status !== "seen") {
            return { ...m, status: "seen" };
          }
          return m;
        }),
      );
    };

    const handleTyping = (data: any) => {
      const typingUserId = data.userId || data.senderId;
      if (typingUserId && String(typingUserId) !== String(myId)) {
        setIsTyping(true);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
      }
    };

    const handleRecordingVoice = (data: any) => {
      if (data.userId && String(data.userId) !== String(myId)) {
        setIsOtherRecording(!!data.isRecording);
      }
    };

    const handleMessageUpdated = (data: any) => {
      if (data.message && data.message._id) {
        setMessages((prev) =>
          prev.map((m) => (m._id === data.message._id ? { ...m, ...data.message } : m)),
        );
      }
    };

    const handleMessageDeleted = (data: any) => {
      if (data.messageId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId
              ? { ...m, content: "This message was deleted", text: "This message was deleted", type: "system" as const, deletedForEveryone: true }
              : m,
          ),
        );
      }
    };

    socketService.on("chat:new-message", handleNewMessage);
    socketService.on("message:new", handleNewMessage);
    socketService.on("chat:message-delivered", handleMessageDelivered); // FIX: was missing
    socketService.on("chat:messages-read", handleMessagesRead);
    socketService.on("chat:message-read", handleMessagesRead);
    socketService.on("chat:read", handleMessagesRead);
    socketService.on("chat:message-updated", handleMessageUpdated);
    socketService.on("chat:message-deleted", handleMessageDeleted);
    socketService.on("chat:message-edited", (data: any) => {
      if (data.messageId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === data.messageId
              ? { ...m, content: data.content, edited: true, editedAt: data.editedAt }
              : m
          )
        );
      }
    });
    socketService.on("chat:user-typing", handleTyping);
    socketService.on("chat:recording-voice", handleRecordingVoice);
    socketService.on("message:reaction", (data: { messageId: string; reactions: MessageReaction[] }) => {
      setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, reactions: data.reactions } : m));
    });

    return () => {
      socketService.off("chat:new-message");
      socketService.off("message:new");
      socketService.off("chat:message-delivered");
      socketService.off("chat:messages-read");
      socketService.off("chat:message-read");
      socketService.off("chat:read");
      socketService.off("chat:message-updated");
      socketService.off("chat:message-deleted");
      socketService.off("chat:message-edited");
      socketService.off("message:reaction");
      socketService.off("chat:user-typing");
      socketService.off("chat:recording-voice");
    };
  }, [matchId, userId, myId, token, put]);

  // â”€â”€â”€ Send message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sendMessage = async (content?: string, type: string = "text", extraData?: any) => {
    const textToSend = content || message.trim();
    if (!textToSend && type === "text") return;
    if (!matchId || !token || sending) return;

    setMessage("");
    setSending(true);
    if (userId) AsyncStorage.removeItem(`chat_draft_${userId}`).catch(() => {});
    setShowEmojiPicker(false);
    setShowAISuggestions(false);

    let replyData: any = undefined;
    if (replyingTo) {
      const replySenderId = typeof replyingTo.sender === "string" ? replyingTo.sender : replyingTo.sender?._id;
      replyData = {
        messageId: replyingTo._id,
        content: replyingTo.content || replyingTo.text || "",
        type: replyingTo.type,
        senderName: String(replySenderId) === String(myId) ? "You" : userName,
      };
    }

    const tempMessage: Message = {
      _id: `temp_${Date.now()}`,
      sender: myId,
      content: textToSend,
      type: type as any,
      createdAt: new Date().toISOString(),
      status: "sent",
      ...(replyData ? { replyTo: replyData } : {}),
      ...extraData,
    };
    setMessages((prev) => [...prev, tempMessage]);
    setReplyingTo(null);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await post<{ message: Message }>(
        `/chat/${matchId}/message`,
        { content: textToSend, type, ...(replyData ? { replyTo: replyData } : {}), ...extraData },
        token,
      );
      if (response.success && response.data?.message) {
        // FIX: preserve "sent" status on replace â€” socket events will upgrade it
        setMessages((prev) =>
          prev.map((m) =>
            m._id === tempMessage._id ? { ...response.data!.message, status: "sent" } : m,
          ),
        );
      }
    } catch (error) {
      console.error("Send error:", error);
      setMessages((prev) => prev.filter((m) => m._id !== tempMessage._id));
      Alert.alert("Error", "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => { sendMessageRef.current = sendMessage; }, [sendMessage]);

  const handleMarkViewOnce = (messageId: string) => {
    if (!token || openedViewOnceIds.has(messageId)) return;
    // Optimistic update — mark as viewed immediately so placeholder shows right away
    setOpenedViewOnceIds(prev => new Set(prev).add(messageId));
    // Fire-and-forget API call in background
    fetch(`${getApiBaseUrl()}/api/chat/messages/${messageId}/view-once`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    }).catch(e => console.error("View once mark error:", e));
  };

  const handleTypingIndicator = useCallback(() => {
    if (matchId && token) {
      socketService.emit("chat:typing", { chatId: matchId, userId: myId, isTyping: true });
    }
  }, [matchId, token, myId]);

  const handleEmojiSelect = (emoji: string) => setMessage((prev) => prev + emoji);

  // â”€â”€â”€ Media pickers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handlePickImage = async () => {
    setShowAttachmentMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as ImagePicker.MediaType[],
      quality: 0.8,
      allowsEditing: true,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const formData = new FormData();
        formData.append("image", { uri: result.assets[0].uri, type: "image/jpeg", name: "chat_image.jpg" } as any);
        const uploadResponse = await fetch(`${getApiBaseUrl()}/api/upload/chat-image`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const uploadData = await uploadResponse.json();
        if (uploadData.success && uploadData.url) {
          const isVOImg = viewOnceModeRef.current;
          await sendMessage("📷 Photo", "image", { imageUrl: uploadData.url, ...(isVOImg ? { viewOnce: true } : {}) });
          if (isVOImg) { setViewOnceModeSync(false); setViewOnceSent(true); setTimeout(() => setViewOnceSent(false), 2500); }
        } else Alert.alert("Upload Failed", uploadData.message || "Could not upload image. Please try again.");
      } catch (error) {
        console.error("Image upload error:", error);
        Alert.alert("Error", "Failed to upload image. Check your connection.");
      }
    }
  };

  const handlePickVideo = async () => {
    setShowAttachmentMenu(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"] as ImagePicker.MediaType[],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const formData = new FormData();
        formData.append("video", { uri: result.assets[0].uri, type: "video/mp4", name: "chat_video.mp4" } as any);
        const uploadResponse = await fetch(`${getApiBaseUrl()}/api/upload/chat-video`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const uploadData = await uploadResponse.json();
        if (uploadData.success && uploadData.url) {
          const isVOVid = viewOnceModeRef.current;
          await sendMessage("🎬 Video", "video", { videoUrl: uploadData.url, ...(isVOVid ? { viewOnce: true } : {}) });
          if (isVOVid) { setViewOnceModeSync(false); setViewOnceSent(true); setTimeout(() => setViewOnceSent(false), 2500); }
        } else Alert.alert("Upload Failed", uploadData.message || "Could not upload video. Please try again.");
      } catch (error) {
        console.error("Video upload error:", error);
        Alert.alert("Error", "Failed to upload video. Check your connection.");
      }
    }
  };

  const handleTakePhoto = async () => {
    setShowAttachmentMenu(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert("Permission Needed", "Camera permission is required to take photos"); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, base64: true });
    if (!result.canceled && result.assets[0]) {
      try {
        const formData = new FormData();
        formData.append("image", { uri: result.assets[0].uri, type: "image/jpeg", name: "chat_photo.jpg" } as any);
        const uploadResponse = await fetch(`${getApiBaseUrl()}/api/upload/chat-image`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const uploadData = await uploadResponse.json();
        if (uploadData.success && uploadData.url) {
          const isVOImg = viewOnceModeRef.current;
          await sendMessage("📷 Photo", "image", { imageUrl: uploadData.url, ...(isVOImg ? { viewOnce: true } : {}) });
          if (isVOImg) { setViewOnceModeSync(false); setViewOnceSent(true); setTimeout(() => setViewOnceSent(false), 2500); }
        }
      } catch (error) {
        Alert.alert("Error", "Failed to upload photo");
      }
    }
  };

  const handleShareLocation = async () => {
    setShowAttachmentMenu(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission Denied", "Location permission is required to share your location"); return; }
      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;
      let address = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      try {
        const [geocode] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (geocode) address = [geocode.street, geocode.city, geocode.country].filter(Boolean).join(", ");
      } catch (e) {}
      await sendMessage(`📍 ${address}`, "location", { latitude, longitude, address });
    } catch (error) {
      Alert.alert("Error", "Could not get your location");
    }
  };

  // â”€â”€â”€ Recording â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const startRecording = async () => {
    if (Platform.OS === "web") { Alert.alert("Not Supported", "Voice recording is only available in the mobile app"); return; }
    if (isRecording || recordingRef.current) return;
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) { Alert.alert("Permission Needed", "Microphone permission is required"); return; }
      if (soundRef.current) {
        try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch (_) {}
        soundRef.current = null;
        playingAudioIdRef.current = null;
        setPlayingAudioId(null);
        setAudioProgress(0);
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      if (matchId) socketService.emit("chat:recording-voice", { chatId: matchId, userId: myId, isRecording: true });
      recordingIntervalRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error("Recording error:", error);
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
      Alert.alert("Error", "Could not start recording. Please try again.");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) { setIsRecording(false); return; }
    try {
      if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
      const recording = recordingRef.current;
      const duration = recordingDurationRef.current;
      recordingRef.current = null;
      setIsRecording(false);
      if (matchId) socketService.emit("chat:recording-voice", { chatId: matchId, userId: myId, isRecording: false });
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
      const uri = recording.getURI();
      if (uri && duration >= 1) {
        try {
          const ext = uri.split(".").pop()?.toLowerCase() || "m4a";
          const mimeMap: Record<string, string> = { m4a: "audio/m4a", mp4: "audio/mp4", caf: "audio/x-caf", wav: "audio/wav", "3gp": "audio/3gpp", aac: "audio/aac", webm: "audio/webm" };
          const mimeType = mimeMap[ext] || (Platform.OS === "android" ? "application/octet-stream" : "audio/m4a");
          const formData = new FormData();
          formData.append("audio", { uri, type: mimeType, name: `voice_message.${ext}` } as any);
          formData.append("duration", duration.toString());
          const uploadResponse = await fetch(`${getApiBaseUrl()}/api/upload/audio`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          const uploadData = await uploadResponse.json();
          if (uploadData.success && uploadData.url) await sendMessage(`🎤 Voice message (${duration}s)`, "audio", { audioUrl: uploadData.url, audioDuration: duration });
          else Alert.alert("Upload Failed", uploadData.message || "Could not upload voice message");
        } catch (error) {
          console.error("Voice upload error:", error);
          Alert.alert("Error", "Failed to upload voice message");
        }
      } else if (uri && duration < 1) {
        Alert.alert("Too Short", "Voice message must be at least 1 second long");
      }
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error("Stop recording error:", error);
      setIsRecording(false);
      setRecordingDuration(0);
      recordingDurationRef.current = 0;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
    }
  };

  const cancelRecording = async () => {
    if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
    if (!recordingRef.current) { setIsRecording(false); setRecordingDuration(0); recordingDurationRef.current = 0; return; }
    try {
      if (Platform.OS !== "web") {
        const recording = recordingRef.current;
        recordingRef.current = null;
        await recording.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true }).catch(() => {});
      } else {
        recordingRef.current = null;
      }
    } catch (error) { console.log("Cancel recording cleanup:", error); }
    if (matchId) socketService.emit("chat:recording-voice", { chatId: matchId, userId: myId, isRecording: false });
    setIsRecording(false);
    setRecordingDuration(0);
    recordingDurationRef.current = 0;
  };

  // â”€â”€â”€ Audio playback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const updatePlayingId = (id: string | null) => {
    playingAudioIdRef.current = id;
    setPlayingAudioId(id);
  };

  const playAudio = async (audioUrl: string, messageId: string) => {
    try {
      if (!audioUrl || audioUrl.trim() === "") { Alert.alert("Error", "No audio URL available for this voice message"); return; }
      const currentId = playingAudioIdRef.current;

      if (htmlAudioRef.current) {
        if (currentId === messageId && !htmlAudioRef.current.paused) { htmlAudioRef.current.pause(); updatePlayingId("paused:" + messageId); return; }
        if (currentId === "paused:" + messageId && htmlAudioRef.current.paused) { htmlAudioRef.current.play(); updatePlayingId(messageId); return; }
        htmlAudioRef.current.pause(); htmlAudioRef.current.src = ""; htmlAudioRef.current = null;
      }

      if (soundRef.current) {
        try {
          const status: any = await soundRef.current.getStatusAsync();
          if (status.isLoaded) {
            if (currentId === messageId && status.isPlaying) { await soundRef.current.pauseAsync(); updatePlayingId("paused:" + messageId); return; }
            if (currentId === "paused:" + messageId && !status.isPlaying) { await soundRef.current.playAsync(); updatePlayingId(messageId); return; }
          }
        } catch (e) { console.log("Status check error:", e); }
        try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch (cleanupErr) {}
        soundRef.current = null;
      }

      updatePlayingId(null);
      setAudioProgress(0);

      const onStatus = (status: any) => {
        if (status.isLoaded) {
          if (status.durationMillis > 0) setAudioProgress(status.positionMillis / status.durationMillis);
          if (status.didJustFinish) {
            updatePlayingId(null); setAudioProgress(0);
            if (soundRef.current) { soundRef.current.unloadAsync().catch(() => {}); soundRef.current = null; }
          }
        }
      };

      if (Platform.OS === "web") {
        try {
          await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: true });
          const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true, progressUpdateIntervalMillis: 100 }, onStatus);
          soundRef.current = sound; updatePlayingId(messageId);
        } catch (expoError) {
          console.log("expo-av failed on web, trying HTML5 Audio fallback:", expoError);
          try {
            const htmlAudio = new window.Audio(audioUrl);
            htmlAudioRef.current = htmlAudio;
            htmlAudio.onended = () => { updatePlayingId(null); setAudioProgress(0); };
            htmlAudio.ontimeupdate = () => { if (htmlAudio.duration > 0) setAudioProgress(htmlAudio.currentTime / htmlAudio.duration); };
            htmlAudio.onerror = () => { updatePlayingId(null); setAudioProgress(0); Alert.alert("Playback Error", "Could not play this voice message. The audio format may not be supported."); };
            await htmlAudio.play(); updatePlayingId(messageId);
          } catch (htmlError: any) {
            console.error("HTML5 Audio fallback also failed:", htmlError);
            Alert.alert("Playback Error", `Could not play voice message: ${htmlError.message || "Unknown error"}`);
          }
        }
        return;
      }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, staysActiveInBackground: true });
      const { sound } = await Audio.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true, progressUpdateIntervalMillis: 100 }, onStatus);
      soundRef.current = sound; updatePlayingId(messageId);
    } catch (error: any) {
      console.error("Audio playback error for URL:", audioUrl, error);
      Alert.alert("Playback Error", `Could not play voice message: ${error.message || "Unknown error"}`);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) { soundRef.current.unloadAsync().catch(() => {}); soundRef.current = null; }
      if (htmlAudioRef.current) { htmlAudioRef.current.pause(); htmlAudioRef.current.src = ""; htmlAudioRef.current = null; }
      if (recordingRef.current) {
        const rec = recordingRef.current; recordingRef.current = null;
        rec.stopAndUnloadAsync().then(() => Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true })).catch(() => {});
      }
      if (recordingIntervalRef.current) { clearInterval(recordingIntervalRef.current); recordingIntervalRef.current = null; }
      recordingDurationRef.current = 0;
    };
  }, []);

  // â”€â”€â”€ Save media â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const saveImage = async (imageUrl: string) => {
    try {
      if (Platform.OS === "web") { const link = document.createElement("a"); link.href = imageUrl; link.download = `afroconnect_${Date.now()}.jpg`; link.target = "_blank"; link.click(); return; }
      const fileUri = `${FileSystem.cacheDirectory}afroconnect_${Date.now()}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
      if (downloadResult.status !== 200) { Alert.alert("Error", "Failed to download image."); return; }
      try { const { status } = await MediaLibrary.requestPermissionsAsync(); if (status === "granted") { await MediaLibrary.saveToLibraryAsync(downloadResult.uri); Alert.alert("Saved", "Image saved to your gallery."); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); return; } } catch (_permError) {}
      if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(downloadResult.uri, { mimeType: "image/jpeg", dialogTitle: "Save Image" }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
      else Alert.alert("Error", "Cannot save images in this environment. Try a development build.");
    } catch (error) { console.error("Save image error:", error); Alert.alert("Error", "Could not save image."); }
  };

  const saveVideo = async (url: string) => {
    try {
      if (Platform.OS === "web") { const link = document.createElement("a"); link.href = url; link.download = `afroconnect_${Date.now()}.mp4`; link.target = "_blank"; link.click(); return; }
      const fileUri = `${FileSystem.cacheDirectory}afroconnect_${Date.now()}.mp4`;
      const downloadResult = await FileSystem.downloadAsync(url, fileUri);
      if (downloadResult.status !== 200) { Alert.alert("Error", "Failed to download video."); return; }
      try { const { status } = await MediaLibrary.requestPermissionsAsync(); if (status === "granted") { await MediaLibrary.saveToLibraryAsync(downloadResult.uri); Alert.alert("Saved!", "Video saved to your gallery"); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); return; } } catch (_permError) {}
      if (await Sharing.isAvailableAsync()) { await Sharing.shareAsync(downloadResult.uri, { mimeType: "video/mp4", dialogTitle: "Save Video" }); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
      else Alert.alert("Error", "Cannot save videos in this environment. Try a development build.");
    } catch (error) { console.error("Save video error:", error); Alert.alert("Error", "Failed to save video"); }
  };

  // â”€â”€â”€ AI suggestions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchAISuggestions = async () => {
    if (!token) return;
    setShowAISuggestions(true);
    try {
      const response = await post<{ suggestions: string[] }>(
        "/ai/chat-suggestions",
        { recipientName: userName, context: messages.slice(-5).map((m) => m.content).join(" ") },
        token,
      );
      if (response.success && response.data?.suggestions) setAiSuggestions(response.data.suggestions);
    } catch (error) { setAiSuggestions(AI_SUGGESTIONS); }
  };

  // â”€â”€â”€ Block / Report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleBlockUser = async () => {
    setShowOptionsMenu(false);
    Alert.alert("Block User", `Are you sure you want to block ${userName}? They won't be able to contact you anymore.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block", style: "destructive", onPress: async () => {
          try {
            const response = await post(`/block/${userId}`, {}, token || "");
            if (response.success) { Alert.alert("Blocked", `${userName} has been blocked`); navigation.goBack(); }
          } catch (error) { Alert.alert("Error", "Failed to block user"); }
        },
      },
    ]);
  };

  // â”€â”€â”€ Message actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleMessageLongPress = useCallback((msg: Message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(msg);
    setShowMessageMenu(true);
  }, []);

  const handleReply = useCallback(() => {
    const msg = selectedMessage;
    setShowMessageMenu(false);
    setSelectedMessage(null);
    if (msg) setReplyingTo(msg);
  }, [selectedMessage]);

  const handleDeleteForMe = useCallback(async () => {
    if (!selectedMessage || !token) return;
    setShowMessageMenu(false);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/chat/message/${selectedMessage._id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success || response.ok) setMessages((prev) => prev.filter((m) => m._id !== selectedMessage._id));
      else Alert.alert("Error", data.message || "Failed to delete message");
    } catch (error) { Alert.alert("Error", "Failed to delete message"); }
    setSelectedMessage(null);
  }, [selectedMessage, token]);

  const handleDeleteForEveryone = useCallback(async () => {
    if (!selectedMessage || !token) return;
    setShowMessageMenu(false);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/chat/message/${selectedMessage._id}?deleteForEveryone=true`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success || response.ok) {
        setMessages((prev) => prev.map((m) => m._id === selectedMessage._id ? { ...m, content: "This message was deleted", text: "This message was deleted", type: "system" as const, deletedForEveryone: true } : m));
      } else Alert.alert("Error", data.message || "Failed to delete message");
    } catch (error) { Alert.alert("Error", "Failed to delete message"); }
    setSelectedMessage(null);
  }, [selectedMessage, token]);

  const handleEditOpen = useCallback(() => {
    if (!selectedMessage) return;
    setShowMessageMenu(false);
    setEditText(selectedMessage.content || selectedMessage.text || "");
    setEditingMessage(selectedMessage);
    setShowEditModal(true);
  }, [selectedMessage]);

  const handleEditSubmit = useCallback(async () => {
    if (!editingMessage || !token || !editText.trim()) return;
    setSubmittingEdit(true);
    try {
      const response = await patch<{ message: any }>(
        `/chat/message/${editingMessage._id}`,
        { content: editText.trim() },
        token
      );
      if (response.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === editingMessage._id
              ? { ...m, content: editText.trim(), edited: true, editedAt: new Date().toISOString() }
              : m
          )
        );
        setShowEditModal(false);
        setEditingMessage(null);
        setEditText("");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert("Cannot edit", response.message || response.error || "Failed to edit message");
      }
    } catch {
      Alert.alert("Error", "Failed to edit message");
    } finally {
      setSubmittingEdit(false);
    }
  }, [editingMessage, token, editText, patch]);

  const handleTranslateOpen = useCallback(() => {
    setShowMessageMenu(false);
    setTranslatedText("");
    setTranslateTargetLang(savedTranslateLang);
    setShowTranslateModal(true);
  }, [savedTranslateLang]);

  const handleTranslate = useCallback(async (targetLanguage: string) => {
    if (!selectedMessage || !token) return;
    const textToTranslate = selectedMessage.content || selectedMessage.text || "";
    if (!textToTranslate) return;
    setTranslating(true);
    try {
      const response = await post<{ translatedText: string }>("/ai/translate", { text: textToTranslate, targetLanguage, sourceLanguage: "auto" }, token);
      if (response.success && response.data?.translatedText) {
        setTranslatedText(response.data.translatedText);
        setSavedTranslateLang(targetLanguage);
        AsyncStorage.setItem("@afroconnect_translate_lang", targetLanguage).catch(() => {});
      } else Alert.alert("Error", response.message || "Translation failed");
    } catch (error) { Alert.alert("Error", (error as any)?.message || "Translation failed"); }
    finally { setTranslating(false); }
  }, [selectedMessage, token, post]);

  const handleCopyTranslation = useCallback(async () => {
    if (translatedText) { await Clipboard.setStringAsync(translatedText); Alert.alert("Copied", "Translation copied to clipboard"); }
  }, [translatedText]);

  const handleReact = useCallback(async (emoji: string) => {
    if (!selectedMessage || !matchId || !token) return;
    setShowReactionPicker(false);
    setShowMessageMenu(false);
    try {
      const response = await post<{ reactions: MessageReaction[] }>(
        `/chat/${matchId}/messages/${selectedMessage._id}/react`,
        { emoji },
        token
      );
      if (response.success && response.data?.reactions) {
        setMessages(prev => prev.map(m =>
          m._id === selectedMessage._id ? { ...m, reactions: response.data!.reactions } : m
        ));
      }
    } catch (e) {
      console.error('React error:', e);
    }
    setSelectedMessage(null);
  }, [selectedMessage, matchId, token, post]);

  const handleSubmitReport = async () => {
    if (!selectedReportReason) { Alert.alert("Select Reason", "Please select a reason for reporting"); return; }
    setSubmittingReport(true);
    try {
      const response = await post("/reports", { reportedUserId: userId, reason: selectedReportReason, description: reportDetails, matchId }, token || "");
      if (response.success) { setShowReportModal(false); setSelectedReportReason(null); setReportDetails(""); Alert.alert("Report Submitted", "Thank you for your report. Our team will review it shortly."); }
    } catch (error) { Alert.alert("Error", "Failed to submit report. Please try again."); }
    finally { setSubmittingReport(false); }
  };

  // â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  };

  const shouldShowDateHeader = (currentMsg: Message, prevMsg: Message | null) => {
    if (!prevMsg) return true;
    return new Date(currentMsg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSwipeReply = useCallback((item: Message) => setReplyingTo(item), []);

  const scrollToMessage = useCallback((messageId: string) => {
    const index = messages.findIndex(m => m._id === messageId);
    if (index === -1) return;
    try {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    } catch {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    setHighlightedMessageId(messageId);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 1500);
  }, [messages]);

  // â”€â”€â”€ Render message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderMessage = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const senderId = typeof item.sender === "string" ? item.sender : item.sender?._id;
      const isMe = String(senderId) === String(myId);
      const prevMessage = index > 0 ? messages[index - 1] : null;
      const showDateHeader = shouldShowDateHeader(item, prevMessage);
      const messageText = item.deletedForEveryone ? "This message was deleted" : item.content || item.text || "";

      return (
        <View>
          {showDateHeader && (
            <View style={styles.dateHeaderContainer}>
              <View style={[styles.dateHeader, { backgroundColor: "rgba(0,0,0,0.3)" }]}>
                <ThemedText style={[styles.dateHeaderText, { color: "#FFF" }]}>{formatDateHeader(item.createdAt)}</ThemedText>
              </View>
            </View>
          )}

          {item.type === "system" || item.type === "call" || item.deletedForEveryone ? (
            <View style={styles.systemMessageContainer}>
              <View style={[styles.systemMessage, { backgroundColor: "rgba(0,0,0,0.3)" }]}>
                <Ionicons
                  name={item.type === "call" ? "call" : item.deletedForEveryone ? "trash-outline" : "information-circle"}
                  size={14} color="#FFF" style={{ marginRight: 6 }}
                />
                <ThemedText style={styles.systemMessageText}>{messageText}</ThemedText>
              </View>
            </View>
          ) : (
            <SwipeableMessage item={item} isMe={isMe} onReply={handleSwipeReply} themeTextSecondary={theme.textSecondary}>
              <Pressable onLongPress={() => handleMessageLongPress(item)} delayLongPress={400}>
                <View style={[styles.messageRow, isMe ? styles.messageRowRight : styles.messageRowLeft]}>

                  <View
                    style={[
                      styles.messageBubble,
                      isMe ? styles.myBubble : styles.theirBubble,
                      { backgroundColor: isMe ? theme.primary : isDark ? "rgba(42,42,42,0.95)" : "rgba(255,255,255,0.95)" },
                      chatBubbleStyle === "sharp" && { borderRadius: 6 },
                      chatBubbleStyle === "sharp" && (isMe ? { borderBottomRightRadius: 2 } : { borderBottomLeftRadius: 2 }),
                      chatBubbleStyle === "minimal" && { borderRadius: 14, borderBottomRightRadius: isMe ? 14 : undefined, borderBottomLeftRadius: !isMe ? 14 : undefined },
                      (item.type === "image" || item.type === "video") && !messageText ? { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 0 } : {},
                      item.type === "location" ? { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 0 } : {},
                      item._id === highlightedMessageId && { borderWidth: 2, borderColor: isMe ? "rgba(255,255,255,0.7)" : theme.primary },
                    ]}
                  >
                    {item.replyTo && (
                      <Pressable
                        onPress={() => scrollToMessage(item.replyTo!.messageId)}
                        style={({ pressed }) => [
                          styles.replyPreviewInBubble,
                          { backgroundColor: isMe ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.06)", borderLeftColor: isMe ? "#FFF" : theme.primary, opacity: pressed ? 0.7 : 1 }
                        ]}
                      >
                        <ThemedText style={[styles.replyPreviewName, { color: isMe ? "rgba(255,255,255,0.9)" : theme.primary }]} numberOfLines={1}>{item.replyTo.senderName}</ThemedText>
                        <ThemedText style={[styles.replyPreviewText, { color: isMe ? "rgba(255,255,255,0.7)" : theme.textSecondary }]} numberOfLines={2}>
                          {item.replyTo.type === "image" ? "📷 Photo" : item.replyTo.type === "video" ? "🎬 Video" : item.replyTo.type === "audio" ? "🎤 Voice message" : item.replyTo.content}
                        </ThemedText>
                      </Pressable>
                    )}

                    {item.type === "image" && item.imageUrl && (() => {
                      const isSender = String(typeof item.sender === 'string' ? item.sender : item.sender?._id) === String(myId);
                      const isViewedByMe = isSender || openedViewOnceIds.has(item._id) || (item.viewOnceOpenedBy || []).some((id: string) => String(id) === String(myId));
                      if (item.viewOnce && !isSender && isViewedByMe) {
                        return (
                          <View style={[styles.viewOncePlaceholder, { backgroundColor: 'rgba(0,0,0,0.08)' }]}>
                            <Ionicons name="eye-off-outline" size={20} color="rgba(128,128,128,0.6)" />
                            <ThemedText style={[styles.viewOnceLabel, { color: theme.textSecondary }]}>Photo opened</ThemedText>
                          </View>
                        );
                      }
                      if (item.viewOnce && !isSender && !isViewedByMe) {
                        return (
                          <Pressable style={[styles.viewOnceTap, { backgroundColor: theme.primary + '18', borderColor: theme.primary + '40' }]}
                            onPress={() => {
                              handleMarkViewOnce(item._id);
                              setViewOnceViewerActive(true);
                              setViewingImage(item.imageUrl!);
                              if (viewOnceTimerRef.current) clearTimeout(viewOnceTimerRef.current);
                              viewOnceTimerRef.current = setTimeout(() => {
                                setViewingImage(null);
                                setViewOnceViewerActive(false);
                              }, 10000);
                            }}>
                            <Ionicons name="eye-outline" size={22} color={theme.primary} />
                            <ThemedText style={[styles.viewOnceLabel, { color: theme.primary }]}>Tap to view (once)</ThemedText>
                          </Pressable>
                        );
                      }
                      return (
                        <Pressable onPress={() => { setViewOnceViewerActive(false); setViewingImage(item.imageUrl!); }} onLongPress={!item.viewOnce ? () => saveImage(item.imageUrl!) : undefined}>
                          {item.viewOnce && isSender && (
                            <View style={styles.viewOnceSenderBadge}>
                              <Ionicons name="eye-outline" size={12} color="rgba(255,255,255,0.9)" />
                            </View>
                          )}
                          <Image source={{ uri: item.imageUrl }} style={styles.messageImage} contentFit="cover" />
                          {!item.viewOnce && (
                            <Pressable style={styles.imageSaveButton} onPress={() => saveImage(item.imageUrl!)}>
                              <Ionicons name="download-outline" size={16} color="#FFF" />
                            </Pressable>
                          )}
                        </Pressable>
                      );
                    })()}
                    {item.type === "video" && (item.videoUrl || item.imageUrl) && (() => {
                      const isSender = String(typeof item.sender === 'string' ? item.sender : item.sender?._id) === String(myId);
                      const isViewedByMe = isSender || openedViewOnceIds.has(item._id) || (item.viewOnceOpenedBy || []).some((id: string) => String(id) === String(myId));
                      if (item.viewOnce && !isSender && isViewedByMe) {
                        return (
                          <View style={[styles.viewOncePlaceholder, { backgroundColor: 'rgba(0,0,0,0.08)' }]}>
                            <Ionicons name="eye-off-outline" size={20} color="rgba(128,128,128,0.6)" />
                            <ThemedText style={[styles.viewOnceLabel, { color: theme.textSecondary }]}>Video opened</ThemedText>
                          </View>
                        );
                      }
                      if (item.viewOnce && !isSender && !isViewedByMe) {
                        return (
                          <Pressable style={[styles.viewOnceTap, { backgroundColor: theme.primary + '18', borderColor: theme.primary + '40' }]}
                            onPress={() => {
                              const url = item.videoUrl || item.imageUrl;
                              if (url) {
                                handleMarkViewOnce(item._id);
                                setViewOnceViewerActive(true);
                                setViewingVideo(url);
                                if (viewOnceTimerRef.current) clearTimeout(viewOnceTimerRef.current);
                                viewOnceTimerRef.current = setTimeout(() => {
                                  setViewingVideo(null);
                                  setViewOnceViewerActive(false);
                                }, 10000);
                              }
                            }}>
                            <Ionicons name="eye-outline" size={22} color={theme.primary} />
                            <ThemedText style={[styles.viewOnceLabel, { color: theme.primary }]}>Tap to view (once)</ThemedText>
                          </Pressable>
                        );
                      }
                      return (
                        <Pressable onPress={() => { const url = item.videoUrl || item.imageUrl; if (url) { setViewOnceViewerActive(false); setViewingVideo(url); } }} style={styles.videoContainer}>
                          {item.viewOnce && isSender && (
                            <View style={styles.viewOnceSenderBadge}>
                              <Ionicons name="eye-outline" size={12} color="rgba(255,255,255,0.9)" />
                            </View>
                          )}
                          {failedThumbnails.has(item._id) ? (
                            <View style={[styles.videoThumbnail, { backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" }]}>
                              <Ionicons name="videocam" size={48} color="rgba(255,255,255,0.7)" />
                              <ThemedText style={{ color: "#FFF", fontSize: 12, marginTop: 4 }}>Tap to play</ThemedText>
                            </View>
                          ) : (
                            <Image
                              source={{ uri: (() => { const url = item.videoUrl || item.imageUrl || ""; if (url.includes("cloudinary.com")) return url.replace("/upload/", "/upload/so_0,w_400,h_300,c_fill/").replace(/.(mp4|mov|avi|webm)$/i, ".jpg"); return url.replace(/.[^.]+$/, ".jpg"); })() }}
                              style={styles.videoThumbnail} contentFit="cover"
                              onError={() => setFailedThumbnails((prev) => new Set(prev).add(item._id))}
                            />
                          )}
                          <View style={styles.videoOverlay}>
                            <View style={styles.videoPlayButton}>
                              <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                            </View>
                          </View>
                          {!item.viewOnce && (
                            <Pressable style={styles.imageSaveButton} onPress={(e: any) => { e.stopPropagation(); saveVideo(item.videoUrl || item.imageUrl!); }}>
                              <Ionicons name="download-outline" size={16} color="#FFF" />
                            </Pressable>
                          )}
                        </Pressable>
                      );
                    })()}

                    {item.type === "audio" && item.audioUrl && (
                      <Pressable
                        style={[styles.audioPlayer, { backgroundColor: isMe ? "rgba(255,255,255,0.15)" : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}
                        onPress={() => playAudio(item.audioUrl!, item._id)}
                      >
                        <View style={[styles.audioPlayBtn, { backgroundColor: isMe ? "rgba(255,255,255,0.25)" : theme.primary + "22" }]}>
                          <Ionicons
                            name={
                              playingAudioId === item._id
                                ? "pause"
                                : playingAudioId === "paused:" + item._id
                                ? "play"
                                : "play"
                            }
                            size={18}
                            color={isMe ? "#FFF" : theme.primary}
                          />
                        </View>
                        <View style={styles.audioWaveform}>
                          <WavyWaveform
                            isPlaying={playingAudioId === item._id}
                            progress={playingAudioId === item._id || playingAudioId === "paused:" + item._id ? audioProgress : 0}
                            isMe={isMe}
                            theme={theme}
                            duration={(item as any).audioDuration}
                          />
                        </View>
                      </Pressable>
                    )}

                    {item.type === "location" && item.latitude != null && item.longitude != null && (() => {
                      const lat = item.latitude!;
                      const lng = item.longitude!;
                      const z = 15;
                      const n = Math.pow(2, z);
                      const fx = ((lng + 180) / 360) * n;
                      const fy = ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
                      const cx = Math.floor(fx);
                      const cy = Math.floor(fy);
                      const subTileX = (fx - cx) * 256;
                      const subTileY = (fy - cy) * 256;
                      const MAP_W = 240;
                      const MAP_H = 160;
                      const gridLeft = -(256 + subTileX - MAP_W / 2);
                      const gridTop = -(256 + subTileY - MAP_H / 2);
                      const tiles = [];
                      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tiles.push({ x: cx + dx, y: cy + dy, dx, dy });
                      return (
                        <Pressable
                          onPress={() => {
                            const label = item.address || `${lat}, ${lng}`;
                            const url = Platform.select({ ios: `maps:0,0?q=${label}@${lat},${lng}`, android: `geo:${lat},${lng}?q=${lat},${lng}(${label})`, default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` });
                            Linking.openURL(url!).catch(() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`));
                          }}
                          style={styles.locationBubble}
                        >
                          <View style={styles.locationMapContainer}>
                            <View style={[styles.locationTileGrid, { top: gridTop, left: gridLeft }]}>
                              {tiles.map((t, i) => (
                                <Image key={i}
                                  source={{ uri: Platform.OS === "web" ? `https://basemaps.cartocdn.com/rastertiles/voyager/${z}/${t.x}/${t.y}@2x.png` : `https://tile.openstreetmap.org/${z}/${t.x}/${t.y}.png`, headers: Platform.OS !== "web" ? { "User-Agent": "AfroConnect/1.0" } : undefined }}
                                  style={styles.locationTile} contentFit="cover"
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
                              <Ionicons name="location-sharp" size={32} color="#E53935" style={{ marginTop: -16, textShadowColor: "rgba(0,0,0,0.3)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 }} />
                            </View>
                          </View>
                          <View style={[styles.locationInfoRow, { backgroundColor: isMe ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.03)" }]}>
                            <View style={[styles.locationIconCircle, { backgroundColor: isMe ? "rgba(255,255,255,0.2)" : theme.primary + "18" }]}>
                              <Ionicons name="navigate" size={14} color={isMe ? "#FFF" : theme.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                              <ThemedText style={[styles.locationAddress, { color: isMe ? "#FFF" : theme.text }]} numberOfLines={2}>{item.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`}</ThemedText>
                              <View style={styles.locationTapHint}>
                                <ThemedText style={[styles.locationTapText, { color: isMe ? "rgba(255,255,255,0.6)" : theme.textSecondary }]}>Tap to open in maps</ThemedText>
                                <Feather name="external-link" size={10} color={isMe ? "rgba(255,255,255,0.5)" : theme.textSecondary} />
                              </View>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })()}

                    {messageText && item.type !== "audio" && item.type !== "location" ? (
                      <ThemedText style={[styles.messageText, { color: isMe ? "#FFF" : theme.text }]}>{messageText}</ThemedText>
                    ) : null}

                    <View style={styles.messageFooter}>
                      {item.edited && (
                        <ThemedText style={[styles.messageTime, { color: isMe ? "rgba(255,255,255,0.55)" : theme.textSecondary, fontStyle: "italic", marginRight: 4 }]}>edited</ThemedText>
                      )}
                      <ThemedText style={[styles.messageTime, { color: isMe ? "rgba(255,255,255,0.7)" : theme.textSecondary }]}>{formatTime(item.createdAt)}</ThemedText>
                      {isMe && (
                        <Ionicons
                          name={item.status === "seen" || item.status === "delivered" ? "checkmark-done" : "checkmark"}
                          size={14}
                          color={item.status === "seen" ? "#4FC3F7" : item.status === "delivered" ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)"}
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </View>
                  </View>

                  {item.reactions && item.reactions.length > 0 && (
                    <View style={[styles.reactionsRow, isMe ? { alignSelf: 'flex-end', marginRight: 4 } : { alignSelf: 'flex-start', marginLeft: 48 }]}>
                      {(() => {
                        const grouped: Record<string, number> = {};
                        (item.reactions || []).forEach(r => { grouped[r.emoji] = (grouped[r.emoji] || 0) + 1; });
                        return Object.entries(grouped).map(([emoji, count]) => (
                          <Pressable
                            key={emoji}
                            style={[styles.reactionBubble, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]}
                            onPress={() => {
                              setSelectedMessage(item);
                              handleReact(emoji);
                            }}
                          >
                            <ThemedText style={styles.reactionEmoji}>{emoji}</ThemedText>
                            {count > 1 && <ThemedText style={[styles.reactionCount, { color: theme.textSecondary }]}>{count}</ThemedText>}
                          </Pressable>
                        ));
                      })()}
                    </View>
                  )}
                </View>
              </Pressable>
            </SwipeableMessage>
          )}
        </View>
      );
    },
    [myId, messages, theme, isDark, userPhoto, handleMessageLongPress, handleSwipeReply, playingAudioId, audioProgress, failedThumbnails, chatBubbleStyle, highlightedMessageId, scrollToMessage],
  );

  const keyExtractor = useCallback((item: Message) => item._id, []);
  const currentTheme = CHAT_THEMES.find((t) => t.id === chatTheme);
  const photoSource = getPhotoSource(userPhoto);

  // â”€â”€â”€ Chat body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          extraData={[playingAudioId, audioProgress, highlightedMessageId]}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          maxToRenderPerBatch={20}
          windowSize={15}
          removeClippedSubviews={false}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
            }, 300);
          }}
          // FIX: load more old messages when user scrolls to top
          onStartReached={loadMoreMessages}
          onStartReachedThreshold={0.1}
          ListHeaderComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 12, alignItems: "center" }}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : hasMoreMessages ? (
              <Pressable style={{ paddingVertical: 12, alignItems: "center" }} onPress={loadMoreMessages}>
                <ThemedText style={{ color: theme.primary, fontSize: 13 }}>Load older messages</ThemedText>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                <Feather name="message-circle" size={40} color="#FFF" />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: "#FFF" }]}>Start the conversation</ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: "rgba(255,255,255,0.7)" }]}>Say hello to {userName}!</ThemedText>
              <Pressable style={[styles.aiSuggestButton, { backgroundColor: theme.primary }]} onPress={fetchAISuggestions}>
                <MaterialCommunityIcons name="robot" size={18} color="#FFF" />
                <ThemedText style={styles.aiSuggestButtonText}>Get AI Suggestions</ThemedText>
              </Pressable>
            </View>
          }
        />
      )}

      {isOtherRecording && !isTyping && (
        <View style={styles.typingIndicator}>
          <View style={[styles.typingBubble, { backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)" }]}>
            <Feather name="mic" size={14} color="#F44336" />
            <ThemedText style={[styles.typingLabel, { color: "#F44336", marginLeft: 6 }]}>recording voice</ThemedText>
          </View>
        </View>
      )}

      {isTyping && (
        <View style={styles.typingIndicator}>
          <View style={[styles.typingBubble, { backgroundColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.06)" }]}>
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

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </Pressable>

        <Pressable style={styles.headerProfile} onPress={() => navigation.navigate("ProfileDetail" as any, { userId })}>
          <View style={styles.avatarContainer}>
            <Image source={photoSource || { uri: "https://via.placeholder.com/50" }} style={styles.headerAvatar} contentFit="cover" />
            {isOnline && <View style={styles.onlineIndicator} />}
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <ThemedText style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>{userName}</ThemedText>
              {otherUserVerified && <Image source={require("@/assets/icons/verified-tick.png")} style={styles.verifiedBadge} contentFit="contain" />}
            </View>
            <ThemedText style={[styles.headerStatus, { color: isOtherRecording ? "#F44336" : isTyping ? theme.primary : isOnline ? "#4CAF50" : theme.textSecondary }]}>
              {getStatusText()}
            </ThemedText>
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable onPress={handleVoiceCall} style={styles.headerActionButton}><Feather name="phone" size={22} color={theme.primary} /></Pressable>
          <Pressable onPress={handleVideoCall} style={styles.headerActionButton}><Feather name="video" size={22} color={theme.primary} /></Pressable>
          <Pressable onPress={() => setShowOptionsMenu(true)} style={styles.headerActionButton}><Feather name="more-vertical" size={22} color={theme.text} /></Pressable>
        </View>
      </View>

      {/* BODY */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 56 : 0}
        enabled={Platform.OS !== "web"}
      >
        {currentTheme?.image ? (
          <ImageBackground source={currentTheme.image} style={[styles.chatBackground, { flex: 1 }]} resizeMode="cover">{chatContent}</ImageBackground>
        ) : (
          <View style={[styles.chatBackground, { flex: 1, backgroundColor: isDark ? "#0a0d14" : "#E8E8E8" }]}>{chatContent}</View>
        )}

        {showAISuggestions && (
          <View style={[styles.aiSuggestionsContainer, { backgroundColor: theme.background, borderTopColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]}>
            <View style={styles.aiSuggestionsHeader}>
              <MaterialCommunityIcons name="robot" size={18} color={theme.primary} />
              <ThemedText style={[styles.aiSuggestionsTitle, { color: theme.text }]}>AI Suggestions</ThemedText>
              <Pressable onPress={() => setShowAISuggestions(false)}><Feather name="x" size={20} color={theme.textSecondary} /></Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aiSuggestionsScroll}>
              {aiSuggestions.map((suggestion, index) => (
                <Pressable key={index} style={[styles.aiSuggestionChip, { backgroundColor: theme.primary + "20", borderColor: theme.primary }]} onPress={() => sendMessage(suggestion)}>
                  <ThemedText style={[styles.aiSuggestionText, { color: theme.primary }]} numberOfLines={2}>{suggestion}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {showEmojiPicker && (
          <View style={[styles.emojiPicker, { backgroundColor: theme.background, borderTopColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]}>
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
          <View style={[styles.replyBar, { backgroundColor: theme.background, borderTopColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]}>
            <View style={[styles.replyBarAccent, { backgroundColor: theme.primary }]} />
            <View style={styles.replyBarContent}>
              <ThemedText style={[styles.replyBarName, { color: theme.primary }]} numberOfLines={1}>
                {(() => { const sid = typeof replyingTo.sender === "string" ? replyingTo.sender : replyingTo.sender?._id; return String(sid) === String(myId) ? "You" : userName; })()}
              </ThemedText>
              <ThemedText style={[styles.replyBarText, { color: theme.textSecondary }]} numberOfLines={1}>
                {replyingTo.type === "image" ? "📷 Photo" : replyingTo.type === "video" ? "🎬 Video" : replyingTo.type === "audio" ? "🎤 Voice message" : replyingTo.content || replyingTo.text || ""}
              </ThemedText>
            </View>
            <Pressable onPress={() => setReplyingTo(null)} style={styles.replyBarClose}><Feather name="x" size={20} color={theme.textSecondary} /></Pressable>
          </View>
        )}

        <View style={[styles.inputContainer, { backgroundColor: theme.background, borderTopColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)", paddingBottom: isKeyboardVisible ? 0 : Math.max(insets.bottom, 4), minHeight: 60 }]}>
          {isRecording ? (
            <View style={styles.recordingContainer}>
              <Pressable onPress={cancelRecording} style={styles.cancelRecordButton}><Feather name="x" size={24} color="#F44336" /></Pressable>
              <View style={styles.recordingInfo}>
                <Animated.View style={[styles.recordingDot, { transform: [{ scale: recordingPulse }] }]} />
                <ThemedText style={[styles.recordingTime, { color: theme.text }]}>{formatRecordingTime(recordingDuration)}</ThemedText>
                <ThemedText style={[styles.recordingLabel, { color: theme.textSecondary }]}>Recording</ThemedText>
              </View>
              <Pressable onPress={stopRecording} style={[styles.sendRecordButton, { backgroundColor: theme.primary }]}><Feather name="send" size={20} color="#FFF" /></Pressable>
            </View>
          ) : (
            <>
              {/* View-once active indicator — visible in the input bar when toggle is ON.
                  Persists after the attachment menu closes so the user always knows
                  the next media will be sent as view-once. Tap it to cancel. */}
              {viewOnceSent ? (
                <View style={[styles.viewOnceChip, { backgroundColor: '#22C55E18', borderColor: '#22C55E40' }]}>
                  <Ionicons name="checkmark-circle-outline" size={13} color="#22C55E" />
                  <ThemedText style={[styles.viewOnceChipText, { color: '#22C55E' }]}>Saved & Sent</ThemedText>
                </View>
              ) : viewOnceMode && (
                <Pressable
                  style={styles.viewOnceChip}
                  onPress={() => setViewOnceModeSync(false)}
                  accessibilityLabel="View Once active — tap to disable"
                >
                  <Ionicons name="eye-outline" size={13} color="#FF6B6B" />
                  <ThemedText style={styles.viewOnceChipText}>View Once</ThemedText>
                  <Feather name="x" size={11} color="#FF6B6B" />
                </Pressable>
              )}
              <Pressable style={styles.attachButton} onPress={() => setShowAttachmentMenu(true)}><Feather name="plus-circle" size={26} color={theme.primary} /></Pressable>
              <View style={[styles.inputWrapper, { backgroundColor: isDark ? "#2A2A2A" : "#F5F5F5" }]}>
                <TextInput
                  ref={inputRef}
                  style={[styles.textInput, { color: theme.text }]}
                  placeholder="Type a message..."
                  placeholderTextColor={theme.textSecondary}
                  value={message}
                  autoCorrect={true}
                  autoCapitalize="sentences"
                  onChangeText={(text) => {
                    setMessage(text);
                    handleTypingIndicator();
                    if (userId) {
                      if (text.trim()) AsyncStorage.setItem(`chat_draft_${userId}`, text).catch(() => {});
                      else AsyncStorage.removeItem(`chat_draft_${userId}`).catch(() => {});
                    }
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
                <Pressable onPress={() => sendMessage()} style={[styles.sendButton, { backgroundColor: theme.primary }]} disabled={sending}>
                  {sending ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="send" size={20} color="#FFF" />}
                </Pressable>
              ) : (
                <Pressable style={styles.micButton} onPress={startRecording}><Feather name="mic" size={24} color={theme.primary} /></Pressable>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Attachment modal */}
      <Modal visible={showAttachmentMenu} transparent animationType="fade" onRequestClose={() => setShowAttachmentMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAttachmentMenu(false)}>
          <View style={[styles.attachmentMenu, { backgroundColor: theme.background }]}>
            <ThemedText style={[styles.attachmentTitle, { color: theme.text }]}>Send Attachment</ThemedText>
            <Pressable style={[styles.viewOnceToggleRow, viewOnceMode && { backgroundColor: '#FF6B6B12', borderColor: '#FF6B6B40' }]}
              onPress={() => setViewOnceModeSync(v => !v)}>
              <View style={styles.viewOnceToggleLeft}>
                <Ionicons name="eye-outline" size={18} color={viewOnceMode ? '#FF6B6B' : theme.textSecondary} />
                <View>
                  <ThemedText style={[styles.viewOnceToggleTitle, { color: viewOnceMode ? '#FF6B6B' : theme.text }]}>View Once</ThemedText>
                  <ThemedText style={[styles.viewOnceToggleDesc, { color: theme.textSecondary }]}>Photo/video disappears after being opened</ThemedText>
                </View>
              </View>
              <View style={[styles.viewOnceTogglePill, { backgroundColor: viewOnceMode ? '#FF6B6B' : theme.border }]}>
                <ThemedText style={styles.viewOnceTogglePillText}>{viewOnceMode ? 'ON' : 'OFF'}</ThemedText>
              </View>
            </Pressable>
            <View style={styles.attachmentOptions}>
              <Pressable style={styles.attachmentOption} onPress={handleTakePhoto}>
                <View style={[styles.attachmentIcon, { backgroundColor: "#FF6B6B20" }]}><Feather name="camera" size={24} color="#FF6B6B" /></View>
                <ThemedText style={[styles.attachmentLabel, { color: theme.text }]}>Camera</ThemedText>
              </Pressable>
              <Pressable style={styles.attachmentOption} onPress={handlePickImage}>
                <View style={[styles.attachmentIcon, { backgroundColor: "#4ECDC420" }]}><Feather name="image" size={24} color="#4ECDC4" /></View>
                <ThemedText style={[styles.attachmentLabel, { color: theme.text }]}>Gallery</ThemedText>
              </Pressable>
              <Pressable style={styles.attachmentOption} onPress={handlePickVideo}>
                <View style={[styles.attachmentIcon, { backgroundColor: "#9B59B620" }]}><Feather name="video" size={24} color="#9B59B6" /></View>
                <ThemedText style={[styles.attachmentLabel, { color: theme.text }]}>Video</ThemedText>
              </Pressable>
              <Pressable style={styles.attachmentOption} onPress={handleShareLocation}>
                <View style={[styles.attachmentIcon, { backgroundColor: "#45B7D120" }]}><Feather name="map-pin" size={24} color="#45B7D1" /></View>
                <ThemedText style={[styles.attachmentLabel, { color: theme.text }]}>Location</ThemedText>
              </Pressable>
            </View>
            <Pressable style={[styles.cancelButton, { borderColor: theme.textSecondary }]} onPress={() => setShowAttachmentMenu(false)}>
              <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Options modal */}
      <Modal visible={showOptionsMenu} transparent animationType="fade" onRequestClose={() => setShowOptionsMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowOptionsMenu(false)}>
          <View style={[styles.optionsMenu, { backgroundColor: theme.background }]}>
            <ThemedText style={[styles.optionsTitle, { color: theme.text }]}>Options</ThemedText>
            <Pressable style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); toggleScreenshotProtection(); }}>
              <Feather name="shield" size={22} color={screenshotProtection ? "#4CAF50" : theme.text} />
              <ThemedText style={[styles.optionText, { color: theme.text }]}>{screenshotProtection ? "Disable Screenshot Protection" : "Enable Screenshot Protection"}</ThemedText>
              {screenshotProtection && <Feather name="check-circle" size={18} color="#4CAF50" />}
            </Pressable>
            <Pressable style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); setShowThemeModal(true); }}>
              <Feather name="image" size={22} color={theme.primary} />
              <ThemedText style={[styles.optionText, { color: theme.text }]}>Chat Theme</ThemedText>
            </Pressable>
            <Pressable style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); setThemeMode(isDark ? "light" : "dark"); }}>
              <Feather name={isDark ? "sun" : "moon"} size={22} color={theme.text} />
              <ThemedText style={[styles.optionText, { color: theme.text }]}>{isDark ? "Light Mode" : "Dark Mode"}</ThemedText>
            </Pressable>
            <Pressable style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); setShowReportModal(true); }}>
              <Feather name="flag" size={22} color="#FF9800" />
              <ThemedText style={[styles.optionText, { color: theme.text }]}>Report User</ThemedText>
            </Pressable>
            <Pressable style={styles.optionItem} onPress={handleBlockUser}>
              <Feather name="slash" size={22} color="#F44336" />
              <ThemedText style={[styles.optionText, { color: "#F44336" }]}>Block User</ThemedText>
            </Pressable>
            <Pressable style={[styles.cancelButton, { borderColor: theme.textSecondary, marginTop: 16 }]} onPress={() => setShowOptionsMenu(false)}>
              <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Theme modal */}
      <Modal visible={showThemeModal} transparent animationType="slide" onRequestClose={() => setShowThemeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.themeModal, { backgroundColor: theme.background }]}>
            <View style={styles.themeHeader}>
              <ThemedText style={[styles.themeTitle, { color: theme.text }]}>Chat Theme</ThemedText>
              <Pressable onPress={() => setShowThemeModal(false)}><Feather name="x" size={24} color={theme.text} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.themeGrid}>
              {CHAT_THEMES.map((themeItem) => (
                <Pressable key={themeItem.id} style={[styles.themeItem, chatTheme === themeItem.id && { borderColor: theme.primary, borderWidth: 3 }]} onPress={() => saveChatTheme(themeItem.id)}>
                  {themeItem.image ? (
                    <Image source={themeItem.image} style={styles.themePreview} contentFit="cover" />
                  ) : (
                    <View style={[styles.themePreview, { backgroundColor: isDark ? "#1A1A1A" : "#E8E8E8", justifyContent: "center", alignItems: "center" }]}>
                      <ThemedText style={{ color: theme.textSecondary }}>Default</ThemedText>
                    </View>
                  )}
                  <ThemedText style={[styles.themeName, { color: theme.text }]} numberOfLines={1}>{themeItem.name}</ThemedText>
                  {chatTheme === themeItem.id && <View style={[styles.themeCheck, { backgroundColor: theme.primary }]}><Feather name="check" size={12} color="#FFF" /></View>}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Report modal */}
      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.reportModal, { backgroundColor: theme.background }]}>
            <View style={styles.reportHeader}>
              <ThemedText style={[styles.reportTitle, { color: theme.text }]}>Report {userName}</ThemedText>
              <Pressable onPress={() => setShowReportModal(false)}><Feather name="x" size={24} color={theme.text} /></Pressable>
            </View>
            <ThemedText style={[styles.reportSubtitle, { color: theme.textSecondary }]}>Why are you reporting this user?</ThemedText>
            <ScrollView style={styles.reportReasons}>
              {REPORT_REASONS.map((reason) => (
                <Pressable key={reason.id} style={[styles.reportReasonItem, selectedReportReason === reason.id && { backgroundColor: theme.primary + "20", borderColor: theme.primary }, { borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]} onPress={() => setSelectedReportReason(reason.id)}>
                  <Feather name={reason.icon as any} size={20} color={selectedReportReason === reason.id ? theme.primary : theme.text} />
                  <ThemedText style={[styles.reportReasonText, { color: theme.text }]}>{reason.label}</ThemedText>
                  {selectedReportReason === reason.id && <Feather name="check-circle" size={20} color={theme.primary} />}
                </Pressable>
              ))}
            </ScrollView>
            <TextInput style={[styles.reportInput, { color: theme.text, backgroundColor: isDark ? "#2A2A2A" : "#F5F5F5", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]} placeholder="Add more details (optional)" placeholderTextColor={theme.textSecondary} value={reportDetails} onChangeText={setReportDetails} multiline numberOfLines={3} />
            <Pressable style={[styles.submitReportButton, { backgroundColor: theme.primary, opacity: selectedReportReason ? 1 : 0.5 }]} onPress={handleSubmitReport} disabled={!selectedReportReason || submittingReport}>
              {submittingReport ? <ActivityIndicator color="#FFF" /> : <ThemedText style={styles.submitReportText}>Submit Report</ThemedText>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Image viewer */}
      <Modal visible={!!viewingImage} transparent animationType="fade" onRequestClose={() => { setViewingImage(null); if (viewOnceTimerRef.current) clearTimeout(viewOnceTimerRef.current); setViewOnceViewerActive(false); }}>
        <View style={styles.imageViewerOverlay}>
          <Pressable style={styles.imageViewerClose} onPress={() => { setViewingImage(null); if (viewOnceTimerRef.current) clearTimeout(viewOnceTimerRef.current); setViewOnceViewerActive(false); }}><Feather name="x" size={28} color="#FFF" /></Pressable>
          {viewOnceViewerActive ? (
            <View style={styles.imageViewerActions}>
              <View style={[styles.imageViewerActionBtn, { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 }]}>
                <Ionicons name="eye-outline" size={18} color="#FF6B6B" />
                <ThemedText style={{ color: "#FF6B6B", fontSize: 13, fontWeight: '700' }}>View Once · Auto-closes in 10s</ThemedText>
              </View>
            </View>
          ) : (
            <View style={styles.imageViewerActions}>
              <Pressable style={styles.imageViewerActionBtn} onPress={() => viewingImage && saveImage(viewingImage)}><Ionicons name="download-outline" size={24} color="#FFF" /></Pressable>
            </View>
          )}
          {viewingImage && <Image source={{ uri: viewingImage }} style={styles.imageViewerImage} contentFit="contain" />}
        </View>
      </Modal>

      {/* Video viewer */}
      <Modal visible={!!viewingVideo} transparent animationType="fade" onRequestClose={() => { setViewingVideo(null); if (viewOnceTimerRef.current) clearTimeout(viewOnceTimerRef.current); setViewOnceViewerActive(false); }}>
        <View style={styles.imageViewerOverlay}>
          <Pressable style={styles.imageViewerClose} onPress={() => { setViewingVideo(null); if (viewOnceTimerRef.current) clearTimeout(viewOnceTimerRef.current); setViewOnceViewerActive(false); }}><Feather name="x" size={28} color="#FFF" /></Pressable>
          {viewOnceViewerActive ? (
            <View style={styles.imageViewerActions}>
              <View style={[styles.imageViewerActionBtn, { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 }]}>
                <Ionicons name="eye-outline" size={18} color="#FF6B6B" />
                <ThemedText style={{ color: "#FF6B6B", fontSize: 13, fontWeight: '700' }}>View Once · Auto-closes in 10s</ThemedText>
              </View>
            </View>
          ) : (
            <View style={styles.imageViewerActions}>
              <Pressable style={styles.imageViewerActionBtn} onPress={() => viewingVideo && saveVideo(viewingVideo)}><Ionicons name="download-outline" size={24} color="#FFF" /></Pressable>
            </View>
          )}
          {viewingVideo && <Video source={{ uri: viewingVideo }} style={{ width: "100%", height: "80%" }} useNativeControls={!viewOnceViewerActive} resizeMode={ResizeMode.CONTAIN} shouldPlay isLooping={false} />}
        </View>
      </Modal>

      {/* Message context menu */}
      <Modal visible={showMessageMenu} transparent animationType="fade" onRequestClose={() => { setShowMessageMenu(false); setSelectedMessage(null); }}>
        <Pressable style={styles.modalOverlay} onPress={() => { setShowMessageMenu(false); setSelectedMessage(null); }}>
          <View style={[styles.messageMenuModal, { backgroundColor: theme.background }]}>
            {selectedMessage && (
              <View style={[styles.messageMenuPreview, { backgroundColor: isDark ? "#2A2A2A" : "#F5F5F5" }]}>
                <ThemedText style={[styles.messageMenuPreviewText, { color: theme.text }]} numberOfLines={2}>
                  {selectedMessage.content || selectedMessage.text || (selectedMessage.type === "image" ? "📷 Photo" : selectedMessage.type === "video" ? "🎬 Video" : "🎤 Voice")}
                </ThemedText>
              </View>
            )}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickReactionBar}
              contentContainerStyle={{ paddingHorizontal: 8, alignItems: 'center' }}
              scrollEnabled
              onStartShouldSetResponder={() => true}
            >
              {["❤️","😂","😍","😮","😢","🔥","👍","💯","🥰","😭","😤","🤣","💀","🥺","🤩","😎","🙌","👏","💪","🫶","🎉","✨","💅","🤔","😏","🤯","💔","🤍","😇","🥳"].map(emoji => (
                <Pressable key={emoji} style={styles.quickReactionBtn} onPress={() => handleReact(emoji)}>
                  <ThemedText style={styles.quickReactionEmoji}>{emoji}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable style={styles.messageMenuItem} onPress={handleReply}>
              <Feather name="corner-up-left" size={22} color={theme.primary} />
              <ThemedText style={[styles.messageMenuItemText, { color: theme.text }]}>Reply</ThemedText>
            </Pressable>
            <Pressable style={styles.messageMenuItem} onPress={handleTranslateOpen}>
              <MaterialCommunityIcons name="translate" size={22} color={theme.primary} />
              <ThemedText style={[styles.messageMenuItemText, { color: theme.text }]}>Translate</ThemedText>
            </Pressable>
            {selectedMessage && (() => {
              const sid = typeof selectedMessage.sender === "string" ? selectedMessage.sender : selectedMessage.sender?._id;
              return String(sid) === String(myId) && selectedMessage.type === "text" && !selectedMessage.deletedForEveryone;
            })() && (
              <Pressable style={styles.messageMenuItem} onPress={handleEditOpen}>
                <Feather name="edit-3" size={22} color={theme.primary} />
                <ThemedText style={[styles.messageMenuItemText, { color: theme.text }]}>Edit Message</ThemedText>
              </Pressable>
            )}
            <Pressable style={styles.messageMenuItem} onPress={handleDeleteForMe}>
              <Feather name="trash-2" size={22} color="#FF9800" />
              <ThemedText style={[styles.messageMenuItemText, { color: theme.text }]}>Delete for Me</ThemedText>
            </Pressable>
            {selectedMessage && (() => { const sid = typeof selectedMessage.sender === "string" ? selectedMessage.sender : selectedMessage.sender?._id; return String(sid) === String(myId); })() && (
              <Pressable style={styles.messageMenuItem} onPress={handleDeleteForEveryone}>
                <Feather name="trash" size={22} color="#F44336" />
                <ThemedText style={[styles.messageMenuItemText, { color: "#F44336" }]}>Delete for Everyone</ThemedText>
              </Pressable>
            )}
            <Pressable style={[styles.cancelButton, { borderColor: theme.textSecondary, marginTop: 12 }]} onPress={() => { setShowMessageMenu(false); setSelectedMessage(null); }}>
              <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Edit message modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => { setShowEditModal(false); setEditingMessage(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Pressable style={styles.modalOverlay} onPress={() => { setShowEditModal(false); setEditingMessage(null); }}>
            <Pressable style={[styles.translateModal, { backgroundColor: theme.background }]} onPress={() => {}}>
              <View style={styles.translateHeader}>
                <ThemedText style={[styles.translateTitle, { color: theme.text }]}>Edit Message</ThemedText>
                <Pressable onPress={() => { setShowEditModal(false); setEditingMessage(null); }}>
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
              </View>
              <TextInput
                style={[styles.translateLangInput, { color: theme.text, backgroundColor: isDark ? "#2A2A2A" : "#F5F5F5", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)", minHeight: 80, textAlignVertical: "top", paddingTop: 12 }]}
                value={editText}
                onChangeText={setEditText}
                multiline
                autoFocus
                placeholderTextColor={theme.textSecondary}
                placeholder="Edit your message..."
              />
              <ThemedText style={[styles.translatePickLabel, { color: theme.textSecondary, fontSize: 11, marginTop: 4 }]}>Messages can only be edited within 15 minutes of sending</ThemedText>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <Pressable style={[styles.cancelButton, { flex: 1, borderColor: theme.border }]} onPress={() => { setShowEditModal(false); setEditingMessage(null); }}>
                  <ThemedText style={[styles.cancelButtonText, { color: theme.text }]}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.translateButton, { flex: 1, backgroundColor: editText.trim() ? theme.primary : theme.primary + "55", marginTop: 0 }]}
                  onPress={handleEditSubmit}
                  disabled={!editText.trim() || submittingEdit}
                >
                  {submittingEdit ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Feather name="check" size={18} color="#FFF" />
                      <ThemedText style={styles.translateButtonText}>Save</ThemedText>
                    </>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Translate modal */}
      <Modal visible={showTranslateModal} transparent animationType="slide" onRequestClose={() => { setShowTranslateModal(false); setSelectedMessage(null); }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.translateModal, { backgroundColor: theme.background }]}>
            <View style={styles.translateHeader}>
              <ThemedText style={[styles.translateTitle, { color: theme.text }]}>Translate Message</ThemedText>
              <Pressable onPress={() => { setShowTranslateModal(false); setSelectedMessage(null); }}><Feather name="x" size={24} color={theme.text} /></Pressable>
            </View>
            {selectedMessage && (
              <View style={[styles.translateOriginal, { backgroundColor: isDark ? "#2A2A2A" : "#F5F5F5" }]}>
                <ThemedText style={[styles.translateOriginalLabel, { color: theme.textSecondary }]}>Original</ThemedText>
                <ThemedText style={[styles.translateOriginalText, { color: theme.text }]} numberOfLines={3}>{selectedMessage.content || selectedMessage.text || ""}</ThemedText>
              </View>
            )}
            {translating ? (
              <View style={styles.translateLoading}>
                <ActivityIndicator size="large" color={theme.primary} />
                <ThemedText style={[styles.translateLoadingText, { color: theme.textSecondary }]}>Translating...</ThemedText>
              </View>
            ) : translatedText ? (
              <View style={[styles.translateResult, { backgroundColor: theme.primary + "15", borderColor: theme.primary }]}>
                <ThemedText style={[styles.translateResultLabel, { color: theme.primary }]}>Translation ({translateTargetLang})</ThemedText>
                <ThemedText style={[styles.translateResultText, { color: theme.text }]}>{translatedText}</ThemedText>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable style={[styles.translateCopyBtn, { backgroundColor: theme.primary, flex: 1 }]} onPress={handleCopyTranslation}>
                    <Feather name="copy" size={16} color="#FFF" />
                    <ThemedText style={styles.translateCopyText}>Copy</ThemedText>
                  </Pressable>
                  <Pressable style={[styles.translateCopyBtn, { backgroundColor: isDark ? "#333" : "#E0E0E0", flex: 1 }]} onPress={() => { setTranslatedText(""); setTranslateTargetLang(savedTranslateLang); }}>
                    <MaterialCommunityIcons name="translate" size={16} color={theme.text} />
                    <ThemedText style={[styles.translateCopyText, { color: theme.text }]}>Retranslate</ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View>
                <ThemedText style={[styles.translatePickLabel, { color: theme.textSecondary }]}>Quick pick or type a language</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                  {["English","French","Swahili","Yoruba","Hausa","Amharic","Arabic","Zulu","Somali","Igbo","Portuguese","Spanish"].map((lang) => (
                    <Pressable
                      key={lang}
                      style={[{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: translateTargetLang === lang ? theme.primary : (isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"), backgroundColor: translateTargetLang === lang ? theme.primary + "22" : "transparent" }]}
                      onPress={() => setTranslateTargetLang(lang)}
                    >
                      <ThemedText style={{ fontSize: 13, color: translateTargetLang === lang ? theme.primary : theme.textSecondary }}>{lang}</ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
                <TextInput style={[styles.translateLangInput, { color: theme.text, backgroundColor: isDark ? "#2A2A2A" : "#F5F5F5", borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }]} placeholder="Or type any language..." placeholderTextColor={theme.textSecondary} value={translateTargetLang} onChangeText={setTranslateTargetLang} />
                <Pressable style={[styles.translateButton, { backgroundColor: theme.primary, opacity: translateTargetLang.trim() ? 1 : 0.5 }]} onPress={() => translateTargetLang.trim() && handleTranslate(translateTargetLang.trim())} disabled={!translateTargetLang.trim()}>
                  <MaterialCommunityIcons name="translate" size={20} color="#FFF" />
                  <ThemedText style={styles.translateButtonText}>Translate</ThemedText>
                </Pressable>
              </View>
            )}
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create<any>({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1 },
  backButton: { padding: 8 },
  headerProfile: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 4 },
  avatarContainer: { position: "relative" },
  headerAvatar: { width: 44, height: 44, borderRadius: 22 },
  onlineIndicator: { position: "absolute", bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: "#4CAF50", borderWidth: 2, borderColor: "#FFF" },
  headerInfo: { marginLeft: 12, flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  headerName: { fontSize: 17, fontWeight: "700" },
  verifiedBadge: { width: 18, height: 18, marginLeft: 6 },
  headerStatus: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: "row", alignItems: "center" },
  headerActionButton: { padding: 10, marginLeft: 4 },
  chatBackground: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  messagesList: { paddingHorizontal: 12, paddingVertical: 16, flexGrow: 1 },
  dateHeaderContainer: { alignItems: "center", marginVertical: 16 },
  dateHeader: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  dateHeaderText: { fontSize: 12, fontWeight: "500" },
  systemMessageContainer: { alignItems: "center", marginVertical: 8 },
  systemMessage: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  systemMessageText: { color: "#FFF", fontSize: 13 },
  messageRow: { flexDirection: "row", marginVertical: 4, alignItems: "flex-end" },
  messageRowLeft: { justifyContent: "flex-start" },
  messageRowRight: { justifyContent: "flex-end" },
  messageAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  messageBubble: { maxWidth: "75%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  myBubble: { borderBottomRightRadius: 4 },
  theirBubble: { borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 21 },
  messageImage: { width: 200, height: 150, borderRadius: 16, marginBottom: 6, overflow: "hidden" },
  messageFooter: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 4 },
  messageTime: { fontSize: 11 },
  typingIndicator: { paddingHorizontal: 16, paddingVertical: 6 },
  typingBubble: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderBottomLeftRadius: 4, gap: 8 },
  typingDots: { flexDirection: "row", alignItems: "center" },
  typingDot: { width: 7, height: 7, borderRadius: 4 },
  typingLabel: { fontSize: 12, fontWeight: "500" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 100 },
  emptyIconContainer: { width: 80, height: 80, borderRadius: 40, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: "center", marginBottom: 20 },
  aiSuggestButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 },
  aiSuggestButtonText: { color: "#FFF", fontSize: 14, fontWeight: "600", marginLeft: 8 },
  aiSuggestionsContainer: { borderTopWidth: 1, paddingVertical: 12 },
  aiSuggestionsHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 10 },
  aiSuggestionsTitle: { flex: 1, fontSize: 14, fontWeight: "600", marginLeft: 8 },
  aiSuggestionsScroll: { paddingHorizontal: 12 },
  aiSuggestionChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1, marginHorizontal: 4, maxWidth: 200 },
  aiSuggestionText: { fontSize: 13 },
  emojiPicker: { borderTopWidth: 1, paddingVertical: 12 },
  emojiScrollContent: { paddingHorizontal: 12 },
  emojiButton: { padding: 6 },
  emojiText: { fontSize: 28 },
  inputContainer: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 8, paddingTop: 8, borderTopWidth: 1 },
  recordingContainer: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cancelRecordButton: { padding: 12 },
  recordingInfo: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#F44336" },
  recordingTime: { fontSize: 18, fontWeight: "600" },
  recordingLabel: { fontSize: 13, fontWeight: "500" },
  sendRecordButton: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  attachButton: { padding: 6, marginBottom: 2 },
  inputWrapper: { flex: 1, flexDirection: "row", alignItems: "flex-end", borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6, marginHorizontal: 4, minHeight: 45, maxHeight: 120 },
  textInput: { flex: 1, fontSize: 16, maxHeight: 100, paddingHorizontal: 8, paddingTop: Platform.OS === "ios" ? 10 : 0, paddingBottom: Platform.OS === "ios" ? 10 : 5 },
  emojiToggle: { padding: 4, marginLeft: 8 },
  aiButton: { padding: 6, marginBottom: 2 },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginBottom: 2 },
  micButton: { padding: 8, marginBottom: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  attachmentMenu: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  attachmentTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 20 },
  attachmentOptions: { flexDirection: "row", justifyContent: "space-around", marginBottom: 24 },
  attachmentOption: { alignItems: "center" },
  attachmentIcon: { width: 60, height: 60, borderRadius: 30, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  attachmentLabel: { fontSize: 14, fontWeight: "500" },
  cancelButton: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  cancelButtonText: { fontSize: 16, fontWeight: "600" },
  optionsMenu: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  optionsTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", marginBottom: 20 },
  optionItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.1)" },
  optionText: { fontSize: 16, marginLeft: 16, flex: 1 },
  themeModal: { margin: 20, borderRadius: 20, padding: 20, maxHeight: "80%" },
  themeHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  themeTitle: { fontSize: 20, fontWeight: "700" },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  themeItem: { width: "31%", marginBottom: 16, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  themePreview: { width: "100%", aspectRatio: 0.8, justifyContent: "center", alignItems: "center" },
  themeName: { fontSize: 12, fontWeight: "500", textAlign: "center", paddingVertical: 6 },
  themeCheck: { position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  reportModal: { margin: 20, borderRadius: 20, padding: 24, maxHeight: "80%" },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  reportTitle: { fontSize: 20, fontWeight: "700" },
  reportSubtitle: { fontSize: 14, marginBottom: 20 },
  reportReasons: { maxHeight: 280 },
  reportReasonItem: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  reportReasonText: { flex: 1, marginLeft: 12, fontSize: 15 },
  reportInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginTop: 16, minHeight: 80, textAlignVertical: "top" },
  submitReportButton: { marginTop: 20, paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  submitReportText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  imageSaveButton: { position: "absolute", bottom: 12, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
  audioPlayer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, minWidth: 180, gap: 8 },
  audioPlayBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  reactionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4, marginBottom: 2 },
  reactionBubble: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 3 },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, fontWeight: "600" },
  quickReactionBar: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.08)", marginBottom: 4 },
  quickReactionBtn: { padding: 6 },
  quickReactionEmoji: { fontSize: 26 },
  audioWaveform: { flex: 1 },
  audioProgressBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  audioProgressFill: { height: "100%", borderRadius: 2 },
  imageViewerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  imageViewerClose: { position: "absolute", top: 50, right: 20, zIndex: 10, padding: 8 },
  imageViewerActions: { position: "absolute", top: 50, left: 20, zIndex: 10, flexDirection: "row", gap: 16 },
  imageViewerActionBtn: { padding: 8 },
  imageViewerImage: { width: SCREEN_WIDTH, height: "80%" },
  replyPreviewInBubble: { paddingHorizontal: 10, paddingVertical: 6, borderLeftWidth: 3, borderRadius: 6, marginBottom: 6 },
  replyPreviewName: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  replyPreviewText: { fontSize: 12 },
  replyBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  replyBarAccent: { width: 4, height: "100%", borderRadius: 2, minHeight: 36 },
  replyBarContent: { flex: 1, marginLeft: 10 },
  replyBarName: { fontSize: 13, fontWeight: "700" },
  replyBarText: { fontSize: 13, marginTop: 2 },
  replyBarClose: { padding: 8 },
  messageMenuModal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  messageMenuPreview: { padding: 12, borderRadius: 12, marginBottom: 16 },
  messageMenuPreviewText: { fontSize: 14 },
  messageMenuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.08)" },
  messageMenuItemText: { fontSize: 16, marginLeft: 16, flex: 1 },
  translateModal: { margin: 20, borderRadius: 20, padding: 24, maxHeight: "80%" },
  translateHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  translateTitle: { fontSize: 20, fontWeight: "700" },
  translateOriginal: { padding: 12, borderRadius: 12, marginBottom: 16 },
  translateOriginalLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4 },
  translateOriginalText: { fontSize: 14 },
  translateLoading: { alignItems: "center", paddingVertical: 40 },
  translateLoadingText: { marginTop: 12, fontSize: 14 },
  translateResult: { padding: 16, borderRadius: 12, borderWidth: 1 },
  translateResultLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  translateResultText: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  translateCopyBtn: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  translateCopyText: { color: "#FFF", fontSize: 13, fontWeight: "600", marginLeft: 6 },
  translatePickLabel: { fontSize: 14, fontWeight: "600", marginBottom: 12 },
  translateLangInput: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 16 },
  translateButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, gap: 8 },
  translateButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  videoContainer: { width: 200, height: 150, borderRadius: 16, overflow: "hidden", marginBottom: 6, position: "relative" },
  videoThumbnail: { width: 200, height: 150, borderRadius: 12 },
  videoOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 12 },
  videoPlayButton: { justifyContent: "center", alignItems: "center" },
  locationBubble: { width: 240, borderRadius: 16, overflow: "hidden", marginBottom: 4 },
  locationMapContainer: { width: 240, height: 160, position: "relative", backgroundColor: "#E0E0E0", overflow: "hidden", borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  locationTileGrid: { width: 256 * 3, height: 256 * 3, flexDirection: "row", flexWrap: "wrap", position: "absolute" },
  locationTile: { width: 256, height: 256 },
  locationGradientOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 50 },
  locationGradientLayer1: { position: "absolute", bottom: 0, left: 0, right: 0, height: 50, backgroundColor: "rgba(0,0,0,0.08)" },
  locationGradientLayer2: { position: "absolute", bottom: 0, left: 0, right: 0, height: 30, backgroundColor: "rgba(0,0,0,0.12)" },
  locationGradientLayer3: { position: "absolute", bottom: 0, left: 0, right: 0, height: 12, backgroundColor: "rgba(0,0,0,0.18)" },
  locationPinOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  locationPinShadow: { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.25)", top: "53%" as any },
  locationInfoRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  locationIconCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center" },
  locationAddress: { fontSize: 13, fontWeight: "600", flex: 1, lineHeight: 17 },
  locationTapHint: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  locationTapText: { fontSize: 10 },

  viewOncePlaceholder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, minWidth: 140 },
  viewOnceTap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, minWidth: 160 },
  viewOnceLabel: { fontSize: 13, fontWeight: '600' },
  viewOnceSenderBadge: { position: 'absolute', top: 6, right: 6, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 10, padding: 3 },
  viewOnceToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: 'transparent', marginBottom: 12 },
  // Persistent chip shown in the input bar while view-once mode is active
  viewOnceChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(255,107,107,0.12)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)', marginRight: 4 },
  viewOnceChipText: { fontSize: 11, color: '#FF6B6B', fontWeight: '600' },
  viewOnceToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewOnceToggleTitle: { fontSize: 13, fontWeight: '700' },
  viewOnceToggleDesc: { fontSize: 11, marginTop: 1 },
  viewOnceTogglePill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  viewOnceTogglePillText: { fontSize: 10, fontWeight: '800', color: '#fff' },
});
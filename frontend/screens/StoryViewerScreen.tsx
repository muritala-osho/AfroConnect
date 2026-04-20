import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Dimensions, StatusBar, Animated, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert, Modal, FlatList, ScrollView, Keyboard } from "react-native";
import { KeyboardAvoidingView as KAVController } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import { Video, ResizeMode } from "expo-av";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { getPhotoSource } from "@/utils/photos";
import * as Haptics from "expo-haptics";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const STORY_DURATION = 5000;

type StoryViewerScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "StoryViewer">;
type StoryViewerScreenRouteProp = RouteProp<RootStackParamList, "StoryViewer">;

interface StoryViewerScreenProps {
  navigation: StoryViewerScreenNavigationProp;
  route: StoryViewerScreenRouteProp;
}

interface StoryViewer {
  id: string;
  name: string;
  photo?: string;
  viewedAt: string;
}

interface Story {
  _id: string;
  type: "image" | "text" | "video";
  imageUrl?: string;
  mediaUrl?: string;
  textContent?: string;
  backgroundColor?: string[];
  createdAt: string;
  viewedBy?: string[];
  viewers?: StoryViewer[];
  viewCount?: number;
}

interface StoryUser {
  _id: string;
  name: string;
  photo?: string;
  stories: Story[];
}

export default function StoryViewerScreen({ navigation, route }: StoryViewerScreenProps) {
  const { theme } = useTheme();
  const { token, user } = useAuth();
  const { get, post, put, del } = useApi();
  const insets = useSafeAreaInsets();
  const { userId, userName, userPhoto } = route.params as any;

  const [stories, setStories] = useState<Story[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessMessage, setAccessMessage] = useState("");
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [editingText, setEditingText] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(STORY_DURATION);
  const [showViewers, setShowViewers] = useState(false);
  const [showStoryMenu, setShowStoryMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('inappropriate');
  const [reportDetails, setReportDetails] = useState('');
  const [reportLoading, setReportLoading] = useState(false);

  const isOwnStory = String(userId) === String(user?.id) || String(userId) === String((user as any)?._id);

  const REACTIONS = ["❤️", "🔥", "😍", "😂", "😮", "😢"];

  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const videoDurationSet = useRef(false);

  useEffect(() => {
    if (!token) return;
    const fetchStories = async () => {
      try {
        setLoading(true);
        const isOwn = String(userId) === String(user?.id) || String(userId) === String((user as any)?._id) || (route.params as any)?.isOwnStory === true;
        const endpoint = isOwn ? `/stories/my-stories` : `/stories/user/${userId}`;
        const response = await get<{ stories: Story[]; message?: string }>(endpoint, token);
        
        if (response.success && response.data?.stories) {
          const fetchedStories = response.data.stories;
          setStories(fetchedStories);
          if (fetchedStories.length > 0) {
            markStoryViewed(fetchedStories[0]._id);
          }
        } else if (!response.success) {
          const errorMsg = (response as any).message || "Unable to view stories";
          if (errorMsg.includes("authorized") || errorMsg.includes("friends") || errorMsg.includes("matches")) {
            setAccessDenied(true);
            setAccessMessage(errorMsg);
          }
        }
      } catch (error: any) {
        console.error("Error fetching stories:", error);
        if (userId === user?.id) {
          setStories([]);
        } else if (error?.response?.status === 403 || error?.message?.includes("403")) {
          setAccessDenied(true);
          setAccessMessage("You need to match with this user to view their stories");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStories();
  }, [userId, token, user?.id]);

  useEffect(() => {
    videoDurationSet.current = false;
    if (stories.length > 0 && !paused) {
      startProgress();
    }
    return () => {
      if (progressAnimation.current) {
        progressAnimation.current.stop();
      }
    };
  }, [currentIndex, stories.length, paused]);

  const markStoryViewed = async (storyId: string) => {
    if (!token || !storyId || isOwnStory) return;
    try {
      await post(`/stories/${storyId}/view`, {}, token);
    } catch (error) {
      console.error("Mark story viewed error:", error);
    }
  };

  const handleDeleteStory = async () => {
    if (!token || !currentStory) return;
    
    Alert.alert(
      "Delete Story",
      "Are you sure you want to delete this story?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await del(`/stories/${currentStory._id}`, token);
              if (response.success) {
                if (Platform.OS !== 'web') {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                const newStories = stories.filter(s => s._id !== currentStory._id);
                if (newStories.length === 0) {
                  navigation.goBack();
                } else {
                  setStories(newStories);
                  if (currentIndex >= newStories.length) {
                    setCurrentIndex(newStories.length - 1);
                  }
                }
              } else {
                Alert.alert("Error", "Failed to delete story");
              }
            } catch (error) {
              console.error("Delete story error:", error);
              Alert.alert("Error", "Failed to delete story");
            }
          }
        }
      ]
    );
  };

  const handleUpdateStory = async () => {
    if (!token || !currentStory || !editingText.trim()) return;
    setIsSaving(true);
    try {
      const putData = {
        textContent: editingText,
        backgroundColor: currentStory.backgroundColor
      };
      
      const response = await put<{ success: boolean; message: string }>(`/stories/${currentStory._id}`, putData, token);
      
      if (response.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        Alert.alert("Success", "Story updated successfully!");
        const updatedStories = stories.map(s => 
          s._id === currentStory._id ? { ...s, textContent: editingText } : s
        );
        setStories(updatedStories);
        setIsEditing(false);
        resumeProgress();
      } else {
        Alert.alert("Error", "Failed to update story");
      }
    } catch (error) {
      console.error("Update story error:", error);
      Alert.alert("Error", "Failed to update story");
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = () => {
    if (currentStory.type !== 'text') return;
    pauseProgress();
    setEditingText(currentStory.textContent || "");
    setIsEditing(true);
  };

  const startProgress = (customDuration?: number) => {
    const duration = customDuration || (stories[currentIndex]?.type === 'video' ? videoDuration : STORY_DURATION);
    progressAnim.setValue(0);
    progressAnimation.current = Animated.timing(progressAnim, {
      toValue: 1,
      duration: duration,
      useNativeDriver: false,
    });
    progressAnimation.current.start(({ finished }) => {
      if (finished) {
        goToNext();
      }
    });
  };

  const pauseProgress = () => {
    setPaused(true);
    if (progressAnimation.current) {
      progressAnimation.current.stop();
    }
  };

  const resumeProgress = () => {
    setPaused(false);
  };

  const goToNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
      markStoryViewed(stories[currentIndex + 1]?._id);
    } else {
      navigation.goBack();
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleTap = (side: "left" | "right") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (side === "left") {
      goToPrevious();
    } else {
      goToNext();
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !token) return;
    try {
      const response = await post(`/stories/${stories[currentIndex]._id}/reply`, {
        message: replyText,
      }, token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReplyText("");
      setShowReplyInput(false);
      Alert.alert("Reply sent!");
    } catch (error) {
      console.error("Reply error:", error);
      Alert.alert("Error", "Failed to send reply. Please try again.");
    }
  };

  const handleReaction = async (emoji: string) => {
    if (!token || !stories[currentIndex]) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      if (userReaction === emoji) {
        await del(`/stories/${stories[currentIndex]._id}/react`, token);
        setUserReaction(null);
      } else {
        await post(`/stories/${stories[currentIndex]._id}/react`, { emoji }, token);
        setUserReaction(emoji);
      }
      setShowReactionPicker(false);
    } catch (error) {
      console.error("Reaction error:", error);
    }
  };

  const toggleReactionPicker = () => {
    pauseProgress();
    setShowReactionPicker(!showReactionPicker);
    if (showReactionPicker) {
      resumeProgress();
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const handleShareStory = async () => {
    if (!currentStory) {
      Alert.alert("Error", "This story cannot be shared");
      return;
    }
    
    try {
      const { Share } = require('react-native');
      const shareMessage = "Hey! Check out this story on AfroConnect - Download the app to see it! 🌍❤️";
      
      const result = await Share.share({
        message: shareMessage,
      });
      
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
        } else {
        }
      } else if (result.action === Share.dismissedAction) {
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleReportStory = () => {
    if (!currentStory) return;
    pauseProgress();
    setReportReason('inappropriate');
    setReportDetails('');
    setShowReportModal(true);
  };

  const handleSubmitReport = async () => {
    if (!token || !currentStory || reportLoading) return;
    setReportLoading(true);
    try {
      const response = await post("/reports", {
        reportedUserId: userId,
        reason: reportReason,
        description: reportDetails.trim() || undefined,
        contentType: "story",
        contentId: currentStory._id,
        contentUrl: currentStory.imageUrl || currentStory.mediaUrl,
        contentPreview: currentStory.textContent || "Reported story"
      }, token);
      setShowReportModal(false);
      resumeProgress();
      if (response.success) {
        Alert.alert("Reported", "Thank you. Our team will review this story.");
      } else {
        Alert.alert("Error", "Failed to submit report");
      }
    } catch {
      Alert.alert("Error", "Failed to submit report");
    } finally {
      setReportLoading(false);
    }
  };

  const currentStory = stories[currentIndex];
  const activeStoryType = currentStory?.type || "image";

  const storyBg = React.useMemo(() => {
    if (!currentStory) return ["#FF6B6B", "#FF8E8E"];
    if (currentStory.type === "image" || currentStory.type === "video") return ["transparent", "transparent"];
    if (Array.isArray(currentStory.backgroundColor)) return currentStory.backgroundColor;
    if (typeof currentStory.backgroundColor === "string") return [currentStory.backgroundColor, currentStory.backgroundColor];
    return ["#FF6B6B", "#FF8E8E"];
  }, [currentStory]);

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
  }

  if (!currentStory || stories.length === 0 || accessDenied) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar barStyle="light-content" />
        <Ionicons 
          name={accessDenied ? "lock-closed-outline" : "images-outline"} 
          size={64} 
          color="rgba(255,255,255,0.5)" 
        />
        <ThemedText style={styles.noStoriesText}>
          {accessDenied 
            ? accessMessage || "Stories are private" 
            : "No stories available"}
        </ThemedText>
        {accessDenied && (
          <ThemedText style={styles.accessHint}>
            Match with {userName} to view their stories
          </ThemedText>
        )}
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="light-content" />
      
      {currentStory.type === "image" && (currentStory.imageUrl || currentStory.mediaUrl) ? (
        <View style={StyleSheet.absoluteFillObject}>
          <Image
            source={{ uri: currentStory.imageUrl || currentStory.mediaUrl }}
            style={{ width: '100%', height: '100%' }}
            contentFit="contain"
            cachePolicy="disk"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            transition={200}
          />
        </View>
      ) : currentStory.type === "video" && (currentStory.imageUrl || currentStory.mediaUrl) ? (
        <View style={[StyleSheet.absoluteFillObject, { borderRadius: 24, overflow: 'hidden' }]}>
          <Video
            source={{ uri: (currentStory.imageUrl || currentStory.mediaUrl) as string }}
            style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={!paused}
            isLooping={false}
            onPlaybackStatusUpdate={(status: any) => {
              if (status.isLoaded && status.durationMillis && !videoDurationSet.current) {
                videoDurationSet.current = true;
                setVideoDuration(status.durationMillis);
                if (!paused) {
                  startProgress(status.durationMillis);
                }
              }
              if (status.didJustFinish) {
                goToNext();
              }
            }}
            useNativeControls={false}
          />
        </View>
      ) : (
        <LinearGradient
          colors={storyBg as [string, string]}
          style={styles.textStoryBg}
        >
          {isEditing ? (
            <View style={styles.editContainer}>
              <TextInput
                style={styles.editInput}
                value={editingText}
                onChangeText={setEditingText}
                multiline
                autoFocus
                maxLength={200}
                placeholderTextColor="rgba(255,255,255,0.5)"
              />
              <View style={styles.editActions}>
                <Pressable 
                  style={[styles.editActionButton, { backgroundColor: 'rgba(255,255,255,0.2)' }]} 
                  onPress={() => {
                    setIsEditing(false);
                    resumeProgress();
                  }}
                >
                  <ThemedText style={styles.editActionText}>Cancel</ThemedText>
                </Pressable>
                <Pressable 
                  style={[styles.editActionButton, { backgroundColor: theme.primary }]} 
                  onPress={handleUpdateStory}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <ThemedText style={styles.editActionText}>Save</ThemedText>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <ThemedText style={styles.textStoryContent}>
              {currentStory.textContent}
            </ThemedText>
          )}
        </LinearGradient>
      )}

      <LinearGradient
        colors={["rgba(0,0,0,0.6)", "transparent"]}
        style={[styles.topGradient, { paddingTop: insets.top }]}
      >
        <View style={styles.progressContainer}>
          {stories.map((_, index) => (
            <View key={index} style={styles.progressBarBg}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width:
                      index < currentIndex
                        ? "100%"
                        : index === currentIndex
                        ? progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0%", "100%"],
                          })
                        : "0%",
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header}>
          <Pressable
            style={styles.userInfo}
            onPress={() => {
              if (isOwnStory) {
                navigation.navigate("MainTabs" as any, { screen: "MyProfile" });
              } else {
                navigation.navigate("ProfileDetail", { userId });
              }
            }}
          >
            <View style={styles.avatarContainer}>
              <Image
                source={userPhoto ? getPhotoSource(userPhoto) : require('../assets/icon.png')}
                style={styles.userAvatar}
                onLoad={() => {
                }}
              />
              {isOwnStory && (
                <Pressable 
                  style={[styles.addStoryBadge, { backgroundColor: theme.primary }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate("StoryUpload" as any);
                  }}
                >
                  <Ionicons name="add" size={12} color="#FFF" />
                </Pressable>
              )}
            </View>
            <View style={{ maxWidth: 120 }}>
              <ThemedText style={styles.userName} numberOfLines={1}>{userName}</ThemedText>
              <ThemedText style={styles.storyTime}>
                {formatTime(currentStory.createdAt)}
              </ThemedText>
            </View>
          </Pressable>

          <View style={[styles.headerActions, { flexShrink: 0 }]}>
            {isOwnStory && (
              <View>
                <Pressable
                  style={styles.headerButtonHighVis}
                  onPress={(e) => { e.stopPropagation(); setShowStoryMenu(v => !v); pauseProgress(); }}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color="#FFF" />
                </Pressable>
                {showStoryMenu && (
                  <View style={styles.storyMenuDropdown}>
                    {currentStory?.type === 'text' && (
                      <Pressable
                        style={styles.storyMenuItem}
                        onPress={() => { setShowStoryMenu(false); startEditing(); }}
                      >
                        <Ionicons name="pencil" size={16} color="#FFF" />
                        <ThemedText style={styles.storyMenuItemText}>Edit</ThemedText>
                      </Pressable>
                    )}
                    <Pressable
                      style={[styles.storyMenuItem, styles.storyMenuItemDanger]}
                      onPress={() => { setShowStoryMenu(false); resumeProgress(); handleDeleteStory(); }}
                    >
                      <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                      <ThemedText style={[styles.storyMenuItemText, { color: '#FF6B6B' }]}>Delete</ThemedText>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
            <Pressable
              style={styles.headerButtonHighVis}
              onPress={paused ? resumeProgress : pauseProgress}
            >
              <Ionicons
                name={paused ? "play" : "pause"}
                size={16}
                color="#FFF"
              />
            </Pressable>
            <Pressable
              style={styles.headerButtonHighVis}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="close" size={18} color="#FFF" />
            </Pressable>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.tapAreas}>
        <Pressable
          style={styles.leftTap}
          onPress={() => handleTap("left")}
          onLongPress={pauseProgress}
          onPressOut={resumeProgress}
        />
        <Pressable
          style={styles.rightTap}
          onPress={() => handleTap("right")}
          onLongPress={pauseProgress}
          onPressOut={resumeProgress}
        />
      </View>

      <View style={styles.bottomGradientWrapper}>
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.6)"]}
        style={[
          styles.bottomGradient,
          { paddingBottom: showReplyInput ? 16 : insets.bottom + 16 },
        ]}
      >
        {showReplyInput ? (
          <View style={styles.replyInputContainer}>
            <Pressable
              style={styles.replyCloseButton}
              onPress={() => { setShowReplyInput(false); setReplyText(''); Keyboard.dismiss(); resumeProgress(); }}
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>
            <TextInput
              style={styles.replyInput}
              placeholder="Send a message..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={replyText}
              onChangeText={setReplyText}
              autoFocus
              returnKeyType="send"
              onSubmitEditing={handleSendReply}
              blurOnSubmit={false}
            />
            <Pressable style={styles.sendButton} onPress={handleSendReply}>
              <Ionicons name="send" size={20} color="#FFF" />
            </Pressable>
          </View>
        ) : !isOwnStory ? (
          <View style={styles.bottomActions}>
            {showReactionPicker && (
              <View style={styles.reactionPicker}>
                {REACTIONS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    style={[
                      styles.reactionEmoji,
                      userReaction === emoji && styles.reactionEmojiSelected
                    ]}
                    onPress={() => handleReaction(emoji)}
                  >
                    <ThemedText style={styles.reactionEmojiText}>{emoji}</ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
            
            <Pressable
              style={styles.replyButton}
              onPress={() => setShowReplyInput(true)}
            >
              <Feather name="message-circle" size={24} color="#FFF" />
              <ThemedText style={styles.replyButtonText}>Reply</ThemedText>
            </Pressable>

            <View style={styles.actionButtons}>
              <Pressable 
                style={styles.actionButton}
                onPress={toggleReactionPicker}
              >
                {userReaction ? (
                  <ThemedText style={styles.activeReaction}>{userReaction}</ThemedText>
                ) : (
                  <Ionicons name="heart-outline" size={28} color="#FFF" />
                )}
              </Pressable>
              <Pressable style={styles.actionButton} onPress={handleShareStory}>
                <Ionicons name="share-outline" size={28} color="#FFF" />
              </Pressable>
              <Pressable style={styles.actionButton} onPress={handleReportStory}>
                <Ionicons name="flag-outline" size={28} color="#FFF" />
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            style={[styles.bottomActions, { justifyContent: 'center' }]}
            onPress={() => {
              pauseProgress();
              setShowViewers(true);
            }}
          >
            <View style={styles.viewersRow}>
              <Ionicons name="eye-outline" size={16} color="rgba(255,255,255,0.7)" />
              <ThemedText style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginLeft: 6 }}>
                Viewed by {currentStory.viewCount ?? currentStory.viewers?.length ?? currentStory.viewedBy?.length ?? 0} {(currentStory.viewCount ?? currentStory.viewers?.length ?? currentStory.viewedBy?.length ?? 0) === 1 ? 'person' : 'people'}
              </ThemedText>
              <Ionicons name="chevron-up" size={14} color="rgba(255,255,255,0.5)" style={{ marginLeft: 4 }} />
            </View>
          </Pressable>
        )}
      </LinearGradient>
      </View>

      <Modal
        visible={showViewers}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowViewers(false);
          resumeProgress();
        }}
      >
        <Pressable
          style={styles.viewerModalOverlay}
          onPress={() => {
            setShowViewers(false);
            resumeProgress();
          }}
        >
          <Pressable style={styles.viewerModalContent} onPress={() => {}}>
            <View style={styles.viewerModalHandle} />
            <ThemedText style={styles.viewerModalTitle}>
              Viewed by {currentStory.viewCount ?? currentStory.viewers?.length ?? currentStory.viewedBy?.length ?? 0}
            </ThemedText>
            {currentStory.viewers && currentStory.viewers.length > 0 ? (
              <ScrollView style={styles.viewerList} showsVerticalScrollIndicator={false}>
                {currentStory.viewers.map((viewer) => (
                  <Pressable
                    key={viewer.id}
                    style={styles.viewerItem}
                    onPress={() => {
                      setShowViewers(false);
                      resumeProgress();
                      navigation.navigate("ProfileDetail", { userId: viewer.id });
                    }}
                  >
                    <Image
                      source={viewer.photo ? getPhotoSource(viewer.photo) : require('../assets/icon.png')}
                      style={styles.viewerAvatar}
                    />
                    <View style={styles.viewerInfo}>
                      <ThemedText style={styles.viewerName}>{viewer.name}</ThemedText>
                      <ThemedText style={styles.viewerTime}>{formatTime(viewer.viewedAt)}</ThemedText>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View style={styles.viewerEmptyState}>
                <Ionicons name="eye-outline" size={32} color="rgba(255,255,255,0.3)" />
                <ThemedText style={styles.viewerEmptyText}>
                  {(currentStory.viewCount ?? currentStory.viewedBy?.length ?? 0) > 0
                    ? `${currentStory.viewCount ?? currentStory.viewedBy?.length ?? 0} ${(currentStory.viewCount ?? currentStory.viewedBy?.length ?? 0) === 1 ? 'person' : 'people'} viewed your story.\nUpgrade to Premium to see who.`
                    : 'No views yet'}
                </ThemedText>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Report Story Modal */}
      <Modal
        visible={showReportModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowReportModal(false); resumeProgress(); }}
      >
        <Pressable
          style={styles.reportModalOverlay}
          onPress={() => { setShowReportModal(false); resumeProgress(); }}
        >
          <KAVController behavior="padding" style={{ width: '100%' }}>
          <Pressable style={styles.reportModalSheet} onPress={() => {}}>
            <View style={styles.reportModalHandle} />
            <ThemedText style={styles.reportModalTitle}>Report Story</ThemedText>
            <ThemedText style={styles.reportModalSubtitle}>
              What's wrong with {userName}'s story?
            </ThemedText>

            <View style={styles.reportReasonList}>
              {[
                { id: 'inappropriate', label: 'Inappropriate Content' },
                { id: 'harassment', label: 'Harassment or Bullying' },
                { id: 'spam', label: 'Spam or Scam' },
                { id: 'fake', label: 'Fake Profile' },
                { id: 'underage', label: 'Underage User' },
                { id: 'other', label: 'Other' },
              ].map(r => (
                <Pressable
                  key={r.id}
                  style={[
                    styles.reportReasonChip,
                    reportReason === r.id && styles.reportReasonChipSelected,
                  ]}
                  onPress={() => setReportReason(r.id)}
                >
                  {reportReason === r.id && (
                    <Ionicons name="checkmark-circle" size={16} color="#FF6B6B" style={{ marginRight: 6 }} />
                  )}
                  <ThemedText style={[
                    styles.reportReasonText,
                    reportReason === r.id && styles.reportReasonTextSelected,
                  ]}>
                    {r.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.reportDetailsInput}
              placeholder="Add more details (optional)..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={reportDetails}
              onChangeText={setReportDetails}
              multiline
              numberOfLines={3}
              maxLength={300}
            />

            <View style={styles.reportModalActions}>
              <Pressable
                style={styles.reportCancelButton}
                onPress={() => { setShowReportModal(false); resumeProgress(); }}
              >
                <ThemedText style={styles.reportCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.reportSubmitButton, reportLoading && { opacity: 0.6 }]}
                onPress={handleSubmitReport}
                disabled={reportLoading}
              >
                {reportLoading
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <ThemedText style={styles.reportSubmitText}>Submit Report</ThemedText>
                }
              </Pressable>
            </View>
          </Pressable>
          </KAVController>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  noStoriesText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 18,
    marginTop: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  headerButtonHighVis: {
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  accessHint: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 24,
  },
  backButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  videoContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  storyImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  textStoryBg: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  textStoryContent: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    paddingHorizontal: 20,
    lineHeight: 38,
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 20,
    zIndex: 10,
  },
  progressContainer: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 12,
    paddingTop: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#FFF",
    borderRadius: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FFF",
  },
  userName: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  addStoryBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyTime: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  tapAreas: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 5,
  },
  leftTap: {
    flex: 1,
  },
  rightTap: {
    flex: 2,
  },
  bottomGradientWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
  },
  bottomGradient: {
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  bottomActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 24,
  },
  replyButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "500",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
  replyInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 24,
    paddingHorizontal: 16,
    gap: 12,
  },
  replyInput: {
    flex: 1,
    color: "#FFF",
    fontSize: 16,
    paddingVertical: 14,
  },
  sendButton: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
  },
  reactionPicker: {
    position: 'absolute',
    bottom: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 32,
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 8,
  },
  reactionEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  reactionEmojiSelected: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    transform: [{ scale: 1.1 }],
  },
  reactionEmojiText: {
    fontSize: 24,
  },
  activeReaction: {
    fontSize: 28,
  },
  editContainer: {
    width: '100%',
    alignItems: 'center',
    zIndex: 20,
  },
  editInput: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFF",
    textAlign: "center",
    width: '100%',
    minHeight: 150,
  },
  editActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  editActionButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  editActionText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  viewersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  viewerModalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  viewerModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  viewerModalTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  viewerList: {
    maxHeight: SCREEN_HEIGHT * 0.4,
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  viewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  viewerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  viewerName: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  viewerTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  viewerEmptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  viewerEmptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  storyMenuDropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: 'rgba(30,30,30,0.97)',
    borderRadius: 14,
    overflow: 'hidden',
    minWidth: 150,
    zIndex: 100,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  storyMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 10,
  },
  storyMenuItemDanger: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  storyMenuItemText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '500',
  },
  replyCloseButton: {
    padding: 6,
    marginRight: 4,
  },
  reportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  reportModalSheet: {
    backgroundColor: '#1A1A2E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
  },
  reportModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  reportModalTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  reportModalSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginBottom: 20,
  },
  reportReasonList: {
    gap: 8,
    marginBottom: 16,
  },
  reportReasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  reportReasonChipSelected: {
    borderColor: '#FF6B6B',
    backgroundColor: 'rgba(255,107,107,0.12)',
  },
  reportReasonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '500',
  },
  reportReasonTextSelected: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  reportDetailsInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: '#FFF',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  reportModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  reportCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  reportCancelText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600',
  },
  reportSubmitButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
  },
  reportSubmitText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

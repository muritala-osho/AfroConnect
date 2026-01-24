import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Dimensions, StatusBar, Animated, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
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

interface Story {
  _id: string;
  type: "image" | "text" | "video";
  imageUrl?: string;
  mediaUrl?: string;
  textContent?: string;
  backgroundColor?: string[];
  createdAt: string;
  viewedBy?: string[];
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
  const { get, post, del } = useApi();
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

  const REACTIONS = ["❤️", "🔥", "😍", "😂", "😮", "😢"];

  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchStories = async () => {
      try {
        setLoading(true);
        // Add a fallback for own stories to ensure they always load
        const isOwn = String(userId) === String(user?.id) || String(userId) === String((user as any)?._id) || (route.params as any)?.isOwnStory === true;
        const endpoint = isOwn ? `/stories/my-stories` : `/stories/user/${userId}`;
        const response = await get<{ stories: Story[]; message?: string }>(endpoint, token);
        
        if (response.success && response.data?.stories) {
          const fetchedStories = response.data.stories;
          setStories(fetchedStories);
          if (fetchedStories.length > 0) {
            markStoryViewed(fetchedStories[0]?._id);
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
        // If we're looking at our own stories and get a 404/403, just set empty stories
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
    if (stories.length > 0 && !paused) {
      startProgress();
    }
    return () => {
      if (progressAnimation.current) {
        progressAnimation.current.stop();
      }
    };
  }, [currentIndex, stories.length, paused]);

  const api = useApi();
  const markStoryViewed = async (storyId: string) => {
    if (!token || !storyId) return;
    try {
      await post(`/stories/${storyId}/view`, {}, token);
    } catch (error) {
      console.log("View tracking error:", error);
    }
  };

  const isOwnStory = 
    String(userId) === String(user?.id) || 
    String(userId) === String((user as any)?._id) ||
    (route.params as any)?.isOwnStory === true;
  
  // Debug logging
  console.log('[StoryViewer] isOwnStory check:', { userId, 'user.id': user?.id, 'user._id': (user as any)?._id, isOwnStory, 'route.isOwnStory': (route.params as any)?.isOwnStory });

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
              const response = await api.del(`/stories/${currentStory._id}`, token);
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
      // Create a temporary object to hold the PUT data
      const putData = {
        textContent: editingText,
        backgroundColor: currentStory.backgroundColor
      };
      
      const response = await api.put<{ success: boolean; message: string }>(`/stories/${currentStory._id}`, putData, token);
      
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
      await post(`/stories/${stories[currentIndex]._id}/reply`, {
        message: replyText,
      }, token);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setReplyText("");
      setShowReplyInput(false);
    } catch (error) {
      console.error("Reply error:", error);
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
    if (!currentStory || !currentStory.imageUrl) {
      Alert.alert("Error", "This story cannot be shared");
      return;
    }
    
    try {
      const { Share } = require('react-native');
      // Use the actual image URL and include a fallback if needed
      const shareUrl = currentStory.imageUrl;
      const shareMessage = `Check out ${userName}'s story on AfroConnect! ${shareUrl}`;
      
      const result = await Share.share({
        message: shareMessage,
        url: shareUrl,
      });
      
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
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

  if (!currentStory) return null;

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#FFF" />
      </View>
    );
  }

  if (stories.length === 0 || accessDenied) {
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
        <View style={StyleSheet.absoluteFillObject}>
          <Video
            source={{ uri: (currentStory.imageUrl || currentStory.mediaUrl) as string }}
            style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={!paused}
            isLooping={false}
            onPlaybackStatusUpdate={(status: any) => {
              if (status.isLoaded && status.durationMillis && videoDuration !== status.durationMillis) {
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
                // If it's my own story, I might want to upload another or view my profile
                // but let's just go to my profile to be safe and avoid the crash if navigation is complex
                navigation.navigate("MyProfile" as any);
              } else {
                navigation.navigate("ProfileDetail", { userId });
              }
            }}
          >
            <View style={styles.avatarContainer}>
              <Image
                source={userPhoto ? getPhotoSource(userPhoto) : { uri: "https://via.placeholder.com/40" }}
                style={styles.userAvatar}
                onLoad={() => {
                  // expo-image onLoad
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
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.userName} numberOfLines={1}>{userName}</ThemedText>
              <ThemedText style={styles.storyTime}>
                {formatTime(currentStory.createdAt)}
              </ThemedText>
            </View>
          </Pressable>

          <View style={styles.headerActions}>
            {isOwnStory && currentStory.type === 'text' && (
              <Pressable
                style={styles.headerButtonHighVis}
                onPress={startEditing}
              >
                <Ionicons name="pencil" size={24} color="#FFF" />
              </Pressable>
            )}
            {isOwnStory && (
              <Pressable
                style={[styles.headerButtonHighVis, { backgroundColor: 'rgba(255,50,50,0.7)' }]}
                onPress={handleDeleteStory}
              >
                <Ionicons name="trash-outline" size={24} color="#FFF" />
              </Pressable>
            )}
            <Pressable
              style={styles.headerButtonHighVis}
              onPress={paused ? resumeProgress : pauseProgress}
            >
              <Ionicons
                name={paused ? "play" : "pause"}
                size={24}
                color="#FFF"
              />
            </Pressable>
            <Pressable
              style={styles.headerButtonHighVis}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="close" size={28} color="#FFF" />
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

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.6)"]}
        style={[styles.bottomGradient, { paddingBottom: insets.bottom + 16 }]}
      >
        {showReplyInput ? (
          <View style={styles.replyInputContainer}>
            <TextInput
              style={styles.replyInput}
              placeholder="Send a message..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={replyText}
              onChangeText={setReplyText}
              autoFocus
              onBlur={() => setShowReplyInput(false)}
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
            </View>
          </View>
        ) : (
          <View style={[styles.bottomActions, { justifyContent: 'center' }]}>
            <ThemedText style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
              Viewed by {currentStory.viewedBy?.length || 0} people
            </ThemedText>
          </View>
        )}
      </LinearGradient>
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
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 24,
    width: 52,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 8,
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
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 40,
    zIndex: 10,
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
});

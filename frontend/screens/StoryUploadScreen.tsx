import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
  ScrollView,
  Platform,
  TouchableOpacity,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { getApiBaseUrl } from "@/constants/config";
import { LinearGradient } from "expo-linear-gradient";

type StoryUploadScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "StoryUpload"
>;

interface StoryUploadScreenProps {
  navigation: StoryUploadScreenNavigationProp;
}

const BACKGROUND_COLORS = [
  ["#FF6B6B", "#FF8E8E"],
  ["#4ECDC4", "#6EE7DF"],
  ["#45B7D1", "#68D8F4"],
  ["#96CEB4", "#B8E8D0"],
  ["#FFEAA7", "#FFF6C9"],
  ["#DDA0DD", "#E8C5E8"],
  ["#FF9FF3", "#FFC0F9"],
  ["#54A0FF", "#7BB8FF"],
];

export default function StoryUploadScreen({
  navigation,
}: StoryUploadScreenProps) {
  const { theme, isDark } = useTheme();
  const { token, user } = useAuth();
  const { post } = useApi();
  const insets = useSafeAreaInsets();

  const [isUploading, setIsUploading] = useState(false);
  const [storyType, setStoryType] = useState<"text" | "image" | "video">("image");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [textContent, setTextContent] = useState("");
  const [selectedBgIndex, setSelectedBgIndex] = useState(0);
  const [duration, setDuration] = useState(24);

  const pickMedia = async (type: 'image' | 'video') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        `Please allow access to your ${type} library`
      );
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: type === 'image' ? ['images'] : ['videos'],
        quality: 0.8,
        allowsEditing: true,
        aspect: [9, 16],
      });

      if (!result.canceled && result.assets[0]) {
        if (type === 'image') {
          setSelectedImage(result.assets[0].uri);
          setSelectedVideo(null);
          setStoryType("image");
        } else {
          setSelectedVideo(result.assets[0].uri);
          setSelectedImage(null);
          setStoryType("video");
        }
      }
    } catch (error) {
      console.error("Media picker error:", error);
      Alert.alert("Error", `Failed to pick ${type}`);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Please allow camera access");
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: true,
        aspect: [9, 16],
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setStoryType("image");
      }
    } catch (error) {
      console.error("Camera error:", error);
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const uploadStory = async () => {
    if (storyType === "text" && !textContent.trim()) {
      Alert.alert("Error", "Please enter some text for your story");
      return;
    }

    if (storyType === "image" && !selectedImage) {
      Alert.alert("Error", "Please select an image for your story");
      return;
    }

    setIsUploading(true);

    try {
      let mediaUrl = null;

      if ((storyType === "image" && selectedImage) || (storyType === "video" && selectedVideo)) {
        const formData = new FormData();
        const uri = storyType === "image" ? selectedImage : selectedVideo;
        const uploadPath = storyType === "image" ? "photo" : "video";
        const fieldName = "file";
        
        // Handle web vs native differently
        if (Platform.OS === 'web') {
          // On web, fetch the blob from the URI
          const response = await fetch(uri!);
          const blob = await response.blob();
          formData.append(fieldName, blob, `story_${Date.now()}.${storyType === "image" ? "jpg" : "mp4"}`);
        } else {
          // On native, use the object format
          formData.append(fieldName, {
            uri: uri,
            type: storyType === "image" ? "image/jpeg" : "video/mp4",
            name: `story_${Date.now()}.${storyType === "image" ? "jpg" : "mp4"}`,
          } as any);
        }

        const uploadResponse = await fetch(`${getApiBaseUrl()}/api/upload/${uploadPath}`, {
          method: "POST",
          headers: { 
            Authorization: `Bearer ${token}`,
            'Accept': 'application/json',
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error("Upload error response:", errorText);
          throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }

        const uploadData = await uploadResponse.json();
        if (!uploadData.success) {
          throw new Error(uploadData.message || "Upload failed");
        }
        mediaUrl = uploadData.url;
      }

      const durationInt = parseInt(duration.toString());

      const storyData: Record<string, any> = {
        type: storyType,
        content: storyType === "text" ? textContent : (storyType === "image" ? "Photo story" : "Video story"),
        durationHours: durationInt,
      };

      if (storyType === "text") {
        storyData.textContent = textContent;
        storyData.backgroundColor = Array.isArray(BACKGROUND_COLORS[selectedBgIndex])
          ? BACKGROUND_COLORS[selectedBgIndex][0]
          : BACKGROUND_COLORS[selectedBgIndex];
      }

      if (mediaUrl) {
        storyData.mediaUrl = mediaUrl;
      }

      const response = await post<{ story: any }>("/stories", storyData, token || "");

      if (response.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Update user state locally to include the new story immediately
        if (user) {
          const newStory = response.data?.story || {
            _id: Date.now().toString(),
            ...storyData,
            createdAt: new Date().toISOString()
          };
          // We don't have a direct setAuthUser here, so we rely on fetchUser or navigation reload
        }

        await AsyncStorage.setItem('@story_posted', Date.now().toString());
        Alert.alert("Posted!", `Your story is now live for ${durationInt} hours!`, [
          { text: "OK", onPress: () => {
            AsyncStorage.setItem('@story_posted', Date.now().toString()).then(() => {
              navigation.goBack();
            });
          }},
        ]);
      } else {
        throw new Error(response.message || "Failed to create story");
      }
    } catch (error) {
      console.error("Story upload error:", error);
      Alert.alert("Error", "Failed to post story. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={theme.background}
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="close" size={28} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
          Create Story
        </ThemedText>
        <Pressable
          onPress={uploadStory}
          disabled={isUploading}
          style={[styles.postBtn, { backgroundColor: theme.primary }]}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <ThemedText style={styles.postBtnText}>Post</ThemedText>
          )}
        </Pressable>
      </View>

      <View style={styles.tabContainer}>
        <Pressable
          style={[
            styles.tab,
            storyType === "image" && { backgroundColor: theme.primary },
          ]}
          onPress={() => setStoryType("image")}
        >
          <Ionicons
            name="image"
            size={20}
            color={storyType === "image" ? "#FFF" : theme.textSecondary}
          />
          <ThemedText
            style={[
              styles.tabText,
              { color: storyType === "image" ? "#FFF" : theme.textSecondary },
            ]}
          >
            Photo
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            storyType === "video" && { backgroundColor: theme.primary },
          ]}
          onPress={() => setStoryType("video")}
        >
          <Ionicons
            name="videocam"
            size={20}
            color={storyType === "video" ? "#FFF" : theme.textSecondary}
          />
          <ThemedText
            style={[
              styles.tabText,
              { color: storyType === "video" ? "#FFF" : theme.textSecondary },
            ]}
          >
            Video
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            storyType === "text" && { backgroundColor: theme.primary },
          ]}
          onPress={() => setStoryType("text")}
        >
          <Ionicons
            name="text"
            size={20}
            color={storyType === "text" ? "#FFF" : theme.textSecondary}
          />
          <ThemedText
            style={[
              styles.tabText,
              { color: storyType === "text" ? "#FFF" : theme.textSecondary },
            ]}
          >
            Text
          </ThemedText>
        </Pressable>
      </View>

      {storyType === "image" ? (
        <View style={styles.imageSection}>
          {selectedImage ? (
            <View style={styles.previewContainer}>
              <Image
                source={{ uri: selectedImage }}
                style={[styles.previewImage, { borderRadius: 0 }]}
                contentFit="contain"
              />
              <Pressable
                style={styles.changeImageBtn}
                onPress={() => setSelectedImage(null)}
              >
                <Ionicons name="close-circle" size={32} color="#FFF" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.imagePickerContainer}>
              <Pressable
                style={[styles.imagePickerBtn, { backgroundColor: theme.surface }]}
                onPress={() => pickMedia('image')}
              >
                <Ionicons name="images" size={48} color={theme.primary} />
                <ThemedText
                  style={[styles.imagePickerText, { color: theme.text }]}
                >
                  Choose from Gallery
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.imagePickerBtn, { backgroundColor: theme.surface }]}
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={48} color={theme.primary} />
                <ThemedText
                  style={[styles.imagePickerText, { color: theme.text }]}
                >
                  Take a Photo
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      ) : storyType === "video" ? (
        <View style={styles.imageSection}>
          {selectedVideo ? (
            <View style={styles.previewContainer}>
              <View style={[styles.previewImage, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="videocam" size={64} color="#FFF" />
                <ThemedText style={{ color: '#FFF', marginTop: 10 }}>Video Selected</ThemedText>
              </View>
              <Pressable
                style={styles.changeImageBtn}
                onPress={() => setSelectedVideo(null)}
              >
                <Ionicons name="close-circle" size={32} color="#FFF" />
              </Pressable>
            </View>
          ) : (
            <View style={styles.imagePickerContainer}>
              <Pressable
                style={[styles.imagePickerBtn, { backgroundColor: theme.surface }]}
                onPress={() => pickMedia('video')}
              >
                <Ionicons name="videocam" size={48} color={theme.primary} />
                <ThemedText
                  style={[styles.imagePickerText, { color: theme.text }]}
                >
                  Choose Video from Gallery
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.textSection}>
          <LinearGradient
            colors={BACKGROUND_COLORS[selectedBgIndex] as [string, string]}
            style={styles.textPreview}
          >
            <TextInput
              style={styles.storyTextInput}
              placeholder="Type your story..."
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={textContent}
              onChangeText={setTextContent}
              multiline
              maxLength={200}
              textAlign="center"
            />
          </LinearGradient>

          <View style={styles.durationSection}>
            <ThemedText style={[styles.bgLabel, { color: theme.text }]}>Story Duration (Hours)</ThemedText>
            <View style={styles.durationOptions}>
              {[24, 48, 72, 168].map((h) => (
                <Pressable
                  key={h}
                  style={[
                    styles.durationOption,
                    duration === h && { backgroundColor: theme.primary, borderColor: theme.primary }
                  ]}
                  onPress={() => setDuration(h)}
                >
                  <ThemedText style={[styles.durationText, { color: duration === h ? '#FFF' : theme.textSecondary }]}>
                    {h === 168 ? '1 Week' : `${h}h`}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <ThemedText style={[styles.bgLabel, { color: theme.text }]}>
            Background Color
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bgColorContainer}
          >
            {BACKGROUND_COLORS.map((colors, index) => (
              <Pressable
                key={index}
                onPress={() => setSelectedBgIndex(index)}
                style={[
                  styles.bgColorBtn,
                  selectedBgIndex === index && styles.bgColorBtnSelected,
                ]}
              >
                <LinearGradient
                  colors={colors as [string, string]}
                  style={styles.bgColorGradient}
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Feather name="clock" size={16} color={theme.textSecondary} />
        <ThemedText style={[styles.footerText, { color: theme.textSecondary }]}>
          {`Live for ${duration} hours`}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backBtn: { padding: Spacing.xs },
  headerTitle: { ...Typography.h3, fontWeight: "600" },
  postBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  postBtnText: { color: "#FFF", fontWeight: "600" },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: "rgba(128,128,128,0.1)",
  },
  tabText: { fontWeight: "500" },
  imageSection: { flex: 1, paddingHorizontal: Spacing.lg },
  previewContainer: { flex: 1, borderRadius: BorderRadius.xl, overflow: "hidden" },
  previewImage: { width: "100%", height: "100%" },
  changeImageBtn: { position: "absolute", top: Spacing.md, right: Spacing.md },
  imagePickerContainer: {
    flex: 1,
    justifyContent: "center",
    gap: Spacing.lg,
  },
  imagePickerBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.xl,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  imagePickerText: { ...Typography.body, fontWeight: "500" },
  textSection: { flex: 1, paddingHorizontal: Spacing.lg },
  textPreview: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  durationSection: {
    marginTop: Spacing.lg,
  },
  durationOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  durationOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
  },
  storyTextInput: {
    ...Typography.h2,
    color: "#FFF",
    textAlign: "center",
    width: "100%",
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  bgLabel: { ...Typography.body, fontWeight: "500", marginTop: Spacing.lg, marginBottom: Spacing.sm },
  bgColorContainer: { gap: Spacing.sm, paddingVertical: Spacing.sm },
  bgColorBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    borderWidth: 2,
    borderColor: "transparent",
  },
  bgColorBtnSelected: { borderColor: "#FFF", borderWidth: 3 },
  bgColorGradient: { flex: 1, borderRadius: 20 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },
  extendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.2)',
  },
  extendBtnText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  footerText: { ...Typography.caption },
});

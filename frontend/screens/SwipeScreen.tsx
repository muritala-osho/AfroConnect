import logger from '@/utils/logger';
import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, Alert, ActivityIndicator, Platform, Dimensions } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { Spacing, BorderRadius, Typography, Shadow } from "@/constants/theme";
import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { getPhotoSource } from "@/utils/photos";

type SwipeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Swipe">;

interface SwipeScreenProps {
  navigation: SwipeScreenNavigationProp;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  return Math.max(0, Number(distanceKm.toFixed(1)));
}

interface PotentialMatch {
  id: string;
  name: string;
  age: number;
  bio: string;
  photos: any[];
  interests: string[];
  location?: { lat?: number; lng?: number; coordinates?: number[] };
  distance?: number;
  gender?: string;
}

export default function SwipeScreen({ navigation }: SwipeScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const api = useApi();
  const [potentialMatches, setPotentialMatches] = useState<PotentialMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const handleTap = (evt: any) => {
    const currentProfile = potentialMatches[currentIndex];
    if (!currentProfile || !currentProfile.photos || currentProfile.photos.length <= 1) return;
    
    const tapX = evt.nativeEvent.locationX;
    const { width } = Dimensions.get('window');
    
    if (tapX > width / 2) {
      setCurrentPhotoIndex((prev) => (prev + 1) % currentProfile.photos.length);
    } else {
      setCurrentPhotoIndex((prev) => (prev - 1 + currentProfile.photos.length) % currentProfile.photos.length);
    }
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const loadPotentialMatches = useCallback(async () => {
    if (!user?.id || !token) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const params: Record<string, any> = {};

      if (user.location?.lat && user.location?.lng) {
        params.lat = user.location.lat;
        params.lng = user.location.lng;
        params.maxDistance = user.preferences?.maxDistance || 50;
      }

      if (user.preferences?.ageRange) {
        params.minAge = user.preferences.ageRange.min;
        params.maxAge = user.preferences.ageRange.max;
      }

      const userGender = user.gender?.toLowerCase();
      if (userGender === 'male') {
        params.genders = 'female';
      } else if (userGender === 'female') {
        params.genders = 'male';
      }

      const response = await api.get<{ success: boolean; users: any[] }>('/users/nearby', params, token);

      logger.log("Nearby Users Response:", response);
      const usersData = response.data as any;
      const users = usersData?.users || [];
      logger.log("Extracted Users:", users.length);

      if (response.success && users.length > 0) {
        const mappedUsers = users.map((u: any) => ({
          id: u._id || u.id,
          name: u.name || 'Unknown',
          age: u.age || 25,
          bio: u.bio || '',
          photos: u.photos || [],
          interests: u.interests || [],
          location: u.location,
          distance: typeof u.distance === 'number' ? u.distance : 0,
          gender: u.gender || 'unknown',
        }));

        mappedUsers.sort((a: any, b: any) => {
          const scoreA = a.compatibilityScore || 0;
          const scoreB = b.compatibilityScore || 0;
          return scoreB - scoreA;
        });
        setPotentialMatches(mappedUsers);
      } else {
        setPotentialMatches([]);
      }
    } catch (error) {
      logger.error("Error loading potential matches:", error);
      setPotentialMatches([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, token, api, user?.location, user?.preferences, user?.gender]);

  useEffect(() => {
    loadPotentialMatches();
  }, [loadPotentialMatches]);

  const triggerHaptic = async (style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(style);
    }
  };

  const triggerNotification = async (type: Haptics.NotificationFeedbackType) => {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(type);
    }
  };

  const handlePass = async () => {
    await triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    const currentProfile = potentialMatches[currentIndex];
    
    if (token && currentProfile) {
      try {
        await api.post('/match/swipe', { targetUserId: currentProfile.id, action: 'pass' }, token);
      } catch (error) {
        logger.error("Error recording pass:", error);
      }
    }

    if (currentIndex < potentialMatches.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      loadPotentialMatches();
    }
  };

  const handleLike = async () => {
    if (!user || !token) return;
    const currentProfile = potentialMatches[currentIndex];
    
    await triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const response = await api.post<{ success: boolean; isMatch: boolean; message: string }>(
        '/match/swipe',
        { targetUserId: currentProfile.id, action: 'like' },
        token
      );

      if (response.success && response.data?.isMatch) {
        await triggerNotification(Haptics.NotificationFeedbackType.Success);
        navigation.navigate("MatchPopup", {
          currentUser: user,
          matchedUser: currentProfile,
          isSuperLike: false
        });
      }
    } catch (error: any) {
      logger.error("Error recording like:", error);
      const errMsg = error?.message || error?.response?.data?.message || '';
      if (errMsg.includes('Daily swipe limit') || errMsg.includes('swipe limit')) {
        Alert.alert(
          'Out of Likes',
          "You've used all 10 daily likes. Upgrade to Premium for unlimited likes!",
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Upgrade', onPress: () => navigation.navigate('Premium') }
          ]
        );
        return;
      }
    }

    if (currentIndex < potentialMatches.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      loadPotentialMatches();
    }
  };

  const handleSuperLike = async () => {
    if (!user || !token) return;
    
    if (!user.premium?.isActive) {
      Alert.alert(
        "Premium Feature",
        "Super Likes are a premium feature. Upgrade to stand out!",
        [
          { text: "Upgrade Now", onPress: () => navigation.navigate("Premium") },
          { text: "Maybe Later", style: "cancel" }
        ]
      );
      return;
    }

    const currentProfile = potentialMatches[currentIndex];
    
    await triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    
    try {
      const response = await api.post<{ success: boolean; isMatch: boolean; message: string }>(
        '/match/swipe',
        { targetUserId: currentProfile.id, action: 'superlike' },
        token
      );

      if (response.success) {
        await triggerNotification(Haptics.NotificationFeedbackType.Success);
        
        if (response.data?.isMatch) {
          navigation.navigate("MatchPopup", {
            currentUser: user,
            matchedUser: currentProfile,
            isSuperLike: true
          });
        } else {
          Alert.alert("Super Like Sent!", `${currentProfile.name} will see that you Super Liked them!`);
        }
      } else {
        Alert.alert("Error", response.message || "Failed to send Super Like");
      }
    } catch (error: any) {
      logger.error("Error sending super like:", error);
      const errMsg = error?.message || error?.response?.data?.message || '';
      if (errMsg.includes('Daily swipe limit') || errMsg.includes('swipe limit')) {
        Alert.alert(
          'Out of Likes',
          "You've used all 10 daily likes. Upgrade to Premium for unlimited likes!",
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Upgrade', onPress: () => navigation.navigate('Premium') }
          ]
        );
        return;
      }
      Alert.alert("Error", error.message || "Failed to send Super Like");
    }

    if (currentIndex < potentialMatches.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      navigation.goBack();
    }
  };

  const handleQuickReport = async () => {
    const currentProfile = potentialMatches[currentIndex];
    if (!currentProfile || !token) return;
    Alert.alert(
      'Report Profile',
      `Report ${currentProfile.name}'s profile?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post('/reports', {
                reportedUserId: currentProfile.id,
                reason: 'inappropriate',
                contentType: 'user',
                description: 'Reported from discovery',
              }, token);
              Alert.alert('Reported', 'Thank you. We will review this profile.');
              if (currentIndex < potentialMatches.length - 1) {
                setCurrentIndex(currentIndex + 1);
              } else {
                loadPotentialMatches();
              }
            } catch {
              Alert.alert('Error', 'Could not submit report. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleRewind = async () => {
    if (!user?.premium?.isActive) {
      Alert.alert(
        "Premium Feature",
        "Rewind is a premium feature. Upgrade to bring back your last swipe!",
        [
          { text: "Upgrade Now", onPress: () => navigation.navigate("Premium") },
          { text: "Maybe Later", style: "cancel" }
        ]
      );
      return;
    }
    await triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <View style={[styles.loadingIcon, { borderColor: theme.primary }]}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
        <ThemedText style={[styles.loadingTitle, { color: theme.text }]}>
          Finding Your Matches
        </ThemedText>
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
          Looking for people nearby...
        </ThemedText>
      </ThemedView>
    );
  }

  const currentProfile = potentialMatches[currentIndex];

  if (!currentProfile) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <Feather name="user-x" size={64} color={theme.textSecondary} />
        <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
          No more profiles
        </ThemedText>
        <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          Check back later for more matches!
        </ThemedText>
        <Pressable
          style={[styles.backButton, { backgroundColor: theme.primary, marginTop: Spacing.xl }]}
          onPress={() => navigation.goBack()}
        >
          <ThemedText style={[styles.backButtonText, { color: theme.buttonText }]}>
            Go Back
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const distance = currentProfile.distance ?? (
    (user?.location?.lat && user?.location?.lng && currentProfile.location?.lat && currentProfile.location?.lng)
      ? calculateDistance(user.location.lat, user.location.lng, currentProfile.location.lat, currentProfile.location.lng)
      : 0
  );

  const photoSource = currentProfile.photos[currentPhotoIndex] ? getPhotoSource(currentProfile.photos[currentPhotoIndex]) : null;

  return (
    <ThemedView style={styles.container}>
      <Pressable 
        onPress={handleTap}
        style={[styles.card, { backgroundColor: theme.backgroundSecondary }]}
      >
        {photoSource ? (
          <Image
            source={photoSource}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.image, { backgroundColor: theme.backgroundSecondary, alignItems: "center", justifyContent: "center" }]}>
            <Feather name="user" size={120} color={theme.textSecondary} />
          </View>
        )}

        <View style={[styles.topOverlay, { paddingTop: insets.top + Spacing.md }]}>
          <View style={styles.photoIndicators}>
            {currentProfile.photos.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.photoIndicator,
                  { backgroundColor: index === currentPhotoIndex ? "#FFF" : "rgba(255,255,255,0.4)" }
                ]}
              />
            ))}
          </View>
          <View style={styles.progressBar}>
            <ThemedText style={styles.progressText}>
              {currentIndex + 1} / {potentialMatches.length}
            </ThemedText>
          </View>
        </View>

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.6)"]}
          style={[styles.infoOverlay, { paddingBottom: insets.bottom + 100 }]}
        >
          <View style={styles.profileInfo}>
            <View style={styles.nameRow}>
              <ThemedText style={styles.name}>
                {currentProfile.name}, {currentProfile.age}
              </ThemedText>
              <Pressable
                style={styles.infoButton}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  navigation.navigate("ProfileDetail", { userId: currentProfile.id });
                }}
              >
                <Feather name="info" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
            
            <View style={styles.distanceRow}>
              <Feather name="map-pin" size={14} color="#FFFFFF" />
              <ThemedText style={styles.distance}>
                {user?.premium?.isActive ? `${distance} km away` : 'Upgrade to see distance'}
              </ThemedText>
            </View>
            
            {currentProfile.bio ? (
              <ThemedText style={styles.bio} numberOfLines={2}>
                {currentProfile.bio}
              </ThemedText>
            ) : null}
            
            {currentProfile.interests && currentProfile.interests.length > 0 ? (
              <View style={styles.interestsRow}>
                {currentProfile.interests.slice(0, 3).map((interest, index) => (
                  <View key={index} style={styles.interestChip}>
                    <ThemedText style={styles.interestText}>
                      {interest}
                    </ThemedText>
                  </View>
                ))}
                {currentProfile.interests.length > 3 ? (
                  <ThemedText style={styles.moreInterests}>
                    +{currentProfile.interests.length - 3}
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
          </View>
        </LinearGradient>
      </Pressable>

      <View style={[styles.actionsContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          style={[styles.actionButton, styles.smallButton, { backgroundColor: theme.cardBackground }]}
          onPress={handleRewind}
          disabled={currentIndex === 0}
        >
          <Feather name="rotate-ccw" size={22} color={currentIndex === 0 ? theme.textSecondary : theme.rewind} />
        </Pressable>

        <Pressable
          style={[styles.actionButton, styles.smallButton, { backgroundColor: theme.cardBackground }]}
          onPress={handleSuperLike}
        >
          <Feather name="star" size={22} color={theme.superLike} />
        </Pressable>

          <Pressable
            style={[styles.actionButton, styles.smallButton, { backgroundColor: theme.cardBackground }]}
            onPress={() => navigation.navigate('BoostCenter')}
          >
            <Feather name="zap" size={22} color={theme.boost} />
          </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
    paddingHorizontal: Spacing.xxl,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingTitle: {
    ...Typography.h2,
    fontWeight: "700",
  },
  loadingText: {
    ...Typography.caption,
    textAlign: "center",
  },
  emptyTitle: {
    ...Typography.h2,
    marginTop: Spacing.lg,
    fontWeight: "700",
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  backButton: {
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    ...Shadow.medium,
  },
  backButtonText: {
    ...Typography.bodyBold,
  },
  photoIndicators: {
    flexDirection: 'row',
    gap: 4,
    width: '100%',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  photoIndicator: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  card: {
    flex: 1,
    overflow: "hidden",
  },
  image: {
    flex: 1,
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  progressBar: {
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  progressText: {
    ...Typography.small,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  infoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.huge,
  },
  profileInfo: {
    gap: Spacing.md,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    ...Typography.h1,
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  infoButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  distanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  distance: {
    ...Typography.body,
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bio: {
    ...Typography.body,
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    lineHeight: 22,
  },
  interestsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    alignItems: "center",
  },
  interestChip: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  interestText: {
    ...Typography.small,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  moreInterests: {
    ...Typography.small,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  actionsContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.large,
  },
  smallButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  largeButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
});

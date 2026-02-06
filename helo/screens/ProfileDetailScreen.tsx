import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getPhotoSource } from "@/utils/photos";
import ActivityStatus from "@/components/ActivityStatus";
import ProfilePrompts from "@/components/ProfilePrompts";
import { VerificationBadge } from "@/components/VerificationBadge";
import CompatibilityQuiz, { CompatibilityScore } from "@/components/CompatibilityQuiz";
import { ScreenScrollView } from "@/components/ScreenScrollView";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const DetailItem = ({ icon, label, value }: { icon: any; label: string; value: string }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={20} color={theme.primary} />
      <View style={{ marginLeft: 10 }}>
        <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>{label}</ThemedText>
        <ThemedText style={{ fontSize: 14, fontWeight: '600' }}>{value}</ThemedText>
      </View>
    </View>
  );
};

export default function ProfileDetailScreen() {
  const { theme } = useTheme();
  const { token, user: currentUser } = useAuth();
  const { get, post } = useApi();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { userId, isFromLikes, isFromVisitors } = route.params || {};

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [liked, setLiked] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchUser();
  }, [userId]);

  const fetchUser = async () => {
    try {
      const response = await get<{ user: any }>(`/users/${userId}`, token || "");
      if (response.success && response.data?.user) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error("Error loading user:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!token || actionLoading) return;
    setActionLoading(true);
    try {
      const response = await post<{ isMatch?: boolean; matchedUser?: any }>('/friends/request', { receiverId: userId }, token);
      if (response.success) {
        setLiked(true);
        if (response.data?.isMatch && response.data?.matchedUser) {
          const matchedUser = response.data.matchedUser;
          navigation.navigate('MatchPopup', {
            currentUser,
            matchedUser: {
              id: matchedUser._id || userId,
              name: matchedUser.name || 'Your Match',
              photos: matchedUser.photos || []
            },
            isSuperLike: false
          });
        }
      }
    } catch (error) {
      console.error('Like error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePass = async () => {
    if (!token || actionLoading) return;
    setActionLoading(true);
    try {
      await post('/match/swipe', { targetUserId: userId, action: 'pass' }, token);
      navigation.goBack();
    } catch (error) {
      console.error('Pass error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTap = (evt: any) => {
    if (!user || !user.photos || user.photos.length <= 1) return;
    
    const tapX = evt.nativeEvent.locationX;
    const { width } = Dimensions.get('window');
    
    if (tapX > width / 2) {
      if (currentPhotoIndex < user.photos.length - 1) {
        setCurrentPhotoIndex(currentPhotoIndex + 1);
      } else {
        setCurrentPhotoIndex(0);
      }
    } else {
      if (currentPhotoIndex > 0) {
        setCurrentPhotoIndex(currentPhotoIndex - 1);
      } else {
        setCurrentPhotoIndex(user.photos.length - 1);
      }
    }
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (!user) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ThemedText>User not found</ThemedText>
        <Pressable
          style={[styles.backButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.goBack()}
        >
          <ThemedText style={{ color: "#FFF" }}>Go Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenScrollView>
        <Pressable onPress={handleTap} style={styles.photoContainer}>
          {user.photos && user.photos.length > 0 ? (
            <Image
              source={getPhotoSource(user.photos[currentPhotoIndex]) || require("@/assets/images/placeholder-1.jpg")}
              style={styles.mainPhoto}
            />
          ) : (
            <Image
              source={require("@/assets/images/placeholder-1.jpg")}
              style={styles.mainPhoto}
            />
          )}
          {user.photos && user.photos.length > 1 && (
            <View style={styles.photoIndicators}>
              {user.photos.map((_: any, index: number) => (
                <View
                  key={index}
                  style={[
                    styles.indicator,
                    { backgroundColor: index === currentPhotoIndex ? "#FFF" : "rgba(255,255,255,0.5)" },
                  ]}
                />
              ))}
            </View>
          )}
          <Pressable style={styles.floatBack} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="#FFF" />
          </Pressable>
        </Pressable>

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.nameContainer}>
              <View style={styles.nameRow}>
                <ThemedText style={styles.name}>{user.name}{user.age ? `, ${user.age}` : ''}</ThemedText>
                {user.premium?.isActive && (
                  <Feather name="star" size={18} color="#FFD700" style={{ marginLeft: 6 }} />
                )}
                {user.verified && (
                  <Image 
                    source={require("@/assets/icons/verified-tick.png")} 
                    style={{ width: 24, height: 24, marginLeft: 6 }} 
                  />
                )}
              </View>
              <View style={styles.statusRow}>
                <ActivityStatus onlineStatus={user.onlineStatus || (user.online ? 'online' : 'offline')} />
                {user.username && (
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 14, marginLeft: 8 }}>
                    @{user.username}
                  </ThemedText>
                )}
              </View>
              {user.location?.city && (
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                  <ThemedText style={{ color: theme.textSecondary, fontSize: 14, marginLeft: 4 }}>
                    {user.location.city}{user.location.country ? `, ${user.location.country}` : ''}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          <View style={styles.actionButtonsContainer}>
            <View style={styles.likePassRow}>
              <Pressable
                style={[styles.passButton, { backgroundColor: theme.surface, borderWidth: 1, borderColor: '#FF6B6B' }]}
                onPress={handlePass}
                disabled={actionLoading}
              >
                <Ionicons name="close" size={28} color="#FF6B6B" />
              </Pressable>
              
              <Pressable
                style={[styles.likeButton, { backgroundColor: liked ? '#4CAF50' : theme.primary }]}
                onPress={handleLike}
                disabled={actionLoading || liked}
              >
                <Ionicons name={liked ? "checkmark" : "heart"} size={28} color="#FFF" />
              </Pressable>
            </View>

            <Pressable
              style={[styles.primaryActionButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                if (currentUser?.premium?.isActive) {
                  navigation.navigate('ChatDetail', { userId: user._id, userName: user.name });
                } else {
                  navigation.navigate('Premium' as any);
                }
              }}
            >
              <Feather name="message-circle" size={22} color="#FFF" />
              <ThemedText style={styles.primaryButtonText}>
                {currentUser?.premium?.isActive ? 'Send Message' : 'Unlock to Message'}
              </ThemedText>
              {!currentUser?.premium?.isActive && (
                <View style={styles.premiumBadge}>
                  <Ionicons name="star" size={12} color="#FFD700" />
                </View>
              )}
            </Pressable>
            
            <Pressable
              style={[styles.secondaryActionButton, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}
              onPress={() => navigation.navigate('DistanceWeather' as any, { userId: user._id, userName: user.name })}
            >
              <Ionicons name="location" size={20} color={theme.primary} />
              <ThemedText style={[styles.secondaryButtonText, { color: theme.text }]}>Distance & Weather</ThemedText>
            </Pressable>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>About Me</ThemedText>
            <ThemedText style={styles.bio}>{user.bio || "No bio yet."}</ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Details</ThemedText>
            <View style={styles.detailsGrid}>
              {user.distance !== undefined && <DetailItem icon="navigate-outline" label="Distance" value={`${Math.round(user.distance)} km away`} />}
              {user.gender && <DetailItem icon="person-outline" label="Gender" value={user.gender} />}
              {user.lookingFor && <DetailItem icon="heart-outline" label="Looking for" value={user.lookingFor} />}
              {user.zodiacSign && <DetailItem icon="star-outline" label="Zodiac" value={user.zodiacSign} />}
              {user.jobTitle && <DetailItem icon="briefcase-outline" label="Job" value={user.jobTitle} />}
              {user.education && <DetailItem icon="school-outline" label="Education" value={user.education} />}
              {user.lifestyle?.pets && <DetailItem icon="paw-outline" label="Pets" value={user.lifestyle.pets} />}
              {user.lifestyle?.relationshipStatus && <DetailItem icon="heart-outline" label="Relationship" value={user.lifestyle.relationshipStatus} />}
              {user.lifestyle?.religion && <DetailItem icon="sunny-outline" label="Religion" value={user.lifestyle.religion} />}
              {user.lifestyle?.ethnicity && <DetailItem icon="globe-outline" label="Ethnicity" value={user.lifestyle.ethnicity} />}
            </View>
          </View>

          {user.interests && user.interests.length > 0 && (
            <View style={styles.section}>
              <ThemedText style={styles.sectionTitle}>Interests</ThemedText>
              <View style={styles.interestsContainer}>
                {user.interests.map((interest: string, index: number) => (
                  <View key={index} style={[styles.interestTag, { backgroundColor: theme.primary + '20' }]}>
                    <ThemedText style={[styles.interestText, { color: theme.primary }]}>{interest}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

          <ProfilePrompts userId={user._id} isOwnProfile={false} />

          <CompatibilityScore userId={user._id} />

          <Pressable 
            style={[styles.quizActionCard, { backgroundColor: theme.primary + '15', borderColor: theme.primary }]}
            onPress={() => navigation.navigate('CompatibilityQuiz' as any)}
          >
            <View style={[styles.quizIcon, { backgroundColor: theme.primary }]}>
              <Ionicons name="help-circle" size={24} color="#fff" />
            </View>
            <View style={styles.quizTextContent}>
              <ThemedText style={styles.quizTitle}>Take Compatibility Quiz</ThemedText>
              <ThemedText style={styles.quizSubtitle}>See how well you match with others</ThemedText>
            </View>
            <Feather name="chevron-right" size={20} color={theme.primary} />
          </Pressable>

        </View>
      </ScreenScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { justifyContent: "center", alignItems: "center" },
  photoContainer: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.25, position: "relative" },
  mainPhoto: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.25 },
  photoIndicators: {
    position: "absolute",
    top: 10,
    flexDirection: "row",
    width: "100%",
    justifyContent: "center",
    gap: 4,
  },
  indicator: { height: 4, flex: 1, marginHorizontal: 2, borderRadius: 2 },
  floatBack: { position: "absolute", top: 40, left: 20, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "center", alignItems: "center" },
  content: { padding: Spacing.lg },
  header: { marginBottom: Spacing.lg },
  nameContainer: { gap: 6 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  statusRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  locationRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  name: { fontSize: 26, fontWeight: "800" },
  verifiedBadgeRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 12,
    marginTop: 4
  },
  verifiedText: { fontSize: 12, fontWeight: '600' },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  bio: { fontSize: 16, lineHeight: 24, opacity: 0.8 },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  detailItem: { width: '45%', flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  backButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 20 },
  quizActionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginVertical: Spacing.md,
  },
  quizIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  quizTextContent: { flex: 1 },
  quizTitle: { fontSize: 16, fontWeight: '700' },
  quizSubtitle: { fontSize: 12, opacity: 0.7 },
  interestsContainer: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 8 
  },
  actionButtonsContainer: {
    gap: 12,
    marginBottom: Spacing.lg,
  },
  likePassRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  passButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  premiumBadge: {
    marginLeft: 4,
  },
  secondaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  interestTag: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  interestText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

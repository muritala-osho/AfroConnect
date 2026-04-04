import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Image,
  Dimensions,
  Animated,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { LinearGradient } from "expo-linear-gradient";
import { getPhotoSource } from "@/utils/photos";
import ActivityStatus from "@/components/ActivityStatus";
import ProfilePrompts from "@/components/ProfilePrompts";
import { VerificationBadge } from "@/components/VerificationBadge";
import { PremiumBadge } from "@/components/PremiumBadge";
import CompatibilityQuiz, { CompatibilityScore } from "@/components/CompatibilityQuiz";
import CulturalCompatibilityScore from "@/components/CulturalCompatibilityScore";
import VoiceBio from "@/components/VoiceBio";
import { ScreenScrollView } from "@/components/ScreenScrollView";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PHOTO_HEIGHT = SCREEN_WIDTH * 1.25;

const INTEREST_COLORS = [
  { bg: '#FF6B6B15', border: '#FF6B6B40', text: '#FF6B6B' },
  { bg: '#4A90D915', border: '#4A90D940', text: '#4A90D9' },
  { bg: '#00D85615', border: '#00D85640', text: '#00B847' },
  { bg: '#9B59B615', border: '#9B59B640', text: '#9B59B6' },
  { bg: '#FF990015', border: '#FF990040', text: '#E68A00' },
  { bg: '#00B2FF15', border: '#00B2FF40', text: '#00B2FF' },
  { bg: '#E91E6315', border: '#E91E6340', text: '#E91E63' },
  { bg: '#4CAF5015', border: '#4CAF5040', text: '#4CAF50' },
];

const DetailItem = ({ icon, label, value }: { icon: any; label: string; value: string }) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.detailItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.detailIconWrap, { backgroundColor: theme.primary + '12' }]}>
        <Ionicons name={icon} size={18} color={theme.primary} />
      </View>
      <View style={styles.detailTextWrap}>
        <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
        <ThemedText style={[styles.detailValue, { color: theme.text }]}>{value}</ThemedText>
      </View>
    </View>
  );
};

const InfoPill = ({ icon, text, color }: { icon: string; text: string; color: string }) => {
  const { theme } = useTheme();
  return (
    <View style={[styles.infoPill, { backgroundColor: color + '12', borderColor: color + '25' }]}>
      <Ionicons name={icon as any} size={13} color={color} />
      <ThemedText style={[styles.infoPillText, { color }]}>{text}</ThemedText>
    </View>
  );
};
function getTimezoneFromCountry(country: string): string {
  const map: Record<string, string> = {
    'Nigeria': 'Africa/Lagos',
    'Ghana': 'Africa/Accra',
    'Kenya': 'Africa/Nairobi',
    'Uganda': 'Africa/Kampala',
    'Tanzania': 'Africa/Dar_es_Salaam',
    'Ethiopia': 'Africa/Addis_Ababa',
    'South Africa': 'Africa/Johannesburg',
    'Egypt': 'Africa/Cairo',
    'Morocco': 'Africa/Casablanca',
    'Tunisia': 'Africa/Tunis',
    'Algeria': 'Africa/Algiers',
    'Libya': 'Africa/Tripoli',
    'Sudan': 'Africa/Khartoum',
    'Cameroon': 'Africa/Douala',
    'Senegal': 'Africa/Dakar',
    'Ivory Coast': 'Africa/Abidjan',
    "Côte d'Ivoire": 'Africa/Abidjan',
    'Mali': 'Africa/Bamako',
    'Angola': 'Africa/Luanda',
    'Mozambique': 'Africa/Maputo',
    'Zimbabwe': 'Africa/Harare',
    'Zambia': 'Africa/Lusaka',
    'Rwanda': 'Africa/Kigali',
    'Botswana': 'Africa/Gaborone',
    'Namibia': 'Africa/Windhoek',
    'UK': 'Europe/London',
    'United Kingdom': 'Europe/London',
    'England': 'Europe/London',
    'France': 'Europe/Paris',
    'Germany': 'Europe/Berlin',
    'Italy': 'Europe/Rome',
    'Spain': 'Europe/Madrid',
    'Portugal': 'Europe/Lisbon',
    'Netherlands': 'Europe/Amsterdam',
    'Belgium': 'Europe/Brussels',
    'Switzerland': 'Europe/Zurich',
    'Sweden': 'Europe/Stockholm',
    'Norway': 'Europe/Oslo',
    'Denmark': 'Europe/Copenhagen',
    'Finland': 'Europe/Helsinki',
    'Poland': 'Europe/Warsaw',
    'Russia': 'Europe/Moscow',
    'USA': 'America/New_York',
    'United States': 'America/New_York',
    'US': 'America/New_York',
    'Canada': 'America/Toronto',
    'Brazil': 'America/Sao_Paulo',
    'Mexico': 'America/Mexico_City',
    'Argentina': 'America/Argentina/Buenos_Aires',
    'Australia': 'Australia/Sydney',
    'New Zealand': 'Pacific/Auckland',
    'India': 'Asia/Kolkata',
    'China': 'Asia/Shanghai',
    'Japan': 'Asia/Tokyo',
    'South Korea': 'Asia/Seoul',
    'UAE': 'Asia/Dubai',
    'United Arab Emirates': 'Asia/Dubai',
    'Saudi Arabia': 'Asia/Riyadh',
    'Qatar': 'Asia/Qatar',
    'Kuwait': 'Asia/Kuwait',
    'Singapore': 'Asia/Singapore',
    'Pakistan': 'Asia/Karachi',
    'Bangladesh': 'Asia/Dhaka',
  };
  return map[country] || 'UTC';
}

function getUserLocalTime(user: any): string {
  try {
    const tz =
      user?.timezone ||
      getTimezoneFromCountry(user?.location?.country || '');
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: tz,
    }).format(new Date());
  } catch {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
export default function ProfileDetailScreen() {
  const { theme } = useTheme();
  const { token, user: currentUser } = useAuth();
  const { get, post } = useApi();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
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

  const handleSuperLike = async () => {
    if (!token || actionLoading) return;
    setActionLoading(true);
    try {
      const response = await post<{ isMatch?: boolean; matchedUser?: any }>('/friends/request', { receiverId: userId, isSuperLike: true }, token);
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
            isSuperLike: true
          });
        }
      }
    } catch (error) {
      console.error('Super like error:', error);
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

  const handleReport = () => {
    Alert.alert(
      'Report User',
      'Are you sure you want to report this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: async () => {
            try {
              if (token) {
                await post('/reports', { reportedUserId: userId, reason: 'inappropriate' }, token);
              }
              Alert.alert('Reported', 'Thank you for your report. We will review it shortly.');
            } catch (error) {
              console.error('Report error:', error);
            }
          },
        },
      ]
    );
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
          style={[styles.goBackButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.goBack()}
        >
          <ThemedText style={{ color: "#FFF" }}>Go Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const quickInfoPills = [];
  if (user.location?.city || user.location?.address || user.livingIn) {
    const city = user.location?.city || user.location?.address || '';
    const country = user.location?.country || '';
    const locationText = city
      ? (country ? `${city}, ${country}` : city)
      : (user.livingIn || '');
    if (locationText) {
      quickInfoPills.push({ icon: 'location-outline', text: locationText, color: theme.primary });
    }
  }
  if (user.gender) {
    quickInfoPills.push({ icon: 'person-outline', text: user.gender, color: '#9B59B6' });
  }
  if (user.zodiacSign) {
    quickInfoPills.push({ icon: 'star-outline', text: user.zodiacSign, color: '#FF9800' });
  }
  if (user.lookingFor) {
    quickInfoPills.push({ icon: 'heart-outline', text: user.lookingFor, color: '#E91E63' });
  }
  if (user.relationshipGoal) {
    quickInfoPills.push({ icon: 'ribbon-outline', text: user.relationshipGoal, color: '#9C27B0' });
  }
  if (user.lifestyle?.personalityType) {
    quickInfoPills.push({ icon: 'bulb-outline', text: user.lifestyle.personalityType, color: '#FF5722' });
  }

  const additionalPhotos = user.photos && user.photos.length > 1
    ? user.photos.filter((_: any, i: number) => i !== currentPhotoIndex)
    : [];

  return (
    <ThemedView style={styles.container}>
      <ScreenScrollView
        contentContainerStyle={{ paddingTop: 0, paddingHorizontal: 0 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={handleTap} style={styles.photoContainer}>
          {user.photos && user.photos.length > 0 ? (
            <Image
              source={getPhotoSource(user.photos[currentPhotoIndex]) || require("@/assets/images/placeholder-1.jpg")}
              style={styles.mainPhoto}
              resizeMode="cover"
            />
          ) : (
            <Image
              source={require("@/assets/images/placeholder-1.jpg")}
              style={styles.mainPhoto}
              resizeMode="cover"
            />
          )}

          {user.photos && user.photos.length > 1 && (
            <View style={[styles.photoIndicators, { top: insets.top + 10 }]}>
              {user.photos.map((_: any, index: number) => (
                <View
                  key={index}
                  style={[
                    styles.indicator,
                    {
                      backgroundColor: index === currentPhotoIndex ? "#FFF" : "rgba(255,255,255,0.4)",
                      height: index === currentPhotoIndex ? 4 : 3,
                    },
                  ]}
                />
              ))}
            </View>
          )}

          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'transparent', 'transparent', 'rgba(0,0,0,0.7)']}
            locations={[0, 0.15, 0.5, 1]}
            style={styles.photoGradient}
          />

          <View style={styles.nameOverlay}>
            <View style={styles.nameRow}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {user.name}
                {user.age ? (
                  <ThemedText style={styles.nameAge}>, {user.age}</ThemedText>
                ) : null}
              </ThemedText>
              {user.verified && (
                <Image
                  source={require("@/assets/icons/verified-tick.png")}
                  style={{ width: 22, height: 22, marginLeft: 8 }}
                  resizeMode="contain"
                />
              )}
              {user.premium?.isActive && (
                <PremiumBadge size="medium" style={{ marginLeft: 6 }} />
              )}
            </View>
            <View style={styles.statusRow}>
              <ActivityStatus onlineStatus={user.onlineStatus || (user.online ? 'online' : 'offline')} />
              {user.username && (
                <ThemedText style={styles.usernameText}>
                  @{user.username}
                </ThemedText>
              )}
            </View>
            {(user.location?.city || user.location?.address || user.livingIn) && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.9)" />
                <ThemedText style={styles.locationText}>
                  {user.location?.city || user.location?.address
                    ? `${user.location.city || user.location.address}${user.location.country ? `, ${user.location.country}` : ''}`
                    : user.livingIn}
                </ThemedText>
              </View>
            )}
            {(user.location?.country || user.timezone) && (
              <View style={styles.locationRow}>
                <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.9)" />
                <ThemedText style={styles.locationText}>
                  {getUserLocalTime(user)} local time
                </ThemedText>
              </View>
            )}
          </View>

          <Pressable style={[styles.floatBack, { top: insets.top + 10 }]} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </Pressable>
        </Pressable>

        <View style={[styles.contentWrapper, { backgroundColor: theme.background }]}>
          <View style={[styles.actionBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Pressable
              style={[styles.actionBtnCircle, styles.passBtn]}
              onPress={handlePass}
              disabled={actionLoading}
            >
              <Ionicons name="close" size={26} color="#FF6B6B" />
            </Pressable>

            <Pressable
              style={[styles.messageBtn, { backgroundColor: theme.primary }]}
              onPress={() => {
                if (currentUser?.premium?.isActive) {
                  navigation.navigate('ChatDetail', { userId: user._id, userName: user.name });
                } else {
                  navigation.navigate('Premium' as any);
                }
              }}
            >
              <Feather name="message-circle" size={18} color="#FFF" />
              <ThemedText style={styles.messageBtnText}>
                {currentUser?.premium?.isActive ? 'Message' : 'Unlock'}
              </ThemedText>
              {!currentUser?.premium?.isActive && (
                <Ionicons name="star" size={11} color="#FFD700" style={{ marginLeft: 2 }} />
              )}
            </Pressable>

            <Pressable
              style={[styles.actionBtnCircle, styles.likeBtn, liked && styles.likeBtnActive]}
              onPress={handleLike}
              disabled={actionLoading || liked}
            >
              <Ionicons name={liked ? "checkmark" : "heart"} size={24} color={liked ? '#FFF' : '#4CAF50'} />
            </Pressable>

            <Pressable
              style={[styles.actionBtnCircle, styles.superLikeBtn]}
              onPress={handleSuperLike}
              disabled={actionLoading || liked}
            >
              <Ionicons name="star" size={22} color="#FFB800" />
            </Pressable>
          </View>

          <View style={styles.contentInner}>
            {quickInfoPills.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillsContainer}
                style={styles.pillsScroll}
              >
                {quickInfoPills.map((pill, index) => (
                  <InfoPill key={index} icon={pill.icon} text={pill.text} color={pill.color} />
                ))}
              </ScrollView>
            )}

            {user.bio && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="person-circle-outline" size={20} color={theme.primary} />
                  <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>About Me</ThemedText>
                </View>
                <View style={[styles.bioCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <ThemedText style={[styles.bioText, { color: theme.text }]}>{user.bio}</ThemedText>
                </View>
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="grid-outline" size={18} color={theme.primary} />
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Details</ThemedText>
              </View>
              <View style={styles.detailsGrid}>
                {user.gender && <DetailItem icon="person-outline" label="Gender" value={user.gender} />}
                {user.lookingFor && <DetailItem icon="heart-outline" label="Looking for" value={user.lookingFor} />}
                {user.relationshipGoal && <DetailItem icon="ribbon-outline" label="Relationship Goal" value={user.relationshipGoal} />}
                {user.zodiacSign && <DetailItem icon="star-outline" label="Zodiac" value={user.zodiacSign} />}
                {user.jobTitle && <DetailItem icon="briefcase-outline" label="Job" value={user.jobTitle} />}
                {user.education && <DetailItem icon="school-outline" label="Education" value={user.education} />}
                {user.lifestyle?.personalityType && <DetailItem icon="bulb-outline" label="Personality" value={user.lifestyle.personalityType} />}
                {user.lifestyle?.communicationStyle && <DetailItem icon="chatbubbles-outline" label="Communication" value={user.lifestyle.communicationStyle} />}
                {user.lifestyle?.loveStyle && <DetailItem icon="heart-circle-outline" label="Love Style" value={user.lifestyle.loveStyle} />}
                {user.lifestyle?.relationshipStatus && <DetailItem icon="heart-half-outline" label="Relationship" value={user.lifestyle.relationshipStatus} />}
                {user.lifestyle?.religion && <DetailItem icon="sunny-outline" label="Religion" value={user.lifestyle.religion} />}
                {user.lifestyle?.ethnicity && <DetailItem icon="globe-outline" label="Ethnicity" value={user.lifestyle.ethnicity} />}
              </View>
            </View>

            {(user.lifestyle?.smoking || user.lifestyle?.drinking || user.lifestyle?.workout || user.lifestyle?.pets || user.lifestyle?.hasKids != null || user.lifestyle?.wantsKids != null) && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="leaf-outline" size={18} color={theme.primary} />
                  <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Lifestyle</ThemedText>
                </View>
                <View style={styles.detailsGrid}>
                  {user.lifestyle?.smoking && <DetailItem icon="flame-outline" label="Smoking" value={user.lifestyle.smoking} />}
                  {user.lifestyle?.drinking && <DetailItem icon="wine-outline" label="Drinking" value={user.lifestyle.drinking} />}
                  {user.lifestyle?.workout && <DetailItem icon="barbell-outline" label="Workout" value={user.lifestyle.workout} />}
                  {user.lifestyle?.pets && <DetailItem icon="paw-outline" label="Pets" value={user.lifestyle.pets} />}
                  {user.lifestyle?.hasKids != null && <DetailItem icon="people-outline" label="Has Kids" value={user.lifestyle.hasKids ? 'Yes' : 'No'} />}
                  {user.lifestyle?.wantsKids != null && <DetailItem icon="happy-outline" label="Wants Kids" value={user.lifestyle.wantsKids ? 'Yes' : 'No'} />}
                </View>
              </View>
            )}

            {user.interests && user.interests.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="sparkles-outline" size={18} color={theme.primary} />
                  <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Interests</ThemedText>
                </View>
                <View style={styles.interestsContainer}>
                  {user.interests.map((interest: string, index: number) => {
                    const colorSet = INTEREST_COLORS[index % INTEREST_COLORS.length];
                    return (
                      <View
                        key={index}
                        style={[styles.interestChip, { backgroundColor: colorSet.bg, borderColor: colorSet.border }]}
                      >
                        <ThemedText style={[styles.interestChipText, { color: colorSet.text }]}>
                          {interest}
                        </ThemedText>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {additionalPhotos.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="images-outline" size={18} color={theme.primary} />
                  <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Photos</ThemedText>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.galleryContainer}
                >
                  {additionalPhotos.map((photo: any, index: number) => (
                    <Pressable
                      key={index}
                      onPress={() => {
                        const realIndex = user.photos.indexOf(photo);
                        if (realIndex >= 0) setCurrentPhotoIndex(realIndex);
                      }}
                      style={[styles.galleryImageWrap, { borderColor: theme.border }]}
                    >
                      <Image
                        source={getPhotoSource(photo) || require("@/assets/images/placeholder-1.jpg")}
                        style={styles.galleryImage}
                        resizeMode="cover"
                      />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {(user as any).voiceBio?.url && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="mic-outline" size={18} color={theme.primary} />
                  <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Voice Bio</ThemedText>
                </View>
                <VoiceBio
                  voiceBioUrl={(user as any).voiceBio.url}
                  duration={(user as any).voiceBio.duration || 0}
                  isOwn={false}
                />
              </View>
            )}

            <CulturalCompatibilityScore userId={user._id} />

            <ProfilePrompts userId={user._id} isOwnProfile={false} />

            <CompatibilityScore userId={user._id} />

            <Pressable
              style={[styles.quizCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => navigation.navigate('CompatibilityQuiz' as any)}
            >
              <LinearGradient
                colors={[theme.primary + '15', theme.primary + '05']}
                style={styles.quizCardGradient}
              >
                <View style={[styles.quizIconWrap, { backgroundColor: theme.primary }]}>
                  <Ionicons name="help-circle" size={22} color="#FFF" />
                </View>
                <View style={styles.quizTextContent}>
                  <ThemedText style={[styles.quizTitle, { color: theme.text }]}>
                    Take Compatibility Quiz
                  </ThemedText>
                  <ThemedText style={[styles.quizSubtitle, { color: theme.textSecondary }]}>
                    See how well you match with others
                  </ThemedText>
                </View>
                <View style={[styles.quizArrow, { backgroundColor: theme.primary + '15' }]}>
                  <Feather name="chevron-right" size={18} color={theme.primary} />
                </View>
              </LinearGradient>
            </Pressable>

            <Pressable
              style={[styles.distanceCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => navigation.navigate('UserDistanceMap' as any, { otherUser: user })}
            >
              <View style={[styles.distanceIconWrap, { backgroundColor: '#00B2FF15' }]}>
                <Ionicons name="map" size={20} color="#00B2FF" />
              </View>
              <View style={styles.distanceTextContent}>
                <ThemedText style={[styles.distanceTitle, { color: theme.text }]}>
                  View on Map
                </ThemedText>
                <ThemedText style={[styles.distanceSubtitle, { color: theme.textSecondary }]}>
                  See their location on the map
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>

            <Pressable onPress={handleReport} style={styles.reportContainer}>
              <Ionicons name="flag-outline" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.reportText, { color: theme.textSecondary }]}>
                Report {user.name}
              </ThemedText>
            </Pressable>

            <View style={{ height: 60 }} />
          </View>
        </View>
      </ScreenScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoContainer: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT,
    position: 'relative',
  },
  mainPhoto: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT,
  },
  photoIndicators: {
    position: 'absolute',
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  indicator: {
    flex: 1,
    marginHorizontal: 2,
    borderRadius: 3,
  },
  floatBack: {
    position: 'absolute',
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  photoGradient: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  nameOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    zIndex: 5,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    width: '100%',
    marginBotttom: 6,
    flexWrap: 'nowrap',
  },
  name: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFF',
    paddingBottom: 4,
    lineHeight:38,
    includeFontPadding: false,
  },
  nameAge: {
    fontSize: 32,
    fontWeight: '400',
    color: '#FFF',
  },
  premiumBadge: {
    width: 20,
    height: 20,
    borderRadius: 19,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    flexShrink: 0,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  usernameText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  locationText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginLeft: 4,
    fontWeight: '500',
  },
  contentWrapper: {
    marginTop: -24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 2,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  actionBtnCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  passBtn: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FF6B6B08',
  },
  likeBtn: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF5008',
  },
  likeBtnActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  superLikeBtn: {
    borderColor: '#FFB800',
    backgroundColor: '#FFB80008',
  },
  messageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: 26,
    maxWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  messageBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  pillsScroll: {
    marginBottom: 20,
    marginHorizontal: -20,
  },
  pillsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  infoPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  bioCard: {
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  bioText: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '400',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 20,
    borderWidth: 0,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  detailIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  detailTextWrap: {
    //flex: 1,
  },
  detailLabel: {
    display: 'none',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFF',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
  },
  interestChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  galleryContainer: {
    gap: 10,
    paddingVertical: 4,
  },
  galleryImageWrap: {
    width: 100,
    height: 130,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  quizCard: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  quizCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  quizIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  quizTextContent: {
    flex: 1,
  },
  quizTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  quizSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },
  quizArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  distanceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  distanceTextContent: {
    flex: 1,
  },
  distanceTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  distanceSubtitle: {
    fontSize: 12,
    marginTop: 3,
  },
  reportContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 8,
  },
  reportText: {
    fontSize: 13,
    fontWeight: '500',
  },
  goBackButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 20,
  },
});

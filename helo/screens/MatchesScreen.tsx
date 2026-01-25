import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator, Dimensions, RefreshControl } from "react-native";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  runOnJS,
  withTiming,
  interpolate
} from "react-native-reanimated";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { CompositeNavigationProp, useFocusEffect } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MainTabParamList } from "@/navigation/MainTabNavigator";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { useTranslation } from "@/hooks/useLanguage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { StoredUser } from "@/utils/storage";
import { getPhotoSource } from "@/utils/photos";
import { useThemedAlert } from "@/components/ThemedAlert";
import { Image as ExpoImage } from "expo-image";
import LikeCard from "@/components/LikeCard";

const { width } = Dimensions.get("window");
const CARD_GAP = 10;
const COLUMN_WIDTH = (width - Spacing.lg * 2 - CARD_GAP) / 2;
const TALL_CARD_HEIGHT = COLUMN_WIDTH * 1.55;
const SHORT_CARD_HEIGHT = COLUMN_WIDTH * 1.1;

type MatchesScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Matches">,
  NativeStackNavigationProp<RootStackParamList>
>;

interface MatchesScreenProps {
  navigation: MatchesScreenNavigationProp;
}

interface MatchWithUser {
  id: string;
  user: StoredUser & { location?: string; country?: string; countryCode?: string; verified?: boolean };
  matchedAt: string;
  compatibilityScore?: number;
  isPerfectMatch?: boolean;
  isSuggested?: boolean;
}

const getCountryFlag = (countryCode?: string): string => {
  if (!countryCode || countryCode.length !== 2) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

export default function MatchesScreen({ navigation }: MatchesScreenProps) {
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const api = useApi();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showAlert, AlertComponent } = useThemedAlert();
  const [matches, setMatches] = useState<MatchWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMatches();
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadMatches();
    }, [token])
  );

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      (navigation as any).navigate('MainTabs', { screen: 'Discovery' });
    }
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMatches();
    setRefreshing(false);
  };

  const [whoLikesMe, setWhoLikesMe] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'matches' | 'likes'>('matches');

  const loadMatches = async () => {
    if (!token) return;
    
    setLoading(true);
    try {
      const [matchesRes, likesRes] = await Promise.all([
        api.get<{ success: boolean; matches: any[] }>('/match/my-matches', token),
        api.get<{ success: boolean; users: any[] }>('/match/who-likes-me', token)
      ]);
      
        const matchesData = matchesRes.data;
        if (matchesRes.success && matchesData?.matches) {
          const rawMatches = Array.isArray(matchesData.matches) ? matchesData.matches : [];
          const enrichedMatches = rawMatches.map((match: any) => {
          const otherUser = match.users?.find((u: any) => u._id !== user?.id);
          const locationCity = otherUser?.location?.city || otherUser?.location?.address || '';
          const locationCountry = otherUser?.location?.country || '';
          const countryCode = otherUser?.location?.countryCode || '';
          
          let displayLocation = '';
          if (locationCity && locationCountry) {
            displayLocation = `${locationCity}, ${locationCountry}`;
          } else if (locationCity) {
            displayLocation = locationCity;
          } else if (locationCountry) {
            displayLocation = locationCountry;
          }
          
          return {
            id: match._id,
            user: {
              id: otherUser?._id || '',
              name: otherUser?.name || 'Unknown',
              age: otherUser?.age || 0,
              bio: otherUser?.bio || '',
              photos: otherUser?.photos || [],
              online: otherUser?.onlineStatus || false,
              location: displayLocation,
              country: locationCountry,
              countryCode: countryCode,
              verified: otherUser?.verified || false,
            } as StoredUser & { location?: string; country?: string; countryCode?: string; verified?: boolean },
            matchedAt: match.matchedAt || new Date().toISOString(),
            compatibilityScore: match.compatibilityScore || Math.floor(Math.random() * 30 + 70),
            isPerfectMatch: match.isPerfectMatch || false,
            isSuggested: match.isSuggested || false,
          };
        });
        
        const seenUserIds = new Set<string>();
        const deduplicatedMatches = enrichedMatches.filter((m: MatchWithUser) => {
          if (!m.user.id || m.user.id === user?.id || seenUserIds.has(m.user.id)) {
            return false;
          }
          seenUserIds.add(m.user.id);
          return true;
        });
        setMatches(deduplicatedMatches);
      }

      if (likesRes.success && likesRes.data?.users) {
        setWhoLikesMe(likesRes.data.users);
      }
    } catch (error) {
      console.error("Error loading matches:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCompatibilityColor = (score: number) => {
    if (score >= 90) return '#FF6B6B';
    if (score >= 70) return '#4CAF50';
    if (score >= 50) return '#FFC107';
    return '#888';
  };

  const renderMatchCard = (item: MatchWithUser, isTall: boolean, isLast: boolean = false) => {
    const photoSource = item.user.photos && item.user.photos[0] ? getPhotoSource(item.user.photos[0]) : null;
    const score = item.compatibilityScore || 0;
    const cardHeight = isTall ? TALL_CARD_HEIGHT : SHORT_CARD_HEIGHT;
    
    return (
      <Pressable
        key={item.id}
        style={[styles.matchCard, { height: cardHeight, marginBottom: isLast ? 0 : CARD_GAP }]}
        onPress={() => navigation.navigate("ProfileDetail", { userId: item.user.id })}
      >
        {photoSource ? (
          <Image
            source={photoSource}
            style={styles.matchPhoto}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.matchPhoto, styles.noPhotoContainer]}>
            <Feather name="user" size={50} color="#666" />
          </View>
        )}
        
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.cardGradient}
        />
        
        <View style={[styles.matchBadge, { backgroundColor: getCompatibilityColor(score) }]}>
          <ThemedText style={styles.matchBadgeText}>{t('match')} {score}%</ThemedText>
        </View>
        
        {item.user.online && (
          <View style={styles.onlineDot} />
        )}
        
        <View style={styles.cardInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ThemedText style={styles.cardName} numberOfLines={1}>
              {item.user.name}, {item.user.age}
            </ThemedText>
            {item.user.verified && (
              <ExpoImage 
                source={require("@/assets/icons/verified-tick.png")} 
                style={{ width: 18, height: 18, marginLeft: 4 }} 
                contentFit="contain"
              />
            )}
          </View>
          {item.user.location ? (
            <View style={styles.locationRow}>
              <Feather name="map-pin" size={10} color="rgba(255,255,255,0.7)" />
              <ThemedText style={styles.cardLocation} numberOfLines={1}>
                {item.user.location} {getCountryFlag(item.user.countryCode)}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const handleLikeBack = async (likeUserId: string) => {
    if (!token) return;
    try {
      // Use friends/request endpoint which handles mutual likes and creates matches
      const response = await api.post<{ isMatch?: boolean; matchedUser?: any }>('/friends/request', { receiverId: likeUserId }, token);
      if (response.success) {
        setWhoLikesMe(prev => prev.filter(u => u._id !== likeUserId));
        
        // If it's a match, show the match popup
        if (response.data?.isMatch && response.data?.matchedUser) {
          const matchedUser = response.data.matchedUser;
          navigation.navigate('MatchPopup', {
            currentUser: user,
            matchedUser: {
              id: matchedUser._id || likeUserId,
              name: matchedUser.name || 'Your Match',
              photos: matchedUser.photos || []
            },
            isSuperLike: false
          });
        }
        
        loadMatches();
      }
    } catch (error) {
      console.error('Error liking back:', error);
    }
  };

  const handlePass = useCallback(async (targetUserId: string) => {
    if (!token) return;
    
    try {
      await api.post('/match/swipe', { targetUserId, action: 'pass' }, token);
    } catch (error) {
      console.error("Error recording pass:", error);
    }
  }, [token, api]);

  const handlePremiumRequired = useCallback(() => {
    showAlert(
      'Premium Feature',
      'Upgrade to Premium to like back directly from this tab.',
      [{ text: 'Upgrade', onPress: () => navigation.navigate('Premium') }, { text: 'Cancel', style: 'cancel' }],
      'star'
    );
  }, [showAlert, navigation]);

  const handleLikeCardPress = useCallback((userId: string) => {
    if (!user?.premium?.isActive) {
      showAlert(
        'Premium Feature',
        'Upgrade to Premium to see who liked you.',
        [{ text: 'Upgrade', onPress: () => navigation.navigate('Premium') }, { text: 'Cancel', style: 'cancel' }],
        'star'
      );
    } else {
      navigation.navigate("ProfileDetail", { userId, isFromLikes: true, likeUserId: userId });
    }
  }, [user, showAlert, navigation]);

  const handleRemoveLike = useCallback((userId: string) => {
    setWhoLikesMe(prev => prev.filter(u => u._id !== userId));
  }, []);

  const renderLikeCard = (likeUser: any, isTall: boolean, isLast: boolean = false) => {
    return (
      <LikeCard
        key={likeUser._id}
        likeUser={likeUser}
        isTall={isTall}
        isLast={isLast}
        isPremium={user?.premium?.isActive || false}
        onLikeBack={handleLikeBack}
        onPass={handlePass}
        onPress={handleLikeCardPress}
        onPremiumRequired={handlePremiumRequired}
        onRemove={handleRemoveLike}
      />
    );
  };

  const renderLikesMasonryGrid = () => {
    if (whoLikesMe.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Feather name="heart" size={60} color={theme.textSecondary} />
          </View>
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No likes yet</ThemedText>
          <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Boost your profile to get seen!</ThemedText>
        </View>
      );
    }

    const leftColumn: React.ReactNode[] = [];
    const rightColumn: React.ReactNode[] = [];
    
    let i = 0;
    let patternIndex = 0;
    
    while (i < whoLikesMe.length) {
      const isFirstPattern = patternIndex % 2 === 0;
      
      if (isFirstPattern) {
        if (i < whoLikesMe.length) {
          leftColumn.push(renderLikeCard(whoLikesMe[i], true, i === whoLikesMe.length - 1));
          i++;
        }
        
        if (i < whoLikesMe.length) {
          rightColumn.push(renderLikeCard(whoLikesMe[i], false, i === whoLikesMe.length - 1));
          i++;
        }
        if (i < whoLikesMe.length) {
          rightColumn.push(renderLikeCard(whoLikesMe[i], false, i === whoLikesMe.length - 1));
          i++;
        }
      } else {
        if (i < whoLikesMe.length) {
          leftColumn.push(renderLikeCard(whoLikesMe[i], false, i === whoLikesMe.length - 1));
          i++;
        }
        if (i < whoLikesMe.length) {
          leftColumn.push(renderLikeCard(whoLikesMe[i], false, i === whoLikesMe.length - 1));
          i++;
        }
        
        if (i < whoLikesMe.length) {
          rightColumn.push(renderLikeCard(whoLikesMe[i], true, i === whoLikesMe.length - 1));
          i++;
        }
      }
      
      patternIndex++;
    }

    return (
      <View style={styles.masonryContainer}>
        <View style={[styles.column, { marginRight: CARD_GAP / 2 }]}>
          {leftColumn}
        </View>
        <View style={[styles.column, { marginLeft: CARD_GAP / 2 }]}>
          {rightColumn}
        </View>
      </View>
    );
  };

  const renderMasonryGrid = () => {
    if (matches.length === 0) {
      return renderEmptyState();
    }

    const leftColumn: React.ReactNode[] = [];
    const rightColumn: React.ReactNode[] = [];
    
    let leftIndex = 0;
    let rightIndex = 0;
    let i = 0;
    let patternIndex = 0;
    
    while (i < matches.length) {
      const isFirstPattern = patternIndex % 2 === 0;
      
      if (isFirstPattern) {
        if (i < matches.length) {
          leftColumn.push(renderMatchCard(matches[i], true, i === matches.length - 1));
          i++;
          leftIndex++;
        }
        
        if (i < matches.length) {
          rightColumn.push(renderMatchCard(matches[i], false, i === matches.length - 1));
          i++;
          rightIndex++;
        }
        if (i < matches.length) {
          rightColumn.push(renderMatchCard(matches[i], false, i === matches.length - 1));
          i++;
          rightIndex++;
        }
      } else {
        if (i < matches.length) {
          leftColumn.push(renderMatchCard(matches[i], false, i === matches.length - 1));
          i++;
          leftIndex++;
        }
        if (i < matches.length) {
          leftColumn.push(renderMatchCard(matches[i], false, i === matches.length - 1));
          i++;
          leftIndex++;
        }
        
        if (i < matches.length) {
          rightColumn.push(renderMatchCard(matches[i], true, i === matches.length - 1));
          i++;
          rightIndex++;
        }
      }
      
      patternIndex++;
    }

    return (
      <View style={styles.masonryContainer}>
        <View style={[styles.column, { marginRight: CARD_GAP / 2 }]}>
          {leftColumn}
        </View>
        <View style={[styles.column, { marginLeft: CARD_GAP / 2 }]}>
          {rightColumn}
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Feather name="heart" size={60} color={theme.textSecondary} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        No Matches
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Start swiping to find your matches!
      </ThemedText>
      <Pressable
        style={[styles.emptyButton, { backgroundColor: theme.primary, marginTop: 20 }]}
        onPress={() => navigation.navigate("Swipe")}
      >
        <ThemedText style={[styles.emptyButtonText, { color: theme.buttonText }]}>
          {t('startSwiping')}
        </ThemedText>
      </Pressable>
    </View>
  );

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
          <ThemedText style={styles.headerTitle}>{t('matches')}</ThemedText>
        </View>

        <View style={styles.tabs}>
          <Pressable 
            style={[styles.tab, activeTab === 'matches' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('matches')}
          >
            <ThemedText style={[styles.tabText, { color: activeTab === 'matches' ? theme.primary : theme.textSecondary }]}>
              Matches ({matches.length})
            </ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.tab, activeTab === 'likes' && { borderBottomColor: theme.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('likes')}
          >
            <ThemedText style={[styles.tabText, { color: activeTab === 'likes' ? theme.primary : theme.textSecondary }]}>
              Likes ({whoLikesMe.length})
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
        >
          {activeTab === 'matches' ? renderMasonryGrid() : renderLikesMasonryGrid()}
        </ScrollView>
      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFF",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    paddingVertical: Spacing.md,
    marginRight: Spacing.xl,
    paddingHorizontal: Spacing.xs,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
  likesGrid: {
    paddingTop: Spacing.md,
  },
  likeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  likeImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  likeInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  likeName: {
    fontSize: 16,
    fontWeight: '700',
  },
  likeBio: {
    fontSize: 12,
  },
  likeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  masonryContainer: {
    flexDirection: "row",
  },
  column: {
    flex: 1,
  },
  matchCard: {
    width: "100%",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    position: "relative",
  },
  matchPhoto: {
    width: "100%",
    height: "100%",
  },
  noPhotoContainer: {
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
  },
  cardGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  matchBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFF",
  },
  onlineDot: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "#121212",
  },
  cardInfo: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFF",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  cardLocation: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
    marginLeft: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xxl * 2,
    paddingHorizontal: Spacing.lg,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h2,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emptyButtonText: {
    ...Typography.body,
    fontWeight: "600",
  },
  likeCardContent: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  swipeIndicator: {
    position: 'absolute',
    top: 20,
    padding: 10,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  likeIndicator: {
    right: 20,
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
  },
  nopeIndicator: {
    left: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.8)',
  },
  likeActionButtons: {
    position: "absolute",
    bottom: Spacing.md,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  likeActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  nopeButton: {
    borderWidth: 2,
    borderColor: "#FF6B6B",
  },
  likeBackButton: {
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
});

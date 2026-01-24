import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Platform, Dimensions, ScrollView } from "react-native";
import { useThemedAlert } from "@/components/ThemedAlert";
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withTiming, 
  withRepeat, 
  withSequence,
  withDelay,
  interpolate, 
  runOnJS, 
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutUp,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { CompositeNavigationProp, useFocusEffect } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MainTabParamList } from "@/navigation/MainTabNavigator";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useLanguage";
import { Spacing, BorderRadius, Typography, Shadow } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { getPhotoSource } from "@/utils/photos";
import { useApi } from "@/hooks/useApi";
import { getApiBaseUrl } from "@/constants/config";
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;

type DiscoveryScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Discovery">,
  NativeStackNavigationProp<RootStackParamList>
>;

interface DiscoveryScreenProps {
  navigation: DiscoveryScreenNavigationProp;
}

interface DiscoverUser {
  id: string;
  name: string;
  age: number | null;
  bio: string;
  photos: any[];
  interests: string[];
  online: boolean | null;
  distance: number | null;
  similarityScore?: number;
  gender?: string;
  verified?: boolean;
  location?: {
    city?: string;
    state?: string;
  };
  religion?: string;
  personalityType?: string;
  needsVerification?: boolean;
}

const AfroConnectLogo = require('@/assets/afroconnect-logo.png');

export default function DiscoveryScreen({ navigation }: DiscoveryScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, token, updateProfile } = useAuth();
  const { t } = useTranslation();
  const api = useApi();
  const { showAlert, AlertComponent } = useThemedAlert();
  
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [radarScanning, setRadarScanning] = useState(false);
  const [newUserFound, setNewUserFound] = useState(false);
  const [locationPermissionChecked, setLocationPermissionChecked] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [showSuperLikeAnimation, setShowSuperLikeAnimation] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [discoveryType, setDiscoveryType] = useState<'local' | 'global'>('local');
  const seenUserIds = useRef<Set<string>>(new Set());
  const userHistory = useRef<DiscoverUser[]>([]);
  
  const superLikeScale = useSharedValue(0);
  const superLikeOpacity = useSharedValue(0);
  const superLikeRotation = useSharedValue(0);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardRotation = useSharedValue(0);
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  
  const radarPulse = useSharedValue(1);
  const radarPulse2 = useSharedValue(1);
  const radarRotation = useSharedValue(0);
  
  const actionButtonScale = useSharedValue(1);
  const likeButtonScale = useSharedValue(1);
  const messageButtonScale = useSharedValue(1);
  const rewindButtonScale = useSharedValue(1);
  const starButtonScale = useSharedValue(1);



  const checkLocationPermission = useCallback(async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    const granted = status === 'granted';
    setHasLocationPermission(granted);
    setLocationPermissionChecked(true);
    return granted;
  }, []);

  const fetchRadarNearbyUsers = useCallback(async () => {
    if (!token) {
      console.log('[DISCOVERY RADAR] Skipped - no token');
      return;
    }
    if (hasLocationPermission === false) {
      console.log('[DISCOVERY RADAR] Skipped - no location permission');
      return;
    }
    
    try {
      setRadarScanning(true);
      
      let permissionGranted: boolean | null = hasLocationPermission;
      if (!locationPermissionChecked) {
        const { status } = await Location.getForegroundPermissionsAsync();
        permissionGranted = status === 'granted';
        setHasLocationPermission(permissionGranted);
        setLocationPermissionChecked(true);
        
        if (!permissionGranted) {
          setRadarScanning(false);
          return;
        }
      }
      
      if (permissionGranted !== true) {
        setRadarScanning(false);
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      
      const params = new URLSearchParams({
        lat: coords.lat.toString(),
        lng: coords.lng.toString(),
        radius: '50',
        ageMin: (user?.preferences?.ageRange?.min || 18).toString(),
        ageMax: (user?.preferences?.ageRange?.max || 50).toString(),
        gender: user?.preferences?.genderPreference || (user?.preferences as any)?.genders?.[0] || 'any',
        limit: '20'
      });

      const response = await fetch(
        `${getApiBaseUrl()}/api/radar/nearby-users?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();
      console.log(`[DISCOVERY RADAR] Received ${data.users?.length || 0} users from radar`);
      if (data.success && data.users?.length > 0) {
        const radarUsers: DiscoverUser[] = data.users.map((u: any) => {
          // Use profilePhoto URL directly, or fallback to photos array
          const photoUrl = u.profilePhoto || (u.photos?.[0]?.url || u.photos?.[0]);
          console.log(`[DISCOVERY RADAR] User ${u.name}: photo=${photoUrl ? 'YES' : 'NO'}`);
          return {
            id: u.id || u._id,
            name: u.name || 'Unknown',
            age: u.age,
            bio: u.bio || '',
            photos: photoUrl ? [photoUrl] : [],
            interests: u.interests || [],
            online: u.online,
            distance: u.distance,
            gender: u.gender || 'unknown',
            verified: u.verified || false,
          };
        });
        
        setUsers(prev => {
          prev.forEach(u => seenUserIds.current.add(u.id));
          
          const newUsers = radarUsers.filter(u => !seenUserIds.current.has(u.id));
          if (newUsers.length > 0) {
            newUsers.forEach(u => seenUserIds.current.add(u.id));
            setNewUserFound(true);
            setTimeout(() => setNewUserFound(false), 3000);
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            // Clear loading state since we now have users
            setLoading(false);
            return [...prev, ...newUsers];
          }
          return prev;
        });
        // If radar returned users but none were new, still clear loading
        setLoading(false);
      } else {
        // No users from radar, still clear loading
        setLoading(false);
      }
    } catch (error) {
      console.error("Radar fetch error:", error);
      setLoading(false);
    } finally {
      setRadarScanning(false);
    }
  }, [token, user?.preferences?.ageRange?.min, user?.preferences?.ageRange?.max, hasLocationPermission, locationPermissionChecked]);

  const loadPotentialMatches = useCallback(async () => {
    if (!user?.id || !token) {
      console.log('[DISCOVERY] loadPotentialMatches skipped - no user or token');
      setLoading(false);
      return;
    }

    console.log('[DISCOVERY] loadPotentialMatches starting...');
    try {
      setLoading(true);
      const params: Record<string, any> = {
        limit: 50,
        includeAll: 'true'
      };

      if (discoveryType === 'local' && user.location?.lat && user.location?.lng) {
        params.lat = user.location.lat;
        params.lng = user.location.lng;
        params.maxDistance = user.preferences?.maxDistance || 50;
      } else if (discoveryType === 'global') {
        params.global = true;
      }

      if ((user.preferences as any)?.ageRange) {
        params.minAge = (user.preferences as any).ageRange.min;
        params.maxAge = (user.preferences as any).ageRange.max;
      }

      const userGender = user.gender?.toLowerCase();
      const prefs = user.preferences as any;
      if (prefs?.genderPreference && prefs.genderPreference !== 'any') {
        params.genders = prefs.genderPreference;
      } else if (prefs?.gender && prefs.gender !== 'any') {
        params.genders = prefs.gender;
      } else if (userGender === 'male') {
        params.genders = 'female';
      } else if (userGender === 'female') {
        params.genders = 'male';
      }

      const response = await api.get<{ success: boolean; users: any[] }>('/users/nearby', params, token);
      console.log('API Response Success:', response.success);
      console.log('API Params:', JSON.stringify(params));
      if (response.data) {
        console.log('Users Array Length:', response.data.users?.length);
        if (response.data.users?.length > 0) {
          console.log('First User sample:', JSON.stringify(response.data.users[0]).substring(0, 100));
        } else {
          console.log('[DISCOVERY] API returned success but empty users array');
        }
      } else {
        console.log('[DISCOVERY] API response has no data property');
      }
      
      console.log('[DISCOVERY] API call complete, response:', response.success);
      if (response.success && response.data?.users) {
        console.log(`[DISCOVERY] Success. Raw users count: ${response.data.users.length}`);
        const myInterests = new Set(user.interests || []);

        const usersWithSimilarity = response.data.users.map((u: any) => {
          const userPhotos = u.photos && u.photos.length > 0 ? u.photos : (u.profilePhoto ? [u.profilePhoto] : []);
          if (userPhotos.length === 0) {
            console.log(`[DISCOVERY] User ${u._id} has NO photos in raw data`);
          }
          
          // Flatten photos if they are objects with url property
          const processedPhotos = userPhotos.map((p: any) => {
            if (typeof p === 'string') return p;
            if (p && typeof p === 'object' && p.url) return p.url;
            return null;
          }).filter(Boolean);
          
          if (processedPhotos.length === 0) {
             console.log(`[DISCOVERY] User ${u._id} has NO valid photo URLs`);
          }

          const theirInterests = u.interests || [];
          const sharedInterests = theirInterests.filter((i: string) => myInterests.has(i));
          
          // Personality match logic
          const personalityMatch = (user as any).personalityType && (u as any).personalityType && (user as any).personalityType === (u as any).personalityType;
          const personalityBonus = personalityMatch ? 20 : 0;

          // Similarity based on interests + personality
          const similarityScore = myInterests.size > 0
            ? Math.min(100, ((sharedInterests.length / Math.max(myInterests.size, theirInterests.length)) * 100) + personalityBonus)
            : personalityBonus;

          return {
            id: u._id || u.id,
            name: u.name || 'Unknown',
            age: u.age,
            bio: u.bio || '',
            photos: processedPhotos,
            interests: u.interests || [],
            online: u.online,
            distance: u.distance,
            similarityScore,
            gender: u.gender || 'male',
            verified: u.verified || false,
            location: u.location,
            isBoosted: u.isBoosted || false,
            needsVerification: u.needsVerification || false
          };
        });

        usersWithSimilarity.sort((a, b) => {
          if (a.isBoosted && !b.isBoosted) return -1;
          if (!a.isBoosted && b.isBoosted) return 1;
          return Math.random() - 0.5;
        });
        
        const filteredUsers = usersWithSimilarity.filter(u => !seenUserIds.current.has(u.id));
        filteredUsers.forEach(u => seenUserIds.current.add(u.id));
        
        setUsers(filteredUsers);
        setCurrentIndex(0);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error("[DISCOVERY] Error loading nearby users:", error);
      // Don't set users to empty - leave existing users from radar
    } finally {
      setLoading(false);
    }
  }, [user?.id, token, user?.location?.lat, user?.location?.lng, user?.preferences?.maxDistance, user?.preferences?.ageRange?.min, user?.preferences?.ageRange?.max, user?.interests, user?.gender]);

  // Stable reference to track if initial load happened
  const hasInitiallyLoaded = useRef(false);
  // Track the preferences that should trigger a reload
  const preferencesRef = useRef<string>('');
  
  useEffect(() => {
    if (!user?.id || !token) return;
    
    // Check if user has photos, if not, they might be blocked by the verification screen
    // but we want to make sure discovery still tries to load
    if (user?.photos?.length === 0) {
      console.log('[DISCOVERY] User has no photos, might be stuck');
    }

    // Create a hash of current preferences to detect changes
    const currentPrefs = JSON.stringify({
      lat: user?.location?.lat,
      lng: user?.location?.lng,
      maxDistance: user?.preferences?.maxDistance,
      ageMin: user?.preferences?.ageRange?.min,
      ageMax: user?.preferences?.ageRange?.max,
      gender: user?.gender,
      discoveryType: discoveryType,
      includeAll: 'true'
    });
    
    // Load on initial mount or when preferences actually change
    if (!hasInitiallyLoaded.current || currentPrefs !== preferencesRef.current) {
      hasInitiallyLoaded.current = true;
      preferencesRef.current = currentPrefs;
      
      const loadData = async () => {
        setLoading(true);
        // Load from both sources in parallel for faster results
        await Promise.all([
          loadPotentialMatches(),
          fetchRadarNearbyUsers()
        ]);
      };
      loadData();
    }
  }, [user?.id, token, user?.location?.lat, user?.location?.lng, user?.preferences?.maxDistance, user?.preferences?.ageRange?.min, user?.preferences?.ageRange?.max, user?.gender, loadPotentialMatches, fetchRadarNearbyUsers, discoveryType]);

  // Radar scanning on focus - reduced dependencies to prevent infinite loops
  const radarIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  useFocusEffect(
    useCallback(() => {
      checkLocationPermission();
      
      // Initial radar scan with delay
      const initialScanTimeout = setTimeout(() => {
        if (hasLocationPermission !== false && token) {
          fetchRadarNearbyUsers();
        }
      }, 1000);
      
      // Setup interval for periodic scans
      radarIntervalRef.current = setInterval(() => {
        if (hasLocationPermission !== false && token) {
          fetchRadarNearbyUsers();
        }
      }, 30000);
      
      return () => {
        clearTimeout(initialScanTimeout);
        if (radarIntervalRef.current) {
          clearInterval(radarIntervalRef.current);
        }
      };
    }, [token, hasLocationPermission])
  );

  useEffect(() => {
    radarPulse.value = withRepeat(
      withTiming(1.3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    radarPulse2.value = withRepeat(
      withTiming(1.2, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    radarRotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
  }, [radarPulse, radarPulse2, radarRotation]);



  const handleDiscoveryTypeChange = (type: 'local' | 'global') => {
    if (type === 'global' && !user?.premium?.isActive) {
      showAlert(
        'Premium Feature',
        'Upgrade to Premium to access Global Discovery and meet people worldwide.',
        [{ text: 'Upgrade Now', onPress: () => navigation.navigate('Premium' as any) }, { text: 'Maybe Later', style: 'cancel' }],
        'star'
      );
      return;
    }
    setDiscoveryType(type);
    setUsers([]);
    setLoading(true);
    loadPotentialMatches();
  };

  const renderFilters = () => (
    <View 
      style={{ 
        backgroundColor: theme.surface,
        margin: Spacing.md,
        borderRadius: BorderRadius.lg,
        ...Shadow.medium,
        padding: Spacing.md,
      }}
    >
      <View style={styles.header}>
        <ThemedText style={{ fontSize: 16, fontWeight: '700' }}>Discovery Preferences</ThemedText>
        <Pressable onPress={() => navigation.navigate('Filters')}>
          <Feather name="settings" size={20} color={theme.primary} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', marginTop: Spacing.sm, backgroundColor: theme.backgroundSecondary, borderRadius: BorderRadius.md, padding: 4 }}>
        <Pressable 
          onPress={() => handleDiscoveryTypeChange('local')}
          style={{ 
            flex: 1, 
            paddingVertical: 8, 
            alignItems: 'center', 
            borderRadius: BorderRadius.sm,
            backgroundColor: discoveryType === 'local' ? theme.surface : 'transparent',
            ... (discoveryType === 'local' ? Shadow.small : {})
          }}
        >
          <ThemedText style={{ fontSize: 13, fontWeight: discoveryType === 'local' ? '700' : '400' }}>Locally</ThemedText>
        </Pressable>
        <Pressable 
          onPress={() => handleDiscoveryTypeChange('global')}
          style={{ 
            flex: 1, 
            paddingVertical: 8, 
            alignItems: 'center', 
            borderRadius: BorderRadius.sm,
            backgroundColor: discoveryType === 'global' ? theme.surface : 'transparent',
            ... (discoveryType === 'global' ? Shadow.small : {})
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <ThemedText style={{ fontSize: 13, fontWeight: discoveryType === 'global' ? '700' : '400' }}>Globally</ThemedText>
            {!user?.premium?.isActive && <Feather name="lock" size={12} color={theme.textSecondary} />}
          </View>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <View style={{ backgroundColor: theme.backgroundSecondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
          <ThemedText style={{ fontSize: 12 }}>
            Age: {user?.preferences?.ageRange?.min || 18}-{user?.preferences?.ageRange?.max || 50}
          </ThemedText>
        </View>
          <View style={{ backgroundColor: theme.backgroundSecondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
            <ThemedText style={{ fontSize: 12 }}>
              Dist: {user?.premium?.isActive ? (user?.preferences?.maxDistance ? Math.round(user.preferences.maxDistance / 1000) : 50) : 'Premium'}
            </ThemedText>
          </View>
        <View style={{ backgroundColor: theme.backgroundSecondary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
          <ThemedText style={{ fontSize: 12 }}>
            Looking for: {user?.lookingFor || 'any'}
          </ThemedText>
        </View>
      </View>
    </View>
  );

  const radarPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: radarPulse.value }],
    opacity: interpolate(radarPulse.value, [1, 1.3], [0.4, 0.1]),
  }));

  const radarPulse2Style = useAnimatedStyle(() => ({
    transform: [{ scale: radarPulse2.value }],
    opacity: interpolate(radarPulse2.value, [1, 1.2], [0.25, 0.05]),
  }));

  const radarRotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${radarRotation.value}deg` }],
  }));

  const renderHeader = () => (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      <View style={styles.headerLeft}>
        <Image 
          source={AfroConnectLogo} 
          style={styles.logo} 
          contentFit="contain"
        />
        <Pressable 
          style={styles.headerIconButton}
          onPress={() => setRadarScanning(true)}
        >
          <View style={styles.radarIconContainer}>
            <Feather name="target" size={22} color={theme.primary} />
            {radarScanning && (
              <Animated.View style={[styles.radarPing, radarPulseStyle]} />
            )}
          </View>
        </Pressable>
      </View>

      <View style={styles.headerCenter}>
        <View style={styles.toggleContainer}>
          <Pressable 
            onPress={() => handleDiscoveryTypeChange('local')}
            style={[
              styles.toggleButton,
              discoveryType === 'local' && { backgroundColor: theme.surface, ...Shadow.small }
            ]}
          >
            <ThemedText style={[styles.toggleText, discoveryType === 'local' && { color: theme.primary, fontWeight: '700' }]}>
              Local
            </ThemedText>
          </Pressable>
          <Pressable 
            onPress={() => handleDiscoveryTypeChange('global')}
            style={[
              styles.toggleButton,
              discoveryType === 'global' && { backgroundColor: theme.surface, ...Shadow.small }
            ]}
          >
            <ThemedText style={[styles.toggleText, discoveryType === 'global' && { color: theme.primary, fontWeight: '700' }]}>
              Global
            </ThemedText>
            {!user?.premium?.isActive && (
              <Feather name="lock" size={10} color={theme.textSecondary} style={{ marginLeft: 2 }} />
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.headerRight}>
        <Pressable 
          style={styles.headerIconButton}
          onPress={() => navigation.navigate('Filters')}
        >
          <Feather name="sliders" size={22} color={theme.text} />
        </Pressable>
      </View>
    </View>
  );

  const resetCardPosition = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
    cardRotation.value = 0;
    cardScale.value = 1;
    cardOpacity.value = 1;
    setIsAnimating(false);
  }, [translateX, translateY, cardRotation, cardScale, cardOpacity]);

  const advanceToNextProfile = useCallback(() => {
    const currentUser = users[currentIndex];
    if (currentUser) {
      userHistory.current.push(currentUser);
      if (userHistory.current.length > 10) {
        userHistory.current.shift();
      }
    }
    resetCardPosition();
    setIsAnimating(false);
    if (currentIndex < users.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setCurrentIndex(0);
      loadPotentialMatches();
    }
  }, [currentIndex, users, resetCardPosition, loadPotentialMatches]);

  const handleLikeAction = useCallback(async (targetUser: DiscoverUser) => {
    if (!user || !token) return;
    
    try {
      // Send a match request (auto-accepts if they already liked you)
      const response = await api.post<{ success: boolean; isMatch?: boolean; friendRequest?: any; matchedUser?: any; message?: string }>(
        '/friends/request',
        { receiverId: targetUser.id },
        token
      );

      if (response.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        if (response.data?.isMatch) {
          // It's a mutual match!
          showAlert(
            "It's a Match!",
            `You and ${targetUser.name} liked each other! 🎉 Start chatting now.`,
            [{ text: 'Start Chat', style: 'default', onPress: () => navigation.navigate('ChatDetail', { userId: targetUser.id, userName: targetUser.name }) },
             { text: 'Keep Swiping', style: 'cancel' }],
            'heart'
          );
        } else {
          // Request sent
          // No need to show alert for every like, it slows down the experience
        }
      }
    } catch (error: any) {
      // Handle duplicate request gracefully
      if (error?.message?.includes('already sent')) {
        showAlert('Already Sent', `You've already sent a request to ${targetUser.name}`, [{ text: 'OK', style: 'default' }], 'info');
      } else {
        console.error("Error sending match request:", error);
      }
    }
  }, [user, token, api, showAlert, navigation]);

  const handlePassAction = useCallback(async (targetUser: DiscoverUser) => {
    if (!token) return;
    
    try {
      await api.post('/match/swipe', { targetUserId: targetUser.id, action: 'pass' }, token);
    } catch (error) {
      console.error("Error recording pass:", error);
    }
  }, [token, api]);

  const handleSwipeComplete = useCallback((direction: 'left' | 'right') => {
    const targetUser = users[currentIndex];
    if (!targetUser) return;
    
    seenUserIds.current.add(targetUser.id);
    
    if (direction === 'right') {
      handleLikeAction(targetUser);
    } else {
      handlePassAction(targetUser);
    }
    advanceToNextProfile();
  }, [users, currentIndex, handleLikeAction, handlePassAction, advanceToNextProfile]);

  const animateSwipe = useCallback((direction: 'left' | 'right') => {
    if (isAnimating || currentIndex >= users.length) return;
    setIsAnimating(true);
    
    const targetX = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
    translateX.value = withTiming(targetX, { 
      duration: 300,
      easing: Easing.out(Easing.ease)
    }, () => {
      runOnJS(handleSwipeComplete)(direction);
    });
    cardRotation.value = withTiming(direction === 'right' ? 15 : -15, { duration: 300 });
    cardScale.value = withTiming(0.9, { duration: 150 });
  }, [isAnimating, currentIndex, users.length, translateX, cardRotation, cardScale, handleSwipeComplete]);

  const handleLike = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    likeButtonScale.value = withSequence(
      withTiming(1.5, { duration: 100 }),
      withSpring(1)
    );
    animateSwipe('right');
  }, [animateSwipe, likeButtonScale]);

  const handlePass = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    actionButtonScale.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withSpring(1)
    );
    animateSwipe('left');
  }, [animateSwipe, actionButtonScale]);

  const handleMessage = useCallback(() => {
    if (currentIndex >= users.length) return;
    const targetUser = users[currentIndex];
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    messageButtonScale.value = withSequence(
      withTiming(0.9, { duration: 100 }),
      withSpring(1, { damping: 10 })
    );
    navigation.navigate("ChatDetail", { userId: targetUser.id, userName: targetUser.name });
  }, [currentIndex, users, navigation, messageButtonScale]);

  const handleViewProfile = useCallback(() => {
    if (currentIndex >= users.length) return;
    const targetUser = users[currentIndex];
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate("ProfileDetail", { userId: targetUser.id });
  }, [currentIndex, users, navigation]);

  const handleRewind = useCallback(() => {
    if (userHistory.current.length === 0) {
      showAlert('No History', 'No previous profiles to rewind to', [{ text: 'OK', style: 'default' }], 'alert-circle');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    rewindButtonScale.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withSpring(1, { damping: 10 })
    );
    const previousUser = userHistory.current.pop();
    if (previousUser) {
      seenUserIds.current.delete(previousUser.id);
      if (currentIndex > 0) {
        setUsers(prev => {
          const newUsers = [...prev];
          newUsers.splice(currentIndex, 0, previousUser);
          return newUsers;
        });
      } else {
        setUsers(prev => [previousUser, ...prev]);
      }
      translateX.value = withSequence(
        withTiming(-SCREEN_WIDTH, { duration: 0 }),
        withSpring(0, { damping: 15 })
      );
    }
  }, [currentIndex, rewindButtonScale, translateX, showAlert]);

  const playSuperLikeAnimation = useCallback(() => {
    setShowSuperLikeAnimation(true);
    superLikeScale.value = 0;
    superLikeOpacity.value = 1;
    superLikeRotation.value = -30;
    
    superLikeScale.value = withSequence(
      withSpring(1.5, { damping: 8, stiffness: 200 }),
      withDelay(300, withTiming(2, { duration: 200 }))
    );
    superLikeRotation.value = withSequence(
      withSpring(0, { damping: 10 }),
      withDelay(300, withTiming(15, { duration: 200 }))
    );
    superLikeOpacity.value = withDelay(400, withTiming(0, { duration: 300 }, () => {
      runOnJS(setShowSuperLikeAnimation)(false);
    }));
  }, [superLikeScale, superLikeOpacity, superLikeRotation]);

  const handleSuperLike = useCallback(async () => {
    if (currentIndex >= users.length) return;
    const targetUser = users[currentIndex];
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    starButtonScale.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withSpring(1, { damping: 10 })
    );
    
    playSuperLikeAnimation();
    
    try {
      const response = await api.post<{ success: boolean; isMatch?: boolean; message?: string }>(
        '/match/swipe',
        { targetUserId: targetUser.id, action: 'superlike' },
        token || ''
      );
      
      const responseData = response.data as any;
      
      if (!response.success || !responseData?.success) {
        showAlert('Error', responseData?.message || 'Failed to send super like. Please try again.', [{ text: 'OK', style: 'default' }], 'alert-circle');
        return;
      }
      
      if (responseData?.isMatch) {
        setTimeout(() => {
          showAlert("It's a Match!", `You and ${targetUser.name} both super liked each other!`, [{ text: 'Start Chatting', style: 'default', onPress: () => navigation.navigate("ChatDetail", { userId: targetUser.id, userName: targetUser.name }) }], 'heart');
        }, 600);
      } else {
        setTimeout(() => {
          showAlert('Super Like Sent!', `${targetUser.name} will know you super liked them!`, [{ text: 'OK', style: 'default' }], 'star');
        }, 600);
      }
      
      setTimeout(() => animateSwipe('right'), 500);
    } catch (error) {
      console.error("Super like error:", error);
      showAlert('Error', 'Something went wrong. Please try again.', [{ text: 'OK', style: 'default' }], 'alert-circle');
    }
  }, [currentIndex, users, token, api, starButtonScale, animateSwipe, showAlert, navigation, playSuperLikeAnimation]);

  const handleShareLocation = useCallback(async () => {
    if (!token) return;
    
    try {
      setLocationLoading(true);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        showAlert(t('locationRequired'), t('enableLocationAccess'), [{ text: t('ok'), style: 'default' }], 'map-pin');
        setLocationLoading(false);
        return;
      }
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      if (!location?.coords?.latitude || !location?.coords?.longitude) {
        showAlert(t('error'), t('locationError'), [{ text: t('ok'), style: 'default' }], 'alert-circle');
        setLocationLoading(false);
        return;
      }
      
      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      
      const response = await api.put<{ success: boolean }>(
        '/users/me',
        { location: coords },
        token
      );
      
      if (response.success) {
        await updateProfile({ location: coords });
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        showAlert(t('success'), t('locationUpdated'), [{ text: t('ok'), style: 'default' }], 'check-circle');
        loadPotentialMatches();
      }
    } catch (error) {
      console.error('Location sharing error:', error);
      showAlert(t('error'), t('locationError'), [{ text: t('ok'), style: 'default' }], 'alert-circle');
    } finally {
      setLocationLoading(false);
    }
  }, [token, api, updateProfile, loadPotentialMatches, t, showAlert]);

  const panGesture = Gesture.Pan()
    .enabled(!isAnimating)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.5;
      cardRotation.value = interpolate(
        event.translationX,
        [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
        [-15, 0, 15]
      );
      cardScale.value = interpolate(
        Math.abs(event.translationX),
        [0, SCREEN_WIDTH / 2],
        [1, 0.95]
      );
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        const direction = event.translationX > 0 ? 'right' : 'left';
        runOnJS(animateSwipe)(direction);
      } else {
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
        cardRotation.value = withSpring(0, { damping: 15 });
        cardScale.value = withSpring(1, { damping: 15 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${cardRotation.value}deg` },
      { scale: cardScale.value },
    ],
    opacity: cardOpacity.value,
  }));

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1]),
  }));

  const passOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0]),
  }));

  const passButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: actionButtonScale.value }],
  }));

  const likeButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeButtonScale.value }],
  }));

  const messageButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: messageButtonScale.value }],
  }));

  const rewindButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rewindButtonScale.value }],
  }));

  const starButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starButtonScale.value }],
  }));

  const superLikeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: superLikeScale.value },
      { rotate: `${superLikeRotation.value}deg` },
    ],
    opacity: superLikeOpacity.value,
  }));

  const currentUser = users[currentIndex];
  const nextUser = users[currentIndex + 1];

  if (loading) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <ThemedView style={[styles.container, styles.centerContent]}>
          <View style={styles.emptyRadarContainer}>
            <Animated.View style={[styles.emptyRadarPulse, radarPulseStyle]}>
              <View style={[styles.emptyRadarRing, { borderColor: theme.primary }]} />
            </Animated.View>
            <Animated.View style={[styles.emptyRadarPulse, radarPulse2Style]}>
              <View style={[styles.emptyRadarRingOuter, { borderColor: theme.primary }]} />
            </Animated.View>
            <Animated.View style={[styles.emptyRadarCenter, { backgroundColor: theme.primary }, radarRotationStyle]}>
              <Feather name="radio" size={32} color="#FFF" />
            </Animated.View>
          </View>
          <ThemedText style={[styles.loadingTitle, { color: theme.text }]}>
            {t('findingYourMatches')}
          </ThemedText>
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t('lookingForPeople')}
          </ThemedText>
        </ThemedView>
      </GestureHandlerRootView>
    );
  }

  if (!currentUser) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <ThemedView style={[styles.container, styles.centerContent]}>
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.primary + '20' }]}>
                <Feather name="users" size={48} color={theme.primary} />
              </View>
            </View>

            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              {t('noMoreProfiles')}
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              {t('noMoreProfilesDescription')}
            </ThemedText>

            <View style={styles.emptyButtonsContainer}>
              <Pressable
                style={[styles.emptyRefreshButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setLoading(true);
                  loadPotentialMatches();
                }}
              >
                <Feather name="refresh-cw" size={18} color="#FFF" />
                <ThemedText style={styles.emptyRefreshButtonText}>{t('refresh')}</ThemedText>
              </Pressable>

              <Pressable
                style={[styles.loveRadarButton, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.primary }]}
                onPress={() => navigation.navigate("LoveRadar")}
              >
                <Feather name="target" size={18} color={theme.primary} />
                <ThemedText style={[styles.loveRadarButtonText, { color: theme.primary }]}>{t('openLoveRadar')}</ThemedText>
              </Pressable>
            </View>

            <Pressable
              style={styles.emptySettingsLink}
              onPress={() => navigation.navigate("Settings")}
            >
              <Feather name="sliders" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.emptySettingsText, { color: theme.textSecondary }]}>
                {t('adjustPreferences')}
              </ThemedText>
            </Pressable>
          </View>
          <AlertComponent />
        </ThemedView>
      </GestureHandlerRootView>
    );
  }

  const getValidPhotoSource = (photos: any[]) => {
    if (!photos || photos.length === 0) {
      return require("@/assets/images/placeholder-1.jpg");
    }
    const photo = photos[0];
    const source = getPhotoSource(photo);
    if (!source) {
      return require("@/assets/images/placeholder-1.jpg");
    }
    return source;
  };
  
  const photoSource = getValidPhotoSource(currentUser.photos);
  const nextPhotoSource = nextUser ? getValidPhotoSource(nextUser.photos) : require("@/assets/images/placeholder-1.jpg");
  const displayInterests = currentUser.interests?.slice(0, 5) || [];

  const getInterestIcon = (interest: string): keyof typeof Feather.glyphMap => {
    const lowerInterest = interest.toLowerCase();
    if (lowerInterest.includes('smoke') || lowerInterest.includes('smoking')) return 'wind';
    if (lowerInterest.includes('drink') || lowerInterest.includes('alcohol')) return 'coffee';
    if (lowerInterest.includes('dog') || lowerInterest.includes('pet')) return 'heart';
    if (lowerInterest.includes('cat')) return 'heart';
    if (lowerInterest.includes('music')) return 'music';
    if (lowerInterest.includes('travel')) return 'map';
    if (lowerInterest.includes('food') || lowerInterest.includes('cook')) return 'coffee';
    if (lowerInterest.includes('sport') || lowerInterest.includes('gym') || lowerInterest.includes('fitness')) return 'activity';
    if (lowerInterest.includes('read') || lowerInterest.includes('book')) return 'book-open';
    if (lowerInterest.includes('movie') || lowerInterest.includes('film')) return 'film';
    if (lowerInterest.includes('game') || lowerInterest.includes('gaming')) return 'monitor';
    if (lowerInterest.includes('photo')) return 'camera';
    if (lowerInterest.includes('art') || lowerInterest.includes('paint')) return 'edit-3';
    if (lowerInterest.includes('dance')) return 'music';
    if (lowerInterest.includes('yoga') || lowerInterest.includes('meditation')) return 'sun';
    return 'star';
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <ThemedView style={[styles.container, { backgroundColor: theme.background }]}>
        {renderHeader()}

        <View style={styles.cardWrapper}>
          {nextUser && (
            <View style={[styles.profileCard, styles.stackedCard]}>
              {nextPhotoSource ? (
                <Image
                  source={nextPhotoSource}
                  style={styles.profileImageFull}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.profileImageFull, styles.noPhotoContainer]}>
                  <Feather name="user" size={80} color="#666" />
                </View>
              )}
            </View>
          )}

          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.profileCard, cardStyle]}>
              {photoSource ? (
                <Image
                  source={photoSource}
                  style={[styles.profileImageFull, (currentUser as any).needsVerification && { filter: 'blur(10px)' }]}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.profileImageFull, styles.noPhotoContainer]}>
                  <Feather name="user" size={80} color="#666" />
                </View>
              )}

              {(currentUser as any).needsVerification && (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }]}>
                  <View style={{ backgroundColor: theme.surface, padding: 16, borderRadius: 12, alignItems: 'center', margin: 20 }}>
                    <Feather name="shield-off" size={32} color={theme.primary} />
                    <ThemedText style={{ fontWeight: '700', marginTop: 12, textAlign: 'center' }}>Photo Under Verification</ThemedText>
                    <ThemedText style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4, textAlign: 'center' }}>This user's photo is being reviewed</ThemedText>
                  </View>
                </View>
              )}

              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.95)']}
                style={styles.cardGradient}
              />

              <Animated.View style={[styles.likeStamp, likeOpacity]}>
                <ThemedText style={[styles.stampText, { color: '#4CAF50' }]}>{t('like')}</ThemedText>
              </Animated.View>

              <Animated.View style={[styles.passStamp, passOpacity]}>
                <ThemedText style={[styles.stampText, { color: '#FF6B6B' }]}>{t('nope')}</ThemedText>
              </Animated.View>


              <View style={styles.cardInfoOverlay}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                  <ThemedText style={styles.profileName}>
                    {currentUser.name}{currentUser.age !== null ? `, ${currentUser.age}` : ''}
                  </ThemedText>
                  {currentUser.verified && (
                    <Image 
                      source={require("@/assets/icons/verified-tick.png")} 
                      style={{ width: 28, height: 28, marginLeft: 8 }} 
                      contentFit="contain"
                    />
                  )}
                </View>

                <Pressable 
                  style={styles.basicsRow}
                  onPress={handleViewProfile}
                >
                  <View style={styles.basicsIconContainer}>
                    <Feather name="grid" size={14} color="#FFF" />
                  </View>
                  <ThemedText style={styles.basicsText}>{t('basicsLifestyle')}</ThemedText>
                  <View style={styles.chevronContainer}>
                    <Feather name="chevron-right" size={18} color="#FFF" />
                  </View>
                </Pressable>

                <View style={styles.lifestyleRow}>
                  {currentUser.religion && (
                    <View style={styles.lifestyleBadge}>
                      <ThemedText style={styles.lifestyleText}>{currentUser.religion}</ThemedText>
                    </View>
                  )}
                  {currentUser.personalityType && (
                    <View style={styles.lifestyleBadge}>
                      <ThemedText style={styles.lifestyleText}>{currentUser.personalityType}</ThemedText>
                    </View>
                  )}
                </View>

                {displayInterests.length > 0 && (
                  <View style={styles.tagsRow}>
                    {displayInterests.map((interest, index) => (
                      <View key={index} style={styles.tag}>
                        <Feather name={getInterestIcon(interest)} size={12} color="#FFF" />
                        <ThemedText style={styles.tagText}>{interest}</ThemedText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Animated.View>
          </GestureDetector>
        </View>

        <View style={[styles.actionRow, { paddingBottom: insets.bottom + 8 }]}>
          <Animated.View style={rewindButtonStyle}>
            <Pressable
              style={[styles.rewindButton, userHistory.current.length === 0 && styles.disabledButton]}
              onPress={handleRewind}
              disabled={isAnimating || userHistory.current.length === 0}
            >
              <Feather name="rotate-ccw" size={20} color="#f5d142" />
            </Pressable>
          </Animated.View>

          <Animated.View style={passButtonStyle}>
            <Pressable
              style={styles.passButton}
              onPress={handlePass}
              disabled={isAnimating}
            >
              <Feather name="x" size={28} color="#FF6B6B" />
            </Pressable>
          </Animated.View>

          <Animated.View style={starButtonStyle}>
            <Pressable
              style={styles.starButton}
              onPress={handleSuperLike}
              disabled={isAnimating}
            >
              <Feather name="star" size={28} color="#2196f3" />
            </Pressable>
          </Animated.View>

          <Animated.View style={likeButtonStyle}>
            <Pressable
              style={styles.likeButton}
              onPress={handleLike}
              disabled={isAnimating}
            >
              <Feather name="heart" size={28} color="#FF6B6B" />
            </Pressable>
          </Animated.View>
          
          <Pressable
            style={styles.boostButton}
            onPress={async () => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              try {
                const response = await api.post<{ success: boolean; message: string }>('/boost/activate', { type: 'standard' }, token || '');
                if (response.success) {
                  showAlert('Boost Activated!', 'Your profile is now being featured to more users!', [{ text: 'Great', style: 'default' }], 'zap');
                } else {
                  showAlert('Boost', (response as any).data?.message || 'Failed to activate boost', [{ text: 'OK', style: 'default' }], 'info');
                }
              } catch (error) {
                console.error("Boost error:", error);
                showAlert('Error', 'Failed to activate boost. Please try again.', [{ text: 'OK', style: 'default' }], 'alert-circle');
              }
            }}
          >
            <Feather name="zap" size={24} color="#a033ff" />
          </Pressable>
        </View>

        {newUserFound && (
          <Animated.View 
            entering={SlideInDown.duration(300)}
            exiting={SlideOutUp.duration(300)}
            style={[styles.newUserBanner, { backgroundColor: theme.primary }]}
          >
            <Feather name="user-plus" size={16} color="#FFF" />
            <ThemedText style={styles.newUserBannerText}>New person found nearby!</ThemedText>
          </Animated.View>
        )}

        {showSuperLikeAnimation && (
          <View style={styles.superLikeOverlay} pointerEvents="none">
            <Animated.View style={[styles.superLikeAnimationContainer, superLikeAnimatedStyle]}>
              <View style={styles.superLikeStar}>
                <Feather name="star" size={80} color="#00D4FF" />
              </View>
              <ThemedText style={styles.superLikeText}>SUPER LIKE</ThemedText>
            </Animated.View>
          </View>
        )}
        <AlertComponent />
      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: Platform.OS === 'ios' ? 110 : 90,
    backgroundColor: 'transparent',
    zIndex: 100,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  headerIconButton: {
    padding: 8,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: 10,
  },
  radarIconContainer: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarPing: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 122, 255, 0.3)',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 20,
    padding: 3,
    width: 150,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    flexDirection: 'row',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
  },
  activeToggleText: {
    color: '#000',
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  loadingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  loadingTitle: {
    ...Typography.h2,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  loadingText: {
    ...Typography.body,
    textAlign: "center",
  },
  emptyStateContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  emptyIconContainer: {
    marginBottom: Spacing.lg,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    ...Typography.h2,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  emptyButtonsContainer: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  emptyRefreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  emptyRefreshButtonText: {
    ...Typography.bodyBold,
    color: "#FFF",
  },
  emptySettingsLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  emptySettingsText: {
    ...Typography.body,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    ...Shadow.medium,
  },
  refreshButtonText: {
    ...Typography.bodyBold,
    color: "#FFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFF",
  },
  headerProfileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2A2A2A",
    alignItems: "center",
    justifyContent: "center",
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  newUserBanner: {
    position: "absolute",
    top: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    zIndex: 100,
  },
  newUserBannerText: {
    ...Typography.bodyBold,
    color: "#FFF",
  },
  superLikeOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 200,
  },
  superLikeAnimationContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  superLikeStar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(0, 212, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00D4FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
  },
  superLikeText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#00D4FF",
    marginTop: Spacing.md,
    letterSpacing: 3,
    textShadowColor: "rgba(0, 212, 255, 0.8)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  cardWrapper: {
    flex: 1,
    marginHorizontal: 8,
    marginBottom: 4,
  },
  profileCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#1E1E1E",
  },
  stackedCard: {
    transform: [{ scale: 0.95 }],
    opacity: 0.3,
  },
  profileImageFull: {
    width: "100%",
    height: "100%",
  },
  noPhotoContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2A2A2A",
  },
  cardGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
  },
  likeStamp: {
    position: "absolute",
    top: 80,
    left: 24,
    borderWidth: 4,
    borderColor: "#4CAF50",
    borderRadius: 8,
    padding: Spacing.sm,
    transform: [{ rotate: "-15deg" }],
  },
  passStamp: {
    position: "absolute",
    top: 80,
    right: 24,
    borderWidth: 4,
    borderColor: "#FF6B6B",
    borderRadius: 8,
    padding: Spacing.sm,
    transform: [{ rotate: "15deg" }],
  },
  stampText: {
    fontSize: 32,
    fontWeight: "800",
  },
  cardInfoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  profileName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFF",
    marginRight: 8,
  },
  verifiedBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1DA1F2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  arrowUpButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#00D4FF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  basicsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  basicsIcon: {
    marginRight: 8,
  },
  basicsIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  basicsText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFF",
    flex: 1,
  },
  basicsVerifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(29, 161, 242, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1DA1F2",
  },
  basicsChevron: {
    marginLeft: 4,
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  lifestyleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  lifestyleBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  lifestyleText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.4,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(50, 50, 50, 0.85)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  tagText: {
    fontSize: 13,
    color: "#FFF",
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  rewindButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1e1e1e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  passButton: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "#1e1e1e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  starButton: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    backgroundColor: "#1e1e1e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  likeButton: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "#1e1e1e",
    alignItems: "center",
    justifyContent: "center",
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  boostButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1e1e1e",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  messageButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(0, 212, 255, 0.15)",
    borderWidth: 2.5,
    borderColor: "#00D4FF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00D4FF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyRadarContainer: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyRadarPulse: {
    position: "absolute",
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyRadarRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    opacity: 0.3,
  },
  emptyRadarRingOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    opacity: 0.15,
  },
  emptyRadarCenter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    ...Shadow.medium,
  },
  shareLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
    ...Shadow.medium,
  },
  shareLocationButtonText: {
    ...Typography.bodyBold,
    color: "#FFF",
  },
  loveRadarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  loveRadarButtonText: {
    ...Typography.bodyBold,
  },
});

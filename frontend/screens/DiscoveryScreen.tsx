import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Platform, Dimensions, ScrollView, Modal } from "react-native";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
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
import {
  getCachedPermissionStatus,
  requestAndCachePermission,
} from '@/utils/locationPermission';
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { PremiumBadge } from "@/components/PremiumBadge";
import { VerificationBadge } from "@/components/VerificationBadge";
import { FALLBACK_COUNTRIES, PASSPORT_CITIES, DiscoverUser } from "@/constants/discoveryConstants";
import BlendPopupPage from "@/components/BlendPopupPage";
import logger from "@/utils/logger";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const STABLE_CARD_HEIGHT = SCREEN_HEIGHT * 0.75;

type DiscoveryScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Discovery">,
  NativeStackNavigationProp<RootStackParamList>
>;

interface DiscoveryScreenProps {
  navigation: DiscoveryScreenNavigationProp;
}

const AfroConnectLogo = require('@/assets/afroconnect-logo.png');

function haversineKm(lat1?: number, lng1?: number, lat2?: number, lng2?: number): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

const reverseGeocodeCache = new Map<string, { city?: string; country?: string }>();
async function cachedReverseGeocode(lat: number, lng: number): Promise<{ city?: string; country?: string }> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (reverseGeocodeCache.has(key)) return reverseGeocodeCache.get(key)!;
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const result = {
      city: place?.city || place?.district || place?.subregion || undefined,
      country: place?.country || undefined,
    };
    reverseGeocodeCache.set(key, result);
    return result;
  } catch {
    return {};
  }
}

function formatDistanceAway(target: any, currentUser: any): string | null {
  let km: number | null = typeof target?.distance === 'number' ? target.distance : null;
  if (km == null) {
    km = haversineKm(
      currentUser?.location?.lat,
      currentUser?.location?.lng,
      target?.location?.lat,
      target?.location?.lng,
    );
  }
  if (km == null || !isFinite(km) || km < 0) return null;
  if (km < 1) {
    const meters = Math.max(50, Math.round((km * 1000) / 50) * 50);
    return `${meters}m away`;
  }
  if (km < 10) {
    const rounded = Math.round(km * 10) / 10;
    return `${rounded}km away`;
  }
  return `${Math.round(km)}km away`;
}

export default function DiscoveryScreen({ navigation }: DiscoveryScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, token, updateProfile } = useAuth();
  const { t } = useTranslation();
  const api = useApi();
  const { showAlert, AlertComponent } = useThemedAlert();
  
  const [users, setUsers] = useState<DiscoverUser[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Persist the last batch of discovery cards to AsyncStorage so the deck
  // renders instantly on cold app open instead of showing a spinner while
  // waiting for /users/nearby. Available to all users.
  const DISCOVERY_CACHE_KEY = `discovery_cache_v1:${user?.id || 'anon'}`;
  const DISCOVERY_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
  const [loading, setLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [radarScanning, setRadarScanning] = useState(false);
  const [newUserFound, setNewUserFound] = useState(false);
  const [locationPermissionChecked, setLocationPermissionChecked] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [requiresLocation, setRequiresLocation] = useState(false);
  const [showSuperLikeAnimation, setShowSuperLikeAnimation] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [discoveryType, setDiscoveryType] = useState<'local' | 'global'>('local');
  const [passportActive, setPassportActive] = useState(false);
  const [passportCity, setPassportCity] = useState('');
  const [showPassportModal, setShowPassportModal] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countries, setCountries] = useState<string[]>([]);
  const [showSecondChance, setShowSecondChance] = useState(false);
  const [secondChanceProfiles, setSecondChanceProfiles] = useState<any[]>([]);
  const [secondChanceLoading, setSecondChanceLoading] = useState(false);
  const [blendMatch, setBlendMatch] = useState<{
    user: DiscoverUser;
    shared: string[];
    songMatch?: { type: 'song' | 'artist'; title?: string; artist?: string; albumArt?: string };
  } | null>(null);
  const blendShownIds = useRef<Set<string>>(new Set());
  const seenUserIds = useRef<Set<string>>(new Set());
  const userHistory = useRef<DiscoverUser[]>([]);

  // Stable refs that always point to the latest callback / primitive value.
  // Using refs instead of putting functions in useEffect dep arrays prevents
  // spurious re-runs caused by useCallback identity changes.
  const loadPotentialMatchesRef = useRef<((silent?: boolean) => Promise<void>) | null>(null);
  const fetchRadarNearbyUsersRef = useRef<(() => Promise<void>) | null>(null);
  const tokenRef = useRef<string | null>(token ?? null);
  const hasLocationPermissionRef = useRef<boolean | null>(hasLocationPermission);
  
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



  const fetchCountries = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.get<{ success: boolean; countries: string[] }>('/users/countries', {}, token);
      if (response.success && response.data?.countries) {
        setCountries(response.data.countries);
      }
    } catch (error) {
      logger.error('Failed to fetch countries:', error);
    }
  }, [token, api]);

  const checkLocationPermission = useCallback(async () => {
    // Use the cached permission value when possible so we don't re-query the
    // OS (or repeatedly trigger any system-side throttles) on every screen
    // focus. The cache TTLs out at 24h.
    const status = await getCachedPermissionStatus();
    const granted = status === 'granted';
    setHasLocationPermission(granted);
    setLocationPermissionChecked(true);
    return granted;
  }, []);

  const fetchRadarNearbyUsers = useCallback(async () => {
    if (!token) {
      logger.log('[DISCOVERY RADAR] Skipped - no token');
      return;
    }
    if (hasLocationPermission === false) {
      logger.log('[DISCOVERY RADAR] Skipped - no location permission');
      return;
    }
    
    try {
      setRadarScanning(true);
      
      let permissionGranted: boolean | null = hasLocationPermission;
      if (!locationPermissionChecked) {
        const status = await getCachedPermissionStatus();
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

      const locationName = await cachedReverseGeocode(coords.lat, coords.lng);

      try {
        await fetch(`${getApiBaseUrl()}/api/radar/location`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ ...coords, ...locationName }),
        });
      } catch (locationUpdateError) {
        logger.log('[DISCOVERY RADAR] Could not update live user location', locationUpdateError);
      }
      
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
      logger.log(`[DISCOVERY RADAR] Received ${data.users?.length || 0} users from radar`);
      if (data.success && data.users?.length > 0) {
        const radarUsers: DiscoverUser[] = data.users.map((u: any) => {
          const photoUrl = u.profilePhoto || (u.photos?.[0]?.url || u.photos?.[0]);
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
            favoriteSong: u.favoriteSong || undefined,
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
            setLoading(false);
            return [...prev, ...newUsers];
          }
          return prev;
        });
        setLoading(false);
      } else {
        setLoading(false);
      }
    } catch (error) {
      logger.error("Radar fetch error:", error);
      setLoading(false);
    } finally {
      setRadarScanning(false);
    }
  }, [token, user?.preferences?.ageRange?.min, user?.preferences?.ageRange?.max, hasLocationPermission, locationPermissionChecked]);

  const loadPotentialMatches = useCallback(async (silent = false) => {
    if (!user?.id || !token) {
      logger.log('[DISCOVERY] loadPotentialMatches skipped - no user or token');
      setLoading(false);
      return;
    }

    logger.log('[DISCOVERY] loadPotentialMatches starting...');
    try {
      if (!silent) setLoading(true);
      const params: Record<string, any> = {
        limit: 50,
      };

      // Normalize stored coords. The user may have either flat lat/lng or the
      // GeoJSON form `location.coordinates: [lng, lat]` from the server. Read
      // both so the request always includes coordinates if ANY form exists —
      // this keeps the cache key stable and lets distance be computed on the
      // first load instead of the silent stored-coord fallback.
      const loc: any = user.location || {};
      const storedLat = loc.lat ?? loc.coordinates?.coordinates?.[1] ?? loc.coordinates?.[1];
      const storedLng = loc.lng ?? loc.coordinates?.coordinates?.[0] ?? loc.coordinates?.[0];

      if (discoveryType === 'local' && Number.isFinite(storedLat) && Number.isFinite(storedLng)) {
        params.lat = storedLat;
        params.lng = storedLng;
        const rawMax = user.preferences?.maxDistance || 50;
        params.maxDistance = user.premium?.isActive ? rawMax : Math.min(rawMax, 50);
      } else if (discoveryType === 'global') {
        params.global = true;
        if (selectedCountry) {
          params.country = selectedCountry;
        }
      }

      const prefs = user.preferences as any;

      if (prefs?.ageRange) {
        params.minAge = Number(prefs.ageRange.min);
        params.maxAge = Number(prefs.ageRange.max);
      }

      const userGender = user.gender?.toLowerCase();
      if (prefs?.genderPreference && prefs.genderPreference !== 'any' && prefs.genderPreference !== 'both') {
        params.genders = prefs.genderPreference;
      } else if (prefs?.gender && prefs.gender !== 'any') {
        params.genders = prefs.gender;
      } else if (userGender === 'male') {
        params.genders = 'female';
      } else if (userGender === 'female') {
        params.genders = 'male';
      }

      if (prefs?.showVerifiedOnly) params.verifiedOnly = 'true';
      if (prefs?.onlineNow) params.onlineOnly = 'true';

      const lifestyle = (user as any).lifestyle;
      if (lifestyle?.lookingFor) params.lookingFor = lifestyle.lookingFor;
      if (lifestyle?.religion) params.religion = lifestyle.religion;
      if (prefs?.smoking) params.smoking = prefs.smoking;
      if (prefs?.drinking) params.drinking = prefs.drinking;
      if (prefs?.wantsKids != null) params.wantsKids = String(prefs.wantsKids);

      const response = await api.get<{ success: boolean; users: any[] }>('/users/nearby', params, token);
      logger.log('API Response Success:', response.success);
      logger.log('API Params:', JSON.stringify(params));
      if (response.data) {
        logger.log('Users Array Length:', response.data.users?.length);
        if (response.data.users?.length > 0) {
          logger.log('First User sample:', JSON.stringify(response.data.users[0]).substring(0, 100));
        } else {
          logger.log('[DISCOVERY] API returned success but empty users array');
        }
      } else {
        logger.log('[DISCOVERY] API response has no data property');
      }
      
      logger.log('[DISCOVERY] API call complete, response:', response.success);
      if (response.success && (response.data as any)?.requiresLocation) {
        logger.log('[DISCOVERY] Backend says location required — showing gate');
        setRequiresLocation(true);
        setUsers([]);
        setLoading(false);
        return;
      }
      setRequiresLocation(false);
      if (response.success && response.data?.users) {
        logger.log(`[DISCOVERY] Success. Raw users count: ${response.data.users.length}`);
        const myInterests = new Set(user.interests || []);

        const usersWithSimilarity = response.data.users.map((u: any) => {
          const userPhotos = u.photos && u.photos.length > 0 ? u.photos : (u.profilePhoto ? [u.profilePhoto] : []);
          if (userPhotos.length === 0) {
            logger.log(`[DISCOVERY] User ${u._id} has NO photos in raw data`);
          }
          
          const processedPhotos = userPhotos.map((p: any) => {
            if (typeof p === 'string') return p;
            if (p && typeof p === 'object' && p.url) return p.url;
            return null;
          }).filter(Boolean);
          
          if (processedPhotos.length === 0) {
             logger.log(`[DISCOVERY] User ${u._id} has NO valid photo URLs`);
          }

          const theirInterests = u.interests || [];
          const sharedInterests = theirInterests.filter((i: string) => myInterests.has(i));
          
          const personalityMatch = (user as any).personalityType && (u as any).personalityType && (user as any).personalityType === (u as any).personalityType;
          const personalityBonus = personalityMatch ? 20 : 0;

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
            sharedInterests,
            gender: u.gender || 'male',
            verified: u.verified || false,
            location: u.location,
            isBoosted: u.isBoosted || false,
            needsVerification: u.needsVerification || false,
            premium: u.premium || undefined,
            favoriteSong: u.favoriteSong || undefined,
          };
        });

        usersWithSimilarity.sort((a, b) => {
          if (a.isBoosted && !b.isBoosted) return -1;
          if (!a.isBoosted && b.isBoosted) return 1;
          if (discoveryType === 'local') {
            const da = a.distance ?? 99999;
            const db = b.distance ?? 99999;
            return da - db;
          }
          return Math.random() - 0.5;
        });
        
        const filteredUsers = usersWithSimilarity.filter(u => !seenUserIds.current.has(u.id));
        filteredUsers.forEach(u => seenUserIds.current.add(u.id));
        
        setUsers(filteredUsers);
        setCurrentIndex(0);

        // Persist the batch so the next cold-open renders the deck instantly.
        // Both free and premium users benefit from the cache.
        if (filteredUsers.length > 0) {
          AsyncStorage.setItem(
            DISCOVERY_CACHE_KEY,
            JSON.stringify({
              users: filteredUsers.slice(0, 30),
              cachedAt: Date.now(),
              discoveryType,
              selectedCountry,
            }),
          ).catch(() => {});
        }
      } else {
        setUsers([]);
      }
    } catch (error) {
      logger.error("[DISCOVERY] Error loading nearby users:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, token, user?.location?.lat, user?.location?.lng, user?.preferences?.maxDistance, user?.preferences?.ageRange?.min, user?.preferences?.ageRange?.max, user?.interests, user?.gender, selectedCountry]);

  // Keep stable refs in sync with latest values — zero cost, runs after each render.
  useEffect(() => { loadPotentialMatchesRef.current = loadPotentialMatches; }, [loadPotentialMatches]);
  useEffect(() => { fetchRadarNearbyUsersRef.current = fetchRadarNearbyUsers; }, [fetchRadarNearbyUsers]);
  useEffect(() => { tokenRef.current = token ?? null; }, [token]);
  useEffect(() => { hasLocationPermissionRef.current = hasLocationPermission; }, [hasLocationPermission]);

  const hasInitiallyLoaded = useRef(false);
  const preferencesRef = useRef<string>('');
  
  useEffect(() => {
    if (!user?.id || !token) return;
    
    if (user?.photos?.length === 0) {
      logger.log('[DISCOVERY] User has no photos, might be stuck');
    }

    const prefs = user?.preferences as any;
    const lifestyle = (user as any)?.lifestyle;
    const currentPrefs = JSON.stringify({
      lat: user?.location?.lat,
      lng: user?.location?.lng,
      maxDistance: prefs?.maxDistance,
      ageMin: prefs?.ageRange?.min,
      ageMax: prefs?.ageRange?.max,
      gender: user?.gender,
      genderPref: prefs?.genderPreference,
      verifiedOnly: prefs?.showVerifiedOnly,
      onlineNow: prefs?.onlineNow,
      lookingFor: lifestyle?.lookingFor,
      religion: lifestyle?.religion,
      smoking: prefs?.smoking,
      drinking: prefs?.drinking,
      wantsKids: prefs?.wantsKids,
      discoveryType: discoveryType,
      selectedCountry: selectedCountry,
    });
    
    if (!hasInitiallyLoaded.current || currentPrefs !== preferencesRef.current) {
      const isFirstLoad = !hasInitiallyLoaded.current;
      hasInitiallyLoaded.current = true;
      preferencesRef.current = currentPrefs;
      
      const loadData = async () => {
        // Instant render on first mount: hydrate from AsyncStorage cache so
        // photo cards appear immediately — no spinner on cold open.
        // We still fire the network call in background to refresh the deck.
        let hadCachedUsers = false;
        if (isFirstLoad) {
          try {
            const cached = await AsyncStorage.getItem(DISCOVERY_CACHE_KEY);
            if (cached) {
              const parsed = JSON.parse(cached);
              const fresh =
                parsed?.cachedAt &&
                Date.now() - parsed.cachedAt < DISCOVERY_CACHE_TTL_MS &&
                parsed?.discoveryType === discoveryType &&
                (parsed?.selectedCountry || null) === (selectedCountry || null) &&
                Array.isArray(parsed?.users) &&
                parsed.users.length > 0;
              if (fresh) {
                setUsers(parsed.users);
                setCurrentIndex(0);
                setLoading(false);
                parsed.users.forEach((u: any) => seenUserIds.current.add(u.id));
                hadCachedUsers = true;
              }
            }
          } catch {
            // Ignore cache read errors — fall through to normal load
          }
        }
        // Background-refresh: pass silent=true when we already showed cached
        // cards so the loading spinner never appears over a usable deck.
        // Call via ref so this effect doesn't re-run when the callback identity changes.
        await loadPotentialMatchesRef.current?.(hadCachedUsers);
        if (users.length < 3) {
          fetchRadarNearbyUsersRef.current?.();
        }
      };
      loadData();
    }
  // Intentionally omit loadPotentialMatches / fetchRadarNearbyUsers — their
  // identity changes when their own deps change, which would cause this effect
  // to re-fire and trigger duplicate API calls. We reach them via stable refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, token, user?.location?.lat, user?.location?.lng, user?.preferences?.maxDistance, user?.preferences?.ageRange?.min, user?.preferences?.ageRange?.max, user?.gender, discoveryType, selectedCountry]);

  const radarIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isAnimatingRef = useRef(false);
  useEffect(() => {
    isAnimatingRef.current = isAnimating;
  }, [isAnimating]);

  useFocusEffect(
    // Empty dep array: set up the interval once per screen-focus cycle.
    // All live values are read through stable refs so the interval/timeout
    // is never needlessly torn down and restarted when token or permission
    // state changes (which used to fire a fresh radar scan on every change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useCallback(() => {
      checkLocationPermission();
      
      const initialScanTimeout = setTimeout(() => {
        if (hasLocationPermissionRef.current !== false && tokenRef.current && !isAnimatingRef.current) {
          fetchRadarNearbyUsersRef.current?.();
        }
      }, 1000);
      
      radarIntervalRef.current = setInterval(() => {
        // Skip while a swipe animation is mid-flight to avoid jank
        if (hasLocationPermissionRef.current !== false && tokenRef.current && !isAnimatingRef.current) {
          fetchRadarNearbyUsersRef.current?.();
        }
      }, 30000);
      
      return () => {
        clearTimeout(initialScanTimeout);
        if (radarIntervalRef.current) {
          clearInterval(radarIntervalRef.current);
        }
      };
    }, [])
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
    if (type === 'global') {
      fetchCountries();
      setShowCountryPicker(true);
      return;
    }
    setDiscoveryType(type);
    setSelectedCountry(null);
    setUsers([]);
    setLoading(true);
    loadPotentialMatches();
  };

  const handleSelectCountry = (country: string | null) => {
    setSelectedCountry(country);
    setShowCountryPicker(false);
    setDiscoveryType('global');
    setUsers([]);
    setLoading(true);
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

      {discoveryType === 'local' && !(user?.location?.lat && user?.location?.lng) && (
        <Pressable
          onPress={handleShareLocation}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: theme.primary + '22',
            borderColor: theme.primary,
            borderWidth: 1,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: BorderRadius.md,
            marginTop: 12,
          }}
        >
          <Feather name="map-pin" size={14} color={theme.primary} />
          <ThemedText style={{ fontSize: 12, flex: 1, color: theme.primary }}>
            Share your location to see distance & better local matches
          </ThemedText>
          <Feather name="chevron-right" size={14} color={theme.primary} />
        </Pressable>
      )}

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

  const handlePassportPress = useCallback(() => {
    if (!user?.premium?.isActive) {
      showAlert(
        'Premium Feature',
        'Passport lets you match with people in any city! Upgrade to Premium to unlock.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', style: 'default', onPress: () => navigation.navigate('Premium') }
        ],
        'globe'
      );
      return;
    }
    setShowPassportModal(true);
  }, [user?.premium?.isActive, showAlert, navigation]);

  const handleSelectPassportCity = useCallback(async (city: typeof PASSPORT_CITIES[0]) => {
    if (!token) return;
    try {
      const response = await api.post<{ success: boolean; message?: string }>(
        '/users/passport-location',
        { lat: city.lat, lng: city.lng, city: city.name, country: city.country, isActive: true },
        token
      );
      if (response.success) {
        setPassportActive(true);
        setPassportCity(city.name);
        setShowPassportModal(false);
        showAlert('Passport Active', `You're now discovering people in ${city.name}!`, [{ text: 'OK', style: 'default' }], 'globe');
        setLoading(true);
        loadPotentialMatches();
      }
    } catch (error) {
      logger.error('Passport set error:', error);
    }
  }, [token, api, showAlert, loadPotentialMatches]);

  const handleClearPassport = useCallback(async () => {
    if (!token) return;
    try {
      const response = await api.post<{ success: boolean }>(
        '/users/passport-location',
        { isActive: false },
        token
      );
      if (response.success) {
        setPassportActive(false);
        setPassportCity('');
        setShowPassportModal(false);
        showAlert('Passport Cleared', 'You\'re back to discovering people near you.', [{ text: 'OK', style: 'default' }], 'map-pin');
        setLoading(true);
        loadPotentialMatches();
      }
    } catch (error) {
      logger.error('Passport clear error:', error);
    }
  }, [token, api, showAlert, loadPotentialMatches]);

  const openSecondChance = useCallback(async () => {
    if (!token) return;
    setShowSecondChance(true);
    setSecondChanceLoading(true);
    try {
      const res = await api.get<{ success: boolean; profiles: any[] }>('/match/second-chance', token);
      if (res.success && res.data?.profiles) {
        setSecondChanceProfiles(res.data.profiles);
      }
    } catch (e) {
      logger.error('Second chance fetch error:', e);
    } finally {
      setSecondChanceLoading(false);
    }
  }, [token, api]);

  const handleSecondChanceLike = useCallback(async (targetUser: any) => {
    if (!token) return;
    try {
      await api.post<any>('/friends/request', { receiverId: targetUser._id }, token);
      setSecondChanceProfiles(prev => prev.filter(p => p._id !== targetUser._id));
    } catch (e) {
      logger.error('Second chance like error:', e);
    }
  }, [token, api]);

  const handleSecondChancePass = useCallback(async (targetUser: any) => {
    if (!token) return;
    try {
      await api.post<any>('/match/second-chance/pass', { targetUserId: targetUser._id }, token);
      setSecondChanceProfiles(prev => prev.filter(p => p._id !== targetUser._id));
    } catch (e) {
      logger.error('Second chance pass error:', e);
    }
  }, [token, api]);

  const renderHeader = () => (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      <Image
        source={AfroConnectLogo}
        style={styles.logo}
        contentFit="contain"
      />

      <Pressable
        style={styles.headerIconButton}
        onPress={() => navigation.navigate("LoveRadar")}
      >
        <Feather name="target" size={22} color={theme.primary} />
      </Pressable>

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

      <Pressable
        style={styles.headerIconButton}
        onPress={openSecondChance}
      >
        <Feather name="rotate-ccw" size={20} color={theme.text} />
      </Pressable>

      <Pressable
        style={[styles.headerIconButton, passportActive && { backgroundColor: theme.primary + '22', borderRadius: 8 }]}
        onPress={handlePassportPress}
      >
        <Feather name="globe" size={20} color={passportActive ? theme.primary : theme.text} />
      </Pressable>

      <Pressable
        style={styles.headerIconButton}
        onPress={() => navigation.navigate('Filters')}
      >
        <Feather name="sliders" size={20} color={theme.text} />
      </Pressable>
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
          navigation.navigate('MatchPopup', {
            currentUser: {
              id: user.id,
              name: user.name,
              photos: user.photos || []
            },
            matchedUser: {
              id: targetUser.id,
              name: targetUser.name,
              photos: targetUser.photos || []
            },
            isSuperLike: false
          });
        }
      }
    } catch (error: any) {
      const errMsg = error?.message || error?.response?.data?.message || '';
      if (errMsg.toLowerCase().includes('daily swipe limit') || errMsg.toLowerCase().includes('swipe limit')) {
        showAlert(
          'Out of Likes',
          "You've used all 10 daily likes. Upgrade to Premium for unlimited likes!",
          [
            { text: 'Not Now', style: 'cancel' },
            { text: 'Upgrade', style: 'default', onPress: () => navigation.navigate('Premium') },
          ],
          'heart'
        );
      } else if (errMsg.includes('already sent')) {
        showAlert('Already Sent', `You've already sent a request to ${targetUser.name}`, [{ text: 'OK', style: 'default' }], 'info');
      } else {
        logger.error("Error sending match request:", error);
      }
    }
  }, [user, token, api, showAlert, navigation]);

  const handlePassAction = useCallback(async (targetUser: DiscoverUser) => {
    if (!token) return;
    
    try {
      await api.post('/match/swipe', { targetUserId: targetUser.id, action: 'pass' }, token);
    } catch (error) {
      logger.error("Error recording pass:", error);
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

  // Stored as a ref so the blend effect dep array only uses primitives.
  const userFavSongRef = useRef<any>((user as any)?.favoriteSong);
  useEffect(() => { userFavSongRef.current = (user as any)?.favoriteSong; }, [(user as any)?.favoriteSong]);

  useEffect(() => {
    if (loading || isAnimating) return;
    const cur = users[currentIndex];
    if (!cur) return;
    if (blendShownIds.current.has(cur.id)) return;

    const shared = cur.sharedInterests || [];
    const score = cur.similarityScore || 0;

    const mySong = userFavSongRef.current;
    const theirSong = cur.favoriteSong;
    const norm = (s?: string) => (s || '').trim().toLowerCase();
    let songMatch: { type: 'song' | 'artist'; title?: string; artist?: string; albumArt?: string } | undefined;
    if (mySong && theirSong) {
      const sameTitle = !!norm(mySong.title) && norm(mySong.title) === norm(theirSong.title);
      const sameArtist = !!norm(mySong.artist) && norm(mySong.artist) === norm(theirSong.artist);
      if (sameTitle && sameArtist) {
        songMatch = { type: 'song', title: theirSong.title, artist: theirSong.artist, albumArt: theirSong.albumArt };
      } else if (sameArtist) {
        songMatch = { type: 'artist', artist: theirSong.artist, albumArt: theirSong.albumArt };
      }
    }

    const hasInterestBlend = shared.length >= 3 && score >= 65;
    const hasSongBlend = !!songMatch;

    if (hasInterestBlend || hasSongBlend) {
      blendShownIds.current.add(cur.id);
      setBlendMatch({ user: cur, shared, songMatch });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
  // Replace `user` (whole object, changes every context update) with just the
  // two primitives that actually matter for the blend calculation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, users, loading, isAnimating]);

  const handleBlendLike = useCallback(() => {
    if (!blendMatch) return;
    setBlendMatch(null);
    setTimeout(() => handleLike(), 50);
  }, [blendMatch]);

  const handleRewind = useCallback(async () => {
    if (userHistory.current.length === 0) {
      showAlert('No History', 'No previous profiles to rewind to', [{ text: 'OK', style: 'default' }], 'alert-circle');
      return;
    }
    if (!user?.premium?.isActive) {
      showAlert(
        'Premium Feature',
        'Rewind is available for Premium members. Upgrade to undo your last swipe!',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', style: 'default', onPress: () => navigation.navigate('Premium') }
        ],
        'rotate-ccw'
      );
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    rewindButtonScale.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withSpring(1, { damping: 10 })
    );
    try {
      await api.post('/match/rewind', {}, token || '');
    } catch (error) {
      logger.error('Rewind API error:', error);
    }
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
  }, [currentIndex, rewindButtonScale, translateX, showAlert, user?.premium?.isActive, navigation, api, token]);

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
    
    if (!user?.premium?.isActive) {
      showAlert(
        'Premium Feature', 
        'Super Like is available for Premium members. Upgrade to stand out and show extra interest!', 
        [
          { text: 'Maybe Later', style: 'cancel' },
          { text: 'Upgrade', style: 'default', onPress: () => navigation.navigate('Subscription' as any) }
        ], 
        'star'
      );
      return;
    }
    
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
    } catch (error: any) {
      logger.error("Super like error:", error);
      const errMsg = error?.message || error?.response?.data?.message || '';
      if (errMsg.includes('Daily swipe limit') || errMsg.includes('swipe limit')) {
        showAlert(
          'Out of Likes',
          "You've used all 10 daily likes. Upgrade to Premium for unlimited likes!",
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Upgrade', style: 'default', onPress: () => navigation.navigate('Premium') }
          ],
          'heart'
        );
      } else {
        showAlert('Error', 'Something went wrong. Please try again.', [{ text: 'OK', style: 'default' }], 'alert-circle');
      }
    }
  }, [currentIndex, users, token, api, starButtonScale, animateSwipe, showAlert, navigation, playSuperLikeAnimation, user?.premium?.isActive]);

  const handleShareLocation = useCallback(async () => {
    if (!token) return;
    
    try {
      setLocationLoading(true);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      const status = await requestAndCachePermission();

      if (status !== 'granted') {
        setHasLocationPermission(false);
        setLocationPermissionChecked(true);
        showAlert(t('locationRequired'), t('enableLocationAccess'), [{ text: t('ok'), style: 'default' }], 'map-pin');
        setLocationLoading(false);
        return;
      }

      setHasLocationPermission(true);
      setLocationPermissionChecked(true);
      
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
        // Drop the gate immediately and reset the preferences ref so the
        // initial-load useEffect re-fires once `user.location.lat/lng` flips
        // in. Calling `loadPotentialMatches()` directly here would use the
        // stale memoized closure (without the new coords) and re-trigger the
        // requiresLocation gate, which is the bug new users hit on signup.
        setRequiresLocation(false);
        preferencesRef.current = '';
        setLoading(true);
        showAlert(t('success'), t('locationUpdated'), [{ text: t('ok'), style: 'default' }], 'check-circle');
      }
    } catch (error) {
      logger.error('Location sharing error:', error);
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

  if (requiresLocation && !currentUser) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <ThemedView style={[styles.container, styles.centerContent]}>
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.primary + '20' }]}>
                <Feather name="map-pin" size={48} color={theme.primary} />
              </View>
            </View>

            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              Enable location to start discovering
            </ThemedText>
            <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              We use your location to show you people nearby. Your exact coordinates are never shared with other users — only an approximate distance.
            </ThemedText>

            <View style={styles.emptyButtonsContainer}>
              <Pressable
                style={[styles.emptyRefreshButton, { backgroundColor: theme.primary, opacity: locationLoading ? 0.7 : 1 }]}
                onPress={handleShareLocation}
                disabled={locationLoading}
              >
                <Feather name="map-pin" size={18} color="#FFF" />
                <ThemedText style={styles.emptyRefreshButtonText}>
                  {locationLoading ? 'Enabling…' : 'Enable Location'}
                </ThemedText>
              </Pressable>

              {user?.premium?.isActive && (
                <Pressable
                  style={[styles.loveRadarButton, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.primary }]}
                  onPress={() => {
                    setDiscoveryType('global');
                    setRequiresLocation(false);
                    setLoading(true);
                    loadPotentialMatches();
                  }}
                >
                  <Feather name="globe" size={18} color={theme.primary} />
                  <ThemedText style={[styles.loveRadarButtonText, { color: theme.primary }]}>
                    Browse Globally
                  </ThemedText>
                </Pressable>
              )}
            </View>

            <Pressable
              style={styles.emptySettingsLink}
              onPress={() => navigation.navigate("Settings")}
            >
              <Feather name="sliders" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.emptySettingsText, { color: theme.textSecondary }]}>
                Open settings
              </ThemedText>
            </Pressable>
          </View>
          <AlertComponent />
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

        {passportActive && (
          <View style={[styles.passportBadge, { backgroundColor: theme.primary }]}>
            <Feather name="globe" size={14} color="#FFF" />
            <ThemedText style={styles.passportBadgeText}>Passport Active: {passportCity}</ThemedText>
            <Pressable onPress={handleClearPassport}>
              <Feather name="x" size={16} color="#FFF" />
            </Pressable>
          </View>
        )}

        {discoveryType === 'global' && (
          <View style={[styles.passportBadge, { backgroundColor: theme.primary }]}>
            <Feather name="globe" size={14} color="#FFF" />
            <ThemedText style={styles.passportBadgeText}>
              {selectedCountry ? `Global: ${selectedCountry}` : 'Global: All Countries'}
            </ThemedText>
            <Pressable onPress={() => { fetchCountries(); setShowCountryPicker(true); }}>
              <Feather name="edit-2" size={14} color="#FFF" />
            </Pressable>
            <Pressable onPress={() => { setDiscoveryType('local'); setSelectedCountry(null); setUsers([]); setLoading(true); }}>
              <Feather name="x" size={16} color="#FFF" />
            </Pressable>
          </View>
        )}

        <Modal
          visible={showCountryPicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCountryPicker(false)}
        >
          <View style={styles.passportModalOverlay}>
            <View style={[styles.passportModalContent, { backgroundColor: theme.surface }]}>
              <View style={styles.passportModalHeader}>
                <ThemedText style={[styles.passportModalTitle, { color: theme.text }]}>
                  Choose a Country
                </ThemedText>
                <Pressable onPress={() => setShowCountryPicker(false)}>
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
              </View>
              <ScrollView style={styles.passportCityList}>
                <Pressable
                  style={[
                    styles.passportCityItem,
                    { borderBottomColor: theme.border },
                    selectedCountry === null && { backgroundColor: theme.primary + '15' }
                  ]}
                  onPress={() => handleSelectCountry(null)}
                >
                  <View>
                    <ThemedText style={[styles.passportCityName, { color: theme.text }]}>All Countries</ThemedText>
                    <ThemedText style={[styles.passportCityCountry, { color: theme.textSecondary }]}>Show users worldwide</ThemedText>
                  </View>
                  {selectedCountry === null && discoveryType === 'global' && <Feather name="check" size={20} color={theme.primary} />}
                </Pressable>
                {(countries.length > 0 ? countries : FALLBACK_COUNTRIES).map((country) => (
                  <Pressable
                    key={country}
                    style={[
                      styles.passportCityItem,
                      { borderBottomColor: theme.border },
                      selectedCountry === country && { backgroundColor: theme.primary + '15' }
                    ]}
                    onPress={() => handleSelectCountry(country)}
                  >
                    <View>
                      <ThemedText style={[styles.passportCityName, { color: theme.text }]}>{country}</ThemedText>
                    </View>
                    {selectedCountry === country && <Feather name="check" size={20} color={theme.primary} />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <Modal
          visible={showPassportModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPassportModal(false)}
        >
          <View style={styles.passportModalOverlay}>
            <View style={[styles.passportModalContent, { backgroundColor: theme.surface }]}>
              <View style={styles.passportModalHeader}>
                <ThemedText style={[styles.passportModalTitle, { color: theme.text }]}>
                  Passport - Choose a City
                </ThemedText>
                <Pressable onPress={() => setShowPassportModal(false)}>
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
              </View>
              <ScrollView style={styles.passportCityList}>
                {PASSPORT_CITIES.map((city) => (
                  <Pressable
                    key={city.name}
                    style={[
                      styles.passportCityItem,
                      { borderBottomColor: theme.border },
                      passportCity === city.name && { backgroundColor: theme.primary + '15' }
                    ]}
                    onPress={() => handleSelectPassportCity(city)}
                  >
                    <View>
                      <ThemedText style={[styles.passportCityName, { color: theme.text }]}>{city.name}</ThemedText>
                      <ThemedText style={[styles.passportCityCountry, { color: theme.textSecondary }]}>{city.country}</ThemedText>
                    </View>
                    {passportCity === city.name && <Feather name="check" size={20} color={theme.primary} />}
                  </Pressable>
                ))}
              </ScrollView>
              {passportActive && (
                <Pressable
                  style={[styles.passportClearButton, { borderColor: '#FF6B6B' }]}
                  onPress={handleClearPassport}
                >
                  <Feather name="map-pin" size={18} color="#FF6B6B" />
                  <ThemedText style={styles.passportClearText}>Clear Passport - Use Real Location</ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        </Modal>

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
                colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.98)']}
                style={styles.cardGradient}
              />

              <Animated.View style={[styles.likeStamp, likeOpacity]}>
                <ThemedText style={[styles.stampText, { color: '#4CAF50' }]}>{t('like')}</ThemedText>
              </Animated.View>

              <Animated.View style={[styles.passStamp, passOpacity]}>
                <ThemedText style={[styles.stampText, { color: '#FF6B6B' }]}>{t('nope')}</ThemedText>
              </Animated.View>


              <Pressable
                style={styles.profileIconButton}
                onPress={handleViewProfile}
              >
                <Feather name="user" size={20} color="#FFF" />
              </Pressable>

              <View style={[styles.cardInfoOverlay, { zIndex: 10 }]}>
                <View style={styles.nameRow}>
                  <ThemedText style={styles.profileName} numberOfLines={1} adjustsFontSizeToFit={false}>
                    {currentUser.name?.split(' ')[0]}
                    {currentUser.age != null && (
                      <ThemedText style={styles.profileAge}>, {currentUser.age}</ThemedText>
                    )}
                  </ThemedText>
                  {currentUser.verified && (
                    <VerificationBadge size={22} />
                  )}
                  {(currentUser as any).premium?.isActive && (
                    <PremiumBadge size="small" style={{ marginLeft: 4 }} />
                  )}
                </View>

                {(currentUser as any).location?.city && (
                  <View style={styles.locationRow}>
                    <Feather name="map-pin" size={13} color="rgba(255,255,255,0.7)" />
                    <ThemedText style={styles.locationText} numberOfLines={1}>
                      {(currentUser as any).location.city}{(currentUser as any).location.country ? `, ${(currentUser as any).location.country}` : ''}
                    </ThemedText>
                  </View>
                )}

                {(() => {
                  const distanceLabel = formatDistanceAway(currentUser, user);
                  if (!distanceLabel) return null;
                  return (
                    <View style={styles.locationRow}>
                      <Feather name="navigation" size={13} color="rgba(255,255,255,0.7)" />
                      <ThemedText style={styles.locationText} numberOfLines={1}>
                        {distanceLabel}
                      </ThemedText>
                    </View>
                  );
                })()}

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
              style={[styles.rewindButton, { backgroundColor: isDark ? '#1e1e1e' : '#FFF' }, userHistory.current.length === 0 && styles.disabledButton]}
              onPress={handleRewind}
              disabled={isAnimating || userHistory.current.length === 0}
            >
              <Feather name="rotate-ccw" size={20} color="#f5d142" />
            </Pressable>
          </Animated.View>

          <Animated.View style={passButtonStyle}>
            <Pressable
              style={[styles.passButton, { backgroundColor: isDark ? '#1e1e1e' : '#FFF' }]}
              onPress={handlePass}
              disabled={isAnimating}
            >
              <Feather name="x" size={28} color="#FF6B6B" />
            </Pressable>
          </Animated.View>

          <Animated.View style={starButtonStyle}>
            <Pressable
              style={[styles.starButton, { backgroundColor: isDark ? '#1e1e1e' : '#FFF' }]}
              onPress={handleSuperLike}
              disabled={isAnimating}
            >
              <Feather name="star" size={28} color="#2196f3" />
            </Pressable>
          </Animated.View>

          <Animated.View style={likeButtonStyle}>
            <Pressable
              style={[styles.likeButton, { backgroundColor: isDark ? '#1e1e1e' : '#FFF' }]}
              onPress={handleLike}
              disabled={isAnimating}
            >
              <Feather name="heart" size={28} color="#FF6B6B" />
            </Pressable>
          </Animated.View>
          
          <Pressable
            style={[styles.boostButton, { backgroundColor: isDark ? '#1e1e1e' : '#FFF' }]}
            onPress={async () => {
              if (Platform.OS !== 'web') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              try {
                const response = await api.post<{ success: boolean; message: string }>('/boost/activate', { type: 'standard' }, token || '');
                const data = response.data as any;
                if (response.success && data?.success) {
                  showAlert('Boost Activated!', 'Your profile is now being featured to more users for 30 minutes!', [{ text: 'Great', style: 'default' }], 'zap');
                } else if (data?.message?.includes('already have an active boost')) {
                  showAlert('Boost Active', 'You already have an active boost! Your profile is being featured to more users.', [{ text: 'OK', style: 'default' }], 'zap');
                } else {
                  showAlert('Boost', data?.message || 'Failed to activate boost', [{ text: 'OK', style: 'default' }], 'info');
                }
              } catch (error: any) {
                logger.error("Boost error:", error);
                const errorMsg = error?.response?.data?.message || error?.message || '';
                if (errorMsg.includes('already have an active boost')) {
                  showAlert('Boost Active', 'You already have an active boost! Your profile is being featured to more users.', [{ text: 'OK', style: 'default' }], 'zap');
                } else {
                  showAlert('Error', 'Failed to activate boost. Please try again.', [{ text: 'OK', style: 'default' }], 'alert-circle');
                }
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

        <Modal
          visible={!!blendMatch}
          transparent
          animationType="slide"
          onRequestClose={() => setBlendMatch(null)}
          statusBarTranslucent
        >
          <BlendPopupPage
            blendMatch={blendMatch}
            currentUser={user}
            theme={theme}
            onClose={() => setBlendMatch(null)}
            onLike={handleBlendLike}
          />
        </Modal>

        <Modal
          visible={showSecondChance}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSecondChance(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <View style={[{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <ThemedText style={{ fontSize: 20, fontWeight: '700', color: theme.text }}>Second Chance 🔄</ThemedText>
                <Pressable onPress={() => setShowSecondChance(false)}>
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
              </View>
              <ThemedText style={{ color: theme.textSecondary, marginBottom: 20, fontSize: 14 }}>
                People you may have swiped past. Give them another look!
              </ThemedText>

              {secondChanceLoading ? (
                <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
              ) : secondChanceProfiles.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 40 }}>
                  <Feather name="rotate-ccw" size={48} color={theme.textSecondary} />
                  <ThemedText style={{ color: theme.textSecondary, marginTop: 16, textAlign: 'center' }}>
                    No second chances yet.{'\n'}Keep swiping to build your list!
                  </ThemedText>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {secondChanceProfiles.map(profile => {
                    const photo = profile.photos?.[0];
                    const photoSrc = photo ? (typeof photo === 'string' ? { uri: photo } : photo.url ? { uri: photo.url } : null) : null;
                    return (
                      <View key={profile._id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 10, backgroundColor: theme.surface }}>
                        {photoSrc ? (
                          <Image source={photoSrc} style={{ width: 60, height: 60, borderRadius: 30 }} contentFit="cover" />
                        ) : (
                          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: theme.backgroundSecondary, justifyContent: 'center', alignItems: 'center' }}>
                            <Feather name="user" size={28} color={theme.textSecondary} />
                          </View>
                        )}
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <ThemedText style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>{profile.name}, {profile.age}</ThemedText>
                          {profile.sharedInterests?.length > 0 && (
                            <ThemedText style={{ fontSize: 12, color: theme.primary, marginTop: 2 }}>
                              {profile.sharedInterests.slice(0, 3).join(' · ')}
                            </ThemedText>
                          )}
                        </View>
                        <Pressable
                          onPress={() => handleSecondChancePass(profile)}
                          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.textSecondary, justifyContent: 'center', alignItems: 'center', marginRight: 8 }}
                        >
                          <Feather name="x" size={18} color={theme.textSecondary} />
                        </Pressable>
                        <Pressable
                          onPress={() => handleSecondChanceLike(profile)}
                          style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }}
                        >
                          <Feather name="heart" size={18} color="#FFF" />
                        </Pressable>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </Modal>
      </ThemedView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    height: Platform.OS === 'ios' ? 108 : 88,
    backgroundColor: 'transparent',
    zIndex: 100,
    gap: 4,
  },
  headerIconButton: {
    padding: 7,
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 8,
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
    backgroundColor: 'rgba(150, 150, 150, 0.15)',
    borderRadius: 20,
    padding: 2,
    flex: 1,
    justifyContent: 'center',
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 3,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '',
  },
  activeToggleText: {
    color: '#000',
    fontWeight: '700',
  },
  container: {
    flex: 1,
  },
  profileImageFull: {
    position: 'absolute',
    width: "100%",
    height: "100%",
    zIndex: 1,
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
    height: STABLE_CARD_HEIGHT,
    marginHorizontal: 10,
    marginBottom: -20,
  },
  profileCard: {
    flex: 1,
      borderRadius: 24, 
      overflow: 'hidden',
      backgroundColor: '#1E1E1E',
      height: '100%',
  },
  stackedCard: {
    transform: [{ scale: 0.95 }],
    opacity: 0.3,
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
    height: "65%",
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    flexWrap: 'nowrap',
    width: '100%',
    gap: 6,
  },
  profileName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFF",
    paddingBottom: 4,
    lineHeight: 38,
    includeFontPadding: false,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  profileAge: {
    fontSize: 28,
    fontWeight: "400",
    color: "#FFF",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    marginLeft: 8,
  },
  verifiedTick: {
    width: 22,
    height: 22,
    marginLeft: 6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 10,
  },
  locationText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "500",
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
    gap: 6,
    marginBottom: 12,
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
  viewProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 30,
    alignSelf: "flex-start",
  },
  viewProfileButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
    letterSpacing: 0.3,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  profileIconButton: {
    position: "absolute",
    top: 20,
    left: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
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
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  passButton: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  starButton: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  likeButton: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  boostButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
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
  passportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    gap: 6,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: 4,
  },
  passportBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  passportModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  passportModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '70%',
  },
  passportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  passportModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  passportCityList: {
    paddingHorizontal: Spacing.lg,
  },
  passportCityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  passportCityName: {
    fontSize: 16,
    fontWeight: '600',
  },
  passportCityCountry: {
    fontSize: 13,
    marginTop: 2,
  },
  passportClearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  passportClearText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
});

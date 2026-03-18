import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform,
  Linking,
  TouchableOpacity,
} from "react-native";
import { useThemedAlert } from "@/components/ThemedAlert";
import { Image } from "expo-image";
import * as Location from "expo-location";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop, Path } from "react-native-svg";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useLanguage";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { getApiBaseUrl } from "@/constants/config";
import Slider from "@react-native-community/slider";

const { width } = Dimensions.get("window");
const RADAR_SIZE = Math.min(width - 60, 320);
const CENTER = RADAR_SIZE / 2;

interface NearbyUser {
  id: string;
  name: string;
  username?: string;
  age: number;
  gender: string;
  bio?: string;
  profilePhoto: string | null;
  distance: number;
  angle: number;
  online: boolean;
  verified: boolean;
  interests: string[];
}

type LoveRadarScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "LoveRadar">;

interface LoveRadarScreenProps {
  navigation: LoveRadarScreenNavigationProp;
}

export default function LoveRadarScreen({ navigation }: LoveRadarScreenProps) {
  const { theme } = useTheme();
  const { token, updateProfile } = useAuth();
  const { t } = useTranslation();
  const { showAlert, AlertComponent } = useThemedAlert();

  const [loading, setLoading] = useState(true);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [locationPermission, setLocationPermission] = useState<boolean | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const [filters, setFilters] = useState({
    radius: 50,
    ageMin: 18,
    ageMax: 60,
    gender: "any" as "any" | "male" | "female",
  });

  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);
  const refreshInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(1.3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const scannerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.3], [0.5, 0]),
  }));

  const updateServerLocation = async (lat: number, lng: number) => {
    try {
      await fetch(`${getApiBaseUrl()}/api/radar/location`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ lat, lng }),
      });
    } catch (error) {
      console.error("Failed to update location:", error);
    }
  };

  const fetchNearbyUsers = useCallback(async (coords?: { lat: number; lng: number }) => {
    const location = coords || userLocation;
    if (!location || !token) return;

    try {
      const params = new URLSearchParams({
        lat: location.lat.toString(),
        lng: location.lng.toString(),
        radius: filters.radius.toString(),
        ageMin: filters.ageMin.toString(),
        ageMax: filters.ageMax.toString(),
        gender: filters.gender,
      });

      const response = await fetch(`${getApiBaseUrl()}/api/radar/nearby-users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setNearbyUsers(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch nearby users:", error);
    } finally {
      setLoading(false);
    }
  }, [userLocation, token, filters]);

  const handleRefreshLocation = useCallback(async () => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        showAlert(t('locationRequired'), t('enableLocationAccess'), [{ text: t('ok') }], 'map-pin');
        setLocationLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: location.coords.latitude, lng: location.coords.longitude };

      setUserLocation(coords);
      setLocationPermission(true);
      await updateServerLocation(coords.lat, coords.lng);
      await updateProfile({ location: coords });
      await fetchNearbyUsers(coords);

      showAlert(t('success'), t('locationUpdated'), [{ text: t('ok') }], 'check-circle');
    } catch (error) {
      showAlert(t('error'), t('locationError'), [{ text: t('ok') }], 'alert-circle');
    } finally {
      setLocationLoading(false);
    }
  }, [token, updateProfile, fetchNearbyUsers, t, showAlert]);

  const toggleLocationSharing = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/radar/location-sharing`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: !locationSharingEnabled }),
      });

      const data = await response.json();
      if (data.success) {
        setLocationSharingEnabled(!locationSharingEnabled);
        showAlert(t('locationSharing'), locationSharingEnabled ? t('youAreHidden') : t('youAreVisible'), [{ text: t('ok') }], locationSharingEnabled ? 'eye-off' : 'eye');
      }
    } catch (error) {
      showAlert(t('error'), "Failed to update settings", [{ text: t('ok') }], 'alert-circle');
    }
  };

  const getUserDotPosition = (user: NearbyUser) => {
    const maxRadius = (RADAR_SIZE / 2 - 50);
    const distanceRatio = Math.min(user.distance / filters.radius, 1);
    const radius = distanceRatio * maxRadius;
    const angleRad = (user.angle * Math.PI) / 180;
    return {
      x: CENTER + radius * Math.cos(angleRad),
      y: CENTER + radius * Math.sin(angleRad)
    };
  };

  const getGenderColor = (gender: string) => (gender === "female" ? "#FF6B9D" : "#4A90E2");

  const handleUserPress = (userId: string) => navigation.navigate("ProfileDetail", { userId });

  return (
    <ScreenScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.container}>

        {/* --- LAYER 1: TOP NAVIGATION --- */}
        <View style={styles.topHeader}>
          <View style={styles.headerLeft}>
            <TouchableOpacity 
              style={[styles.backButton, { backgroundColor: theme.surface }]} 
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ThemedText style={[styles.pageTitle, { color: theme.text }]}>
            Love Radar
          </ThemedText>

          <View style={styles.headerRight} />
        </View>

        {/* --- LAYER 2: INFO & ACTIONS --- */}
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              {nearbyUsers.length > 0
                ? `${nearbyUsers.length} ${t('peopleWithinKm')}\n${filters.radius}km`
                : t('scanningNearby')}
            </ThemedText>
          </View>

          <View style={styles.headerButtons}>
            <Pressable
              style={[styles.headerButton, { backgroundColor: theme.surface }]}
              onPress={handleRefreshLocation}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Feather name="map-pin" size={18} color="#F2994A" />
              )}
            </Pressable>

            <Pressable
              style={[styles.headerButton, { backgroundColor: theme.surface }]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Feather name="sliders" size={18} color="#F2994A" />
            </Pressable>

            <Pressable
              style={[
                styles.headerButton,
                { backgroundColor: locationSharingEnabled ? theme.online : theme.surface },
              ]}
              onPress={toggleLocationSharing}
            >
              <Feather
                name={locationSharingEnabled ? "eye" : "eye-off"}
                size={18}
                color={locationSharingEnabled ? "#fff" : theme.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {/* --- FILTERS --- */}
        {showFilters && (
          <View style={[styles.filtersCard, { backgroundColor: theme.surface }]}>
            <ThemedText style={styles.filterLabel}>{t('distance')}: {filters.radius}km</ThemedText>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={100}
              value={filters.radius}
              onValueChange={(v) => setFilters({ ...filters, radius: Math.round(v) })}
              minimumTrackTintColor={theme.primary}
              thumbTintColor={theme.primary}
            />
            <TouchableOpacity 
              style={[styles.applyButton, { backgroundColor: theme.primary }]} 
              onPress={() => setShowFilters(false)}
            >
              <ThemedText style={{ color: '#FFF', fontWeight: '700' }}>{t('applyFilters')}</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* --- RADAR --- */}
        <View style={[styles.radarCard, { backgroundColor: theme.surface }]}>
          <View style={styles.radarContainer}>
            <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
              {[0.25, 0.5, 0.75, 1].map((f, i) => (
                <Circle key={i} cx={CENTER} cy={CENTER} r={(RADAR_SIZE / 2 - 30) * f} stroke={theme.border} strokeDasharray="4,4" fill="none" opacity={0.3} />
              ))}
              <Circle cx={CENTER} cy={CENTER} r="8" fill={theme.primary} />
            </Svg>

            <Animated.View style={[styles.pulseRing, pulseStyle]}>
              <View style={[styles.ring, { borderColor: theme.primary, width: RADAR_SIZE, height: RADAR_SIZE, borderRadius: RADAR_SIZE/2 }]} />
            </Animated.View>

            <Animated.View style={[styles.scannerBeam, scannerStyle]}>
              <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
                <Defs>
                  <RadialGradient id="beamGrad" cx="50%" cy="50%">
                    <Stop offset="0%" stopColor={theme.primary} stopOpacity="0.3" />
                    <Stop offset="100%" stopColor={theme.primary} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Path d={`M ${CENTER} ${CENTER} L ${CENTER} 30 A ${CENTER - 30} ${CENTER - 30} 0 0 1 ${RADAR_SIZE - 30} ${CENTER} Z`} fill="url(#beamGrad)" />
              </Svg>
            </Animated.View>

            {nearbyUsers.map((u) => {
              const pos = getUserDotPosition(u);
              return (
                <Pressable key={u.id} style={[styles.userDot, { left: pos.x - 22, top: pos.y - 22, backgroundColor: getGenderColor(u.gender) }]} onPress={() => handleUserPress(u.id)}>
                  {u.profilePhoto ? <Image source={{ uri: u.profilePhoto }} style={styles.userDotImage} /> : <Feather name="user" size={16} color="#fff" />}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* --- LIST --- */}
        <View style={styles.nearbyListSection}>
          <ThemedText style={styles.sectionTitle}>{t('peopleNearby')}</ThemedText>
          {nearbyUsers.map((u) => (
            <Pressable key={u.id} style={[styles.userCard, { backgroundColor: theme.surface }]} onPress={() => handleUserPress(u.id)}>
              <View style={styles.userCardLeft}>
                <Image source={{ uri: u.profilePhoto || '' }} style={styles.userCardPhoto} />
                <View>
                  <ThemedText style={styles.userCardName}>{u.name}, {u.age}</ThemedText>
                  <ThemedText style={styles.userCardDistance}>{u.distance.toFixed(1)} km away</ThemedText>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>

        <AlertComponent />
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // LAYER 1: Balanced Header
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 10,
  },
  headerLeft: {
    width: 44, 
    alignItems: 'flex-start'
  },
  headerRight: {
    width: 44, // Matches headerLeft for perfect centering
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    ...Typography.h3,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    flex: 1,
  },
  // LAYER 2: Sub-header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 15,
  },
  headerInfo: { flex: 1 },
  subtitle: { ...Typography.body, fontSize: 15, lineHeight: 20 },
  headerButtons: { flexDirection: "row", gap: 10 },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  // UI COMPONENTS
  filtersCard: { padding: 20, margin: 16, borderRadius: 20 },
  filterLabel: { ...Typography.body, marginBottom: 10 },
  slider: { width: '100%', height: 40, marginBottom: 10 },
  applyButton: { padding: 12, borderRadius: 12, alignItems: 'center' },
  radarCard: { borderRadius: 24, marginHorizontal: 16, padding: 20, alignItems: 'center' },
  radarContainer: { width: RADAR_SIZE, height: RADAR_SIZE, alignItems: "center", justifyContent: "center" },
  scannerBeam: { position: "absolute", width: RADAR_SIZE, height: RADAR_SIZE },
  pulseRing: { position: "absolute", alignItems: "center", justifyContent: "center" },
  ring: { borderWidth: 1, position: 'absolute' },
  userDot: { position: "absolute", width: 44, height: 44, borderRadius: 22, padding: 2, borderWidth: 2, borderColor: '#000' },
  userDotImage: { width: '100%', height: '100%', borderRadius: 20 },
  nearbyListSection: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { ...Typography.h3, marginBottom: 15 },
  userCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderRadius: 16, marginBottom: 10 },
  userCardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  userCardPhoto: { width: 50, height: 50, borderRadius: 25 },
  userCardName: { ...Typography.body, fontWeight: "600" },
  userCardDistance: { ...Typography.small },
});
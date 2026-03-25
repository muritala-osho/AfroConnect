import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform,
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
import { Spacing, BorderRadius } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { getApiBaseUrl } from "@/constants/config";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

const { width, height } = Dimensions.get("window");
const RADAR_SIZE = Math.min(width - 80, 280);
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
  const glowPulse = useSharedValue(1);
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
    glowPulse.value = withRepeat(
      withTiming(1.2, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const scannerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: interpolate(pulse.value, [1, 1.3], [0.3, 0]),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowPulse.value, [1, 1.2], [0.4, 0.15]),
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
        showAlert(
          t('locationSharing'),
          locationSharingEnabled ? t('youAreHidden') : t('youAreVisible'),
          [{ text: t('ok') }],
          locationSharingEnabled ? 'eye-off' : 'eye'
        );
      }
    } catch (error) {
      showAlert(t('error'), "Failed to update settings", [{ text: t('ok') }], 'alert-circle');
    }
  };

  const getUserDotPosition = (user: NearbyUser) => {
    const maxRadius = RADAR_SIZE / 2 - 50;
    const distanceRatio = Math.min(user.distance / filters.radius, 1);
    const radius = distanceRatio * maxRadius;
    const angleRad = (user.angle * Math.PI) / 180;
    return {
      x: CENTER + radius * Math.cos(angleRad),
      y: CENTER + radius * Math.sin(angleRad),
    };
  };

  const getGenderGradient = (gender: string) =>
    gender === "female"
      ? ["#FF6B9D", "#FF4081"]
      : ["#4A90E2", "#2563EB"];

  const handleUserPress = (userId: string) => navigation.navigate("ProfileDetail", { userId });

  const isDark = theme.background === '#000' || theme.background === '#0a0a0a';

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : theme.background }]}>
      <ScreenScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          <ThemedText style={styles.pageTitle}>Love Radar</ThemedText>

          <View style={styles.headerRight} />
        </View>

        {/* STATS & CONTROLS */}
        <View style={styles.statsRow}>
          <View style={styles.statsInfo}>
            <ThemedText style={styles.statsLabel}>Nearby singles</ThemedText>
            <ThemedText style={styles.statsCount}>
              {nearbyUsers.length} {nearbyUsers.length === 1 ? 'person' : 'people'}
            </ThemedText>
            <ThemedText style={styles.statsSubtext}>
              within {filters.radius} km
            </ThemedText>
          </View>

          <View style={styles.controlButtons}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: 'rgba(242,153,74,0.15)', borderColor: 'rgba(242,153,74,0.3)' }]}
              onPress={handleRefreshLocation}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color="#F2994A" />
              ) : (
                <Feather name="map-pin" size={18} color="#F2994A" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: 'rgba(242,153,74,0.15)', borderColor: 'rgba(242,153,74,0.3)' }]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Feather name="sliders" size={18} color="#F2994A" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.controlButton,
                {
                  backgroundColor: locationSharingEnabled ? '#8b5cf6' : 'rgba(255,255,255,0.08)',
                  borderColor: locationSharingEnabled ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.1)',
                },
              ]}
              onPress={toggleLocationSharing}
            >
              <Feather
                name={locationSharingEnabled ? "eye" : "eye-off"}
                size={18}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* FILTERS */}
        {showFilters && (
          <View style={[styles.filtersCard, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
            <ThemedText style={styles.filterLabel}>
              {t('distance')}: {filters.radius}km
            </ThemedText>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={100}
              value={filters.radius}
              onValueChange={(v) => setFilters({ ...filters, radius: Math.round(v) })}
              minimumTrackTintColor="#8b5cf6"
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor="#8b5cf6"
            />
            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: '#8b5cf6' }]}
              onPress={() => {
                setShowFilters(false);
                fetchNearbyUsers();
              }}
            >
              <ThemedText style={{ color: '#FFF', fontWeight: '700' }}>
                {t('applyFilters')}
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* RADAR CARD */}
        <View style={styles.radarCard}>
          {/* Animated glow background */}
          <Animated.View style={[styles.radarGlow, glowStyle]}>
            <View
              style={{
                width: RADAR_SIZE + 100,
                height: RADAR_SIZE + 100,
                borderRadius: (RADAR_SIZE + 100) / 2,
                backgroundColor: 'rgba(139,92,246,0.2)',
              }}
            />
          </Animated.View>

          <View style={[styles.radarInner, { backgroundColor: 'rgba(255,255,255,0.03)' }]}>
            <View style={styles.radarContainer}>
              {/* SVG Radar */}
              <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
                <Defs>
                  <RadialGradient id="beamGrad" cx="50%" cy="50%">
                    <Stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.4" />
                    <Stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                  </RadialGradient>
                </Defs>

                {/* Grid circles */}
                {[0.25, 0.5, 0.75, 1].map((f, i) => (
                  <Circle
                    key={i}
                    cx={CENTER}
                    cy={CENTER}
                    r={(RADAR_SIZE / 2 - 30) * f}
                    stroke="rgba(255,255,255,0.06)"
                    strokeDasharray="4,4"
                    fill="none"
                  />
                ))}

                {/* Scanning beam */}
                <Animated.View style={[{ position: 'absolute' }, scannerStyle]}>
                  <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
                    <Path
                      d={`M ${CENTER} ${CENTER} L ${CENTER} 30 A ${CENTER - 30} ${
                        CENTER - 30
                      } 0 0 1 ${RADAR_SIZE - 30} ${CENTER} Z`}
                      fill="url(#beamGrad)"
                    />
                  </Svg>
                </Animated.View>

                {/* Center point */}
                <Circle cx={CENTER} cy={CENTER} r="8" fill="#8b5cf6" />
              </Svg>

              {/* Pulse rings */}
              <Animated.View style={[styles.pulseRing, pulseStyle]}>
                <View
                  style={[
                    styles.ring,
                    {
                      borderColor: '#8b5cf6',
                      width: RADAR_SIZE,
                      height: RADAR_SIZE,
                      borderRadius: RADAR_SIZE / 2,
                    },
                  ]}
                />
              </Animated.View>

              {/* User dots */}
              {nearbyUsers.map((u, index) => {
                const pos = getUserDotPosition(u);
                const gradientColors = getGenderGradient(u.gender);
                return (
                  <Pressable
                    key={u.id}
                    style={[
                      styles.userDot,
                      { left: pos.x - 22, top: pos.y - 22 },
                    ]}
                    onPress={() => handleUserPress(u.id)}
                  >
                    <LinearGradient
                      colors={gradientColors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.userDotGradient}
                    >
                      {u.profilePhoto ? (
                        <Image source={{ uri: u.profilePhoto }} style={styles.userDotImage} />
                      ) : (
                        <Feather name="user" size={20} color="#fff" />
                      )}
                      {u.online && (
                        <View style={styles.onlineIndicator} />
                      )}
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>

            {/* Distance scale */}
            <View style={styles.distanceScale}>
              <ThemedText style={styles.scaleText}>0 km</ThemedText>
              <ThemedText style={styles.scaleText}>{(filters.radius / 2).toFixed(1)} km</ThemedText>
              <ThemedText style={styles.scaleText}>{filters.radius} km</ThemedText>
            </View>
          </View>
        </View>

        {/* NEARBY LIST */}
        <View style={styles.nearbySection}>
          <ThemedText style={styles.sectionTitle}>People nearby</ThemedText>

          {nearbyUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color="rgba(255,255,255,0.2)" />
              <ThemedText style={styles.emptyText}>No one nearby yet</ThemedText>
              <ThemedText style={styles.emptySubtext}>
                Try adjusting your search radius
              </ThemedText>
            </View>
          ) : (
            nearbyUsers.map((u, index) => {
              const gradientColors = getGenderGradient(u.gender);
              return (
                <Pressable
                  key={u.id}
                  style={[styles.userCard, { backgroundColor: 'rgba(255,255,255,0.04)' }]}
                  onPress={() => handleUserPress(u.id)}
                >
                  <View style={styles.userCardContent}>
                    <View style={styles.userAvatar}>
                      <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.avatarGradient}
                      >
                        {u.profilePhoto ? (
                          <Image source={{ uri: u.profilePhoto }} style={styles.avatarImage} />
                        ) : (
                          <Feather name="user" size={24} color="#fff" />
                        )}
                      </LinearGradient>
                      {u.online && <View style={styles.avatarOnline} />}
                    </View>

                    <View style={styles.userInfo}>
                      <ThemedText style={styles.userName}>
                        {u.name}, {u.age}
                      </ThemedText>
                      <ThemedText style={styles.userDistance}>
                        {u.distance.toFixed(1)} km away
                      </ThemedText>
                    </View>
                  </View>

                  <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.4)" />
                </Pressable>
              );
            })
          )}
        </View>

        <AlertComponent />
      </ScreenScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
  },
  headerLeft: {
    width: 44,
    alignItems: 'flex-start',
  },
  headerRight: {
    width: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: '#fff',
    letterSpacing: 0.5,
    flex: 1,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 20,
  },
  statsInfo: {
    flex: 1,
  },
  statsLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
  },
  statsCount: {
    fontSize: 24,
    fontWeight: "700",
    color: '#fff',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  statsSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  controlButtons: {
    flexDirection: "row",
    gap: 8,
  },
  controlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  filtersCard: {
    padding: 20,
    marginHorizontal: 16,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  filterLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 10,
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 10,
  },
  applyButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  radarCard: {
    marginHorizontal: 16,
    alignItems: 'center',
    position: 'relative',
    marginBottom: 24,
  },
  radarGlow: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    top: -50,
  },
  radarInner: {
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
  radarContainer: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: 'relative',
  },
  pulseRing: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    borderWidth: 2,
    position: 'absolute',
  },
  userDot: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userDotGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.3)',
    position: 'relative',
  },
  userDotImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4ade80',
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  distanceScale: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  scaleText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
  },
  nearbySection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: '#fff',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  userCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  userAvatar: {
    position: 'relative',
  },
  avatarGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarOnline: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4ade80',
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    color: '#fff',
    marginBottom: 2,
  },
  userDistance: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
});
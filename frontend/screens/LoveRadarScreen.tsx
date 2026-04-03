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
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  const insets = useSafeAreaInsets();
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

  useEffect(() => {
    handleRefreshLocation();
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
        setLoading(false);
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
      <ScreenScrollView contentContainerStyle={{ paddingBottom: 40, paddingTop: 0 }}>
        {/* PREMIUM HEADER */}
        <LinearGradient
          colors={['rgba(139,92,246,0.15)', 'rgba(139,92,246,0.05)', 'transparent']}
          style={[styles.headerGradient, { paddingTop: insets.top + 16 }]}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Feather name="arrow-left" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerTextContainer}>
              <ThemedText style={styles.pageTitle}>Love Radar</ThemedText>
              <View style={styles.subtitleRow}>
                <View style={styles.liveDot} />
                <ThemedText style={styles.pageSubtitle}>Live nearby</ThemedText>
              </View>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.headerIconButton, locationSharingEnabled && styles.headerIconButtonActive]}
                onPress={toggleLocationSharing}
              >
                <Feather
                  name={locationSharingEnabled ? "eye" : "eye-off"}
                  size={18}
                  color={locationSharingEnabled ? "#8b5cf6" : "rgba(255,255,255,0.5)"}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* STATS CARD */}
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>{nearbyUsers.length}</ThemedText>
              <ThemedText style={styles.statLabel}>Nearby</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ThemedText style={styles.statValue}>{filters.radius}km</ThemedText>
              <ThemedText style={styles.statLabel}>Radius</ThemedText>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={styles.locationStatusRow}>
                {locationLoading ? (
                  <ActivityIndicator size="small" color="#4ade80" />
                ) : (
                  <>
                    <View style={[styles.locationDot, { backgroundColor: locationPermission ? '#4ade80' : '#f87171' }]} />
                    <ThemedText style={styles.statValue}>
                      {locationPermission ? 'Active' : 'Off'}
                    </ThemedText>
                  </>
                )}
              </View>
              <ThemedText style={styles.statLabel}>Location</ThemedText>
            </View>
          </View>
        </LinearGradient>

        {/* FILTERS SECTION */}
        <View style={styles.filtersSection}>
          <TouchableOpacity
            style={styles.filterToggle}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Feather name="sliders" size={18} color="#8b5cf6" />
            <ThemedText style={styles.filterToggleText}>
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </ThemedText>
            <Feather
              name={showFilters ? "chevron-up" : "chevron-down"}
              size={18}
              color="rgba(255,255,255,0.5)"
            />
          </TouchableOpacity>

          {showFilters && (
            <Animated.View style={styles.filterContent}>
              <View style={styles.filterRow}>
                <View style={styles.filterLabel}>
                  <Feather name="compass" size={16} color="#8b5cf6" />
                  <ThemedText style={styles.filterLabelText}>Distance</ThemedText>
                </View>
                <ThemedText style={styles.filterValue}>{filters.radius}km</ThemedText>
              </View>
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

              <View style={[styles.filterRow, { marginTop: 16 }]}>
                <View style={styles.filterLabel}>
                  <Feather name="users" size={16} color="#8b5cf6" />
                  <ThemedText style={styles.filterLabelText}>Age Range</ThemedText>
                </View>
                <ThemedText style={styles.filterValue}>
                  {filters.ageMin} - {filters.ageMax}
                </ThemedText>
              </View>

              <View style={styles.ageSliders}>
                <View style={styles.ageSliderRow}>
                  <ThemedText style={styles.ageLabel}>Min: {filters.ageMin}</ThemedText>
                  <Slider
                    style={styles.ageSlider}
                    minimumValue={18}
                    maximumValue={80}
                    value={filters.ageMin}
                    onValueChange={(v) => setFilters({ ...filters, ageMin: Math.round(v) })}
                    minimumTrackTintColor="#8b5cf6"
                    maximumTrackTintColor="rgba(255,255,255,0.1)"
                    thumbTintColor="#8b5cf6"
                  />
                </View>
                <View style={styles.ageSliderRow}>
                  <ThemedText style={styles.ageLabel}>Max: {filters.ageMax}</ThemedText>
                  <Slider
                    style={styles.ageSlider}
                    minimumValue={18}
                    maximumValue={80}
                    value={filters.ageMax}
                    onValueChange={(v) => setFilters({ ...filters, ageMax: Math.round(v) })}
                    minimumTrackTintColor="#8b5cf6"
                    maximumTrackTintColor="rgba(255,255,255,0.1)"
                    thumbTintColor="#8b5cf6"
                  />
                </View>
              </View>

              <View style={[styles.filterRow, { marginTop: 16 }]}>
                <View style={styles.filterLabel}>
                  <Feather name="users" size={16} color="#8b5cf6" />
                  <ThemedText style={styles.filterLabelText}>Show Me</ThemedText>
                </View>
              </View>
              <View style={styles.genderPills}>
                {[
                  { value: 'any', label: 'Everyone', emoji: '🌈' },
                  { value: 'female', label: 'Women', emoji: '👩' },
                  { value: 'male', label: 'Men', emoji: '👨' },
                ].map((g) => (
                  <TouchableOpacity
                    key={g.value}
                    style={[
                      styles.genderPill,
                      filters.gender === g.value && styles.genderPillActive,
                    ]}
                    onPress={() => setFilters({ ...filters, gender: g.value as any })}
                  >
                    <ThemedText style={styles.genderPillEmoji}>{g.emoji}</ThemedText>
                    <ThemedText
                      style={[
                        styles.genderPillText,
                        { color: filters.gender === g.value ? '#8b5cf6' : 'rgba(255,255,255,0.6)' },
                      ]}
                    >
                      {g.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.applyFiltersButton}
                onPress={() => {
                  setShowFilters(false);
                  fetchNearbyUsers();
                }}
              >
                <LinearGradient
                  colors={['#8b5cf6', '#7c3aed']}
                  style={styles.applyFiltersGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Feather name="check" size={18} color="#fff" />
                  <ThemedText style={styles.applyFiltersText}>Apply Filters</ThemedText>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        {/* RADAR VISUALIZATION */}
        <View style={styles.radarSection}>
          <Animated.View style={[styles.radarGlow, glowStyle]}>
            <View style={styles.radarGlowInner} />
          </Animated.View>

          <View style={styles.radarCard}>
            <View style={styles.radarContainer}>
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
                    stroke="rgba(139,92,246,0.15)"
                    strokeDasharray="4,4"
                    fill="none"
                    strokeWidth={1.5}
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
                <Circle cx={CENTER} cy={CENTER} r="10" fill="#8b5cf6" opacity={0.8} />
                <Circle cx={CENTER} cy={CENTER} r="6" fill="#fff" />
              </Svg>

              {/* Pulse rings */}
              <Animated.View style={[styles.pulseRing, pulseStyle]}>
                <View style={styles.ring} />
              </Animated.View>

              {/* User dots */}
              {nearbyUsers.map((u) => {
                const pos = getUserDotPosition(u);
                const gradientColors = getGenderGradient(u.gender);
                return (
                  <Pressable
                    key={u.id}
                    style={[styles.userDot, { left: pos.x - 24, top: pos.y - 24 }]}
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
                      {u.online && <View style={styles.onlineIndicator} />}
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </View>

            {/* Distance markers */}
            <View style={styles.distanceMarkers}>
              <View style={styles.distanceMarker}>
                <ThemedText style={styles.distanceText}>0km</ThemedText>
              </View>
              <View style={styles.distanceMarker}>
                <ThemedText style={styles.distanceText}>{(filters.radius / 2).toFixed(0)}km</ThemedText>
              </View>
              <View style={styles.distanceMarker}>
                <ThemedText style={styles.distanceText}>{filters.radius}km</ThemedText>
              </View>
            </View>
          </View>

          {/* Quick Action */}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={handleRefreshLocation}
            disabled={locationLoading}
          >
            <LinearGradient
              colors={['rgba(139,92,246,0.2)', 'rgba(139,92,246,0.1)']}
              style={styles.refreshGradient}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color="#8b5cf6" />
              ) : (
                <Feather name="refresh-cw" size={18} color="#8b5cf6" />
              )}
              <ThemedText style={styles.refreshText}>
                {locationLoading ? 'Updating...' : 'Refresh Location'}
              </ThemedText>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* NEARBY USERS LIST */}
        <View style={styles.nearbySection}>
          <View style={styles.nearbySectionHeader}>
            <ThemedText style={styles.nearbySectionTitle}>People Nearby</ThemedText>
            {nearbyUsers.length > 0 && (
              <View style={styles.countBadge}>
                <ThemedText style={styles.countBadgeText}>{nearbyUsers.length}</ThemedText>
              </View>
            )}
          </View>

          {nearbyUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Feather name="users" size={48} color="rgba(139,92,246,0.3)" />
              </View>
              <ThemedText style={styles.emptyText}>No one nearby</ThemedText>
              <ThemedText style={styles.emptySubtext}>
                Try increasing your search radius or refreshing your location
              </ThemedText>
            </View>
          ) : (
            <View style={styles.usersList}>
              {nearbyUsers.map((u) => {
                const gradientColors = getGenderGradient(u.gender);
                return (
                  <Pressable
                    key={u.id}
                    style={styles.userCard}
                    onPress={() => handleUserPress(u.id)}
                  >
                    <View style={styles.userCardLeft}>
                      <LinearGradient
                        colors={gradientColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.userAvatar}
                      >
                        {u.profilePhoto ? (
                          <Image source={{ uri: u.profilePhoto }} style={styles.userAvatarImage} />
                        ) : (
                          <Feather name="user" size={24} color="#fff" />
                        )}
                        {u.online && <View style={styles.userOnlineBadge} />}
                      </LinearGradient>

                      <View style={styles.userInfo}>
                        <View style={styles.userNameRow}>
                          <ThemedText style={styles.userName} numberOfLines={1}>
                            {u.name}
                          </ThemedText>
                          <ThemedText style={styles.userAge}>{u.age}</ThemedText>
                        </View>
                        <View style={styles.userMetaRow}>
                          <Feather name="map-pin" size={12} color="rgba(255,255,255,0.5)" />
                          <ThemedText style={styles.userDistance}>
                            {u.distance < 1 
                              ? `${(u.distance * 1000).toFixed(0)}m away`
                              : `${u.distance.toFixed(1)}km away`
                            }
                          </ThemedText>
                        </View>
                      </View>
                    </View>

                    <View style={styles.userCardRight}>
                      <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
                    </View>
                  </Pressable>
                );
              })}
            </View>
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

  // HEADER
  headerGradient: {
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "center",
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: '#fff',
    letterSpacing: 0.5,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4ade80',
    marginRight: 6,
  },
  pageSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.3,
  },
  headerActions: {
    width: 44,
    alignItems: "flex-end",
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  headerIconButtonActive: {
    backgroundColor: "rgba(139,92,246,0.15)",
    borderColor: "rgba(139,92,246,0.3)",
  },

  // STATS CARD
  statsCard: {
    flexDirection: "row",
    marginHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginHorizontal: 12,
  },
  locationStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // FILTERS
  filtersSection: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(139,92,246,0.1)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
  },
  filterToggleText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8b5cf6",
  },
  filterContent: {
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  filterLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  filterLabelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
  },
  filterValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8b5cf6",
  },
  slider: {
    width: '100%',
    height: 40,
  },
  ageSliders: {
    marginTop: 8,
    gap: 12,
  },
  ageSliderRow: {
    gap: 8,
  },
  ageLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: "500",
  },
  ageSlider: {
    width: '100%',
    height: 40,
  },
  genderPills: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  genderPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  genderPillActive: {
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderColor: 'rgba(139,92,246,0.5)',
  },
  genderPillEmoji: {
    fontSize: 14,
  },
  genderPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  applyFiltersButton: {
    marginTop: 16,
    borderRadius: 14,
    overflow: "hidden",
  },
  applyFiltersGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  applyFiltersText: {
    fontSize: 15,
    fontWeight: "700",
    color: '#fff',
  },

  // RADAR
  radarSection: {
    marginTop: 24,
    alignItems: "center",
    position: "relative",
  },
  radarGlow: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    top: 0,
    zIndex: 0,
  },
  radarGlowInner: {
    width: RADAR_SIZE + 120,
    height: RADAR_SIZE + 120,
    borderRadius: (RADAR_SIZE + 120) / 2,
    backgroundColor: 'rgba(139,92,246,0.15)',
  },
  radarCard: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 32,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
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
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    borderRadius: RADAR_SIZE / 2,
    borderWidth: 2,
    borderColor: '#8b5cf6',
  },
  userDot: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userDotGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
  },
  userDotImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4ade80',
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  distanceMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 8,
  },
  distanceMarker: {
    alignItems: 'center',
  },
  distanceText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: "500",
  },
  refreshButton: {
    marginTop: 16,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  refreshGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
    borderRadius: 16,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8b5cf6",
  },

  // NEARBY USERS
  nearbySection: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  nearbySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  nearbySectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: '#fff',
  },
  countBadge: {
    backgroundColor: "rgba(139,92,246,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8b5cf6",
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(139,92,246,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  usersList: {
    gap: 12,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  userCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 14,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    position: "relative",
  },
  userAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userOnlineBadge: {
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
  userNameRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: "700",
    color: '#fff',
    flex: 1,
  },
  userAge: {
    fontSize: 15,
    fontWeight: "500",
    color: 'rgba(255,255,255,0.7)',
  },
  userMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  userDistance: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  userCardRight: {
    marginLeft: 8,
  },
});
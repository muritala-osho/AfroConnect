import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform,
  Linking,
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
  const { token, user, updateProfile } = useAuth();
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

  const requestLocationPermission = async () => {
    try {
      const { status: existingStatus } = await Location.getForegroundPermissionsAsync();
      
      if (existingStatus === "denied") {
        showAlert(
          t('locationRequired'),
          'Please enable location access in your device settings to use Love Radar.',
          [
            { text: t('cancel'), style: 'cancel' },
            { 
              text: 'Open Settings', 
              style: 'default',
              onPress: () => Linking.openSettings()
            }
          ],
          'settings'
        );
        return null;
      }
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === "granted");
      
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        };
        setUserLocation(coords);
        updateServerLocation(coords.lat, coords.lng);
        return coords;
      }
      return null;
    } catch (error) {
      console.error("Location permission error:", error);
      return null;
    }
  };

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

      const response = await fetch(
        `${getApiBaseUrl()}/api/radar/nearby-users?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

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
          [{ text: t('ok'), style: 'default' }],
          locationSharingEnabled ? 'eye-off' : 'eye'
        );
      }
    } catch (error) {
      showAlert(t('error'), "Failed to update location sharing settings", [{ text: t('ok'), style: 'default' }], 'alert-circle');
    }
  };

  const handleRefreshLocation = useCallback(async () => {
    try {
      setLocationLoading(true);
      if (Platform.OS !== 'web') {
        try {
          const Haptics = require('expo-haptics');
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (e) {}
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
      
      setUserLocation(coords);
      setLocationPermission(true);
      await updateServerLocation(coords.lat, coords.lng);
      await updateProfile({ location: coords });
      await fetchNearbyUsers(coords);
      
      if (Platform.OS !== 'web') {
        try {
          const Haptics = require('expo-haptics');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (e) {}
      }
      showAlert(t('success'), t('locationUpdated'), [{ text: t('ok'), style: 'default' }], 'check-circle');
    } catch (error) {
      console.error('Location refresh error:', error);
      showAlert(t('error'), t('locationError'), [{ text: t('ok'), style: 'default' }], 'alert-circle');
    } finally {
      setLocationLoading(false);
    }
  }, [token, updateProfile, fetchNearbyUsers, t, showAlert]);

  useEffect(() => {
    const init = async () => {
      const coords = await requestLocationPermission();
      if (coords) {
        await fetchNearbyUsers(coords);
      }
      setLoading(false);
    };
    init();

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchNearbyUsers();
    }
  }, [filters]);

  useEffect(() => {
    if (userLocation && locationSharingEnabled) {
      refreshInterval.current = setInterval(() => {
        fetchNearbyUsers();
      }, 30000);
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [userLocation, locationSharingEnabled, fetchNearbyUsers]);

  const getUserDotPosition = (user: NearbyUser) => {
    const maxRadius = (RADAR_SIZE / 2 - 50);
    const distanceRatio = Math.min(user.distance / filters.radius, 1);
    const radius = distanceRatio * maxRadius;
    
    const angleRad = (user.angle * Math.PI) / 180;
    const x = CENTER + radius * Math.cos(angleRad);
    const y = CENTER + radius * Math.sin(angleRad);
    
    return { x, y };
  };

  const getGenderColor = (gender: string) => {
    return gender === "female" ? "#FF6B9D" : "#4A90E2";
  };

  const handleUserPress = (userId: string) => {
    navigation.navigate("ProfileDetail", { userId });
  };

  if (locationPermission === false) {
    return (
      <ScreenScrollView>
        <View style={styles.permissionContainer}>
          <View style={[styles.iconCircle, { backgroundColor: `${theme.primary}15` }]}>
            <Feather name="map-pin" size={48} color={theme.primary} />
          </View>
          <ThemedText style={[styles.permissionTitle, { color: theme.text }]}>
            {t('enableLocation')}
          </ThemedText>
          <ThemedText style={[styles.permissionText, { color: theme.textSecondary }]}>
            {t('locationNeeded')}
          </ThemedText>
          <Pressable
            style={[styles.permissionButton, { backgroundColor: theme.primary }]}
            onPress={requestLocationPermission}
          >
            <ThemedText style={[styles.buttonText, { color: '#FFF' }]}>
              {t('enableLocationAccess')}
            </ThemedText>
          </Pressable>
          <AlertComponent />
        </View>
      </ScreenScrollView>
    );
  }

  return (
    <ScreenScrollView contentContainerStyle={{ paddingTop: Spacing.md }}>
      <View style={styles.container}>
        <View style={styles.topHeader}>
          <Pressable
            style={[styles.backButton, { backgroundColor: theme.surface }]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={20} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.pageTitle, { color: theme.text }]}>Love Radar</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              {nearbyUsers.length > 0
                ? `${nearbyUsers.length} ${t('peopleWithinKm')} ${filters.radius}km`
                : t('scanningNearby')}
            </ThemedText>
          </View>
          <View style={styles.headerButtons}>
            <Pressable
              style={[styles.headerButton, { backgroundColor: userLocation ? theme.surface : theme.primary }]}
              onPress={handleRefreshLocation}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color={userLocation ? theme.primary : '#FFF'} />
              ) : (
                <Feather name="map-pin" size={20} color={userLocation ? theme.primary : '#FFF'} />
              )}
            </Pressable>
            <Pressable
              style={[styles.headerButton, { backgroundColor: theme.surface }]}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Feather name="sliders" size={20} color={theme.primary} />
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
                size={20}
                color={locationSharingEnabled ? "#fff" : theme.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {showFilters && (
          <View style={[styles.filtersCard, { backgroundColor: theme.surface }]}>
            <View style={styles.filterRow}>
              <ThemedText style={[styles.filterLabel, { color: theme.text }]}>
                {t('distance')}: {filters.radius}km
              </ThemedText>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={100}
                step={1}
                value={filters.radius}
                onValueChange={(value) => setFilters({ ...filters, radius: value })}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.primary}
              />
            </View>

            <View style={styles.filterRow}>
              <ThemedText style={[styles.filterLabel, { color: theme.text }]}>
                {t('age')}: {filters.ageMin} - {filters.ageMax}
              </ThemedText>
              <View style={styles.ageSliders}>
                <Slider
                  style={styles.ageSlider}
                  minimumValue={18}
                  maximumValue={filters.ageMax}
                  step={1}
                  value={filters.ageMin}
                  onValueChange={(value) => setFilters({ ...filters, ageMin: value })}
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={theme.primary}
                />
                <Slider
                  style={styles.ageSlider}
                  minimumValue={filters.ageMin}
                  maximumValue={80}
                  step={1}
                  value={filters.ageMax}
                  onValueChange={(value) => setFilters({ ...filters, ageMax: value })}
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={theme.primary}
                />
              </View>
            </View>

            <View style={styles.filterRow}>
              <ThemedText style={[styles.filterLabel, { color: theme.text }]}>
                {t('show')}
              </ThemedText>
              <View style={styles.genderButtons}>
                {(["any", "male", "female"] as const).map((g) => (
                  <Pressable
                    key={g}
                    style={[
                      styles.genderButton,
                      {
                        backgroundColor: filters.gender === g ? theme.primary : theme.background,
                        borderColor: theme.border,
                      },
                    ]}
                    onPress={() => setFilters({ ...filters, gender: g })}
                  >
                    <ThemedText
                      style={[
                        styles.genderButtonText,
                        { color: filters.gender === g ? theme.buttonText : theme.text },
                      ]}
                      numberOfLines={1}
                    >
                      {g === "any" ? t('everyone') : g === "male" ? t('male') : t('female')}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            <Pressable
              style={[styles.applyButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                setShowFilters(false);
                fetchNearbyUsers();
              }}
            >
              <ThemedText style={[styles.buttonText, { color: theme.buttonText }]}>
                {t('applyFilters')}
              </ThemedText>
            </Pressable>
          </View>
        )}

        <View style={[styles.radarCard, { backgroundColor: theme.surface }]}>
          <View style={styles.radarContainer}>
            <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
              <Defs>
                <RadialGradient id="radarGrad" cx="50%" cy="50%">
                  <Stop offset="0%" stopColor={theme.primary} stopOpacity="0.4" />
                  <Stop offset="100%" stopColor={theme.primary} stopOpacity="0" />
                </RadialGradient>
              </Defs>

              {[0.25, 0.5, 0.75, 1].map((fraction, index) => (
                <Circle
                  key={index}
                  cx={CENTER}
                  cy={CENTER}
                  r={(RADAR_SIZE / 2 - 30) * fraction}
                  stroke={theme.border}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                  fill="none"
                  opacity={0.4}
                />
              ))}

              <Circle cx={CENTER} cy={CENTER} r="10" fill={theme.primary} />
            </Svg>

            <Animated.View style={[styles.pulseRing, pulseStyle]}>
              <View style={[styles.ring, { borderColor: theme.primary }]} />
            </Animated.View>

            <Animated.View style={[styles.scannerBeam, scannerStyle]}>
              <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
                <Defs>
                  <RadialGradient id="beamGrad" cx="50%" cy="50%">
                    <Stop offset="0%" stopColor={theme.primary} stopOpacity="0.3" />
                    <Stop offset="100%" stopColor={theme.primary} stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                <Path
                  d={`M ${CENTER} ${CENTER} L ${CENTER} 30 A ${CENTER - 30} ${CENTER - 30} 0 0 1 ${RADAR_SIZE - 30} ${CENTER} Z`}
                  fill="url(#beamGrad)"
                />
              </Svg>
            </Animated.View>

            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            )}

            {nearbyUsers.map((user) => {
              const pos = getUserDotPosition(user);
              return (
                <Pressable
                  key={user.id}
                  style={[
                    styles.userDot,
                    {
                      left: pos.x - 20,
                      top: pos.y - 20,
                      backgroundColor: getGenderColor(user.gender),
                    },
                  ]}
                  onPress={() => handleUserPress(user.id)}
                >
                  {user.profilePhoto ? (
                    <Image
                      source={{ uri: user.profilePhoto }}
                      style={styles.userDotImage}
                      contentFit="cover"
                    />
                  ) : (
                    <Feather name="user" size={16} color="#fff" />
                  )}
                  {user.online && <View style={styles.onlineIndicator} />}
                </Pressable>
              );
            })}

            <View style={[styles.scanningBadge, { backgroundColor: theme.online }]}>
              <View style={styles.scanningDot} />
              <ThemedText style={styles.scanningText}>
                {locationSharingEnabled ? t('live') : t('hidden')}
              </ThemedText>
            </View>
          </View>

          <View style={styles.distanceLabels}>
            {[
              { label: "0", position: 0 },
              { label: `${Math.round(filters.radius / 2)}km`, position: 0.5 },
              { label: `${filters.radius}km`, position: 1 },
            ].map((item, i) => (
              <ThemedText
                key={i}
                style={[styles.distanceLabel, { color: theme.textSecondary }]}
              >
                {item.label}
              </ThemedText>
            ))}
          </View>
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
            <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>
              {t('you')}
            </ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#FF6B9D" }]} />
            <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>
              {t('women')}
            </ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: "#4A90E2" }]} />
            <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>
              {t('men')}
            </ThemedText>
          </View>
        </View>

        {nearbyUsers.length > 0 && (
          <View style={styles.nearbyListSection}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              {t('peopleNearby')}
            </ThemedText>
            {nearbyUsers.slice(0, 5).map((user) => (
              <Pressable
                key={user.id}
                style={[styles.userCard, { backgroundColor: theme.surface }]}
                onPress={() => handleUserPress(user.id)}
              >
                <View style={styles.userCardLeft}>
                  {user.profilePhoto ? (
                    <Image
                      source={{ uri: user.profilePhoto }}
                      style={styles.userCardPhoto}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.userCardPhoto, { backgroundColor: theme.backgroundSecondary }]}>
                      <Feather name="user" size={24} color={theme.textSecondary} />
                    </View>
                  )}
                  <View style={styles.userCardInfo}>
                    <View style={styles.userCardNameRow}>
                      <ThemedText style={[styles.userCardName, { color: theme.text }]}>
                        {user.name}, {user.age}
                      </ThemedText>
                      {user.verified && (
                        <Image 
                          source={require("@/assets/icons/verified-tick.png")} 
                          style={{ width: 22, height: 22, marginLeft: 4 }} 
                          contentFit="contain"
                        />
                      )}
                      {user.online && (
                        <View style={[styles.onlineBadge, { backgroundColor: theme.online }]} />
                      )}
                    </View>
                    <ThemedText style={[styles.userCardDistance, { color: theme.textSecondary }]}>
                      {user.distance < 1 ? "< 1 km away" : `${user.distance.toFixed(1)} km away`}
                    </ThemedText>
                  </View>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}

        {!loading && nearbyUsers.length === 0 && userLocation && (
          <View style={[styles.emptyState, { backgroundColor: theme.surface }]}>
            <Feather name="users" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              {t('noOneNearbyRadar')}
            </ThemedText>
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              {t('tryIncreasingRadius')}
            </ThemedText>
          </View>
        )}
        <AlertComponent />
      </View>
    </ScreenScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  subtitle: {
    ...Typography.body,
  },
  headerButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  filtersCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  filterRow: {
    marginBottom: Spacing.md,
  },
  filterLabel: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    flexShrink: 1,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  ageSliders: {
    gap: Spacing.xs,
  },
  ageSlider: {
    width: "100%",
    height: 36,
  },
  genderButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  genderButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    borderWidth: 1,
  },
  genderButtonText: {
    ...Typography.small,
    fontWeight: "600",
    flexShrink: 1,
  },
  applyButton: {
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  buttonText: {
    ...Typography.body,
    fontWeight: "600",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  radarCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  radarContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignSelf: "center",
  },
  scannerBeam: {
    position: "absolute",
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    left: 0,
    top: 0,
  },
  pulseRing: {
    position: "absolute",
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    width: RADAR_SIZE - 60,
    height: RADAR_SIZE - 60,
    borderRadius: (RADAR_SIZE - 60) / 2,
    borderWidth: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: RADAR_SIZE / 2,
  },
  userDot: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  userDotImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#fff",
  },
  scanningBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  scanningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  scanningText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  distanceLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  distanceLabel: {
    ...Typography.small,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    ...Typography.small,
    fontWeight: "500",
  },
  nearbyListSection: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  userCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  userCardPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  userCardInfo: {
    gap: 2,
  },
  userCardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  userCardName: {
    ...Typography.body,
    fontWeight: "600",
  },
  userCardDistance: {
    ...Typography.small,
  },
  onlineBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  emptyTitle: {
    ...Typography.h3,
    marginTop: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
    marginTop: Spacing.sm,
    maxWidth: 250,
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  permissionTitle: {
    ...Typography.h2,
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  permissionText: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
    maxWidth: 300,
    lineHeight: 24,
  },
  permissionButton: {
    height: 50,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});

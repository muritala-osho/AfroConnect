import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Modal,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useThemedAlert } from "@/components/ThemedAlert";
import { Image } from "expo-image";
import * as Location from "expo-location";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  interpolate,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import Svg, { Circle, Defs, RadialGradient, Stop, Path, Line } from "react-native-svg";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useLanguage";
import { Feather } from "@expo/vector-icons";
import { getApiBaseUrl } from "@/constants/config";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";

const { width, height } = Dimensions.get("window");
const RADAR_SIZE = Math.min(width - 48, 320);
const CENTER = RADAR_SIZE / 2;
const AVATAR_SIZE = 52;

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

// ── Pulse ring rendered per avatar ──────────────────────────────────────────
function AvatarPulse({ active, color }: { active: boolean; color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withTiming(1.8, { duration: 1600, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      opacity.value = withRepeat(withTiming(0, { duration: 1600 }), -1, false);
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!active) return null;
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: AVATAR_SIZE / 2, borderWidth: 2, borderColor: color },
        style,
      ]}
    />
  );
}

// ── Preview popup card ───────────────────────────────────────────────────────
function PreviewCard({
  user,
  onClose,
  onViewProfile,
}: {
  user: NearbyUser;
  onClose: () => void;
  onViewProfile: () => void;
}) {
  const genderColor = user.gender === "female" ? "#FF6B9D" : "#4A90E2";
  return (
    <Animated.View
      entering={SlideInDown.springify().damping(20)}
      exiting={SlideOutDown.duration(200)}
      style={styles.previewCard}
    >
      {/* Photo */}
      <View style={styles.previewPhotoWrap}>
        {user.profilePhoto ? (
          <Image source={{ uri: user.profilePhoto }} style={styles.previewPhoto} contentFit="cover" />
        ) : (
          <LinearGradient
            colors={user.gender === "female" ? ["#FF6B9D", "#FF4081"] : ["#4A90E2", "#2563EB"]}
            style={styles.previewPhotoPlaceholder}
          >
            <Feather name="user" size={40} color="#fff" />
          </LinearGradient>
        )}

        {/* Gradient overlay */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.75)"]}
          style={styles.previewPhotoGradient}
        />

        {/* Close */}
        <Pressable style={styles.previewClose} onPress={onClose} hitSlop={8}>
          <Feather name="x" size={18} color="#fff" />
        </Pressable>

        {/* Online badge */}
        {user.online && (
          <View style={styles.previewOnlineBadge}>
            <View style={styles.previewOnlineDot} />
            <ThemedText style={styles.previewOnlineText}>Online</ThemedText>
          </View>
        )}

        {/* Name / age overlay */}
        <View style={styles.previewPhotoInfo}>
          <View style={styles.previewNameRow}>
            <ThemedText style={styles.previewName}>{user.name}</ThemedText>
            {user.verified && (
              <View style={styles.previewVerifyBadge}>
                <Feather name="check" size={11} color="#fff" />
              </View>
            )}
            <ThemedText style={styles.previewAge}>{user.age}</ThemedText>
          </View>
          <View style={styles.previewDistRow}>
            <Feather name="map-pin" size={12} color="rgba(255,255,255,0.7)" />
            <ThemedText style={styles.previewDist}>
              {user.distance < 1
                ? `${(user.distance * 1000).toFixed(0)}m away`
                : `${user.distance.toFixed(1)}km away`}
            </ThemedText>
          </View>
        </View>
      </View>

      {/* Bio snippet */}
      {user.bio ? (
        <View style={styles.previewBioWrap}>
          <ThemedText style={styles.previewBio} numberOfLines={2}>{user.bio}</ThemedText>
        </View>
      ) : null}

      {/* Interests */}
      {user.interests?.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.previewInterests}
        >
          {user.interests.slice(0, 5).map((tag) => (
            <View key={tag} style={[styles.previewTag, { borderColor: `${genderColor}40`, backgroundColor: `${genderColor}12` }]}>
              <ThemedText style={[styles.previewTagText, { color: genderColor }]}>{tag}</ThemedText>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Action buttons */}
      <View style={styles.previewActions}>
        <Pressable style={styles.previewPassBtn} onPress={onClose}>
          <Feather name="x" size={22} color="#F87171" />
        </Pressable>

        <Pressable style={styles.previewProfileBtn} onPress={onViewProfile}>
          <LinearGradient
            colors={["#10B981", "#059669"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.previewProfileBtnGrad}
          >
            <Feather name="user" size={16} color="#fff" />
            <ThemedText style={styles.previewProfileBtnText}>View Profile</ThemedText>
          </LinearGradient>
        </Pressable>

        <Pressable style={styles.previewLikeBtn}>
          <Feather name="heart" size={22} color="#10B981" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
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
  const [selectedUser, setSelectedUser] = useState<NearbyUser | null>(null);

  const [filters, setFilters] = useState({
    radius: 50,
    ageMin: 18,
    ageMax: 60,
    gender: "any" as "any" | "male" | "female",
  });

  const rotation = useSharedValue(0);
  const pulse1 = useSharedValue(1);
  const pulse2 = useSharedValue(1);
  const scanOpacity = useSharedValue(0.7);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 4500, easing: Easing.linear }),
      -1,
      false
    );
    pulse1.value = withRepeat(
      withTiming(1.4, { duration: 2200, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    pulse2.value = withDelay(
      1100,
      withRepeat(
        withTiming(1.4, { duration: 2200, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
    scanOpacity.value = withRepeat(
      withTiming(0.35, { duration: 2250, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    handleRefreshLocation(true);
  }, []);

  const scannerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pulse1Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse1.value }],
    opacity: interpolate(pulse1.value, [1, 1.4], [0.25, 0]),
  }));

  const pulse2Style = useAnimatedStyle(() => ({
    transform: [{ scale: pulse2.value }],
    opacity: interpolate(pulse2.value, [1, 1.4], [0.15, 0]),
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

  const fetchNearbyUsers = useCallback(
    async (coords?: { lat: number; lng: number }) => {
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
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await response.json();
        if (data.success) setNearbyUsers(data.users || []);
      } catch (error) {
        console.error("Failed to fetch nearby users:", error);
      } finally {
        setLoading(false);
      }
    },
    [userLocation, token, filters]
  );

  const handleRefreshLocation = useCallback(async (silent = false) => {
    try {
      setLocationLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocationPermission(false);
        setLoading(false);
        if (!silent) {
          showAlert(t("locationRequired"), t("enableLocationAccess"), [{ text: t("ok") }], "map-pin");
        }
        setLocationLoading(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: location.coords.latitude, lng: location.coords.longitude };
      setUserLocation(coords);
      setLocationPermission(true);
      try { await updateServerLocation(coords.lat, coords.lng); } catch {}
      try { await updateProfile({ location: coords }); } catch {}
      await fetchNearbyUsers(coords);
      if (!silent) {
        showAlert(t("success"), t("locationUpdated"), [{ text: t("ok") }], "check-circle");
      }
    } catch (error) {
      if (!silent) {
        showAlert(t("error"), t("locationError"), [{ text: t("ok") }], "alert-circle");
      }
    } finally {
      setLocationLoading(false);
    }
  }, [token, updateProfile, fetchNearbyUsers, t, showAlert]);

  const toggleLocationSharing = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/radar/location-sharing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ enabled: !locationSharingEnabled }),
      });
      const data = await response.json();
      if (data.success) {
        setLocationSharingEnabled(!locationSharingEnabled);
        showAlert(
          t("locationSharing"),
          locationSharingEnabled ? t("youAreHidden") : t("youAreVisible"),
          [{ text: t("ok") }],
          locationSharingEnabled ? "eye-off" : "eye"
        );
      }
    } catch {
      showAlert(t("error"), "Failed to update settings", [{ text: t("ok") }], "alert-circle");
    }
  };

  const getUserDotPosition = (user: NearbyUser) => {
    const maxRadius = RADAR_SIZE / 2 - AVATAR_SIZE / 2 - 8;
    const distanceRatio = Math.min(user.distance / filters.radius, 0.92);
    const radius = Math.max(distanceRatio * maxRadius, 28);
    const angleRad = (user.angle * Math.PI) / 180;
    return {
      x: CENTER + radius * Math.cos(angleRad),
      y: CENTER + radius * Math.sin(angleRad),
    };
  };

  const getGenderColors = (gender: string): [string, string] =>
    gender === "female" ? ["#FF6B9D", "#FF4081"] : ["#4A90E2", "#2563EB"];

  const handleAvatarPress = (user: NearbyUser) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedUser(user);
  };

  return (
    <View style={styles.container}>
      <ScreenScrollView contentContainerStyle={styles.scrollContent}>

        {/* ── Header ── */}
        <LinearGradient
          colors={["#10B981", "#059669"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <ThemedText style={styles.headerTitle}>Love Radar</ThemedText>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <ThemedText style={styles.liveText}>LIVE</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.headerSub}>Discover people around you</ThemedText>
          </View>

          <TouchableOpacity
            style={[styles.headerIconBtn, locationSharingEnabled && styles.headerIconBtnActive]}
            onPress={toggleLocationSharing}
          >
            <Feather
              name={locationSharingEnabled ? "eye" : "eye-off"}
              size={18}
              color={locationSharingEnabled ? "#10B981" : "rgba(255,255,255,0.5)"}
            />
          </TouchableOpacity>
        </LinearGradient>

        {/* ── Stats row ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <ThemedText style={styles.statNum}>{nearbyUsers.length}</ThemedText>
            <ThemedText style={styles.statLbl}>Nearby</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.08)" }]} />
          <View style={styles.statCard}>
            <ThemedText style={styles.statNum}>{filters.radius}km</ThemedText>
            <ThemedText style={styles.statLbl}>Radius</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.08)" }]} />
          <View style={styles.statCard}>
            {locationLoading ? (
              <ActivityIndicator size="small" color="#4ADE80" />
            ) : (
              <View style={styles.locationStatusRow}>
                <View style={[styles.locationDot, { backgroundColor: locationPermission ? "#4ADE80" : "#F87171" }]} />
                <ThemedText style={styles.statNum}>{locationPermission ? "Active" : "Off"}</ThemedText>
              </View>
            )}
            <ThemedText style={styles.statLbl}>GPS</ThemedText>
          </View>
        </View>

        {/* ── Filter toggle ── */}
        <Pressable
          style={styles.filterToggle}
          onPress={() => { setShowFilters(!showFilters); Haptics.selectionAsync(); }}
        >
          <Feather name="sliders" size={16} color="#10B981" />
          <ThemedText style={styles.filterToggleText}>
            {showFilters ? "Hide Filters" : "Adjust Radar Filters"}
          </ThemedText>
          <Feather name={showFilters ? "chevron-up" : "chevron-down"} size={16} color="rgba(255,255,255,0.4)" />
        </Pressable>

        {showFilters && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.filterPanel}>
            {/* Distance */}
            <View style={styles.filterRow}>
              <View style={styles.filterRowLeft}>
                <Feather name="compass" size={15} color="#10B981" />
                <ThemedText style={styles.filterLabel}>Distance</ThemedText>
              </View>
              <ThemedText style={styles.filterVal}>{filters.radius}km</ThemedText>
            </View>
            <Slider
              style={styles.fSlider}
              minimumValue={1}
              maximumValue={100}
              value={filters.radius}
              onValueChange={(v) => setFilters({ ...filters, radius: Math.round(v) })}
              minimumTrackTintColor="#10B981"
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor="#10B981"
            />

            {/* Age */}
            <View style={[styles.filterRow, { marginTop: 12 }]}>
              <View style={styles.filterRowLeft}>
                <Feather name="users" size={15} color="#10B981" />
                <ThemedText style={styles.filterLabel}>Age</ThemedText>
              </View>
              <ThemedText style={styles.filterVal}>{filters.ageMin}–{filters.ageMax}</ThemedText>
            </View>
            <View style={styles.ageSliderGroup}>
              <View style={styles.ageSliderRow}>
                <ThemedText style={styles.ageSliderLbl}>Min {filters.ageMin}</ThemedText>
                <Slider
                  style={styles.ageSlider}
                  minimumValue={18}
                  maximumValue={filters.ageMax - 1}
                  value={filters.ageMin}
                  onValueChange={(v) => setFilters({ ...filters, ageMin: Math.round(v) })}
                  minimumTrackTintColor="#10B981"
                  maximumTrackTintColor="rgba(255,255,255,0.1)"
                  thumbTintColor="#10B981"
                />
              </View>
              <View style={styles.ageSliderRow}>
                <ThemedText style={styles.ageSliderLbl}>Max {filters.ageMax}</ThemedText>
                <Slider
                  style={styles.ageSlider}
                  minimumValue={filters.ageMin + 1}
                  maximumValue={80}
                  value={filters.ageMax}
                  onValueChange={(v) => setFilters({ ...filters, ageMax: Math.round(v) })}
                  minimumTrackTintColor="#10B981"
                  maximumTrackTintColor="rgba(255,255,255,0.1)"
                  thumbTintColor="#10B981"
                />
              </View>
            </View>

            {/* Gender */}
            <View style={[styles.filterRow, { marginTop: 12 }]}>
              <View style={styles.filterRowLeft}>
                <Feather name="users" size={15} color="#10B981" />
                <ThemedText style={styles.filterLabel}>Show Me</ThemedText>
              </View>
            </View>
            <View style={styles.genderPills}>
              {[
                { value: "any", label: "Everyone", emoji: "🌈" },
                { value: "female", label: "Women", emoji: "👩" },
                { value: "male", label: "Men", emoji: "👨" },
              ].map((g) => (
                <Pressable
                  key={g.value}
                  style={[
                    styles.genderPill,
                    filters.gender === g.value && styles.genderPillActive,
                  ]}
                  onPress={() => { setFilters({ ...filters, gender: g.value as any }); Haptics.selectionAsync(); }}
                >
                  <ThemedText style={styles.genderPillEmoji}>{g.emoji}</ThemedText>
                  <ThemedText
                    style={[styles.genderPillText, { color: filters.gender === g.value ? "#10B981" : "rgba(255,255,255,0.6)" }]}
                  >
                    {g.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={styles.applyFilterBtn}
              onPress={() => { setShowFilters(false); fetchNearbyUsers(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
            >
              <LinearGradient
                colors={["#10B981", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.applyFilterBtnGrad}
              >
                <Feather name="check" size={16} color="#fff" />
                <ThemedText style={styles.applyFilterBtnText}>Apply & Scan</ThemedText>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {/* ── Radar ── */}
        <View style={styles.radarSection}>
          {/* Atmospheric glow */}
          <View style={styles.radarGlowOuter} />

          <View style={styles.radarCard}>
            <View style={styles.radarContainer}>

              {/* SVG base: rings + cross-hairs + scan beam */}
              <Svg width={RADAR_SIZE} height={RADAR_SIZE} style={StyleSheet.absoluteFill}>
                <Defs>
                  <RadialGradient id="scanGrad" cx="50%" cy="50%">
                    <Stop offset="0%" stopColor="#10B981" stopOpacity="0.35" />
                    <Stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </RadialGradient>
                  <RadialGradient id="bgGrad" cx="50%" cy="50%">
                    <Stop offset="0%" stopColor="#10B981" stopOpacity="0.04" />
                    <Stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                  </RadialGradient>
                </Defs>

                {/* Background fill */}
                <Circle cx={CENTER} cy={CENTER} r={CENTER - 4} fill="url(#bgGrad)" />

                {/* Rings */}
                {[0.28, 0.52, 0.76, 1].map((f, i) => (
                  <Circle
                    key={i}
                    cx={CENTER}
                    cy={CENTER}
                    r={(CENTER - 6) * f}
                    stroke="rgba(16,185,129,0.18)"
                    strokeDasharray="5,5"
                    fill="none"
                    strokeWidth={1}
                  />
                ))}

                {/* Cross-hair lines */}
                <Line x1={CENTER} y1={6} x2={CENTER} y2={RADAR_SIZE - 6} stroke="rgba(16,185,129,0.08)" strokeWidth={1} />
                <Line x1={6} y1={CENTER} x2={RADAR_SIZE - 6} y2={CENTER} stroke="rgba(16,185,129,0.08)" strokeWidth={1} />
              </Svg>

              {/* Rotating scan beam */}
              <Animated.View style={[StyleSheet.absoluteFill, scannerStyle]}>
                <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
                  <Defs>
                    <RadialGradient id="beam2" cx="50%" cy="50%">
                      <Stop offset="0%" stopColor="#10B981" stopOpacity="0.5" />
                      <Stop offset="100%" stopColor="#10B981" stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  <Path
                    d={`M ${CENTER} ${CENTER} L ${CENTER} 8 A ${CENTER - 8} ${CENTER - 8} 0 0 1 ${RADAR_SIZE - 8} ${CENTER} Z`}
                    fill="url(#beam2)"
                  />
                  {/* Bright leading edge */}
                  <Line
                    x1={CENTER}
                    y1={CENTER}
                    x2={RADAR_SIZE - 8}
                    y2={CENTER}
                    stroke="#10B981"
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                  />
                </Svg>
              </Animated.View>

              {/* Pulse rings from center */}
              <Animated.View
                style={[
                  styles.pulseRing,
                  { width: RADAR_SIZE * 0.55, height: RADAR_SIZE * 0.55, borderRadius: (RADAR_SIZE * 0.55) / 2, borderColor: "#10B981" },
                  pulse1Style,
                ]}
              />
              <Animated.View
                style={[
                  styles.pulseRing,
                  { width: RADAR_SIZE * 0.55, height: RADAR_SIZE * 0.55, borderRadius: (RADAR_SIZE * 0.55) / 2, borderColor: "#10B981" },
                  pulse2Style,
                ]}
              />

              {/* User avatar pins */}
              {nearbyUsers.map((u, idx) => {
                const pos = getUserDotPosition(u);
                const colors = getGenderColors(u.gender);
                return (
                  <Pressable
                    key={u.id}
                    style={[
                      styles.avatarPin,
                      {
                        left: pos.x - AVATAR_SIZE / 2,
                        top: pos.y - AVATAR_SIZE / 2,
                      },
                    ]}
                    onPress={() => handleAvatarPress(u)}
                  >
                    <AvatarPulse active={u.online} color={colors[0]} />
                    <LinearGradient
                      colors={colors}
                      style={styles.avatarPinGrad}
                    >
                      {u.profilePhoto ? (
                        <Image source={{ uri: u.profilePhoto }} style={styles.avatarPinImg} contentFit="cover" />
                      ) : (
                        <Feather name="user" size={20} color="#fff" />
                      )}
                    </LinearGradient>
                    {u.online && <View style={styles.avatarOnlineDot} />}
                    {u.verified && (
                      <View style={styles.avatarVerifyBadge}>
                        <Feather name="check" size={7} color="#fff" />
                      </View>
                    )}
                  </Pressable>
                );
              })}

              {/* Center: user dot */}
              <View style={styles.centerDot}>
                <LinearGradient colors={["#10B981", "#059669"]} style={styles.centerDotGrad}>
                  <View style={styles.centerDotCore} />
                </LinearGradient>
              </View>
            </View>

            {/* Distance ring labels */}
            <View style={styles.ringLabels}>
              {[
                { label: "0km", left: "50%", top: "50%" },
              ]}
              <View style={styles.distMarkersRow}>
                <ThemedText style={styles.distMark}>0</ThemedText>
                <ThemedText style={styles.distMark}>{Math.round(filters.radius / 2)}km</ThemedText>
                <ThemedText style={styles.distMark}>{filters.radius}km</ThemedText>
              </View>
            </View>
          </View>

          {/* Refresh */}
          <Pressable
            style={styles.refreshBtn}
            onPress={handleRefreshLocation}
            disabled={locationLoading}
          >
            <LinearGradient
              colors={["rgba(16,185,129,0.15)", "rgba(16,185,129,0.08)"]}
              style={styles.refreshBtnGrad}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Feather name="refresh-cw" size={16} color="#10B981" />
              )}
              <ThemedText style={styles.refreshBtnText}>
                {locationLoading ? "Locating..." : "Refresh Location"}
              </ThemedText>
            </LinearGradient>
          </Pressable>
        </View>

        {/* ── Nearby People list ── */}
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <ThemedText style={styles.listTitle}>People Nearby</ThemedText>
            {nearbyUsers.length > 0 && (
              <View style={styles.listCountBadge}>
                <ThemedText style={styles.listCountText}>{nearbyUsers.length}</ThemedText>
              </View>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#10B981" />
              <ThemedText style={styles.loadingText}>Scanning nearby...</ThemedText>
            </View>
          ) : nearbyUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Feather name="radio" size={40} color="rgba(16,185,129,0.4)" />
              </View>
              <ThemedText style={styles.emptyTitle}>No one detected</ThemedText>
              <ThemedText style={styles.emptySub}>
                Try expanding your radius or refreshing your location
              </ThemedText>
              <Pressable style={styles.emptyAction} onPress={handleRefreshLocation}>
                <Feather name="refresh-cw" size={14} color="#10B981" />
                <ThemedText style={styles.emptyActionText}>Refresh</ThemedText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.usersList}>
              {nearbyUsers.map((u) => {
                const colors = getGenderColors(u.gender);
                return (
                  <Pressable
                    key={u.id}
                    style={styles.userCard}
                    onPress={() => navigation.navigate("ProfileDetail", { userId: u.id })}
                  >
                    <View style={styles.userCardLeft}>
                      <LinearGradient colors={colors} style={styles.userAvatar}>
                        {u.profilePhoto ? (
                          <Image source={{ uri: u.profilePhoto }} style={styles.userAvatarImg} contentFit="cover" />
                        ) : (
                          <Feather name="user" size={22} color="#fff" />
                        )}
                        {u.online && <View style={styles.cardOnlineBadge} />}
                      </LinearGradient>

                      <View style={styles.userInfo}>
                        <View style={styles.userNameRow}>
                          <ThemedText style={styles.userName} numberOfLines={1}>{u.name}</ThemedText>
                          {u.verified && (
                            <View style={styles.cardVerifyBadge}>
                              <Feather name="check" size={9} color="#fff" />
                            </View>
                          )}
                          <ThemedText style={styles.userAge}>{u.age}</ThemedText>
                        </View>
                        <View style={styles.userMetaRow}>
                          <Feather name="map-pin" size={11} color="rgba(255,255,255,0.4)" />
                          <ThemedText style={styles.userDist}>
                            {u.distance < 1
                              ? `${(u.distance * 1000).toFixed(0)}m away`
                              : `${u.distance.toFixed(1)}km away`}
                          </ThemedText>
                        </View>
                        {u.interests?.length > 0 && (
                          <View style={styles.cardInterests}>
                            {u.interests.slice(0, 2).map((tag) => (
                              <View key={tag} style={styles.cardTag}>
                                <ThemedText style={styles.cardTagText}>{tag}</ThemedText>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    </View>

                    <Pressable
                      style={styles.cardViewBtn}
                      onPress={() => handleAvatarPress(u)}
                    >
                      <Feather name="eye" size={16} color="#10B981" />
                    </Pressable>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <AlertComponent />
      </ScreenScrollView>

      {/* ── Preview card overlay ── */}
      {selectedUser && (
        <Modal
          transparent
          visible={!!selectedUser}
          animationType="none"
          onRequestClose={() => setSelectedUser(null)}
        >
          <Pressable style={styles.previewOverlay} onPress={() => setSelectedUser(null)}>
            <Pressable onPress={(e) => e.stopPropagation()}>
              <PreviewCard
                user={selectedUser}
                onClose={() => setSelectedUser(null)}
                onViewProfile={() => {
                  setSelectedUser(null);
                  navigation.navigate("ProfileDetail", { userId: selectedUser.id });
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080f0a",
  },
  scrollContent: {
    paddingBottom: 60,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  liveText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.8,
  },
  headerSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  headerIconBtnActive: {
    backgroundColor: "rgba(16,185,129,0.2)",
    borderColor: "rgba(16,185,129,0.4)",
  },

  // ── Stats ──
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  statNum: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  statLbl: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    marginHorizontal: 8,
  },
  locationStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // ── Filter ──
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(16,185,129,0.08)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.2)",
  },
  filterToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#10B981",
  },
  filterPanel: {
    marginHorizontal: 20,
    marginTop: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  filterRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  filterVal: {
    fontSize: 13,
    fontWeight: "700",
    color: "#10B981",
  },
  fSlider: {
    width: "100%",
    height: 36,
  },
  ageSliderGroup: {
    gap: 8,
  },
  ageSliderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ageSliderLbl: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    width: 52,
    fontWeight: "500",
  },
  ageSlider: {
    flex: 1,
    height: 36,
  },
  genderPills: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  genderPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  genderPillActive: {
    backgroundColor: "rgba(16,185,129,0.12)",
    borderColor: "rgba(16,185,129,0.4)",
  },
  genderPillEmoji: {
    fontSize: 14,
  },
  genderPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  applyFilterBtn: {
    marginTop: 14,
    borderRadius: 12,
    overflow: "hidden",
  },
  applyFilterBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
  },
  applyFilterBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },

  // ── Radar ──
  radarSection: {
    marginTop: 22,
    alignItems: "center",
  },
  radarGlowOuter: {
    position: "absolute",
    top: -20,
    width: RADAR_SIZE + 140,
    height: RADAR_SIZE + 140,
    borderRadius: (RADAR_SIZE + 140) / 2,
    backgroundColor: "rgba(16,185,129,0.06)",
  },
  radarCard: {
    backgroundColor: "rgba(16,185,129,0.03)",
    borderRadius: 32,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.18)",
    zIndex: 1,
  },
  radarContainer: {
    width: RADAR_SIZE,
    height: RADAR_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 1.5,
  },
  avatarPin: {
    position: "absolute",
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    zIndex: 10,
  },
  avatarPinGrad: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  avatarPinImg: {
    width: AVATAR_SIZE - 5,
    height: AVATAR_SIZE - 5,
    borderRadius: (AVATAR_SIZE - 5) / 2,
  },
  avatarOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: "#4ADE80",
    borderWidth: 2,
    borderColor: "#080f0a",
  },
  avatarVerifyBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#080f0a",
  },
  centerDot: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 20,
  },
  centerDotGrad: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.4)",
  },
  centerDotCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  ringLabels: {},
  distMarkersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginTop: 10,
  },
  distMark: {
    fontSize: 10,
    color: "rgba(16,185,129,0.5)",
    fontWeight: "600",
  },

  // Refresh
  refreshBtn: {
    marginTop: 14,
    borderRadius: 14,
    overflow: "hidden",
    width: RADAR_SIZE + 32,
  },
  refreshBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.18)",
    borderRadius: 14,
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10B981",
  },

  // ── List ──
  listSection: {
    marginTop: 28,
    paddingHorizontal: 20,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  listCountBadge: {
    backgroundColor: "rgba(16,185,129,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
  },
  listCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#10B981",
  },
  loadingWrap: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 14,
  },
  loadingText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(16,185,129,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "rgba(255,255,255,0.7)",
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 20,
    marginBottom: 20,
  },
  emptyAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    backgroundColor: "rgba(16,185,129,0.08)",
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#10B981",
  },
  usersList: {
    gap: 10,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  userCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
    position: "relative",
    overflow: "hidden",
  },
  userAvatarImg: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  cardOnlineBadge: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4ADE80",
    borderWidth: 2,
    borderColor: "#080f0a",
  },
  userInfo: {
    flex: 1,
    gap: 3,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    flex: 1,
  },
  cardVerifyBadge: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  userAge: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },
  userMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  userDist: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  cardInterests: {
    flexDirection: "row",
    gap: 5,
    marginTop: 2,
  },
  cardTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.2)",
  },
  cardTagText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "500",
  },
  cardViewBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(16,185,129,0.1)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  // ── Preview card ──
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  previewCard: {
    backgroundColor: "#111a14",
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
  },
  previewPhotoWrap: {
    height: 280,
    position: "relative",
  },
  previewPhoto: {
    width: "100%",
    height: "100%",
  },
  previewPhotoPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  previewPhotoGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 140,
  },
  previewClose: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewOnlineBadge: {
    position: "absolute",
    top: 14,
    left: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.3)",
  },
  previewOnlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#4ADE80",
  },
  previewOnlineText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4ADE80",
  },
  previewPhotoInfo: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
  },
  previewNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 4,
  },
  previewName: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  previewVerifyBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  previewAge: {
    fontSize: 22,
    fontWeight: "400",
    color: "rgba(255,255,255,0.8)",
  },
  previewDistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  previewDist: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
  },
  previewBioWrap: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  previewBio: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 20,
  },
  previewInterests: {
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  previewTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  previewTagText: {
    fontSize: 12,
    fontWeight: "600",
  },
  previewActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 12,
  },
  previewPassBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(248,113,113,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(248,113,113,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewProfileBtn: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
  previewProfileBtnGrad: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  previewProfileBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  previewLikeBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(16,185,129,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
});

import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Dimensions,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons, Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Spacing, BorderRadius } from "@/constants/theme";
import * as Location from "expo-location";

const { width } = Dimensions.get("window");

export default function DistanceWeatherScreen() {
  const { theme } = useTheme();
  const { token, user: currentUser } = useAuth();
  const { get } = useApi();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { userId, userName } = route.params || {};

  const [loading, setLoading] = useState(true);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [weather, setWeather] = useState<any>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      // Fetch user data first
      const userResponse = await get<any>(`/users/${userId}`, token || "");
      
      if (userResponse.success && userResponse.data?.user) {
        setOtherUser(userResponse.data.user);
        
        // Try to get current location, but don't fail if unavailable
        let locationResult = null;
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ 
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 5000,
              distanceInterval: 10
            });
            locationResult = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          }
        } catch (locError) {
          console.log("Location unavailable, using other user's location for weather");
        }
        
        const otherLoc = userResponse.data.user.location?.coordinates;
        
        if (locationResult) {
          setMyLocation(locationResult);
          if (otherLoc && otherLoc.length === 2) {
            const dist = calculateDistance(
              locationResult.lat,
              locationResult.lng,
              otherLoc[1],
              otherLoc[0]
            );
            setDistance(dist);
          }
          
          // Fetch weather for either their location or current user's location
          const weatherLat = otherLoc?.[1] || locationResult.lat;
          const weatherLng = otherLoc?.[0] || locationResult.lng;
          fetchWeather(weatherLat, weatherLng);
        } else if (otherLoc && otherLoc.length === 2) {
          // No permission/location available, try to get weather from their location
          fetchWeather(otherLoc[1], otherLoc[0]);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchWeather = async (lat: number, lng: number) => {
    setWeatherLoading(true);
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
      );
      const data = await response.json();
      setWeather(data);
    } catch (error) {
      console.error("Weather fetch error:", error);
    } finally {
      setWeatherLoading(false);
    }
  };

  const getWeatherIcon = (code: number): keyof typeof Ionicons.glyphMap => {
    if (code === 0) return "sunny";
    if (code <= 3) return "partly-sunny";
    if (code <= 48) return "cloudy";
    if (code <= 67) return "rainy";
    if (code <= 77) return "snow";
    if (code <= 82) return "rainy";
    return "thunderstorm";
  };

  const getWeatherDescription = (code: number): string => {
    const descriptions: { [key: number]: string } = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Foggy",
      48: "Depositing rime fog",
      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Dense drizzle",
      61: "Slight rain",
      63: "Moderate rain",
      65: "Heavy rain",
      71: "Slight snow",
      73: "Moderate snow",
      75: "Heavy snow",
      80: "Slight rain showers",
      81: "Moderate rain showers",
      82: "Violent rain showers",
      95: "Thunderstorm",
    };
    return descriptions[code] || "Unknown";
  };

  const hasValidLocation = otherUser?.location?.coordinates && 
    Array.isArray(otherUser.location.coordinates) && 
    otherUser.location.coordinates.length === 2 &&
    otherUser.location.coordinates[0] !== 0 &&
    otherUser.location.coordinates[1] !== 0;

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText style={{ marginTop: Spacing.md }}>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={[styles.backButton, { backgroundColor: theme.surface }]} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <ThemedText style={styles.title}>Distance & Weather</ThemedText>
            <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {userName || 'User'}
            </ThemedText>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          {/* Distance Card */}
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primary + '15' }]}>
                <MaterialCommunityIcons name="map-marker-distance" size={28} color={theme.primary} />
              </View>
              <ThemedText style={styles.cardTitle}>Distance</ThemedText>
            </View>
            
            <View style={styles.cardBody}>
              {distance !== null ? (
                <>
                  <ThemedText style={[styles.bigValue, { color: theme.primary }]}>
                    {distance < 1 ? `${Math.round(distance * 1000)}` : distance.toFixed(1)}
                  </ThemedText>
                  <ThemedText style={[styles.valueUnit, { color: theme.textSecondary }]}>
                    {distance < 1 ? 'meters' : 'km'}
                  </ThemedText>
                </>
              ) : (
                <>
                  <Ionicons name="location-outline" size={40} color={theme.textSecondary} />
                  <ThemedText style={[styles.noDataText, { color: theme.textSecondary }]}>
                    {!myLocation ? 'Enable location permission' : 'User location not shared'}
                  </ThemedText>
                </>
              )}
            </View>
            
            {otherUser?.location?.city && (
              <View style={[styles.locationBadge, { backgroundColor: theme.primary + '10' }]}>
                <Ionicons name="location" size={14} color={theme.primary} />
                <ThemedText style={[styles.locationText, { color: theme.primary }]}>
                  {otherUser.location.city}{otherUser.location.country ? `, ${otherUser.location.country}` : ''}
                </ThemedText>
              </View>
            )}
          </View>

          {/* Weather Card */}
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: '#FFB800' + '15' }]}>
                <Ionicons 
                  name={weather?.current?.weather_code !== undefined ? getWeatherIcon(weather.current.weather_code) : "cloudy"} 
                  size={28} 
                  color="#FFB800" 
                />
              </View>
              <ThemedText style={styles.cardTitle}>Weather</ThemedText>
            </View>
            
            <View style={styles.cardBody}>
              {weatherLoading ? (
                <ActivityIndicator size="large" color="#FFB800" />
              ) : weather?.current ? (
                <>
                  <ThemedText style={[styles.bigValue, { color: '#FFB800' }]}>
                    {Math.round(weather.current.temperature_2m)}°
                  </ThemedText>
                  <ThemedText style={[styles.weatherCondition, { color: theme.text }]}>
                    {getWeatherDescription(weather.current.weather_code)}
                  </ThemedText>
                </>
              ) : (
                <>
                  <Ionicons name="cloud-offline-outline" size={40} color={theme.textSecondary} />
                  <ThemedText style={[styles.noDataText, { color: theme.textSecondary }]}>
                    Weather unavailable
                  </ThemedText>
                </>
              )}
            </View>
            
            {weather?.current && (
              <View style={styles.weatherStats}>
                <View style={[styles.statItem, { backgroundColor: theme.background }]}>
                  <Ionicons name="water" size={18} color="#4FC3F7" />
                  <ThemedText style={styles.statValue}>{weather.current.relative_humidity_2m}%</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>Humidity</ThemedText>
                </View>
                <View style={[styles.statItem, { backgroundColor: theme.background }]}>
                  <Feather name="wind" size={18} color="#81C784" />
                  <ThemedText style={styles.statValue}>{Math.round(weather.current.wind_speed_10m)}</ThemedText>
                  <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>km/h Wind</ThemedText>
                </View>
              </View>
            )}
          </View>

          {/* Map Button */}
          {hasValidLocation ? (
            <Pressable
              style={[styles.mapButton, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate('UserDistanceMap', { otherUser })}
            >
              <Feather name="map" size={22} color="#FFF" />
              <ThemedText style={styles.mapButtonText}>View on Map</ThemedText>
              <Ionicons name="chevron-forward" size={20} color="#FFF" />
            </Pressable>
          ) : (
            <View style={[styles.mapButton, { backgroundColor: theme.textSecondary + '40' }]}>
              <Feather name="map-pin" size={22} color={theme.textSecondary} />
              <ThemedText style={[styles.mapButtonText, { color: theme.textSecondary }]}>
                Map unavailable - location not shared
              </ThemedText>
            </View>
          )}
        </View>
      </ScreenScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 50,
    paddingBottom: Spacing.lg,
  },
  headerCenter: {
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardBody: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    minHeight: 100,
    justifyContent: 'center',
  },
  bigValue: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 60,
  },
  valueUnit: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
  },
  weatherCondition: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  noDataText: {
    fontSize: 14,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: 6,
    marginTop: Spacing.sm,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '500',
  },
  weatherStats: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  mapButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
});

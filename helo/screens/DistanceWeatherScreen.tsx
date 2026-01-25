import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { Spacing, BorderRadius } from "@/constants/theme";
import * as Location from "expo-location";

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
      const [userResponse, locationResult] = await Promise.all([
        get<any>(`/users/${userId}`, token || ""),
        Location.requestForegroundPermissionsAsync().then(async ({ status }) => {
          if (status === 'granted') {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            return { lat: loc.coords.latitude, lng: loc.coords.longitude };
          }
          return null;
        })
      ]);

      if (userResponse.success && userResponse.data?.user) {
        setOtherUser(userResponse.data.user);
        
        if (locationResult) {
          setMyLocation(locationResult);
          const otherLoc = userResponse.data.user.location?.coordinates;
          if (otherLoc) {
            const dist = calculateDistance(
              locationResult.lat,
              locationResult.lng,
              otherLoc[1],
              otherLoc[0]
            );
            setDistance(dist);
          }
          
          fetchWeather(otherLoc?.[1] || locationResult.lat, otherLoc?.[0] || locationResult.lng);
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

  const getWeatherIcon = (code: number) => {
    if (code === 0) return "sunny";
    if (code <= 3) return "partly-sunny";
    if (code <= 49) return "cloudy";
    if (code <= 69) return "rainy";
    if (code <= 79) return "snow";
    if (code <= 99) return "thunderstorm";
    return "cloudy";
  };

  const getWeatherDescription = (code: number) => {
    if (code === 0) return "Clear sky";
    if (code <= 3) return "Partly cloudy";
    if (code <= 49) return "Foggy";
    if (code <= 69) return "Rain";
    if (code <= 79) return "Snow";
    if (code <= 99) return "Thunderstorm";
    return "Cloudy";
  };

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScreenScrollView>
        <View style={styles.header}>
          <Pressable style={[styles.backButton, { backgroundColor: theme.surface }]} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.title}>Distance & Weather</ThemedText>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="location" size={32} color={theme.primary} />
            </View>
            <ThemedText style={styles.cardTitle}>Distance to {userName || 'User'}</ThemedText>
            {distance !== null ? (
              <ThemedText style={[styles.bigValue, { color: theme.primary }]}>
                {distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}
              </ThemedText>
            ) : (
              <ThemedText style={styles.subtitle}>Location not available</ThemedText>
            )}
            {otherUser?.location?.city && (
              <ThemedText style={styles.subtitle}>
                {otherUser.location.city}{otherUser.location.country ? `, ${otherUser.location.country}` : ''}
              </ThemedText>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={[styles.iconCircle, { backgroundColor: '#FFB800' + '20' }]}>
              <Ionicons name={weather?.current?.weather_code !== undefined ? getWeatherIcon(weather.current.weather_code) : "cloudy"} size={32} color="#FFB800" />
            </View>
            <ThemedText style={styles.cardTitle}>Weather at Their Location</ThemedText>
            {weatherLoading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : weather?.current ? (
              <>
                <ThemedText style={[styles.bigValue, { color: '#FFB800' }]}>
                  {Math.round(weather.current.temperature_2m)}°C
                </ThemedText>
                <ThemedText style={styles.subtitle}>
                  {getWeatherDescription(weather.current.weather_code)}
                </ThemedText>
                <View style={styles.weatherDetails}>
                  <View style={styles.weatherItem}>
                    <Ionicons name="water" size={16} color={theme.textSecondary} />
                    <ThemedText style={styles.weatherText}>{weather.current.relative_humidity_2m}% humidity</ThemedText>
                  </View>
                  <View style={styles.weatherItem}>
                    <Feather name="wind" size={16} color={theme.textSecondary} />
                    <ThemedText style={styles.weatherText}>{Math.round(weather.current.wind_speed_10m)} km/h</ThemedText>
                  </View>
                </View>
              </>
            ) : (
              <ThemedText style={styles.subtitle}>Weather data unavailable</ThemedText>
            )}
          </View>

          {otherUser?.location?.coordinates ? (
            <Pressable
              style={[styles.mapButton, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate('UserDistanceMap', { otherUser })}
            >
              <Feather name="map" size={20} color="#FFF" />
              <ThemedText style={styles.mapButtonText}>View on Map</ThemedText>
            </Pressable>
          ) : (
            <View style={[styles.mapButton, { backgroundColor: theme.textSecondary }]}>
              <Feather name="map-pin" size={20} color="#FFF" />
              <ThemedText style={styles.mapButtonText}>User location not shared</ThemedText>
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
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  bigValue: {
    fontSize: 36,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  weatherDetails: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  weatherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weatherText: {
    fontSize: 13,
    opacity: 0.7,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  mapButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

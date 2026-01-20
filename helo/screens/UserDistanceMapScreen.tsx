import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Dimensions, Linking, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { getPhotoSource } from "@/utils/photos";
import { getApiBaseUrl } from "@/constants/config";
import * as Location from 'expo-location';

const { width } = Dimensions.get("window");

type UserDistanceMapScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "UserDistanceMap">;
type UserDistanceMapScreenRouteProp = RouteProp<RootStackParamList, "UserDistanceMap">;

interface UserDistanceMapScreenProps {
  navigation: UserDistanceMapScreenNavigationProp;
  route: UserDistanceMapScreenRouteProp;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default function UserDistanceMapScreen({ navigation, route }: UserDistanceMapScreenProps) {
  const { otherUser } = route.params;
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  
  const [currentUserLocation, setCurrentUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  const isValidLocation = (lat?: number, lng?: number): boolean => {
    if (lat === undefined || lng === undefined) return false;
    if (!isFinite(lat) || !isFinite(lng)) return false;
    if (lat === 0 && lng === 0) return false;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    return true;
  };

  const fetchCurrentLocation = async () => {
    setLoading(true);
    setLocationError(null);
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission not granted. Please enable location services.');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      const freshLat = location.coords.latitude;
      const freshLng = location.coords.longitude;
      
      if (!isValidLocation(freshLat, freshLng)) {
        setLocationError('Could not get accurate location');
        setLoading(false);
        return;
      }
      
      setCurrentUserLocation({
        lat: freshLat,
        lng: freshLng,
      });
      
      if (token) {
        try {
          await fetch(`${getApiBaseUrl()}/api/users/me`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              location: {
                type: 'Point',
                coordinates: [freshLng, freshLat],
                lat: freshLat,
                lng: freshLng,
              }
            }),
          });
        } catch (updateError) {
          console.log('Could not update location on server:', updateError);
        }
      }
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Could not get your current location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const userLat = currentUserLocation?.lat ?? 0;
  const userLng = currentUserLocation?.lng ?? 0;
  const otherLat = otherUser?.location?.lat ?? 0;
  const otherLng = otherUser?.location?.lng ?? 0;

  const hasValidLocations = 
    currentUserLocation !== null &&
    isValidLocation(currentUserLocation?.lat, currentUserLocation?.lng) &&
    isValidLocation(otherUser?.location?.lat, otherUser?.location?.lng);

  const distance = hasValidLocations 
    ? calculateDistance(userLat, userLng, otherLat, otherLng)
    : 0;

  const midLat = (userLat + otherLat) / 2;
  const midLng = (userLng + otherLng) / 2;

  const otherUserPhoto = otherUser?.photos?.[0] ? getPhotoSource(otherUser.photos[0]) : null;

  const escapedName = (otherUser?.name || 'User')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body, #map { width: 100%; height: 100%; }
        .custom-marker {
          background: #FF6B6B;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .you-marker {
          background: #4CAF50;
        }
        .marker-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .marker-label {
          position: absolute;
          top: -25px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          z-index: 1000;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: false,
          attributionControl: false
        }).setView([${midLat || 0}, ${midLng || 0}], 12);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19
        }).addTo(map);
        
        ${hasValidLocations ? `
          var youIcon = L.divIcon({
            className: '',
            html: '<div style="position:relative"><div class="marker-label">You</div><div class="custom-marker you-marker" style="width:30px;height:30px;"></div></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          });
          
          var otherIcon = L.divIcon({
            className: '',
            html: '<div style="position:relative"><div class="marker-label">${escapedName}</div><div class="custom-marker" style="width:40px;height:40px;">${otherUserPhoto ? `<img src="${otherUserPhoto}" class="marker-image" />` : ''}</div></div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });
          
          L.marker([${userLat}, ${userLng}], {icon: youIcon}).addTo(map);
          L.marker([${otherLat}, ${otherLng}], {icon: otherIcon}).addTo(map);
          
          var latlngs = [
            [${userLat}, ${userLng}],
            [${otherLat}, ${otherLng}]
          ];
          L.polyline(latlngs, {
            color: '#FF6B6B',
            weight: 4,
            dashArray: '10, 10',
            opacity: 0.8
          }).addTo(map);
          
          map.fitBounds(latlngs, { padding: [70, 70] });
        ` : ''}
      </script>
    </body>
    </html>
  `;

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <ThemedText style={{ color: theme.text, marginTop: Spacing.md }}>Getting location...</ThemedText>
      </ThemedView>
    );
  }

  if (!user || !otherUser || locationError || !hasValidLocations) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <View style={styles.errorIconContainer}>
          <Feather name="map" size={48} color="#FF6B6B" />
        </View>
        <ThemedText style={{ color: theme.text, fontSize: 18, fontWeight: '600', marginTop: Spacing.md }}>
          {locationError || 'Location Unavailable'}
        </ThemedText>
        <ThemedText style={{ color: '#888', marginTop: Spacing.sm, textAlign: 'center', paddingHorizontal: Spacing.xl }}>
          {!hasValidLocations && !locationError 
            ? "This user hasn't shared their location yet" 
            : "Please enable location services to view distance"}
        </ThemedText>
        <Pressable
          style={[styles.backButtonLarge, { backgroundColor: theme.primary, marginTop: Spacing.xl }]}
          onPress={() => navigation.goBack()}
        >
          <ThemedText style={{ color: theme.buttonText }}>Go Back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const openInMaps = () => {
    if (hasValidLocations) {
      const url = `https://www.google.com/maps/dir/${userLat},${userLng}/${otherLat},${otherLng}`;
      Linking.openURL(url);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.mapContainer}>
        <WebView
          source={{ html: mapHtml }}
          style={styles.map}
          scrollEnabled={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
      </View>

      <Pressable
        style={[styles.backButton, { top: insets.top + Spacing.md }]}
        onPress={() => navigation.goBack()}
      >
        <Feather name="arrow-left" size={24} color="#FFF" />
      </Pressable>

      <View style={[styles.bottomCard, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.cardHandle} />
        
        <View style={styles.distanceHeader}>
          <View style={styles.distanceIconContainer}>
            <Feather name="navigation" size={24} color="#FF6B6B" />
          </View>
          <View style={styles.distanceInfo}>
            <ThemedText style={styles.distanceLabel}>Distance</ThemedText>
            <ThemedText style={styles.distanceValue}>
              {hasValidLocations ? `${distance} km away` : 'Location unavailable'}
            </ThemedText>
          </View>
          {hasValidLocations && (
            <Pressable style={styles.directionsButton} onPress={openInMaps}>
              <Feather name="external-link" size={18} color="#FF6B6B" />
            </Pressable>
          )}
        </View>

        <View style={styles.userInfoRow}>
          <View style={styles.userPhotoContainer}>
            {otherUserPhoto ? (
              <Image
                source={otherUserPhoto}
                style={styles.userPhoto}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.userPhoto, styles.noPhoto]}>
                <Feather name="user" size={24} color="#666" />
              </View>
            )}
            {otherUser.online && <View style={styles.onlineDot} />}
          </View>
          <View style={styles.userDetails}>
            <ThemedText style={styles.userName}>{otherUser.name}, {otherUser.age}</ThemedText>
            <ThemedText style={styles.userStatus}>
              {otherUser.online ? 'Online now' : 'Offline'}
            </ThemedText>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: '#FF6B6B' }]}
            onPress={() => navigation.navigate("ChatDetail", { userId: otherUser.id, userName: otherUser.name })}
          >
            <Feather name="message-circle" size={20} color="#FFF" />
            <ThemedText style={styles.actionButtonText}>Message</ThemedText>
          </Pressable>
          
          <Pressable
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => {
              navigation.goBack();
              navigation.navigate("ProfileDetail", { userId: otherUser.id });
            }}
          >
            <Feather name="user" size={20} color="#FFF" />
            <ThemedText style={styles.actionButtonText}>View Profile</ThemedText>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  mapContainer: {
    flex: 1,
    overflow: "hidden",
  },
  map: {
    flex: 1,
    backgroundColor: "#121212",
  },
  backButton: {
    position: "absolute",
    left: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonLarge: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1E1E1E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  cardHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#444",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  distanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  distanceIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  distanceInfo: {
    flex: 1,
  },
  distanceLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 2,
  },
  distanceValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFF",
  },
  directionsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 107, 107, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  userInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: "#2A2A2A",
    borderRadius: BorderRadius.md,
  },
  userPhotoContainer: {
    position: "relative",
    marginRight: Spacing.md,
  },
  userPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  noPhoto: {
    backgroundColor: "#3A3A3A",
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "#2A2A2A",
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
    marginBottom: 2,
  },
  userStatus: {
    fontSize: 13,
    color: "#888",
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  secondaryButton: {
    backgroundColor: "#3A3A3A",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
});

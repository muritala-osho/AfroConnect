import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { storage, StoredUser } from "@/utils/storage";
import { Image } from "expo-image";
import { getPhotoSource } from "@/utils/photos";

type MapViewScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "MapView">;

interface MapViewScreenProps {
  navigation: MapViewScreenNavigationProp;
}

interface UserWithDistance extends StoredUser {
  distance?: number;
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
  return Math.round(R * c);
}

export default function MapViewScreen({ navigation }: MapViewScreenProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithDistance | null>(null);

  useEffect(() => {
    loadNearbyUsers();
  }, [user?.id]);

  const loadNearbyUsers = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const allUsers = await storage.getAllUsers();
      
      const filteredUsers = allUsers
        .filter(u => {
          if (u.id === user.id) return false;
          
          if (user.preferences) {
            const { ageRange, genders, maxDistance } = user.preferences;
            
            if (ageRange && (u.age < ageRange.min || u.age > ageRange.max)) {
              return false;
            }
            
            if (genders && genders.length > 0 && !genders.includes(u.gender)) {
              return false;
            }
            
            if (maxDistance && user.location?.lat && user.location?.lng && u.location?.lat && u.location?.lng) {
              const distance = calculateDistance(
                user.location.lat,
                user.location.lng,
                u.location.lat,
                u.location.lng
              );
              if (distance > maxDistance) return false;
            }
          }
          
          return true;
        })
        .map(u => {
          const distance = (user.location?.lat && user.location?.lng && u.location?.lat && u.location?.lng)
            ? calculateDistance(
                user.location.lat,
                user.location.lng,
                u.location.lat,
                u.location.lng
              )
            : 0;
          return {
            ...u,
            distance,
          };
        });
      
      setUsers(filteredUsers);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !user) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  const hasLocation = user.location && user.location.lat && user.location.lng;
  
  const initialRegion = hasLocation ? {
    latitude: user.location.lat,
    longitude: user.location.lng,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  } : {
    latitude: 0,
    longitude: 0,
    latitudeDelta: 50,
    longitudeDelta: 50,
  };

  if (!hasLocation) {
    return (
      <View style={styles.container}>
        <ThemedView style={[styles.container, styles.centerContent]}>
          <Feather name="map-pin" size={64} color={theme.textSecondary} />
          <ThemedText style={[styles.mapUnavailableTitle, { color: theme.text }]}>
            Location Not Available
          </ThemedText>
          <ThemedText style={[styles.mapUnavailableText, { color: theme.textSecondary }]}>
            Please enable location services to see nearby users on the map.
            {"\n\n"}
            Go to your device settings to grant location permission.
          </ThemedText>
          <Pressable
            style={[styles.backToListButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={[styles.backToListText, { color: theme.buttonText }]}>
              Go Back
            </ThemedText>
          </Pressable>
        </ThemedView>

        <Pressable
          style={[styles.backButton, { top: insets.top + Spacing.md, backgroundColor: theme.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.map}>
        <ThemedView style={[styles.container, styles.centerContent]}>
          <Feather name="map" size={64} color={theme.textSecondary} />
          <ThemedText style={[styles.mapUnavailableTitle, { color: theme.text }]}>
            Map View
          </ThemedText>
          <ThemedText style={[styles.mapUnavailableText, { color: theme.textSecondary }]}>
            Map view with nearby users will be available on native devices.
            {"\n\n"}
            {users.length} users found nearby
          </ThemedText>
          <Pressable
            style={[styles.backToListButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={[styles.backToListText, { color: theme.buttonText }]}>
              Back to List
            </ThemedText>
          </Pressable>
        </ThemedView>
      </View>

      <Pressable
        style={[styles.backButton, { top: insets.top + Spacing.md, backgroundColor: theme.surface }]}
        onPress={() => navigation.goBack()}
      >
        <Feather name="arrow-left" size={24} color={theme.text} />
      </Pressable>

      {selectedUser ? (
        <View style={[styles.userCard, { bottom: insets.bottom + Spacing.md, backgroundColor: theme.surface }]}>
          <Pressable
            style={styles.closeCard}
            onPress={() => setSelectedUser(null)}
          >
            <Feather name="x" size={20} color={theme.textSecondary} />
          </Pressable>

          <View style={styles.cardContent}>
            {selectedUser.photos && selectedUser.photos[0] ? (
              <Image
                source={getPhotoSource(selectedUser.photos[0])}
                style={styles.cardImage}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.cardImage, { backgroundColor: theme.backgroundSecondary }]}>
                <Feather name="user" size={40} color={theme.textSecondary} />
              </View>
            )}

            <View style={styles.cardInfo}>
              <View style={styles.cardHeader}>
                <ThemedText style={[styles.cardName, { color: theme.text }]}>
                  {selectedUser.name}, {selectedUser.age}
                </ThemedText>
                {selectedUser.online && (
                  <View style={[styles.onlineDot, { backgroundColor: theme.online }]} />
                )}
              </View>
              <ThemedText style={[styles.cardDistance, { color: theme.textSecondary }]}>
                <Feather name="map-pin" size={12} color={theme.textSecondary} /> {selectedUser.distance} km away
              </ThemedText>
              <ThemedText
                style={[styles.cardBio, { color: theme.textSecondary }]}
                numberOfLines={2}
              >
                {selectedUser.bio}
              </ThemedText>

              <Pressable
                style={[styles.viewProfileButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setSelectedUser(null);
                  navigation.navigate("ProfileDetail", { userId: selectedUser.id });
                }}
              >
                <ThemedText style={[styles.viewProfileText, { color: theme.buttonText }]}>
                  View Profile
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  map: {
    flex: 1,
  },
  mapUnavailableTitle: {
    fontSize: 24,
    fontWeight: "600",
    marginTop: Spacing.lg,
  },
  mapUnavailableText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  backToListButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  backToListText: {
    fontSize: 16,
    fontWeight: "600",
  },
  backButton: {
    position: "absolute",
    left: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  markerContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    overflow: "hidden",
  },
  markerImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  currentUserMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
  userCard: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  closeCard: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flexDirection: "row",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  cardName: {
    fontSize: 18,
    fontWeight: "600",
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardDistance: {
    fontSize: 13,
  },
  cardBio: {
    fontSize: 14,
    lineHeight: 18,
  },
  viewProfileButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  viewProfileText: {
    fontSize: 14,
    fontWeight: "600",
  },
});


import React, { useState, useEffect } from "react";
import { 
  View, 
  StyleSheet, 
  Pressable, 
  FlatList, 
  TextInput, 
  Alert,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function ManageLocationsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { user, token, fetchUser } = useAuth();
  const { post, del } = useApi();
  const insets = useSafeAreaInsets();
  
  const [locations, setLocations] = useState<any[]>(user?.additionalLocations || []);
  const [newLocation, setNewLocation] = useState("");

  const isPremium = user?.premium?.isActive;

  const handleAddLocation = async () => {
    if (!isPremium) {
      Alert.alert("Premium Feature", "Additional locations is a premium feature. Upgrade to unlock!");
      return;
    }

    const name = newLocation.trim();
    if (!name) {
      Alert.alert("Error", "Please enter a location name");
      return;
    }

    // Optimistic add — show the new chip instantly and clear the input so the
    // tap feels immediate. We reconcile with the server response once it
    // arrives (and roll back on failure).
    const tempId = `temp_${Date.now()}`;
    const optimisticItem = { _id: tempId, id: tempId, name, optimistic: true };
    const previous = locations;
    setLocations(prev => [...prev, optimisticItem]);
    setNewLocation("");

    try {
      const res = await post<{ success: boolean; locations?: any[]; message?: string }>(
        '/users/me/locations',
        { name },
        token ?? undefined,
      );
      if (res.success && res.data?.locations) {
        setLocations(res.data.locations);
        // Refresh the auth user in the background so the Discovery passport
        // picker gets the new entry, but never block the UI on it.
        if (fetchUser) {
          fetchUser().catch(() => {});
        }
      } else {
        setLocations(previous);
        setNewLocation(name);
        Alert.alert("Error", res.message || "Failed to add location");
      }
    } catch (_e) {
      setLocations(previous);
      setNewLocation(name);
      Alert.alert("Error", "An unexpected error occurred");
    }
  };

  const handleDeleteLocation = async (id: string) => {
    // Optimistic delete for the same instant-feel reason.
    const previous = locations;
    setLocations(prev => prev.filter(l => (l._id || l.id) !== id));
    try {
      const res = await del<{ success: boolean; locations?: any[] }>(
        `/users/me/locations/${id}`,
        token ?? undefined,
      );
      if (res.success && res.data?.locations) {
        setLocations(res.data.locations);
        if (fetchUser) {
          fetchUser().catch(() => {});
        }
      } else if (!res.success) {
        setLocations(previous);
        Alert.alert("Error", "Failed to delete location");
      }
    } catch (_e) {
      setLocations(previous);
      Alert.alert("Error", "Failed to delete location");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Manage Locations</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={[styles.currentLocationCard, { backgroundColor: theme.surface }]}>
          <ThemedText style={styles.label}>Current Location</ThemedText>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={20} color={theme.primary} />
            <ThemedText style={styles.locationText}>{user?.livingIn || 'Not set'}</ThemedText>
          </View>
        </View>

        <View style={styles.addSection}>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
            placeholder="Add new location..."
            placeholderTextColor={theme.textSecondary}
            value={newLocation}
            onChangeText={setNewLocation}
            editable={isPremium}
          />
          <Pressable 
            style={[styles.addButton, { backgroundColor: isPremium ? theme.primary : theme.textSecondary }]} 
            onPress={handleAddLocation}
          >
            <Feather name="plus" size={24} color="#FFF" />
          </Pressable>
        </View>

        {!isPremium && (
          <View style={[styles.premiumNotice, { backgroundColor: theme.primary + '10' }]}>
            <Ionicons name="star" size={20} color={theme.primary} />
            <ThemedText style={[styles.premiumText, { color: theme.primary }]}>
              Upgrade to Premium to add up to 3 additional locations!
            </ThemedText>
          </View>
        )}

        <ThemedText style={styles.sectionTitle}>Additional Locations</ThemedText>
        <FlatList
          data={locations}
          keyExtractor={(item) => item._id || item.id}
          renderItem={({ item }) => (
            <View style={[styles.locationItem, { borderBottomColor: theme.border }]}>
              <ThemedText style={styles.locationItemText}>{item.name}</ThemedText>
              <Pressable onPress={() => handleDeleteLocation(item._id || item.id)}>
                <Feather name="trash-2" size={20} color="#FF3B30" />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <ThemedText style={styles.emptyText}>No additional locations added yet.</ThemedText>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, padding: 20 },
  currentLocationCard: { padding: 16, borderRadius: 16, marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', opacity: 0.6, marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationText: { fontSize: 16, fontWeight: '500' },
  addSection: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  input: { flex: 1, height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 15 },
  addButton: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  premiumNotice: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, gap: 10, marginBottom: 20 },
  premiumText: { flex: 1, fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 10 },
  locationItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1 },
  locationItemText: { fontSize: 16 },
  emptyText: { textAlign: 'center', marginTop: 40, opacity: 0.5 }
});

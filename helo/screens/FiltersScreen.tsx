
import React, { useState, useEffect, useRef, useCallback } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';

type FiltersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Filters">;

interface FiltersScreenProps {
  navigation: FiltersScreenNavigationProp;
}

export default function FiltersScreen({ navigation }: FiltersScreenProps) {
  const { theme } = useTheme();
  const { user, token, updateProfile } = useAuth();
  const api = useApi();
  
  const [minAge, setMinAge] = useState(user?.preferences?.ageRange?.min || 18);
  const [maxAge, setMaxAge] = useState(user?.preferences?.ageRange?.max || 35);
  const [distance, setDistance] = useState(user?.preferences?.maxDistance || 50);
  const [genderPref, setGenderPref] = useState<string>(user?.preferences?.genderPreference || 'both');
  const [lookingFor, setLookingFor] = useState<string>(user?.lifestyle?.lookingFor || 'relationship');
  const [religion, setReligion] = useState<string>(user?.lifestyle?.religion || 'any');
  const [saving, setSaving] = useState(false);

  const handleApply = async () => {
    if (!token) return;
    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const updatedPreferences = {
        ...user?.preferences,
        ageRange: { min: minAge, max: maxAge },
        maxDistance: distance,
        genderPreference: genderPref,
      };
      const lifestyleUpdates = {
        lookingFor,
        religion: religion === 'any' ? undefined : religion
      };
      const response = await api.put<{ success: boolean }>('/users/me', { 
        preferences: updatedPreferences,
        lifestyle: lifestyleUpdates
      }, token);
      if (response.success) {
        await updateProfile({ 
          preferences: updatedPreferences,
          lifestyle: { ...user?.lifestyle, ...lifestyleUpdates }
        });
        navigation.goBack();
      }
    } catch (error) {
      console.error('Filter update error:', error);
    } finally {
      setSaving(false);
    }
  };

  const LOOKING_FOR_OPTIONS = [
    { value: 'relationship', label: 'Relationship' },
    { value: 'friendship', label: 'Friendship' },
    { value: 'casual', label: 'Casual' },
    { value: 'networking', label: 'Networking' },
  ];

  const RELIGION_OPTIONS = [
    { value: 'any', label: 'Any' },
    { value: 'christian', label: 'Christian' },
    { value: 'muslim', label: 'Muslim' },
    { value: 'traditional', label: 'Traditional' },
    { value: 'atheist', label: 'Atheist' },
    { value: 'spiritual', label: 'Spiritual' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: 48, backgroundColor: theme.surface }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="chevron-left" size={28} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Discovery Filters</ThemedText>
        <View style={{ width: 40 }} />
      </View>
      <ScreenScrollView>
        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.cardHeader}><Feather name="users" size={24} color={theme.primary} /><ThemedText style={styles.cardTitle}>Age Range</ThemedText></View>
            <ThemedText style={[styles.valueText, { color: theme.primary }]}>{minAge} - {maxAge}</ThemedText>
            <Slider style={styles.slider} minimumValue={18} maximumValue={100} step={1} value={minAge} onValueChange={setMinAge} minimumTrackTintColor={theme.primary} />
            <Slider style={styles.slider} minimumValue={18} maximumValue={100} step={1} value={maxAge} onValueChange={setMaxAge} minimumTrackTintColor={theme.primary} />
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.cardHeader}><Feather name="map-pin" size={24} color={theme.primary} /><ThemedText style={styles.cardTitle}>Distance</ThemedText></View>
            <ThemedText style={[styles.valueText, { color: theme.primary }]}>{distance} km</ThemedText>
            <Slider style={styles.slider} minimumValue={1} maximumValue={200} step={1} value={distance} onValueChange={setDistance} minimumTrackTintColor={theme.primary} />
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.cardHeader}><Feather name="star" size={24} color={theme.primary} /><ThemedText style={styles.cardTitle}>Looking For</ThemedText></View>
            <View style={styles.genderButtons}>
              {LOOKING_FOR_OPTIONS.map(opt => (
                <Pressable key={opt.value} style={[styles.genderButton, { backgroundColor: lookingFor === opt.value ? theme.primary : 'transparent', borderColor: theme.border }]} onPress={() => setLookingFor(opt.value)}>
                  <ThemedText style={{ color: lookingFor === opt.value ? '#FFF' : theme.text }}>{opt.label}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.cardHeader}><Feather name="sun" size={24} color={theme.primary} /><ThemedText style={styles.cardTitle}>Religion</ThemedText></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {RELIGION_OPTIONS.map(opt => (
                <Pressable key={opt.value} style={[styles.genderButton, { paddingHorizontal: 16, backgroundColor: religion === opt.value ? theme.primary : 'transparent', borderColor: theme.border }]} onPress={() => setReligion(opt.value)}>
                  <ThemedText style={{ color: religion === opt.value ? '#FFF' : theme.text }}>{opt.label}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Pressable style={[styles.applyButton, { backgroundColor: theme.primary }]} onPress={handleApply}>
            <ThemedText style={{ color: '#FFF', fontWeight: '700' }}>{saving ? 'Saving...' : 'Apply Filters'}</ThemedText>
          </Pressable>
        </View>
      </ScreenScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  card: { padding: Spacing.lg, borderRadius: BorderRadius.lg, gap: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  cardTitle: { ...Typography.h3, fontWeight: '700' },
  valueText: { ...Typography.h2, fontWeight: '700' },
  slider: { width: '100%', height: 40 },
  genderButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  genderButton: { padding: 12, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  applyButton: { height: 56, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md }
});

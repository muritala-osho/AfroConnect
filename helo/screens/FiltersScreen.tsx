
import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
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

const ACCENT_COLOR = "#10B981"; // Emerald Green

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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Filters</ThemedText>
        <Pressable style={styles.resetButton} onPress={() => {/* Logic to reset */}}>
          <ThemedText style={{ color: ACCENT_COLOR, fontWeight: '600' }}>Reset</ThemedText>
        </Pressable>
      </View>

      <ScreenScrollView>
        <View style={styles.content}>

          {/* AGE RANGE SECTION */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionLabel}>Age Range</ThemedText>
              <ThemedText style={styles.sectionValue}>{minAge} — {maxAge}</ThemedText>
            </View>
            <View style={styles.sliderContainer}>
              <Slider 
                style={styles.slider} 
                minimumValue={18} 
                maximumValue={80} 
                step={1} 
                value={minAge} 
                onValueChange={setMinAge} 
                minimumTrackTintColor={ACCENT_COLOR}
                maximumTrackTintColor={theme.border}
                thumbTintColor={Platform.OS === 'ios' ? '#FFF' : ACCENT_COLOR}
              />
              <Slider 
                style={styles.slider} 
                minimumValue={18} 
                maximumValue={100} 
                step={1} 
                value={maxAge} 
                onValueChange={setMaxAge} 
                minimumTrackTintColor={ACCENT_COLOR}
                maximumTrackTintColor={theme.border}
                thumbTintColor={Platform.OS === 'ios' ? '#FFF' : ACCENT_COLOR}
              />
            </View>
          </View>

          {/* DISTANCE SECTION */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionLabel}>Maximum Distance</ThemedText>
              <ThemedText style={styles.sectionValue}>{distance} km</ThemedText>
            </View>
            <Slider 
              style={styles.slider} 
              minimumValue={1} 
              maximumValue={200} 
              step={1} 
              value={distance} 
              onValueChange={setDistance} 
              minimumTrackTintColor={ACCENT_COLOR}
              maximumTrackTintColor={theme.border}
              thumbTintColor={Platform.OS === 'ios' ? '#FFF' : ACCENT_COLOR}
            />
          </View>

          {/* LOOKING FOR SECTION */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Looking For</ThemedText>
            <View style={styles.pillGrid}>
              {[
                { value: 'relationship', label: 'Relationship' },
                { value: 'friendship', label: 'Friendship' },
                { value: 'casual', label: 'Something Casual' },
                { value: 'networking', label: 'Business' },
              ].map(opt => (
                <Pressable 
                  key={opt.value} 
                  style={[
                    styles.pill, 
                    { backgroundColor: lookingFor === opt.value ? ACCENT_COLOR : theme.surface, borderColor: theme.border }
                  ]} 
                  onPress={() => {
                    setLookingFor(opt.value);
                    Haptics.selectionAsync();
                  }}
                >
                  <ThemedText style={[styles.pillText, { color: lookingFor === opt.value ? '#FFF' : theme.text }]}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {/* RELIGION SECTION */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>Religion</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {[
                { value: 'any', label: 'Any' },
                { value: 'christian', label: 'Christian' },
                { value: 'muslim', label: 'Muslim' },
                { value: 'spiritual', label: 'Spiritual' },
                { value: 'atheist', label: 'Atheist' },
              ].map(opt => (
                <Pressable 
                  key={opt.value} 
                  style={[
                    styles.pill, 
                    { backgroundColor: religion === opt.value ? ACCENT_COLOR : theme.surface, borderColor: theme.border }
                  ]} 
                  onPress={() => {
                    setReligion(opt.value);
                    Haptics.selectionAsync();
                  }}
                >
                  <ThemedText style={[styles.pillText, { color: religion === opt.value ? '#FFF' : theme.text }]}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={{ height: 40 }} />
        </View>
      </ScreenScrollView>

      {/* FLOATING ACTION BUTTON */}
      <View style={[styles.footer, { backgroundColor: theme.background }]}>
        <Pressable 
          style={[styles.applyButton, { backgroundColor: ACCENT_COLOR }]} 
          onPress={handleApply}
          disabled={saving}
        >
          <ThemedText style={styles.applyButtonText}>
            {saving ? 'Updating...' : 'Show People'}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  resetButton: {
    padding: 8,
  },
  content: { padding: Spacing.lg },
  section: { 
    marginBottom: Spacing.xxl,
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionLabel: { 
    fontSize: 16, 
    fontWeight: '700',
    color: '#1A1A1A'
  },
  sectionValue: { 
    fontSize: 16, 
    fontWeight: '700',
    color: ACCENT_COLOR 
  },
  sliderContainer: {
    gap: -10, // Overlap sliders slightly for a cleaner look
  },
  slider: { 
    width: '100%', 
    height: 40 
  },
  pillGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: Spacing.sm,
    marginTop: Spacing.sm 
  },
  horizontalScroll: { 
    gap: 10,
    paddingVertical: 5
  },
  pill: { 
    paddingHorizontal: 20, 
    paddingVertical: 12, 
    borderRadius: BorderRadius.full, 
    borderWidth: 1.5, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  pillText: { 
    fontSize: 14, 
    fontWeight: '600' 
  },
  footer: {
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  applyButton: { 
    height: 56, 
    borderRadius: BorderRadius.full, 
    alignItems: 'center', 
    justifyContent: 'center',
    shadowColor: ACCENT_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  applyButtonText: {
    color: '#FFF', 
    fontWeight: '800', 
    fontSize: 16
  }
});
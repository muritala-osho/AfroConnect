import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";

type FiltersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Filters">;

interface FiltersScreenProps {
  navigation: FiltersScreenNavigationProp;
}

export default function FiltersScreen({ navigation }: FiltersScreenProps) {
  const { theme } = useTheme();
  const { user, token, updateProfile } = useAuth();
  const api = useApi();
  const insets = useSafeAreaInsets();

  const [minAge, setMinAge] = useState(user?.preferences?.ageRange?.min || 18);
  const [maxAge, setMaxAge] = useState(user?.preferences?.ageRange?.max || 35);
  const [distance, setDistance] = useState(user?.preferences?.maxDistance || 50);
  const [genderPref, setGenderPref] = useState<string>(user?.preferences?.genderPreference || "both");
  const [lookingFor, setLookingFor] = useState<string>(user?.lifestyle?.lookingFor || "relationship");
  const [religion, setReligion] = useState<string>(user?.lifestyle?.religion || "any");
  const [ethnicity, setEthnicity] = useState<string>(user?.lifestyle?.ethnicity || "any");
  const [education, setEducation] = useState<string>(user?.preferences?.education || "any");
  const [smoking, setSmoking] = useState<string>(user?.preferences?.smoking || "any");
  const [drinking, setDrinking] = useState<string>(user?.preferences?.drinking || "any");
  const [wantsKids, setWantsKids] = useState<string>(
    user?.preferences?.wantsKids != null ? String(user.preferences.wantsKids) : "any"
  );
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
        education: education === "any" ? undefined : education,
        smoking: smoking === "any" ? undefined : smoking,
        drinking: drinking === "any" ? undefined : drinking,
        wantsKids: wantsKids === "any" ? undefined : wantsKids === "true",
      };

      const lifestyleUpdates = {
        lookingFor,
        religion: religion === "any" ? undefined : religion,
        ethnicity: ethnicity === "any" ? undefined : ethnicity,
      };

      const response = await api.put<{ success: boolean }>(
        "/users/me",
        {
          preferences: updatedPreferences,
          lifestyle: lifestyleUpdates,
        },
        token
      );

      if (response.success) {
        await updateProfile({
          preferences: updatedPreferences,
          lifestyle: { ...user?.lifestyle, ...lifestyleUpdates },
        });
        navigation.goBack();
      }
    } catch (error) {
      console.error("Filter update error:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMinAge(18);
    setMaxAge(35);
    setDistance(50);
    setGenderPref("both");
    setLookingFor("relationship");
    setReligion("any");
    setEthnicity("any");
    setEducation("any");
    setSmoking("any");
    setDrinking("any");
    setWantsKids("any");
  };

  const getLookingForLabel = (value: string) => {
    const labels: { [key: string]: string } = {
      relationship: "Relationship",
      friendship: "Friendship",
      casual: "Casual",
      networking: "Business",
    };
    return labels[value] || value;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={[styles.iconButton, { backgroundColor: "rgba(255,255,255,0.08)" }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </Pressable>

        <ThemedText style={styles.headerTitle}>Filters</ThemedText>

        <Pressable style={styles.resetButton} onPress={handleReset}>
          <ThemedText style={styles.resetText}>Reset</ThemedText>
        </Pressable>
      </View>

      {/* ACTIVE FILTERS SUMMARY */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <ThemedText style={styles.summaryEmoji}>🎯</ThemedText>
            <ThemedText style={styles.summaryLabel}>ACTIVE FILTERS</ThemedText>
          </View>
          <ThemedText style={styles.summaryText}>
            Ages {minAge}-{maxAge} • Within {distance}km • {getLookingForLabel(lookingFor)}
          </ThemedText>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* AGE RANGE SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionEmoji}>👤</ThemedText>
            <View style={styles.sectionInfo}>
              <ThemedText style={styles.sectionTitle}>Age Range</ThemedText>
              <ThemedText style={styles.sectionSubtitle}>Set minimum and maximum age</ThemedText>
            </View>
            <View style={styles.ageBadge}>
              <ThemedText style={styles.ageBadgeText}>
                {minAge} - {maxAge}
              </ThemedText>
            </View>
          </View>

          <View style={styles.sliderCard}>
            <View style={styles.sliderLabelRow}>
              <ThemedText style={styles.sliderLabel}>MINIMUM</ThemedText>
              <ThemedText style={styles.sliderValue}>{minAge}</ThemedText>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={18}
              maximumValue={80}
              step={1}
              value={minAge}
              onValueChange={(v) => {
                setMinAge(Math.round(v));
                Haptics.selectionAsync();
              }}
              minimumTrackTintColor="#4A90E2"
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor="#4A90E2"
            />
          </View>

          <View style={styles.sliderCard}>
            <View style={styles.sliderLabelRow}>
              <ThemedText style={styles.sliderLabel}>MAXIMUM</ThemedText>
              <ThemedText style={styles.sliderValue}>{maxAge}</ThemedText>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={18}
              maximumValue={100}
              step={1}
              value={maxAge}
              onValueChange={(v) => {
                setMaxAge(Math.round(v));
                Haptics.selectionAsync();
              }}
              minimumTrackTintColor="#4A90E2"
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor="#4A90E2"
            />
          </View>
        </View>

        {/* DISTANCE SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionEmoji}>📍</ThemedText>
            <View style={styles.sectionInfo}>
              <ThemedText style={styles.sectionTitle}>Maximum Distance</ThemedText>
              <ThemedText style={styles.sectionSubtitle}>How far are you willing to travel?</ThemedText>
            </View>
            <View style={[styles.ageBadge, { backgroundColor: "rgba(255,107,157,0.15)" }]}>
              <ThemedText style={[styles.ageBadgeText, { color: "#FF6B9D" }]}>
                {distance} km
              </ThemedText>
            </View>
          </View>

          <View style={styles.sliderCard}>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={200}
              step={1}
              value={distance}
              onValueChange={(v) => {
                setDistance(Math.round(v));
                Haptics.selectionAsync();
              }}
              minimumTrackTintColor="#FF6B9D"
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor="#FF6B9D"
            />
            <View style={styles.sliderRangeLabels}>
              <ThemedText style={styles.rangeLabel}>1km</ThemedText>
              <ThemedText style={styles.rangeLabel}>200km</ThemedText>
            </View>
          </View>
        </View>

        {/* LOOKING FOR SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionEmoji}>💕</ThemedText>
            <View style={styles.sectionInfo}>
              <ThemedText style={styles.sectionTitle}>Looking For</ThemedText>
              <ThemedText style={styles.sectionSubtitle}>What type of connection?</ThemedText>
            </View>
          </View>

          <View style={styles.pillGrid}>
            {[
              { value: "relationship", label: "Relationship", emoji: "💑" },
              { value: "friendship", label: "Friendship", emoji: "🤝" },
              { value: "casual", label: "Casual", emoji: "✨" },
              { value: "networking", label: "Business", emoji: "💼" },
            ].map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.pill,
                  lookingFor === option.value ? styles.pillActive : styles.pillInactive,
                ]}
                onPress={() => {
                  setLookingFor(option.value);
                  Haptics.selectionAsync();
                }}
              >
                <ThemedText
                  style={[
                    styles.pillText,
                    lookingFor === option.value ? styles.pillTextActive : styles.pillTextInactive,
                  ]}
                >
                  {option.emoji} {option.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* GENDER PREFERENCE SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionEmoji}>⚧️</ThemedText>
            <View style={styles.sectionInfo}>
              <ThemedText style={styles.sectionTitle}>Show Me</ThemedText>
              <ThemedText style={styles.sectionSubtitle}>Gender preferences</ThemedText>
            </View>
          </View>

          <View style={styles.genderGrid}>
            {[
              { value: "male", emoji: "👨", label: "Men" },
              { value: "female", emoji: "👩", label: "Women" },
              { value: "both", emoji: "🌈", label: "Everyone" },
            ].map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.genderCard,
                  genderPref === option.value
                    ? option.value === "both"
                      ? styles.genderCardActiveBoth
                      : styles.genderCardActive
                    : styles.genderCardInactive,
                ]}
                onPress={() => {
                  setGenderPref(option.value);
                  Haptics.selectionAsync();
                }}
              >
                <ThemedText style={styles.genderEmoji}>{option.emoji}</ThemedText>
                <ThemedText
                  style={[
                    styles.genderLabel,
                    genderPref === option.value
                      ? option.value === "both"
                        ? styles.genderLabelActiveBoth
                        : styles.genderLabelActive
                      : styles.genderLabelInactive,
                  ]}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* RELIGION SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionEmoji}>🙏</ThemedText>
            <View style={styles.sectionInfo}>
              <ThemedText style={styles.sectionTitle}>Religion</ThemedText>
              <ThemedText style={styles.sectionSubtitle}>Religious preferences</ThemedText>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScroll}
          >
            {[
              { value: "any", label: "Any", emoji: "✓" },
              { value: "christian", label: "Christian", emoji: "✝️" },
              { value: "muslim", label: "Muslim", emoji: "☪️" },
              { value: "spiritual", label: "Spiritual", emoji: "🌟" },
              { value: "atheist", label: "Atheist", emoji: "🔬" },
            ].map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.religionPill,
                  religion === option.value
                    ? styles.religionPillActive
                    : styles.religionPillInactive,
                ]}
                onPress={() => {
                  setReligion(option.value);
                  Haptics.selectionAsync();
                }}
              >
                <ThemedText
                  style={[
                    styles.religionText,
                    religion === option.value
                      ? styles.religionTextActive
                      : styles.religionTextInactive,
                  ]}
                >
                  {option.emoji} {option.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FLOATING BUTTON */}
      <View style={styles.footer}>
        <LinearGradient colors={["rgba(13,13,15,0)", "rgba(13,13,15,0.8)", "#0D0D0F"]} style={styles.gradientOverlay} />
        <Pressable
          style={[styles.applyButton, saving && styles.applyButtonDisabled]}
          onPress={handleApply}
          disabled={saving}
        >
          <LinearGradient colors={["#4A90E2", "#357ABD"]} style={styles.applyButtonGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <ThemedText style={styles.applyEmoji}>✨</ThemedText>
            <ThemedText style={styles.applyButtonText}>
              {saving ? "Updating..." : "Show 247 People"}
            </ThemedText>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // HEADER
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    flex: 1,
    textAlign: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.1)",
  },
  resetButton: {
    padding: 8,
  },
  resetText: {
    color: "#4A90E2",
    fontWeight: "600",
    fontSize: 14,
  },

  // SUMMARY
  summaryContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  summaryCard: {
    backgroundColor: "rgba(74,144,226,0.12)",
    borderWidth: 0.5,
    borderColor: "rgba(74,144,226,0.25)",
    borderRadius: 16,
    padding: 16,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  summaryEmoji: {
    fontSize: 16,
  },
  summaryLabel: {
    fontSize: 13,
    color: "#4A90E2",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  summaryText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    lineHeight: 22,
  },

  // SCROLL
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  // SECTION
  section: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  sectionEmoji: {
    fontSize: 20,
  },
  sectionInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
  },
  ageBadge: {
    backgroundColor: "rgba(74,144,226,0.15)",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  ageBadgeText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4A90E2",
  },

  // SLIDERS
  sliderCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  sliderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderRangeLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  rangeLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
  },

  // PILLS
  pillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pill: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: "rgba(74,144,226,0.25)",
    borderColor: "rgba(74,144,226,0.4)",
  },
  pillInactive: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  pillText: {
    fontSize: 14,
  },
  pillTextActive: {
    fontWeight: "600",
    color: "#4A90E2",
  },
  pillTextInactive: {
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
  },

  // GENDER GRID
  genderGrid: {
    flexDirection: "row",
    gap: 10,
  },
  genderCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  genderCardActive: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.15)",
  },
  genderCardActiveBoth: {
    backgroundColor: "rgba(242,153,74,0.2)",
    borderColor: "rgba(242,153,74,0.35)",
  },
  genderCardInactive: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  genderEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  genderLabel: {
    fontSize: 13,
  },
  genderLabelActive: {
    fontWeight: "600",
    color: "#FFFFFF",
  },
  genderLabelActiveBoth: {
    fontWeight: "600",
    color: "#F2994A",
  },
  genderLabelInactive: {
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
  },

  // RELIGION
  horizontalScroll: {
    gap: 10,
    paddingVertical: 5,
  },
  religionPill: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  religionPillActive: {
    backgroundColor: "rgba(76,217,100,0.2)",
    borderColor: "rgba(76,217,100,0.35)",
  },
  religionPillInactive: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.1)",
  },
  religionText: {
    fontSize: 14,
  },
  religionTextActive: {
    fontWeight: "600",
    color: "#4CD964",
  },
  religionTextInactive: {
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
  },

  // FOOTER
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 32 : 20,
  },
  gradientOverlay: {
    position: "absolute",
    top: -80,
    left: 0,
    right: 0,
    height: 80,
    pointerEvents: "none",
  },
  applyButton: {
    height: 56,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#4A90E2",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  applyButtonDisabled: {
    opacity: 0.6,
  },
  applyButtonGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyEmoji: {
    fontSize: 18,
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
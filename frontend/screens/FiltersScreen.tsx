import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
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
      {/* PREMIUM HEADER */}
      <LinearGradient
        colors={[theme.primary + '15', theme.primary + '05', 'transparent']}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={22} color="#FFFFFF" />
        </Pressable>

        <View style={styles.headerCenter}>
          <ThemedText style={styles.headerTitle}>Discover Filters</ThemedText>
          <ThemedText style={styles.headerSubtitle}>Find your perfect match</ThemedText>
        </View>

        <Pressable style={styles.resetButton} onPress={handleReset}>
          <Feather name="refresh-cw" size={18} color={theme.primary} />
        </Pressable>
      </LinearGradient>

      {/* ACTIVE FILTERS SUMMARY */}
      <View style={styles.summaryContainer}>
        <LinearGradient
          colors={[theme.primary + '20', theme.primary + '10']}
          style={styles.summaryCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.summaryRow}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.primary }]}>
              <Feather name="sliders" size={16} color="#FFF" />
            </View>
            <View style={styles.summaryContent}>
              <ThemedText style={styles.summaryLabel}>ACTIVE FILTERS</ThemedText>
              <ThemedText style={styles.summaryText}>
                {minAge}-{maxAge} years • {distance}km • {getLookingForLabel(lookingFor)}
              </ThemedText>
            </View>
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* AGE RANGE */}
        <View style={[styles.filterCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.filterHeader}>
            <View style={styles.filterTitleRow}>
              <View style={[styles.filterIcon, { backgroundColor: theme.primary + '15' }]}>
                <Feather name="user" size={18} color={theme.primary} />
              </View>
              <View style={styles.filterTitleContent}>
                <ThemedText style={[styles.filterTitle, { color: theme.text }]}>Age Range</ThemedText>
                <ThemedText style={[styles.filterSubtitle, { color: theme.textSecondary }]}>
                  Who you want to meet
                </ThemedText>
              </View>
            </View>
            <View style={[styles.filterValueBadge, { backgroundColor: theme.primary + '15' }]}>
              <ThemedText style={[styles.filterValueText, { color: theme.primary }]}>
                {minAge}-{maxAge}
              </ThemedText>
            </View>
          </View>

          <View style={styles.sliderContainer}>
            <View style={styles.sliderRow}>
              <ThemedText style={[styles.sliderLabel, { color: theme.textSecondary }]}>MIN AGE</ThemedText>
              <ThemedText style={[styles.sliderValue, { color: theme.text }]}>{minAge}</ThemedText>
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
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor={theme.primary}
            />
          </View>

          <View style={styles.sliderContainer}>
            <View style={styles.sliderRow}>
              <ThemedText style={[styles.sliderLabel, { color: theme.textSecondary }]}>MAX AGE</ThemedText>
              <ThemedText style={[styles.sliderValue, { color: theme.text }]}>{maxAge}</ThemedText>
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
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor="rgba(255,255,255,0.1)"
              thumbTintColor={theme.primary}
            />
          </View>
        </View>

        {/* DISTANCE */}
        <View style={[styles.filterCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.filterHeader}>
            <View style={styles.filterTitleRow}>
              <View style={[styles.filterIcon, { backgroundColor: '#FF6B9D15' }]}>
                <Feather name="map-pin" size={18} color="#FF6B9D" />
              </View>
              <View style={styles.filterTitleContent}>
                <ThemedText style={[styles.filterTitle, { color: theme.text }]}>Maximum Distance</ThemedText>
                <ThemedText style={[styles.filterSubtitle, { color: theme.textSecondary }]}>
                  How far you'll go
                </ThemedText>
              </View>
            </View>
            <View style={[styles.filterValueBadge, { backgroundColor: '#FF6B9D15' }]}>
              <ThemedText style={[styles.filterValueText, { color: '#FF6B9D' }]}>
                {distance}km
              </ThemedText>
            </View>
          </View>

          <View style={styles.sliderContainer}>
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
            <View style={styles.sliderRangeRow}>
              <ThemedText style={[styles.rangeLabel, { color: theme.textSecondary }]}>1km</ThemedText>
              <ThemedText style={[styles.rangeLabel, { color: theme.textSecondary }]}>200km</ThemedText>
            </View>
          </View>
        </View>

        {/* GENDER PREFERENCE */}
        <View style={[styles.filterCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.filterHeader}>
            <View style={styles.filterTitleRow}>
              <View style={[styles.filterIcon, { backgroundColor: '#8b5cf615' }]}>
                <Feather name="users" size={18} color="#8b5cf6" />
              </View>
              <View style={styles.filterTitleContent}>
                <ThemedText style={[styles.filterTitle, { color: theme.text }]}>Show Me</ThemedText>
                <ThemedText style={[styles.filterSubtitle, { color: theme.textSecondary }]}>
                  Gender preference
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.optionsGrid}>
            {[
              { value: "male", label: "Men", icon: "👨" },
              { value: "female", label: "Women", icon: "👩" },
              { value: "both", label: "Everyone", icon: "🌈" },
            ].map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: genderPref === option.value
                      ? theme.primary + '20'
                      : 'rgba(255,255,255,0.03)',
                    borderColor: genderPref === option.value
                      ? theme.primary
                      : 'rgba(255,255,255,0.1)',
                  },
                ]}
                onPress={() => {
                  setGenderPref(option.value);
                  Haptics.selectionAsync();
                }}
              >
                <ThemedText style={styles.optionEmoji}>{option.icon}</ThemedText>
                <ThemedText
                  style={[
                    styles.optionLabel,
                    {
                      color: genderPref === option.value ? theme.primary : theme.text,
                      fontWeight: genderPref === option.value ? '700' : '500',
                    },
                  ]}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* LOOKING FOR */}
        <View style={[styles.filterCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.filterHeader}>
            <View style={styles.filterTitleRow}>
              <View style={[styles.filterIcon, { backgroundColor: '#F2994A15' }]}>
                <Feather name="heart" size={18} color="#F2994A" />
              </View>
              <View style={styles.filterTitleContent}>
                <ThemedText style={[styles.filterTitle, { color: theme.text }]}>Looking For</ThemedText>
                <ThemedText style={[styles.filterSubtitle, { color: theme.textSecondary }]}>
                  Type of connection
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.pillsContainer}>
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
                  {
                    backgroundColor: lookingFor === option.value
                      ? theme.primary + '20'
                      : 'rgba(255,255,255,0.05)',
                    borderColor: lookingFor === option.value
                      ? theme.primary
                      : 'rgba(255,255,255,0.1)',
                  },
                ]}
                onPress={() => {
                  setLookingFor(option.value);
                  Haptics.selectionAsync();
                }}
              >
                <ThemedText style={styles.pillEmoji}>{option.emoji}</ThemedText>
                <ThemedText
                  style={[
                    styles.pillLabel,
                    {
                      color: lookingFor === option.value ? theme.primary : theme.text,
                      fontWeight: lookingFor === option.value ? '700' : '500',
                    },
                  ]}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* RELIGION */}
        <View style={[styles.filterCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.filterHeader}>
            <View style={styles.filterTitleRow}>
              <View style={[styles.filterIcon, { backgroundColor: '#4ade8015' }]}>
                <Feather name="sun" size={18} color="#4ade80" />
              </View>
              <View style={styles.filterTitleContent}>
                <ThemedText style={[styles.filterTitle, { color: theme.text }]}>Religion</ThemedText>
                <ThemedText style={[styles.filterSubtitle, { color: theme.textSecondary }]}>
                  Religious preference
                </ThemedText>
              </View>
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
                  styles.scrollPill,
                  {
                    backgroundColor: religion === option.value
                      ? theme.primary + '20'
                      : 'rgba(255,255,255,0.05)',
                    borderColor: religion === option.value
                      ? theme.primary
                      : 'rgba(255,255,255,0.1)',
                  },
                ]}
                onPress={() => {
                  setReligion(option.value);
                  Haptics.selectionAsync();
                }}
              >
                <ThemedText style={styles.scrollPillEmoji}>{option.emoji}</ThemedText>
                <ThemedText
                  style={[
                    styles.scrollPillLabel,
                    {
                      color: religion === option.value ? theme.primary : theme.text,
                      fontWeight: religion === option.value ? '700' : '500',
                    },
                  ]}
                >
                  {option.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* LIFESTYLE PREFERENCES */}
        <View style={[styles.filterCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <View style={styles.filterHeader}>
            <View style={styles.filterTitleRow}>
              <View style={[styles.filterIcon, { backgroundColor: '#00B2FF15' }]}>
                <Feather name="coffee" size={18} color="#00B2FF" />
              </View>
              <View style={styles.filterTitleContent}>
                <ThemedText style={[styles.filterTitle, { color: theme.text }]}>Lifestyle</ThemedText>
                <ThemedText style={[styles.filterSubtitle, { color: theme.textSecondary }]}>
                  Habits & preferences
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.lifestyleGrid}>
            <View style={styles.lifestyleItem}>
              <View style={styles.lifestyleLabel}>
                <Feather name="wind" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.lifestyleLabelText, { color: theme.textSecondary }]}>
                  Smoking
                </ThemedText>
              </View>
              <ThemedText style={[styles.lifestyleValue, { color: theme.text }]}>
                {smoking === 'any' ? 'Any' : smoking.charAt(0).toUpperCase() + smoking.slice(1)}
              </ThemedText>
            </View>

            <View style={styles.lifestyleItem}>
              <View style={styles.lifestyleLabel}>
                <Feather name="coffee" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.lifestyleLabelText, { color: theme.textSecondary }]}>
                  Drinking
                </ThemedText>
              </View>
              <ThemedText style={[styles.lifestyleValue, { color: theme.text }]}>
                {drinking === 'any' ? 'Any' : drinking.charAt(0).toUpperCase() + drinking.slice(1)}
              </ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* FLOATING APPLY BUTTON */}
      <View style={[styles.footer, { paddingBottom: Platform.OS === "ios" ? insets.bottom + 16 : 20 }]}>
        <LinearGradient
          colors={["rgba(10,10,10,0)", "rgba(10,10,10,0.95)", theme.background]}
          style={styles.footerGradient}
        />
        <Pressable
          style={[styles.applyButton, saving && styles.applyButtonDisabled]}
          onPress={handleApply}
          disabled={saving}
        >
          <LinearGradient
            colors={[theme.primary, theme.primary + 'CC']}
            style={styles.applyButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {saving ? (
              <ThemedText style={styles.applyButtonText}>Updating...</ThemedText>
            ) : (
              <>
                <Feather name="check" size={20} color="#FFF" />
                <ThemedText style={styles.applyButtonText}>Apply Filters</ThemedText>
              </>
            )}
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
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    marginTop: 2,
  },
  resetButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },

  // SUMMARY
  summaryContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  summaryCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 15,
    color: "rgba(255,255,255,0.95)",
    fontWeight: "500",
    lineHeight: 20,
  },

  // SCROLL
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },

  // FILTER CARD
  filterCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
  },
  filterHeader: {
    marginBottom: 20,
  },
  filterTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  filterIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  filterTitleContent: {
    flex: 1,
  },
  filterTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  filterSubtitle: {
    fontSize: 13,
  },
  filterValueBadge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  filterValueText: {
    fontSize: 15,
    fontWeight: "700",
  },

  // SLIDERS
  sliderContainer: {
    marginBottom: 16,
  },
  sliderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderRangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  rangeLabel: {
    fontSize: 11,
  },

  // OPTIONS GRID
  optionsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  optionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1.5,
  },
  optionEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  optionLabel: {
    fontSize: 14,
  },

  // PILLS
  pillsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  pillEmoji: {
    fontSize: 16,
  },
  pillLabel: {
    fontSize: 14,
  },

  // HORIZONTAL SCROLL
  horizontalScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  scrollPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  scrollPillEmoji: {
    fontSize: 16,
  },
  scrollPillLabel: {
    fontSize: 14,
  },

  // LIFESTYLE
  lifestyleGrid: {
    gap: 12,
  },
  lifestyleItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  lifestyleLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lifestyleLabelText: {
    fontSize: 14,
  },
  lifestyleValue: {
    fontSize: 14,
    fontWeight: "600",
  },

  // FOOTER
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  footerGradient: {
    position: "absolute",
    top: -60,
    left: 0,
    right: 0,
    height: 60,
    pointerEvents: "none",
  },
  applyButton: {
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  applyButtonDisabled: {
    opacity: 0.6,
  },
  applyButtonGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
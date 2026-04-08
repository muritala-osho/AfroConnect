import React, { useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  Switch,
  Animated,
  Dimensions,
} from "react-native";
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
import { Spacing, BorderRadius, Shadow } from "@/constants/theme";

const { width } = Dimensions.get("window");

type FiltersScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Filters">;
interface FiltersScreenProps {
  navigation: FiltersScreenNavigationProp;
}

const INTEREST_OPTIONS = [
  { label: "🎵 Music", value: "Music" },
  { label: "✈️ Travel", value: "Travel" },
  { label: "🍕 Food", value: "Food" },
  { label: "⚽ Sports", value: "Sports" },
  { label: "🎨 Art", value: "Art" },
  { label: "🎬 Movies", value: "Movies" },
  { label: "📚 Reading", value: "Reading" },
  { label: "🎮 Gaming", value: "Gaming" },
  { label: "💪 Fitness", value: "Fitness" },
  { label: "📸 Photography", value: "Photography" },
  { label: "💃 Dancing", value: "Dancing" },
  { label: "👨‍🍳 Cooking", value: "Cooking" },
  { label: "👗 Fashion", value: "Fashion" },
  { label: "💻 Technology", value: "Technology" },
];

interface SectionProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
  theme: any;
}

function FilterSection({ icon, iconColor, iconBg, title, subtitle, badge, badgeColor, children, theme }: SectionProps) {
  return (
    <View style={[fStyles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={fStyles.sectionHeader}>
        <View style={[fStyles.sectionIconWrap, { backgroundColor: iconBg }]}>
          <Feather name={icon as any} size={16} color={iconColor} />
        </View>
        <View style={fStyles.sectionTitles}>
          <ThemedText style={[fStyles.sectionTitle, { color: theme.text }]}>{title}</ThemedText>
          <ThemedText style={[fStyles.sectionSubtitle, { color: theme.textSecondary }]}>{subtitle}</ThemedText>
        </View>
        {badge && (
          <View style={[fStyles.sectionBadge, { backgroundColor: `${badgeColor}18`, borderColor: `${badgeColor}30` }]}>
            <ThemedText style={[fStyles.sectionBadgeText, { color: badgeColor }]}>{badge}</ThemedText>
          </View>
        )}
      </View>
      <View style={fStyles.sectionBody}>{children}</View>
    </View>
  );
}

export default function FiltersScreen({ navigation }: FiltersScreenProps) {
  const { theme } = useTheme();
  const { user, token, updateProfile } = useAuth();
  const api = useApi();
  const insets = useSafeAreaInsets();

  const [minAge, setMinAge] = useState(user?.preferences?.ageRange?.min ?? 18);
  const [maxAge, setMaxAge] = useState(user?.preferences?.ageRange?.max ?? 35);
  const [distance, setDistance] = useState(user?.preferences?.maxDistance ?? 50);
  const [genderPref, setGenderPref] = useState<string>(user?.preferences?.genderPreference ?? "both");
  const [lookingFor, setLookingFor] = useState<string>(user?.lifestyle?.lookingFor ?? "relationship");
  const [religion, setReligion] = useState<string>(user?.lifestyle?.religion ?? "any");
  const [smoking, setSmoking] = useState<string>(user?.preferences?.smoking ?? "any");
  const [drinking, setDrinking] = useState<string>(user?.preferences?.drinking ?? "any");
  const [wantsKids, setWantsKids] = useState<string>(
    user?.preferences?.wantsKids != null ? String(user.preferences.wantsKids) : "any"
  );
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    user?.preferences?.interests ?? []
  );
  const [showVerifiedOnly, setShowVerifiedOnly] = useState<boolean>(
    user?.preferences?.showVerifiedOnly ?? false
  );
  const [onlineNow, setOnlineNow] = useState<boolean>(
    user?.preferences?.onlineNow ?? false
  );
  const [saving, setSaving] = useState(false);
  const isPremium = user?.premium?.isActive;

  const buttonScaleAnim = useRef(new Animated.Value(1)).current;

  const handleApply = async () => {
    if (!token) return;
    try {
      setSaving(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.sequence([
        Animated.spring(buttonScaleAnim, { toValue: 0.96, useNativeDriver: true, friction: 6 }),
        Animated.spring(buttonScaleAnim, { toValue: 1, useNativeDriver: true, friction: 6 }),
      ]).start();

      const updatedPreferences = {
        ...user?.preferences,
        ageRange: { min: minAge, max: maxAge },
        maxDistance: distance,
        genderPreference: genderPref,
        smoking: smoking === "any" ? undefined : smoking,
        drinking: drinking === "any" ? undefined : drinking,
        wantsKids: wantsKids === "any" ? undefined : wantsKids === "true",
        showVerifiedOnly: isPremium ? showVerifiedOnly : false,
        onlineNow,
        interests: selectedInterests.length > 0 ? selectedInterests : undefined,
      };

      const lifestyleUpdates = {
        lookingFor,
        religion: religion === "any" ? undefined : religion,
      };

      const response = await api.put<{ success: boolean }>(
        "/users/me",
        { preferences: updatedPreferences, lifestyle: lifestyleUpdates },
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
    setSmoking("any");
    setDrinking("any");
    setWantsKids("any");
    setSelectedInterests([]);
    setShowVerifiedOnly(false);
    setOnlineNow(false);
  };

  const toggleInterest = (val: string) => {
    Haptics.selectionAsync();
    setSelectedInterests((prev) =>
      prev.includes(val) ? prev.filter((i) => i !== val) : [...prev, val]
    );
  };

  const activeFilterCount = [
    minAge !== 18 || maxAge !== 35,
    distance !== 50,
    genderPref !== "both",
    lookingFor !== "relationship",
    religion !== "any",
    smoking !== "any",
    drinking !== "any",
    wantsKids !== "any",
    selectedInterests.length > 0,
    showVerifiedOnly,
    onlineNow,
  ].filter(Boolean).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* ── Header ── */}
      <LinearGradient
        colors={["#10B981", "#059669"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + 12 }]}
      >
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>

        <View style={styles.headerCenter}>
          <ThemedText style={styles.headerTitle}>Discover Filters</ThemedText>
          <ThemedText style={styles.headerSub}>Find your perfect match</ThemedText>
        </View>

        <Pressable style={styles.resetBtn} onPress={handleReset} hitSlop={10}>
          <Feather name="refresh-cw" size={18} color="rgba(255,255,255,0.9)" />
        </Pressable>
      </LinearGradient>

      {/* ── Active summary ── */}
      <View style={[styles.summaryBar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.summaryIconWrap, { backgroundColor: `${theme.primary}18` }]}>
          <Feather name="sliders" size={15} color={theme.primary} />
        </View>
        <ThemedText style={[styles.summaryText, { color: theme.textSecondary }]}>
          {activeFilterCount === 0
            ? "No active filters — showing everyone"
            : `${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active`}
        </ThemedText>
        {activeFilterCount > 0 && (
          <View style={[styles.activeDot, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.activeDotText}>{activeFilterCount}</ThemedText>
          </View>
        )}
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ─── Age Range ─── */}
        <FilterSection
          icon="user"
          iconColor={theme.primary}
          iconBg={`${theme.primary}18`}
          title="Age Range"
          subtitle="Who you want to meet"
          badge={`${minAge}–${maxAge} yrs`}
          badgeColor={theme.primary}
          theme={theme}
        >
          <View style={styles.ageTrackRow}>
            <ThemedText style={[styles.ageEndLabel, { color: theme.textSecondary }]}>18</ThemedText>
            <View style={styles.ageTrackFill}>
              <View style={[styles.ageBar, { backgroundColor: theme.border }]} />
              <View
                style={[
                  styles.ageBarFilled,
                  {
                    backgroundColor: theme.primary,
                    left: `${((minAge - 18) / 62) * 100}%` as any,
                    right: `${((80 - maxAge) / 62) * 100}%` as any,
                  },
                ]}
              />
            </View>
            <ThemedText style={[styles.ageEndLabel, { color: theme.textSecondary }]}>80+</ThemedText>
          </View>

          <View style={styles.sliderGroupRow}>
            <View style={styles.sliderHalf}>
              <View style={styles.sliderLabelRow}>
                <ThemedText style={[styles.sliderMiniLabel, { color: theme.textSecondary }]}>MIN</ThemedText>
                <ThemedText style={[styles.sliderValueLabel, { color: theme.primary }]}>{minAge}</ThemedText>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={maxAge - 1}
                step={1}
                value={minAge}
                onValueChange={(v) => { setMinAge(Math.round(v)); Haptics.selectionAsync(); }}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.primary}
              />
            </View>

            <View style={[styles.sliderDivider, { backgroundColor: theme.border }]} />

            <View style={styles.sliderHalf}>
              <View style={styles.sliderLabelRow}>
                <ThemedText style={[styles.sliderMiniLabel, { color: theme.textSecondary }]}>MAX</ThemedText>
                <ThemedText style={[styles.sliderValueLabel, { color: theme.primary }]}>{maxAge}</ThemedText>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={minAge + 1}
                maximumValue={80}
                step={1}
                value={maxAge}
                onValueChange={(v) => { setMaxAge(Math.round(v)); Haptics.selectionAsync(); }}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.primary}
              />
            </View>
          </View>
        </FilterSection>

        {/* ─── Distance ─── */}
        <FilterSection
          icon="map-pin"
          iconColor="#FF6B9D"
          iconBg="#FF6B9D18"
          title="Maximum Distance"
          subtitle="How far you're willing to go"
          badge={`${distance} km`}
          badgeColor="#FF6B9D"
          theme={theme}
        >
          <Slider
            style={[styles.slider, { marginTop: 4 }]}
            minimumValue={1}
            maximumValue={200}
            step={1}
            value={distance}
            onValueChange={(v) => { setDistance(Math.round(v)); Haptics.selectionAsync(); }}
            minimumTrackTintColor="#FF6B9D"
            maximumTrackTintColor={theme.border}
            thumbTintColor="#FF6B9D"
          />
          <View style={styles.rangeEndRow}>
            <ThemedText style={[styles.rangeEndText, { color: theme.textSecondary }]}>1 km</ThemedText>
            <View style={[styles.distancePill, { backgroundColor: "#FF6B9D18", borderColor: "#FF6B9D30" }]}>
              <Feather name="map-pin" size={11} color="#FF6B9D" />
              <ThemedText style={[styles.distancePillText, { color: "#FF6B9D" }]}>{distance} km radius</ThemedText>
            </View>
            <ThemedText style={[styles.rangeEndText, { color: theme.textSecondary }]}>200 km</ThemedText>
          </View>
        </FilterSection>

        {/* ─── Show Me ─── */}
        <FilterSection
          icon="users"
          iconColor="#8B5CF6"
          iconBg="#8B5CF618"
          title="Show Me"
          subtitle="Gender preference"
          theme={theme}
        >
          <View style={styles.optionRow}>
            {[
              { value: "male", label: "Men", emoji: "👨" },
              { value: "female", label: "Women", emoji: "👩" },
              { value: "both", label: "Everyone", emoji: "🌈" },
            ].map((opt) => {
              const active = genderPref === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.optionCard,
                    {
                      borderColor: active ? "#8B5CF6" : theme.border,
                      backgroundColor: active ? "#8B5CF618" : theme.background,
                    },
                  ]}
                  onPress={() => { setGenderPref(opt.value); Haptics.selectionAsync(); }}
                >
                  <ThemedText style={styles.optionEmoji}>{opt.emoji}</ThemedText>
                  <ThemedText style={[styles.optionLabel, { color: active ? "#8B5CF6" : theme.text, fontWeight: active ? "700" : "500" }]}>
                    {opt.label}
                  </ThemedText>
                  {active && (
                    <View style={[styles.optionCheck, { backgroundColor: "#8B5CF6" }]}>
                      <Feather name="check" size={9} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </FilterSection>

        {/* ─── Looking For ─── */}
        <FilterSection
          icon="heart"
          iconColor="#F59E0B"
          iconBg="#F59E0B18"
          title="Looking For"
          subtitle="Type of connection"
          theme={theme}
        >
          <View style={styles.pillWrap}>
            {[
              { value: "relationship", label: "Relationship", emoji: "💍" },
              { value: "friendship", label: "Friendship", emoji: "🤝" },
              { value: "casual", label: "Casual", emoji: "✨" },
              { value: "networking", label: "Business", emoji: "💼" },
            ].map((opt) => {
              const active = lookingFor === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.pill,
                    {
                      borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active ? `${theme.primary}18` : theme.background,
                    },
                  ]}
                  onPress={() => { setLookingFor(opt.value); Haptics.selectionAsync(); }}
                >
                  <ThemedText style={styles.pillEmoji}>{opt.emoji}</ThemedText>
                  <ThemedText style={[styles.pillLabel, { color: active ? theme.primary : theme.text, fontWeight: active ? "700" : "500" }]}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </FilterSection>

        {/* ─── Interests ─── */}
        <FilterSection
          icon="star"
          iconColor="#10B981"
          iconBg={`${theme.primary}18`}
          title="Shared Interests"
          subtitle={selectedInterests.length > 0 ? `${selectedInterests.length} selected` : "Match by what you love"}
          theme={theme}
        >
          <View style={styles.chipsWrap}>
            {INTEREST_OPTIONS.map((item) => {
              const active = selectedInterests.includes(item.value);
              return (
                <Pressable
                  key={item.value}
                  onPress={() => toggleInterest(item.value)}
                  style={[
                    styles.chip,
                    {
                      borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active ? theme.primary : theme.background,
                    },
                  ]}
                >
                  <ThemedText style={[styles.chipText, { color: active ? "#fff" : theme.text }]}>
                    {item.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </FilterSection>

        {/* ─── Religion ─── */}
        <FilterSection
          icon="sun"
          iconColor="#4ADE80"
          iconBg="#4ADE8018"
          title="Religion"
          subtitle="Spiritual preference"
          theme={theme}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hScrollContent}
          >
            {[
              { value: "any", label: "Any", emoji: "✓" },
              { value: "christian", label: "Christian", emoji: "✝️" },
              { value: "muslim", label: "Muslim", emoji: "☪️" },
              { value: "traditional", label: "Traditional", emoji: "🌿" },
              { value: "spiritual", label: "Spiritual", emoji: "🌟" },
              { value: "atheist", label: "Atheist", emoji: "🔬" },
              { value: "agnostic", label: "Agnostic", emoji: "🤔" },
              { value: "deist", label: "Deist", emoji: "🌌" },
            ].map((opt) => {
              const active = religion === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.hScrollPill,
                    {
                      borderColor: active ? theme.primary : theme.border,
                      backgroundColor: active ? `${theme.primary}18` : theme.background,
                    },
                  ]}
                  onPress={() => { setReligion(opt.value); Haptics.selectionAsync(); }}
                >
                  <ThemedText style={styles.hScrollEmoji}>{opt.emoji}</ThemedText>
                  <ThemedText style={[styles.hScrollLabel, { color: active ? theme.primary : theme.text, fontWeight: active ? "700" : "500" }]}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </FilterSection>

        {/* ─── Lifestyle ─── */}
        <FilterSection
          icon="coffee"
          iconColor="#00B2FF"
          iconBg="#00B2FF18"
          title="Lifestyle"
          subtitle="Habits & preferences"
          theme={theme}
        >
          <View style={styles.lifestyleGroup}>
            <ThemedText style={[styles.lifestyleGroupLabel, { color: theme.textSecondary }]}>🚭 Smoking</ThemedText>
            <View style={styles.lifestylePills}>
              {[
                { value: "any", label: "Any" },
                { value: "never", label: "Never" },
                { value: "socially", label: "Socially" },
                { value: "regularly", label: "Regularly" },
              ].map((opt) => {
                const active = smoking === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.lifestylePill,
                      {
                        borderColor: active ? theme.primary : theme.border,
                        backgroundColor: active ? `${theme.primary}18` : theme.background,
                      },
                    ]}
                    onPress={() => { setSmoking(opt.value); Haptics.selectionAsync(); }}
                  >
                    <ThemedText style={[styles.lifestylePillText, { color: active ? theme.primary : theme.text, fontWeight: active ? "700" : "500" }]}>
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.lifestyleDivider, { backgroundColor: theme.border }]} />

          <View style={styles.lifestyleGroup}>
            <ThemedText style={[styles.lifestyleGroupLabel, { color: theme.textSecondary }]}>🍷 Drinking</ThemedText>
            <View style={styles.lifestylePills}>
              {[
                { value: "any", label: "Any" },
                { value: "never", label: "Never" },
                { value: "socially", label: "Socially" },
                { value: "regularly", label: "Regularly" },
              ].map((opt) => {
                const active = drinking === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.lifestylePill,
                      {
                        borderColor: active ? theme.primary : theme.border,
                        backgroundColor: active ? `${theme.primary}18` : theme.background,
                      },
                    ]}
                    onPress={() => { setDrinking(opt.value); Haptics.selectionAsync(); }}
                  >
                    <ThemedText style={[styles.lifestylePillText, { color: active ? theme.primary : theme.text, fontWeight: active ? "700" : "500" }]}>
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.lifestyleDivider, { backgroundColor: theme.border }]} />

          <View style={styles.lifestyleGroup}>
            <ThemedText style={[styles.lifestyleGroupLabel, { color: theme.textSecondary }]}>👶 Has Kids</ThemedText>
            <View style={styles.lifestylePills}>
              {[
                { value: "any", label: "Any" },
                { value: "false", label: "No Kids" },
                { value: "true", label: "Has Kids" },
              ].map((opt) => {
                const active = wantsKids === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.lifestylePill,
                      {
                        borderColor: active ? theme.primary : theme.border,
                        backgroundColor: active ? `${theme.primary}18` : theme.background,
                      },
                    ]}
                    onPress={() => { setWantsKids(opt.value); Haptics.selectionAsync(); }}
                  >
                    <ThemedText style={[styles.lifestylePillText, { color: active ? theme.primary : theme.text, fontWeight: active ? "700" : "500" }]}>
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </FilterSection>

        {/* ─── Toggles ─── */}
        <FilterSection
          icon="zap"
          iconColor="#F59E0B"
          iconBg="#F59E0B18"
          title="Quick Filters"
          subtitle="Smart discovery options"
          theme={theme}
        >
          {/* Online Now */}
          <View style={[styles.toggleRow, { borderBottomColor: theme.border }]}>
            <View style={styles.toggleInfo}>
              <View style={[styles.toggleIconWrap, { backgroundColor: "#4ADE8018" }]}>
                <View style={[styles.onlineDot]} />
              </View>
              <View>
                <ThemedText style={[styles.toggleTitle, { color: theme.text }]}>Online Now</ThemedText>
                <ThemedText style={[styles.toggleSub, { color: theme.textSecondary }]}>Show active users only</ThemedText>
              </View>
            </View>
            <Switch
              value={onlineNow}
              onValueChange={(v) => { setOnlineNow(v); Haptics.selectionAsync(); }}
              trackColor={{ false: theme.border, true: `${theme.primary}80` }}
              thumbColor={onlineNow ? theme.primary : theme.textSecondary}
              ios_backgroundColor={theme.border}
            />
          </View>

          {/* Verified Only */}
          <Pressable
            style={styles.toggleRow}
            onPress={() => { if (!isPremium) navigation.navigate("Premium" as any); }}
          >
            <View style={styles.toggleInfo}>
              <View style={[styles.toggleIconWrap, { backgroundColor: "#4ADE8018" }]}>
                <Feather name="check-circle" size={15} color="#4ADE80" />
              </View>
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <ThemedText style={[styles.toggleTitle, { color: theme.text }]}>Verified Only</ThemedText>
                  {!isPremium && (
                    <View style={[styles.premiumTag, { backgroundColor: `${theme.primary}18` }]}>
                      <Feather name="lock" size={9} color={theme.primary} />
                      <ThemedText style={[styles.premiumTagText, { color: theme.primary }]}>Premium</ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText style={[styles.toggleSub, { color: theme.textSecondary }]}>Only show verified profiles</ThemedText>
              </View>
            </View>
            {isPremium ? (
              <Switch
                value={showVerifiedOnly}
                onValueChange={(v) => { setShowVerifiedOnly(v); Haptics.selectionAsync(); }}
                trackColor={{ false: theme.border, true: `${theme.primary}80` }}
                thumbColor={showVerifiedOnly ? theme.primary : theme.textSecondary}
                ios_backgroundColor={theme.border}
              />
            ) : (
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            )}
          </Pressable>
        </FilterSection>

      </ScrollView>

      {/* ── Sticky Apply Button ── */}
      <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + 16, backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <View style={styles.footerRow}>
          <Pressable
            style={[styles.resetFooterBtn, { borderColor: theme.border, backgroundColor: theme.surface }]}
            onPress={handleReset}
          >
            <Feather name="refresh-cw" size={16} color={theme.text} />
          </Pressable>

          <Animated.View style={[{ flex: 1 }, { transform: [{ scale: buttonScaleAnim }] }]}>
            <Pressable
              style={styles.applyBtn}
              onPress={handleApply}
              disabled={saving}
            >
              <LinearGradient
                colors={["#10B981", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.applyBtnGradient}
              >
                <Feather name={saving ? "loader" : "check"} size={18} color="#fff" />
                <ThemedText style={styles.applyBtnText}>
                  {saving ? "Applying..." : "Apply Filters"}
                </ThemedText>
                {activeFilterCount > 0 && (
                  <View style={styles.applyCount}>
                    <ThemedText style={styles.applyCountText}>{activeFilterCount}</ThemedText>
                  </View>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const fStyles = StyleSheet.create({
  section: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
    overflow: "hidden",
    ...Shadow.small,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitles: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 1,
  },
  sectionBadge: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  sectionBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionBody: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  resetBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    gap: Spacing.sm,
    borderBottomWidth: 1,
  },
  summaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  activeDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  activeDotText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  ageTrackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  ageEndLabel: {
    fontSize: 11,
    fontWeight: "600",
    width: 28,
    textAlign: "center",
  },
  ageTrackFill: {
    flex: 1,
    height: 6,
    position: "relative",
  },
  ageBar: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 6,
    borderRadius: 3,
  },
  ageBarFilled: {
    position: "absolute",
    height: 6,
    borderRadius: 3,
  },
  sliderGroupRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  sliderHalf: {
    flex: 1,
  },
  sliderDivider: {
    width: 1,
    height: 50,
    alignSelf: "center",
  },
  sliderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  sliderMiniLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  sliderValueLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  slider: {
    width: "100%",
    height: 36,
  },
  rangeEndRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  rangeEndText: {
    fontSize: 11,
    fontWeight: "500",
  },
  distancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  distancePillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  optionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  optionCard: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.md,
    alignItems: "center",
    gap: 6,
    position: "relative",
  },
  optionEmoji: {
    fontSize: 22,
  },
  optionLabel: {
    fontSize: 13,
  },
  optionCheck: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  pillEmoji: {
    fontSize: 14,
  },
  pillLabel: {
    fontSize: 14,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  hScrollContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  hScrollPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  hScrollEmoji: {
    fontSize: 13,
  },
  hScrollLabel: {
    fontSize: 13,
  },
  lifestyleGroup: {
    gap: Spacing.sm,
  },
  lifestyleGroupLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  lifestylePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs + 2,
  },
  lifestylePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  lifestylePillText: {
    fontSize: 13,
  },
  lifestyleDivider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  toggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  toggleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#4ADE80",
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  toggleSub: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 1,
  },
  premiumTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  premiumTagText: {
    fontSize: 10,
    fontWeight: "700",
  },
  stickyFooter: {
    borderTopWidth: 1,
    paddingTop: 14,
    paddingHorizontal: Spacing.xl,
  },
  footerRow: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "center",
  },
  resetFooterBtn: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  applyBtn: {
    borderRadius: BorderRadius.full,
    overflow: "hidden",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  applyBtnGradient: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  applyBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
  applyCount: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  applyCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
});

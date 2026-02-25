import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedText } from "@/components/ThemedText";
import { useTheme, ThemeMode, FontSizeOption, ChatBubbleStyle } from "@/hooks/useTheme";
import { Feather } from "@expo/vector-icons";
import { Spacing, BorderRadius } from "@/constants/theme";
import * as Haptics from "expo-haptics";

const ACCENT_COLORS = [
  { label: "Blue", value: "#4A90D9" },
  { label: "Pink", value: "#FF6B9D" },
  { label: "Green", value: "#10B981" },
  { label: "Purple", value: "#8B5CF6" },
  { label: "Orange", value: "#F97316" },
  { label: "Red", value: "#EF4444" },
  { label: "Teal", value: "#14B8A6" },
  { label: "Gold", value: "#F59E0B" },
];

const FONT_SIZES: { label: string; value: FontSizeOption; scale: number }[] = [
  { label: "Small", value: "small", scale: 0.85 },
  { label: "Default", value: "default", scale: 1 },
  { label: "Large", value: "large", scale: 1.15 },
];

const CHAT_BUBBLE_STYLES: { label: string; value: ChatBubbleStyle }[] = [
  { label: "Rounded", value: "rounded" },
  { label: "Sharp", value: "sharp" },
  { label: "Minimal", value: "minimal" },
];

export default function CustomizeInterfaceScreen({ navigation }: any) {
  const {
    theme, themeMode, isDark, accentColor: themeAccent,
    fontSize, chatBubbleStyle, compactMode, animationsEnabled, hapticFeedback,
    setThemeMode, setAccentColor: setThemeAccent,
    setFontSize, setChatBubbleStyle, setCompactMode, setAnimationsEnabled, setHapticFeedback,
  } = useTheme();
  const accentColor = themeAccent || "#4A90D9";

  const doHaptic = () => {
    if (hapticFeedback && Platform.OS !== "web") {
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    }
  };

  const themeOptions: { value: ThemeMode; label: string; icon: string }[] = [
    { value: "light", label: "Light", icon: "sun" },
    { value: "dark", label: "Dark", icon: "moon" },
    { value: "grey", label: "Grey", icon: "cloud" },
    { value: "system", label: "Auto", icon: "monitor" },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </TouchableOpacity>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Customize</ThemedText>
          <View style={styles.backButton} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>APPEARANCE</ThemedText>

            <ThemedText style={[styles.label, { color: theme.text }]}>Theme</ThemedText>
            <View style={styles.themeRow}>
              {themeOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.themeOption,
                    { backgroundColor: theme.cardBackground, borderColor: theme.border },
                    themeMode === opt.value && { borderColor: accentColor, borderWidth: 2 },
                  ]}
                  onPress={() => { setThemeMode(opt.value); doHaptic(); }}
                >
                  <Feather
                    name={opt.icon as any}
                    size={20}
                    color={themeMode === opt.value ? accentColor : theme.textSecondary}
                  />
                  <ThemedText
                    style={[
                      styles.themeLabel,
                      { color: themeMode === opt.value ? accentColor : theme.textSecondary },
                    ]}
                  >
                    {opt.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>

            <ThemedText style={[styles.label, { color: theme.text, marginTop: 20 }]}>Accent Color</ThemedText>
            <View style={styles.colorRow}>
              {ACCENT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color.value}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color.value },
                    accentColor === color.value && styles.colorSelected,
                  ]}
                  onPress={() => { setThemeAccent(color.value); doHaptic(); }}
                >
                  {accentColor === color.value && (
                    <Feather name="check" size={16} color="#FFF" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>TEXT</ThemedText>

            <ThemedText style={[styles.label, { color: theme.text }]}>Font Size</ThemedText>
            <View style={styles.fontRow}>
              {FONT_SIZES.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.fontOption,
                    { backgroundColor: theme.cardBackground, borderColor: theme.border },
                    fontSize === opt.value && { borderColor: accentColor, borderWidth: 2 },
                  ]}
                  onPress={() => { setFontSize(opt.value); doHaptic(); }}
                >
                  <ThemedText
                    style={[
                      styles.fontSample,
                      { color: theme.text, fontSize: 14 * opt.scale },
                    ]}
                    skipFontScale
                  >
                    Aa
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.fontLabel,
                      { color: fontSize === opt.value ? accentColor : theme.textSecondary },
                    ]}
                    skipFontScale
                  >
                    {opt.label}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>CHAT</ThemedText>

            <ThemedText style={[styles.label, { color: theme.text }]}>Bubble Style</ThemedText>
            <View style={styles.bubbleRow}>
              {CHAT_BUBBLE_STYLES.map((opt) => {
                const radius = opt.value === "rounded" ? 18 : opt.value === "sharp" ? 4 : 12;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.bubbleOption,
                      { backgroundColor: theme.cardBackground, borderColor: theme.border },
                      chatBubbleStyle === opt.value && { borderColor: accentColor, borderWidth: 2 },
                    ]}
                    onPress={() => { setChatBubbleStyle(opt.value); doHaptic(); }}
                  >
                    <View
                      style={[
                        styles.bubblePreview,
                        {
                          backgroundColor: accentColor,
                          borderRadius: radius,
                          borderBottomRightRadius: opt.value === "minimal" ? radius : 4,
                        },
                      ]}
                    >
                      <ThemedText style={styles.bubbleText} skipFontScale>Hello!</ThemedText>
                    </View>
                    <ThemedText
                      style={[
                        styles.bubbleLabel,
                        { color: chatBubbleStyle === opt.value ? accentColor : theme.textSecondary },
                      ]}
                      skipFontScale
                    >
                      {opt.label}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: theme.surface }]}>
            <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>PREFERENCES</ThemedText>

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Feather name="layout" size={20} color={theme.text} />
                <View style={styles.toggleTextWrap}>
                  <ThemedText style={[styles.toggleLabel, { color: theme.text }]}>Compact Mode</ThemedText>
                  <ThemedText style={[styles.toggleDesc, { color: theme.textSecondary }]}>Show more content with less spacing</ThemedText>
                </View>
              </View>
              <Switch
                value={compactMode}
                onValueChange={(val) => { setCompactMode(val); doHaptic(); }}
                trackColor={{ false: theme.border, true: accentColor + "80" }}
                thumbColor={compactMode ? accentColor : theme.textTertiary}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Feather name="zap" size={20} color={theme.text} />
                <View style={styles.toggleTextWrap}>
                  <ThemedText style={[styles.toggleLabel, { color: theme.text }]}>Animations</ThemedText>
                  <ThemedText style={[styles.toggleDesc, { color: theme.textSecondary }]}>Enable smooth transitions and effects</ThemedText>
                </View>
              </View>
              <Switch
                value={animationsEnabled}
                onValueChange={(val) => { setAnimationsEnabled(val); doHaptic(); }}
                trackColor={{ false: theme.border, true: accentColor + "80" }}
                thumbColor={animationsEnabled ? accentColor : theme.textTertiary}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Feather name="smartphone" size={20} color={theme.text} />
                <View style={styles.toggleTextWrap}>
                  <ThemedText style={[styles.toggleLabel, { color: theme.text }]}>Haptic Feedback</ThemedText>
                  <ThemedText style={[styles.toggleDesc, { color: theme.textSecondary }]}>Vibration on interactions</ThemedText>
                </View>
              </View>
              <Switch
                value={hapticFeedback}
                onValueChange={(val) => { setHapticFeedback(val); }}
                trackColor={{ false: theme.border, true: accentColor + "80" }}
                thumbColor={hapticFeedback ? accentColor : theme.textTertiary}
              />
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  themeRow: {
    flexDirection: "row",
    gap: 10,
  },
  themeOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 6,
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  colorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  fontRow: {
    flexDirection: "row",
    gap: 10,
  },
  fontOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 6,
  },
  fontSample: {
    fontWeight: "700",
  },
  fontLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  bubbleRow: {
    flexDirection: "row",
    gap: 10,
  },
  bubbleOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 8,
  },
  bubblePreview: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  bubbleText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  bubbleLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  toggleInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  toggleTextWrap: {
    marginLeft: 12,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  toggleDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
});

import React, { useEffect, useState, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/hooks/useAuth";
import { Ionicons } from "@expo/vector-icons";
import { BorderRadius, Spacing } from "@/constants/theme";

interface BreakdownItem {
  label: string;
  score: number;
  max: number;
  mine?: string | string[] | null;
  theirs?: string | string[] | null;
  shared?: string[];
}

interface CulturalScoreData {
  totalScore: number;
  maxScore: number;
  breakdown: BreakdownItem[];
}

interface Props {
  userId: string;
}

const LABEL_ICONS: Record<string, string> = {
  "Country of Origin": "flag-outline",
  "Tribe / Ethnicity": "people-outline",
  "Language": "chatbubble-outline",
  "Religion": "prism-outline",
  "Diaspora Generation": "earth-outline",
};

const DIASPORA_LABELS: Record<string, string> = {
  "1st_gen": "1st Generation",
  "2nd_gen": "2nd Generation",
  "3rd_gen_plus": "3rd Gen+",
  "born_in_africa": "Born in Africa",
  "not_applicable": "N/A",
};

function formatValue(val: string | string[] | null | undefined): string {
  if (!val) return "Not set";
  if (Array.isArray(val)) return val.length ? val.join(", ") : "Not set";
  return DIASPORA_LABELS[val] || val;
}

const ScoreBar = ({ score, max, color }: { score: number; max: number; color: string }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const pct = max > 0 ? score / max : 0;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <View style={styles.barTrack}>
      <Animated.View
        style={[
          styles.barFill,
          {
            backgroundColor: color,
            width: anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          },
        ]}
      />
    </View>
  );
};

const TotalRing = ({ score, max, color }: { score: number; max: number; color: string }) => {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <View style={[styles.ringWrap, { borderColor: color }]}>
      <ThemedText style={[styles.ringScore, { color }]}>{score}</ThemedText>
      <ThemedText style={styles.ringMax}>/ {max}</ThemedText>
      <ThemedText style={[styles.ringPct, { color }]}>{pct}%</ThemedText>
    </View>
  );
};

export default function CulturalCompatibilityScore({ userId }: Props) {
  const { theme } = useTheme();
  const { token } = useAuth();
  const { get } = useApi();
  const [data, setData] = useState<CulturalScoreData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !token) return;
    get<CulturalScoreData>(`/match/cultural-score/${userId}`, token)
      .then((res) => {
        if (res.success && res.data) setData(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId, token]);

  if (loading || !data) return null;

  const accentColor =
    data.totalScore >= 70
      ? "#00C853"
      : data.totalScore >= 40
      ? "#FF9800"
      : theme.primary;

  const label =
    data.totalScore >= 70
      ? "High Cultural Match"
      : data.totalScore >= 40
      ? "Moderate Match"
      : "Exploring Differences";

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="globe-outline" size={20} color={accentColor} />
          <ThemedText style={[styles.title, { color: theme.text }]}>Cultural Compatibility</ThemedText>
        </View>
        <View style={[styles.labelBadge, { backgroundColor: accentColor + "18", borderColor: accentColor + "40" }]}>
          <ThemedText style={[styles.labelText, { color: accentColor }]}>{label}</ThemedText>
        </View>
      </View>

      <View style={styles.topRow}>
        <TotalRing score={data.totalScore} max={data.maxScore} color={accentColor} />
        <View style={styles.summaryText}>
          <ThemedText style={[styles.summaryTitle, { color: theme.text }]}>
            Score Breakdown
          </ThemedText>
          <ThemedText style={[styles.summaryDesc, { color: theme.textSecondary }]}>
            Based on origin, tribe, language, religion and diaspora generation
          </ThemedText>
        </View>
      </View>

      <View style={styles.breakdown}>
        {data.breakdown.map((item, i) => (
          <View key={i} style={styles.breakdownRow}>
            <View style={styles.rowHeader}>
              <View style={styles.rowLabel}>
                <Ionicons
                  name={(LABEL_ICONS[item.label] || "ellipse-outline") as any}
                  size={14}
                  color={theme.textSecondary}
                />
                <ThemedText style={[styles.rowLabelText, { color: theme.text }]}>
                  {item.label}
                </ThemedText>
              </View>
              <ThemedText style={[styles.rowPoints, { color: item.score > 0 ? accentColor : theme.textSecondary }]}>
                {item.score}/{item.max}
              </ThemedText>
            </View>
            <ScoreBar score={item.score} max={item.max} color={item.score > 0 ? accentColor : theme.border} />
            {(item.mine || item.theirs) && (
              <View style={styles.rowValues}>
                {item.mine && (
                  <View style={[styles.valuePill, { backgroundColor: theme.primary + "12", borderColor: theme.primary + "20" }]}>
                    <ThemedText style={[styles.valuePillLabel, { color: theme.textSecondary }]}>You: </ThemedText>
                    <ThemedText style={[styles.valuePillText, { color: theme.text }]} numberOfLines={1}>
                      {formatValue(item.mine)}
                    </ThemedText>
                  </View>
                )}
                {item.theirs && (
                  <View style={[styles.valuePill, { backgroundColor: accentColor + "12", borderColor: accentColor + "20" }]}>
                    <ThemedText style={[styles.valuePillLabel, { color: theme.textSecondary }]}>Them: </ThemedText>
                    <ThemedText style={[styles.valuePillText, { color: theme.text }]} numberOfLines={1}>
                      {formatValue(item.theirs)}
                    </ThemedText>
                  </View>
                )}
              </View>
            )}
            {item.shared && item.shared.length > 0 && (
              <View style={styles.sharedRow}>
                <Ionicons name="checkmark-circle" size={12} color={accentColor} />
                <ThemedText style={[styles.sharedText, { color: accentColor }]}>
                  Shared: {item.shared.join(", ")}
                </ThemedText>
              </View>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  labelBadge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  labelText: {
    fontSize: 11,
    fontWeight: "600",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  ringWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  ringScore: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 22,
  },
  ringMax: {
    fontSize: 10,
    opacity: 0.6,
    lineHeight: 12,
  },
  ringPct: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 13,
  },
  summaryText: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 3,
  },
  summaryDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  breakdown: {
    gap: Spacing.sm,
  },
  breakdownRow: {
    gap: 4,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rowLabelText: {
    fontSize: 13,
    fontWeight: "500",
  },
  rowPoints: {
    fontSize: 12,
    fontWeight: "700",
  },
  barTrack: {
    height: 6,
    backgroundColor: "#00000012",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  rowValues: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    marginTop: 2,
  },
  valuePill: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: "48%",
  },
  valuePillLabel: {
    fontSize: 10,
  },
  valuePillText: {
    fontSize: 10,
    fontWeight: "600",
    flexShrink: 1,
  },
  sharedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  sharedText: {
    fontSize: 11,
    fontWeight: "500",
  },
});

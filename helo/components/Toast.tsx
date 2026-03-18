import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadow } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
  onDismiss?: () => void;
}

export function Toast({
  message,
  type = "info",
  duration = 3000,
  onDismiss,
}: ToastProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);

  useEffect(() => {
    translateY.value = withSpring(0);

    if (duration > 0) {
      translateY.value = withDelay(
        duration,
        withSpring(-100, {}, () => {
          onDismiss?.();
        }),
      );
    }
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const getIcon = () => {
    switch (type) {
      case "success":
        return "check-circle";
      case "error":
        return "alert-circle";
      default:
        return "info";
    }
  };

  const getColor = () => {
    switch (type) {
      case "success":
        return theme.success;
      case "error":
        return theme.error;
      default:
        return theme.primary;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.surface,
          top: insets.top + Spacing.md,
          shadowColor: theme.text,
        },
        animatedStyle,
      ]}
    >
      <Feather name={getIcon()} size={20} color={getColor()} />
      <ThemedText style={[styles.message, { color: theme.text }]}>
        {message}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    zIndex: 9999,
    ...Shadow.large,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
});


import React, { useState } from "react";
import { View, StyleSheet } from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SliderInputProps {
  min: number;
  max: number;
  value: number;
  onValueChange: (value: number) => void;
  step?: number;
  label?: string;
  suffix?: string;
}

export function SliderInput({ min, max, value, onValueChange, step = 1, label, suffix = "" }: SliderInputProps) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const translateX = useSharedValue(0);

  const updateValue = (x: number) => {
    const percentage = Math.max(0, Math.min(1, x / width));
    const newValue = Math.round((min + percentage * (max - min)) / step) * step;
    onValueChange(Math.max(min, Math.min(max, newValue)));
  };

  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startX = translateX.value;
    },
    onActive: (event, ctx: any) => {
      const newX = Math.max(0, Math.min(width, ctx.startX + event.translationX));
      translateX.value = newX;
      runOnJS(updateValue)(newX);
    },
    onEnd: () => {
      translateX.value = withSpring((value - min) / (max - min) * width);
    },
  });

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value - 12 }],
  }));

  React.useEffect(() => {
    translateX.value = ((value - min) / (max - min)) * width;
  }, [value, width, min, max]);

  const fillWidth = ((value - min) / (max - min)) * 100;

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelRow}>
          <ThemedText style={[styles.label, { color: theme.text }]}>{label}</ThemedText>
          <ThemedText style={[styles.value, { color: theme.primary }]}>
            {value}{suffix}
          </ThemedText>
        </View>
      )}
      <View
        style={[styles.track, { backgroundColor: theme.backgroundSecondary }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        <View
          style={[
            styles.fill,
            { backgroundColor: theme.primary, width: `${fillWidth}%` },
          ]}
        />
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View
            style={[
              styles.thumb,
              { backgroundColor: theme.primary, shadowColor: theme.text },
              thumbStyle,
            ]}
          />
        </PanGestureHandler>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.sm,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
  },
  value: {
    fontSize: 18,
    fontWeight: "600",
  },
  track: {
    height: 6,
    borderRadius: 3,
    position: "relative",
  },
  fill: {
    height: 6,
    borderRadius: 3,
    position: "absolute",
    left: 0,
    top: 0,
  },
  thumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    position: "absolute",
    top: -9,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});

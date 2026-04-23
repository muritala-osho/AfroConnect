
import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface SwipeCardProps {
  children: React.ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
}

export function SwipeCard({ children, onSwipeLeft, onSwipeRight, onSwipeUp }: SwipeCardProps) {
  const { theme } = useTheme();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onChange((event) => {
      translateX.value = startX.value + event.translationX;
      translateY.value = startY.value + event.translationY;
    })
    .onEnd(() => {
      if (Math.abs(translateX.value) > SWIPE_THRESHOLD) {
        if (translateX.value > 0) {
          runOnJS(onSwipeRight)();
        } else {
          runOnJS(onSwipeLeft)();
        }
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      } else if (translateY.value < -SWIPE_THRESHOLD) {
        runOnJS(onSwipeUp)();
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-15, 0, 15],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
      zIndex: 1,
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    ),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolate.CLAMP
    ),
  }));

  const superLikeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolate.CLAMP
    ),
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Animated.View style={[styles.overlay, styles.likeOverlay, likeOpacity]}>
          <ThemedText style={[styles.overlayText, { color: theme.like }]}>LIKE</ThemedText>
        </Animated.View>
        <Animated.View style={[styles.overlay, styles.nopeOverlay, nopeOpacity]}>
          <ThemedText style={[styles.overlayText, { color: theme.pass }]}>NOPE</ThemedText>
        </Animated.View>
        <Animated.View style={[styles.overlay, styles.superLikeOverlay, superLikeOpacity]}>
          <ThemedText style={[styles.overlayText, { color: theme.superLike }]}>SUPER LIKE</ThemedText>
        </Animated.View>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    position: "relative",
  },
  overlay: {
    position: "absolute",
    top: 50,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 4,
    borderRadius: 8,
  },
  likeOverlay: {
    left: 50,
    transform: [{ rotate: "-15deg" }],
  },
  nopeOverlay: {
    right: 50,
    transform: [{ rotate: "15deg" }],
  },
  superLikeOverlay: {
    alignSelf: "center",
  },
  overlayText: {
    fontSize: 32,
    fontWeight: "bold",
  },
});

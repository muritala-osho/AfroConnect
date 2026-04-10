import React from "react";
import { Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ZoomablePhotoProps {
  source: any;
  width?: number;
  height?: number;
}

export default function ZoomablePhoto({
  source,
  width = SCREEN_WIDTH,
  height = SCREEN_HEIGHT * 0.82,
}: ZoomablePhotoProps) {
  const scale      = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx         = useSharedValue(0);
  const ty         = useSharedValue(0);
  const savedTx    = useSharedValue(0);
  const savedTy    = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 0.8), 6);
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value      = withSpring(1);
        savedScale.value = 1;
        tx.value         = withSpring(0);
        ty.value         = withSpring(0);
        savedTx.value    = 0;
        savedTy.value    = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (scale.value <= 1.05) return;
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      if (scale.value <= 1.05) {
        tx.value      = withSpring(0);
        ty.value      = withSpring(0);
        savedTx.value = 0;
        savedTy.value = 0;
        return;
      }
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd(() => {
      if (savedScale.value > 1) {
        scale.value      = withSpring(1);
        savedScale.value = 1;
        tx.value         = withSpring(0);
        ty.value         = withSpring(0);
        savedTx.value    = 0;
        savedTy.value    = 0;
      } else {
        scale.value      = withSpring(2.5);
        savedScale.value = 2.5;
      }
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: tx.value },
      { translateY: ty.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.Image
        source={source}
        style={[{ width, height }, animStyle]}
        resizeMode="contain"
      />
    </GestureDetector>
  );
}

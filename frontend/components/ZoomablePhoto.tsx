import React from "react";
import { Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const SWIPE_THRESHOLD = 60;

interface ZoomablePhotoProps {
  source: any;
  width?: number;
  height?: number;
  onSwipeNext?: () => void;
  onSwipePrev?: () => void;
  onZoomChange?: (zoomed: boolean) => void;
}

export default function ZoomablePhoto({
  source,
  width = SCREEN_WIDTH,
  height = SCREEN_HEIGHT,
  onSwipeNext,
  onSwipePrev,
  onZoomChange,
}: ZoomablePhotoProps) {
  const scale      = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx         = useSharedValue(0);
  const ty         = useSharedValue(0);
  const savedTx    = useSharedValue(0);
  const savedTy    = useSharedValue(0);

  const notifyZoom = (zoomed: boolean) => {
    if (onZoomChange) runOnJS(onZoomChange)(zoomed);
  };

  const goNext = () => { if (onSwipeNext) onSwipeNext(); };
  const goPrev = () => { if (onSwipePrev) onSwipePrev(); };

  const resetZoom = () => {
    "worklet";
    scale.value      = withSpring(1);
    savedScale.value = 1;
    tx.value         = withSpring(0);
    ty.value         = withSpring(0);
    savedTx.value    = 0;
    savedTy.value    = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      "worklet";
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 0.8), 6);
    })
    .onEnd(() => {
      "worklet";
      if (scale.value < 1) {
        resetZoom();
        notifyZoom(false);
      } else {
        savedScale.value = scale.value;
        notifyZoom(scale.value > 1.05);
      }
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      "worklet";
      if (scale.value <= 1.05) {
        tx.value = e.translationX * 0.3;
        return;
      }
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd((e) => {
      "worklet";
      if (scale.value <= 1.05) {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
        savedTx.value = 0;
        savedTy.value = 0;
        if (e.translationX < -SWIPE_THRESHOLD) {
          runOnJS(goNext)();
        } else if (e.translationX > SWIPE_THRESHOLD) {
          runOnJS(goPrev)();
        }
        return;
      }
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(250)
    .onEnd(() => {
      "worklet";
      if (savedScale.value > 1) {
        resetZoom();
        notifyZoom(false);
      } else {
        scale.value      = withSpring(2.5);
        savedScale.value = 2.5;
        notifyZoom(true);
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

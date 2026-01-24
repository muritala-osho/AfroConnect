import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Dimensions, Platform } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { getPhotoSource } from "@/utils/photos";
import * as Haptics from 'expo-haptics';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withSequence,
  withDelay,
  withTiming,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';

const { width, height } = Dimensions.get("window");

type MatchPopupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "MatchPopup">;
type MatchPopupScreenRouteProp = RouteProp<RootStackParamList, "MatchPopup">;

interface MatchPopupScreenProps {
  navigation: MatchPopupScreenNavigationProp;
  route: MatchPopupScreenRouteProp;
}

export default function MatchPopupScreen({ navigation, route }: MatchPopupScreenProps) {
  const { currentUser, matchedUser, isSuperLike } = route.params;
  const insets = useSafeAreaInsets();
  
  const scale = useSharedValue(0);
  const rotate = useSharedValue(0);
  const heartScale = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const buttonsTranslate = useSharedValue(100);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });
    rotate.value = withSequence(
      withTiming(-5, { duration: 100 }),
      withTiming(5, { duration: 100 }),
      withTiming(0, { duration: 100 })
    );
    heartScale.value = withDelay(300, withSpring(1, { damping: 8 }));
    textOpacity.value = withDelay(400, withTiming(1, { duration: 300 }));
    buttonsTranslate.value = withDelay(500, withSpring(0, { damping: 15 }));
  }, []);

  const currentUserPhoto = currentUser?.photos?.[0] ? getPhotoSource(currentUser.photos[0]) : null;
  const matchedUserPhoto = matchedUser?.photos?.[0] ? getPhotoSource(matchedUser.photos[0]) : null;

  const leftPhotoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${-12 + rotate.value}deg` },
    ],
  }));

  const rightPhotoStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${12 + rotate.value}deg` },
    ],
  }));

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartScale.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: buttonsTranslate.value }],
    opacity: interpolate(buttonsTranslate.value, [100, 0], [0, 1], Extrapolate.CLAMP),
  }));

  const handleSendMessage = () => {
    navigation.replace("ChatDetail", { 
      userId: matchedUser.id, 
      userName: matchedUser.name,
      userPhoto: typeof matchedUserPhoto === 'object' && matchedUserPhoto?.uri ? matchedUserPhoto.uri : undefined
    });
  };

  const handleKeepSwiping = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isSuperLike 
          ? ['#1a1a2e', '#4a148c', '#7c4dff', '#b388ff'] 
          : ['#1a1a2e', '#2d1f3d', '#FF6B6B', '#FF8E53']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.confettiContainer}>
        {[...Array(20)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.confetti,
              {
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 60}%`,
                backgroundColor: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF8E53'][i % 5],
                transform: [{ rotate: `${Math.random() * 360}deg` }],
              },
            ]}
          />
        ))}
      </View>

      <View style={[styles.content, { paddingTop: insets.top + 40 }]}>
        <Animated.View style={[styles.photosContainer, { transform: [{ scale: scale.value }] }]}>
          <Animated.View style={[styles.photoWrapper, styles.leftPhoto, leftPhotoStyle]}>
            {currentUserPhoto ? (
              <Image
                source={currentUserPhoto}
                style={styles.photo}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.photo, styles.noPhoto]}>
                <Feather name="user" size={40} color="#666" />
              </View>
            )}
            <View style={styles.photoLabel}>
              <ThemedText style={styles.photoLabelText}>You</ThemedText>
            </View>
          </Animated.View>

          <Animated.View style={[styles.heartBadge, heartStyle]}>
            <LinearGradient
              colors={isSuperLike ? ['#7c4dff', '#b388ff'] : ['#FF6B6B', '#FF8E53']}
              style={styles.heartGradient}
            >
              <Feather name="heart" size={28} color="#FFF" />
            </LinearGradient>
          </Animated.View>

          <Animated.View style={[styles.photoWrapper, styles.rightPhoto, rightPhotoStyle]}>
            {matchedUserPhoto ? (
              <Image
                source={matchedUserPhoto}
                style={styles.photo}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.photo, styles.noPhoto]}>
                <Feather name="user" size={40} color="#666" />
              </View>
            )}
            <View style={styles.photoLabel}>
              <ThemedText style={styles.photoLabelText}>{matchedUser.name}</ThemedText>
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.View style={[styles.textContainer, textStyle]}>
          <ThemedText style={styles.matchTitle}>
            {isSuperLike ? "Super Match!" : "It's a Match!"}
          </ThemedText>
          <ThemedText style={styles.matchSubtitle}>
            {currentUser.name} & {matchedUser.name}
          </ThemedText>
          <ThemedText style={styles.matchDescription}>
            You both liked each other! Start a conversation now.
          </ThemedText>
        </Animated.View>

        <Animated.View style={[styles.buttonsContainer, buttonsStyle, { paddingBottom: insets.bottom + 20 }]}>
          <Pressable
            style={styles.messageButton}
            onPress={handleSendMessage}
          >
            <LinearGradient
              colors={isSuperLike ? ['#7c4dff', '#b388ff'] : ['#FF6B6B', '#FF8E53']}
              style={styles.messageButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Feather name="message-circle" size={22} color="#FFF" />
              <ThemedText style={styles.messageButtonText}>Send Message</ThemedText>
            </LinearGradient>
          </Pressable>

          <Pressable
            style={styles.keepSwipingButton}
            onPress={handleKeepSwiping}
          >
            <ThemedText style={styles.keepSwipingText}>Keep Swiping</ThemedText>
          </Pressable>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
    opacity: 0.6,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  photosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  photoWrapper: {
    position: 'relative',
  },
  leftPhoto: {
    marginRight: -30,
    zIndex: 1,
  },
  rightPhoto: {
    marginLeft: -30,
    zIndex: 1,
  },
  photo: {
    width: width * 0.38,
    height: width * 0.48,
    borderRadius: 20,
    borderWidth: 4,
    borderColor: '#FFF',
  },
  noPhoto: {
    backgroundColor: '#3A3A3A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: {
    position: 'absolute',
    bottom: -12,
    left: '50%',
    transform: [{ translateX: -40 }],
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    width: 80,
    alignItems: 'center',
  },
  photoLabelText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  heartBadge: {
    position: 'absolute',
    zIndex: 10,
    top: '50%',
    left: '50%',
    marginLeft: -30,
    marginTop: -30,
  },
  heartGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  matchTitle: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  matchSubtitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFD93D',
    marginTop: 8,
    textAlign: 'center',
  },
  matchDescription: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  messageButton: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  messageButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  messageButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  keepSwipingButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  keepSwipingText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
});

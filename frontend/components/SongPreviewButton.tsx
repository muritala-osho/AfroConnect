import React, { useState, useEffect, useRef } from "react";
import { Pressable, ActivityIndicator, Linking, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";

interface SongPreviewButtonProps {
  previewUrl?: string;
  spotifyUri?: string;
  size?: number;
  color?: string;
  activeColor?: string;
}

export default function SongPreviewButton({
  previewUrl,
  spotifyUri,
  size = 22,
  color = "#1DB954",
  activeColor = "#1DB954",
}: SongPreviewButtonProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const handlePress = async () => {
    if (previewUrl) {
      await handlePreviewPlay();
    } else if (spotifyUri) {
      const webUrl = spotifyUri.replace("spotify:track:", "https://open.spotify.com/track/");
      const canOpen = await Linking.canOpenURL(spotifyUri).catch(() => false);
      Linking.openURL(canOpen ? spotifyUri : webUrl).catch(() => {});
    }
  };

  const handlePreviewPlay = async () => {
    if (isLoading) return;

    if (isPlaying && soundRef.current) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      return;
    }

    if (soundRef.current) {
      await soundRef.current.playAsync();
      setIsPlaying(true);
      return;
    }

    setIsLoading(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: previewUrl! },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (status.didJustFinish) {
          setIsPlaying(false);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (err) {
      console.error("Preview playback error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!previewUrl && !spotifyUri) return null;

  if (isLoading) {
    return <ActivityIndicator size="small" color={color} style={{ width: size + 8, height: size + 8 }} />;
  }

  return (
    <Pressable onPress={handlePress} style={styles.btn} hitSlop={10}>
      <Feather
        name={isPlaying ? "pause-circle" : "play-circle"}
        size={size + 8}
        color={isPlaying ? activeColor : color}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: "center",
    justifyContent: "center",
  },
});

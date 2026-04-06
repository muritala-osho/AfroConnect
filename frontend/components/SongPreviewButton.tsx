import React, { useState, useEffect, useRef } from "react";
import { Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useAuth } from "@/hooks/useAuth";
import { getApiBaseUrl } from "@/constants/config";

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
  const [resolvedPreviewUrl, setResolvedPreviewUrl] = useState<string | null>(
    previewUrl || null
  );

  const { token } = useAuth();

  useEffect(() => {
    setResolvedPreviewUrl(previewUrl || null);
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  const fetchPreviewFromUri = async (): Promise<string | null> => {
    if (!spotifyUri || !token) return null;
    const match = spotifyUri.match(/spotify:track:([A-Za-z0-9]+)/);
    if (!match) return null;
    const trackId = match[1];
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/spotify/track/${trackId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (json.success && json.track?.previewUrl) {
        return json.track.previewUrl;
      }
    } catch (err) {
      console.warn("Failed to fetch Spotify preview:", err);
    }
    return null;
  };

  const handlePress = async () => {
    if (isLoading) return;

    let urlToPlay = resolvedPreviewUrl;

    if (!urlToPlay && spotifyUri) {
      setIsLoading(true);
      urlToPlay = await fetchPreviewFromUri();
      if (urlToPlay) {
        setResolvedPreviewUrl(urlToPlay);
      }
      setIsLoading(false);
    }

    if (!urlToPlay) {
      Alert.alert(
        "No Preview Available",
        "This song doesn't have a 30-second preview available.",
        [{ text: "OK" }]
      );
      return;
    }

    await handlePreviewPlay(urlToPlay);
  };

  const handlePreviewPlay = async (url: string) => {
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
        { uri: url },
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
    return (
      <ActivityIndicator
        size="small"
        color={color}
        style={{ width: size + 8, height: size + 8 }}
      />
    );
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

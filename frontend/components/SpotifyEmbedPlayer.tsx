import React, { useState, useRef } from "react";
import {
  Pressable,
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import WebView from "react-native-webview";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";

const { width: SW } = Dimensions.get("window");

function extractTrackId(spotifyUri?: string): string | null {
  if (!spotifyUri) return null;
  const uriMatch = spotifyUri.match(/spotify:track:([A-Za-z0-9]+)/);
  if (uriMatch) return uriMatch[1];
  const urlMatch = spotifyUri.match(/open\.spotify\.com\/track\/([A-Za-z0-9]+)/);
  if (urlMatch) return urlMatch[1];
  return null;
}

interface Props {
  spotifyUri?: string;
  previewUrl?: string;
  title?: string;
  artist?: string;
  albumArt?: string;
  size?: number;
  color?: string;
  activeColor?: string;
}

export default function SpotifyEmbedPlayer({
  spotifyUri,
  previewUrl,
  title,
  artist,
  albumArt,
  size = 22,
  color = "#1DB954",
  activeColor = "#1DB954",
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [webviewLoading, setWebviewLoading] = useState(true);

  // expo-av fallback state (for when only previewUrl is available)
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);

  const trackId = extractTrackId(spotifyUri);
  const embedUrl = trackId
    ? `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`
    : null;

  if (!trackId && !previewUrl) return null;

  const handlePress = async () => {
    if (embedUrl) {
      setWebviewLoading(true);
      setModalVisible(true);
      return;
    }

    // Fallback: expo-av for previewUrl
    if (isAudioLoading) return;
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
    setIsAudioLoading(true);
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
    } catch {}
    finally { setIsAudioLoading(false); }
  };

  const handleClose = async () => {
    setModalVisible(false);
  };

  const iconName = embedUrl
    ? "play-circle"
    : isPlaying
    ? "pause-circle"
    : "play-circle";

  return (
    <>
      <Pressable onPress={handlePress} hitSlop={10} style={styles.btn}>
        {isAudioLoading ? (
          <ActivityIndicator size="small" color={color} style={{ width: size + 8, height: size + 8 }} />
        ) : (
          <Feather
            name={iconName}
            size={size + 8}
            color={isPlaying && !embedUrl ? activeColor : color}
          />
        )}
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.trackRow}>
            {albumArt ? (
              <Image source={{ uri: albumArt }} style={styles.albumArt} />
            ) : (
              <LinearGradient colors={["#1DB954", "#158f3f"]} style={styles.albumArtPlaceholder}>
                <Feather name="music" size={20} color="#fff" />
              </LinearGradient>
            )}
            <View style={{ flex: 1, marginLeft: 12 }}>
              {title ? (
                <Text style={styles.trackTitle} numberOfLines={1}>{title}</Text>
              ) : null}
              {artist ? (
                <Text style={styles.trackArtist} numberOfLines={1}>{artist}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={8}>
              <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </View>

          <View style={styles.playerContainer}>
            {webviewLoading && (
              <View style={styles.loaderOverlay}>
                <ActivityIndicator size="large" color="#1DB954" />
                <Text style={styles.loaderText}>Loading player…</Text>
              </View>
            )}
            <WebView
              source={{ uri: embedUrl! }}
              style={styles.webview}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              bounces={false}
              onLoadEnd={() => setWebviewLoading(false)}
              originWhitelist={["https://*", "http://*"]}
              mixedContentMode="always"
              userAgent={
                Platform.OS === "android"
                  ? "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/91.0.4472.114 Mobile Safari/537.36"
                  : undefined
              }
            />
          </View>

          <View style={styles.branding}>
            <Feather name="music" size={12} color="#1DB954" />
            <Text style={styles.brandingText}>30-second preview via Spotify</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const SHEET_HEIGHT = 280;

const styles = StyleSheet.create({
  btn: { alignItems: "center", justifyContent: "center" },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: "#121212",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 30 : 16,
  },

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 14,
  },

  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    marginBottom: 14,
  },

  albumArt: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },

  albumArtPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  trackTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  trackArtist: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginTop: 2,
  },

  closeBtn: {
    padding: 4,
  },

  playerContainer: {
    marginHorizontal: 16,
    height: 152,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },

  webview: {
    flex: 1,
    backgroundColor: "#000",
  },

  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#121212",
    gap: 10,
  },

  loaderText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },

  branding: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 10,
  },

  brandingText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 11,
  },
});

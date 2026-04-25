import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons, Feather } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { VerificationBadge } from '@/components/VerificationBadge';

type Props = {
  theme: any;
  isDark: boolean;
  photoSource: any;
  userName: string;
  otherUserVerified: boolean;
  isOnline: boolean;
  isTyping: boolean;
  isOtherRecording: boolean;
  statusText: string;
  onBack: () => void;
  onProfilePress: () => void;
  onVoiceCall: () => void;
  onVideoCall: () => void;
  onOpenOptions: () => void;
};

export default function ChatHeader({
  theme,
  isDark,
  photoSource,
  userName,
  otherUserVerified,
  isOnline,
  isTyping,
  isOtherRecording,
  statusText,
  onBack,
  onProfilePress,
  onVoiceCall,
  onVideoCall,
  onOpenOptions,
}: Props) {
  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: theme.background,
          borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        },
      ]}
    >
      <Pressable onPress={onBack} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color={theme.text} />
      </Pressable>

      <Pressable style={styles.headerProfile} onPress={onProfilePress}>
        <View style={styles.avatarContainer}>
          <Image
            source={photoSource || require('../../assets/icon.png')}
            style={styles.headerAvatar}
            contentFit="cover"
          />
          {isOnline && <View style={styles.onlineIndicator} />}
        </View>
        <View style={styles.headerInfo}>
          <View style={styles.nameRow}>
            <ThemedText style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
              {userName}
            </ThemedText>
            {otherUserVerified && <VerificationBadge size={14} />}
          </View>
          <ThemedText
            style={[
              styles.headerStatus,
              {
                color: isOtherRecording
                  ? '#F44336'
                  : isTyping
                  ? theme.primary
                  : isOnline
                  ? '#4CAF50'
                  : theme.textSecondary,
              },
            ]}
          >
            {statusText}
          </ThemedText>
        </View>
      </Pressable>

      <View style={styles.headerActions}>
        <Pressable onPress={onVoiceCall} style={styles.headerActionButton}>
          <Feather name="phone" size={22} color={theme.primary} />
        </Pressable>
        <Pressable onPress={onVideoCall} style={styles.headerActionButton}>
          <Feather name="video" size={22} color={theme.primary} />
        </Pressable>
        <Pressable onPress={onOpenOptions} style={styles.headerActionButton}>
          <Feather name="more-vertical" size={22} color={theme.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  headerProfile: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  avatarContainer: { position: 'relative' },
  headerAvatar: { width: 44, height: 44, borderRadius: 22 },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  headerInfo: { marginLeft: 12, flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  headerName: { fontSize: 17, fontWeight: '700' },
  headerStatus: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerActionButton: { padding: 10, marginLeft: 4 },
});

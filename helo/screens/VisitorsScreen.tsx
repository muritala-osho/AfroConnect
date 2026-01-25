import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Dimensions, ActivityIndicator, Pressable, FlatList, Platform, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius, Typography, Shadow } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { getPhotoSource } from "@/utils/photos";
import { useTranslation } from "@/hooks/useLanguage";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Visitor {
  user: {
    _id: string;
    name: string;
    age: number;
    photos: any[];
    verified: boolean;
  };
  viewedAt: string;
}

export default function VisitorsScreen({ navigation }: { navigation: NativeStackNavigationProp<RootStackParamList> }) {
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const { get } = useApi();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const isPremium = user?.premium?.isActive;

  const fetchVisitors = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const response = await get<any>('/users/me', token);
      const data = response.data as any;
      if (response.success && data?.user?.profileViews) {
        setVisitors(data.user.profileViews);
      }
    } catch (error) {
      console.error('Failed to fetch visitors:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchVisitors();
    }, [token])
  );

  const hashName = (name: string) => {
    if (!name) return "";
    return name[0] + "****" + name[name.length - 1];
  };

  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const handleVisitorPress = (visitorUser: any) => {
    if (isPremium) {
      navigation.navigate("ProfileDetail", { userId: visitorUser._id });
    } else {
      setShowPremiumModal(true);
    }
  };

  const renderVisitor = ({ item }: { item: Visitor }) => {
    const visitorUser = item.user;
    if (!visitorUser) return null;

    const photoSource = visitorUser.photos?.[0] ? getPhotoSource(visitorUser.photos[0]) : null;

    return (
      <Pressable 
        style={[styles.visitorCard, { backgroundColor: theme.surface }]}
        onPress={() => handleVisitorPress(visitorUser)}
      >
        <View style={styles.photoContainer}>
          {photoSource ? (
            <Image 
              source={photoSource} 
              style={styles.photo} 
              contentFit="cover"
            />
          ) : (
            <View style={[styles.photo, { backgroundColor: theme.backgroundSecondary, justifyContent: 'center', alignItems: 'center' }]}>
              <Feather name="user" size={30} color={theme.textSecondary} />
            </View>
          )}
        </View>
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <ThemedText style={styles.name}>{visitorUser.name}, {visitorUser.age}</ThemedText>
            {visitorUser.verified && (
               <Image 
               source={require("@/assets/icons/verified-tick.png")} 
               style={{ width: 16, height: 16, marginLeft: 4 }} 
               contentFit="contain"
             />
            )}
          </View>
          <ThemedText style={[styles.time, { color: theme.textSecondary }]}>
            Visited {new Date(item.viewedAt).toLocaleDateString()}
          </ThemedText>
        </View>
        {!isPremium && <Feather name="lock" size={16} color={theme.primary} />}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="chevron-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Profile Visitors</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={visitors}
        renderItem={renderVisitor}
        keyExtractor={(item, index) => item.user?._id || index.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="users" size={50} color={theme.textSecondary} />
            <ThemedText style={styles.emptyText}>No visitors yet</ThemedText>
          </View>
        }
      />

      {!isPremium && (
        <Pressable 
          style={[styles.premiumBanner, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate("Premium")}
        >
          <Feather name="star" size={20} color="#FFF" />
          <ThemedText style={styles.premiumText}>Upgrade to view full profiles</ThemedText>
        </Pressable>
      )}

      <Modal
        visible={showPremiumModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPremiumModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalIcon, { backgroundColor: theme.primary + '20' }]}>
              <Ionicons name="lock-closed" size={32} color={theme.primary} />
            </View>
            <ThemedText style={styles.modalTitle}>Premium Feature</ThemedText>
            <ThemedText style={[styles.modalText, { color: theme.textSecondary }]}>
              Upgrade to Premium to view full profiles and connect with people who visited you.
            </ThemedText>
            <Pressable 
              style={[styles.unlockButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                setShowPremiumModal(false);
                navigation.navigate("Premium");
              }}
            >
              <Ionicons name="star" size={18} color="#FFF" />
              <ThemedText style={styles.unlockButtonText}>Unlock Premium</ThemedText>
            </Pressable>
            <Pressable 
              style={styles.cancelButton}
              onPress={() => setShowPremiumModal(false)}
            >
              <ThemedText style={{ color: theme.textSecondary }}>Maybe Later</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    height: 56,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  backButton: {
    padding: 8,
  },
  listContent: {
    padding: Spacing.md,
  },
  visitorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    ...Shadow.small,
  },
  photoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    marginRight: Spacing.md,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  blurredPhoto: {
    ...Platform.select({
      web: {
        filter: 'blur(10px)',
      },
      default: {
        // For native, we rely on the blurred prop if using expo-image or a container
      }
    })
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 16,
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  premiumText: {
    color: '#FFF',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '90%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 25,
    width: '100%',
  },
  unlockButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 8,
  },
});
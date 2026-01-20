import React, { useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Dimensions, ActivityIndicator, Pressable, FlatList } from "react-native";
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
      if (response.success && response.user?.profileViews) {
        setVisitors(response.user.profileViews);
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

  const renderVisitor = ({ item }: { item: Visitor }) => {
    const visitorUser = item.user;
    if (!visitorUser) return null;

    const name = isPremium ? visitorUser.name : hashName(visitorUser.name);
    const photoSource = visitorUser.photos?.[0] ? getPhotoSource(visitorUser.photos[0]) : null;

    return (
      <Pressable 
        style={[styles.visitorCard, { backgroundColor: theme.surface }]}
        onPress={() => {
          if (isPremium) {
            navigation.navigate("ProfileDetail", { userId: visitorUser._id });
          } else {
            navigation.navigate("Premium");
          }
        }}
      >
        <View style={styles.photoContainer}>
          {photoSource ? (
            <Image 
              source={photoSource} 
              style={styles.photo} 
              contentFit="cover"
              blurRadius={isPremium ? 0 : 20}
            />
          ) : (
            <View style={[styles.photo, { backgroundColor: theme.backgroundSecondary, justifyContent: 'center', alignItems: 'center' }]}>
              <Feather name="user" size={30} color={theme.textSecondary} />
            </View>
          )}
        </View>
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <ThemedText style={styles.name}>{name}, {visitorUser.age}</ThemedText>
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
        {!isPremium && <Feather name="lock" size={16} color={theme.textSecondary} />}
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
          <ThemedText style={styles.premiumText}>Upgrade to see who viewed you</ThemedText>
        </Pressable>
      )}
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
});
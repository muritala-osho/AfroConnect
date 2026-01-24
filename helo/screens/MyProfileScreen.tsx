import React, { useState, useRef } from "react";
import { View, StyleSheet, Pressable, Modal, Dimensions, ScrollView, FlatList } from "react-native";
import { useThemedAlert } from "@/components/ThemedAlert";
import { SafeImage } from "@/components/SafeImage";
import { LinearGradient } from "expo-linear-gradient";
import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MainTabParamList } from "@/navigation/MainTabNavigator";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { useTranslation } from "@/hooks/useLanguage";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { getPhotoSource } from "@/utils/photos";
import * as Haptics from 'expo-haptics';
import { Platform } from "react-native";
import ProfilePrompts from "@/components/ProfilePrompts";

type MyProfileScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "MyProfile">,
  NativeStackNavigationProp<RootStackParamList>
>;

interface MyProfileScreenProps {
  navigation: MyProfileScreenNavigationProp;
}

const ZODIAC_EMOJI: { [key: string]: string } = {
  aries: '♈',
  taurus: '♉',
  gemini: '♊',
  cancer: '♋',
  leo: '♌',
  virgo: '♍',
  libra: '♎',
  scorpio: '♏',
  sagittarius: '♐',
  capricorn: '♑',
  aquarius: '♒',
  pisces: '♓',
};

const GENDER_LABELS: { [key: string]: string } = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};

const LOOKING_FOR_LABELS: { [key: string]: string } = {
  relationship: 'Relationship',
  friendship: 'Friendship',
  casual: 'Casual',
  networking: 'Networking',
};

const EDUCATION_LABELS: { [key: string]: string } = {
  high_school: 'High School',
  some_college: 'Some College',
  bachelors: "Bachelor's Degree",
  masters: "Master's Degree",
  doctorate: 'Doctorate',
  trade_school: 'Trade School',
  other: 'Other',
  prefer_not_to_say: 'Prefer not to say',
};

const LIFESTYLE_LABELS: { [key: string]: string } = {
  never: 'Never',
  socially: 'Socially',
  regularly: 'Regularly',
  prefer_not_to_say: 'Prefer not to say',
  introverted: 'Introverted',
  ambiverted: 'Ambiverted',
  extroverted: 'Extroverted',
  romantic: 'Romantic',
  playful: 'Playful',
  passionate: 'Passionate',
  intellectual: 'Intellectual',
  caring: 'Caring',
  adventurous: 'Adventurous',
  christian: 'Christian',
  muslim: 'Muslim',
  traditional: 'Traditional',
  atheist: 'Atheist',
  spiritual: 'Spiritual',
  
};

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.5;

export default function MyProfileScreen({ navigation }: MyProfileScreenProps) {
  const { theme } = useTheme();
  const { user, logout, token, fetchUser } = useAuth();
  const { del } = useApi();
  const { t } = useTranslation();
  const { showAlert, AlertComponent } = useThemedAlert();
  const [selectedPhoto, setSelectedPhoto] = useState<number>(0);
  const [photoModalVisible, setPhotoModalVisible] = useState(false);
  const [currentHeroPhoto, setCurrentHeroPhoto] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleLogout = () => {
    showAlert(
      t('logout'),
      t('logoutConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ],
      'log-out'
    );
  };

  const handleDeletePhoto = async (photoIndex: number) => {
    const photo = user?.photos?.[photoIndex];
    if (!photo) return;

    if (user?.photos?.length === 1) {
      showAlert(t('error'), "You must have at least one photo on your profile.", [{ text: t('ok'), style: 'default' }], 'alert-circle');
      return;
    }

    showAlert(
      t('delete'),
      t('confirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await del(`/upload/photo?publicId=${encodeURIComponent(photo.publicId || (photo as any)._id)}`, token ?? undefined);
              await fetchUser();
              if (photoIndex > 0) {
                setSelectedPhoto(photoIndex - 1);
              }
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
            } catch (error) {
              console.error('Delete photo error:', error);
              showAlert(t('error'), 'Failed to delete photo', [{ text: t('ok'), style: 'default' }], 'alert-circle');
            }
          },
        },
      ],
      'trash-2'
    );
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setSelectedPhoto(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const photoSource = user?.photos && user.photos[currentHeroPhoto] ? getPhotoSource(user.photos[currentHeroPhoto]) : null;
  const totalPhotos = user?.photos?.length || 0;

  const handleHeroTap = (evt: any) => {
    const tapX = evt.nativeEvent.locationX;
    const tapY = evt.nativeEvent.locationY;
    
    // If tapping the top area or indicators, don't trigger photo change
    if (tapY < 60) return;

    if (totalPhotos <= 1) return;
    if (tapX > width / 2) {
      setCurrentHeroPhoto((prev) => (prev + 1) % totalPhotos);
    } else {
      setCurrentHeroPhoto((prev) => (prev - 1 + totalPhotos) % totalPhotos);
    }
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleIndicatorPress = (index: number) => {
    setCurrentHeroPhoto(index);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const profileDetails = [
    user?.gender && {
      icon: 'user' as const,
      label: t('gender'),
      value: GENDER_LABELS[user.gender] || user.gender,
    },
    user?.lookingFor && {
      icon: 'heart' as const,
      label: t('lookingFor'),
      value: LOOKING_FOR_LABELS[user.lookingFor] || user.lookingFor,
    },
    (user as any)?.zodiacSign && {
      icon: 'star' as const,
      label: t('zodiac'),
      value: `${(user as any).zodiacSign.charAt(0).toUpperCase() + (user as any).zodiacSign.slice(1)} ${ZODIAC_EMOJI[(user as any).zodiacSign] || ''}`,
    },
    (user as any)?.jobTitle && {
      icon: 'briefcase' as const,
      label: t('work'),
      value: (user as any).jobTitle,
    },
    (user as any)?.education && {
      icon: 'book' as const,
      label: t('education'),
      value: EDUCATION_LABELS[(user as any).education] || (user as any).education,
    },
    (user as any)?.livingIn && {
      icon: 'map' as const,
      label: t('livingIn'),
      value: (user as any).livingIn,
    },
    (user as any)?.favoriteSong?.title && {
      icon: 'music' as const,
      label: t('favoriteSong'),
      value: `${(user as any).favoriteSong.title}${(user as any).favoriteSong.artist ? ` by ${(user as any).favoriteSong.artist}` : ''}`,
    },
    (user as any)?.lifestyle?.smoking && {
      icon: 'wind' as const,
      label: 'Smoking',
      value: LIFESTYLE_LABELS[(user as any).lifestyle.smoking] || (user as any).lifestyle.smoking,
    },
    (user as any)?.lifestyle?.drinking && {
      icon: 'coffee' as const,
      label: 'Drinking',
      value: LIFESTYLE_LABELS[(user as any).lifestyle.drinking] || (user as any).lifestyle.drinking,
    },
    (user as any)?.lifestyle?.religion && {
      icon: 'sun' as const,
      label: 'Religion',
      value: LIFESTYLE_LABELS[(user as any).lifestyle.religion] || (user as any).lifestyle.religion,
    },
    (user as any)?.lifestyle?.ethnicity && {
      icon: 'globe' as const,
      label: 'Ethnicity',
      value: (user as any).lifestyle.ethnicity,
    },
    (user as any)?.lifestyle?.personalityType && {
      icon: 'zap' as const,
      label: 'Personality',
      value: (user as any).lifestyle.personalityType,
    },
    (user as any)?.lifestyle?.pets && {
      icon: 'heart' as const,
      label: 'Pets',
      value: (user as any).lifestyle.pets,
    },
    (user as any)?.lifestyle?.relationshipStatus && {
      icon: 'heart' as const,
      label: 'Relationship',
      value: (user as any).lifestyle.relationshipStatus,
    },
  ].filter(Boolean);

  const renderPhotoItem = ({ item, index }: { item: any; index: number }) => {
    const source = getPhotoSource(item);
    return (
      <View style={styles.photoSlideContainer}>
        <SafeImage source={source} style={styles.fullPhoto} contentFit="contain" />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
          <Pressable 
            style={styles.heroContainer}
            onPress={() => {
              if (user?.id) {
                navigation.navigate("StoryViewer", { 
                  userId: user.id, 
                  userName: user.name, 
                  userPhoto: user.photos?.[0]?.url || user.photos?.[0] || (user as any).profilePhoto
                });
              }
            }}
          >
          {photoSource ? (
            <SafeImage
              source={photoSource}
              style={styles.heroImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.heroImage, { backgroundColor: theme.backgroundSecondary, justifyContent: 'center', alignItems: 'center' }]}>
              <Feather name="user" size={80} color={theme.textSecondary} />
            </View>
          )}
          
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.heroGradient}
          />

          <View style={styles.tapControls}>
            <Pressable 
              style={styles.tapArea} 
              onPress={() => {
                handleIndicatorPress((currentHeroPhoto - 1 + totalPhotos) % totalPhotos);
              }} 
            />
            <Pressable 
              style={styles.tapArea} 
              onPress={() => {
                handleIndicatorPress((currentHeroPhoto + 1) % totalPhotos);
              }} 
            />
          </View>

          <View style={styles.photoIndicators}>
            {user?.photos?.map((_, index) => (
              <Pressable
                key={index}
                onPress={() => handleIndicatorPress(index)}
                hitSlop={10}
                style={[
                  styles.photoIndicator,
                  { backgroundColor: index === currentHeroPhoto ? '#fff' : 'rgba(255,255,255,0.4)' }
                ]}
              />
            ))}
          </View>

          <View style={styles.heroContent}>
            <View style={styles.nameRow}>
              <ThemedText style={styles.heroName} numberOfLines={1}>
                {user?.name || "User"}
                {user?.age && !(user as any)?.privacySettings?.hideAge && (
                  <ThemedText style={styles.heroAge}>  {user.age}</ThemedText>
                )}
              </ThemedText>
            </View>
            {(user as any)?.livingIn && (
              <View style={styles.locationRow}>
                <Feather name="map" size={14} color="rgba(255,255,255,0.8)" />
                <ThemedText style={styles.heroLocation}>{(user as any).livingIn}</ThemedText>
              </View>
            )}
          </View>

          <Pressable 
            style={styles.settingsButton}
            onPress={(e) => {
              e.stopPropagation();
              navigation.navigate("Settings");
            }}
          >
            <Feather name="settings" size={22} color="#fff" />
          </Pressable>
        </Pressable>

        <View style={styles.actionButtonsRow}>
          <Pressable 
            style={[styles.actionButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => navigation.navigate("EditProfile")}
          >
            <Feather name="edit-2" size={20} color={theme.primary} />
            <ThemedText style={[styles.actionButtonText, { color: theme.text }]}>{t('editProfile')}</ThemedText>
          </Pressable>
          <Pressable 
            style={[styles.actionButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate("Visitors" as any)}
          >
            <Feather name="eye" size={20} color="#FFF" />
            <ThemedText style={[styles.actionButtonText, { color: '#FFF' }]}>Visitors</ThemedText>
          </Pressable>
        </View>

        {user?.bio && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              {t('aboutMe')}
            </ThemedText>
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              <ThemedText style={[styles.bio, { color: theme.text }]}>
                {user.bio}
              </ThemedText>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            Personality Prompt
          </ThemedText>
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <ThemedText style={[styles.bio, { color: theme.text }]}>
              {(user as any)?.lifestyle?.personalityType || "Add your personality type in Edit Profile to help matches understand your vibe!"}
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            Location & Distance
          </ThemedText>
          <Pressable 
            style={[styles.card, { backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', padding: Spacing.md }]}
            onPress={() => {
              if (user?.location?.coordinates) {
                const [lng, lat] = user.location.coordinates;
                const url = Platform.select({
                  ios: `maps:0,0?q=${lat},${lng}`,
                  android: `geo:0,0?q=${lat},${lng}`
                });
                if (url) {
                  require('react-native').Linking.openURL(url);
                }
              } else {
                showAlert(
                  "Location Not Found", 
                  "Your location is not set. Please ensure location permissions are enabled.",
                  [{ text: "OK", style: "default" }],
                  "map"
                );
              }
            }}
          >
            <View style={[styles.detailIconContainer, { backgroundColor: theme.primary + '15', marginRight: Spacing.md }]}>
              <Feather name="map" size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={{ fontWeight: '600' }}>Google Maps Integration</ThemedText>
              <ThemedText style={{ color: theme.textSecondary, fontSize: 12 }}>Real-time distance calculation</ThemedText>
            </View>
            <Feather name="info" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        <ProfilePrompts isOwnProfile={true} />

        {profileDetails.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              {t('details')}
            </ThemedText>
            <View style={[styles.card, { backgroundColor: theme.surface }]}>
              {profileDetails.map((detail: any, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.detailRow, 
                    index !== profileDetails.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border }
                  ]}
                >
                  <View style={styles.detailLeft}>
                    <View style={[styles.detailIconContainer, { backgroundColor: theme.primary + '15' }]}>
                      <Feather name={detail.icon} size={16} color={theme.primary} />
                    </View>
                    <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
                      {detail.label}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.detailValue, { color: theme.text }]} numberOfLines={1}>
                    {detail.value}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {user?.interests && user.interests.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
              {t('interests')}
            </ThemedText>
            <View style={styles.interestsContainer}>
              {user.interests.map((interest, index) => (
                <View
                  key={index}
                  style={[styles.interestTag, { backgroundColor: theme.primary + '20', borderColor: theme.primary, borderWidth: 1 }]}
                >
                  <ThemedText style={[styles.interestText, { color: theme.primary }]}>
                    {interest}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        )}

        {user?.photos && user.photos.length > 1 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
                {t('photos')} ({user.photos.length})
              </ThemedText>
              <Pressable onPress={() => navigation.navigate("ChangeProfilePicture")}>
                <ThemedText style={[styles.editLink, { color: theme.primary }]}>
                  {t('manage')}
                </ThemedText>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
              {user.photos.map((photo, index) => {
                const source = getPhotoSource(photo);
                return (
                  <Pressable 
                    key={index} 
                    style={styles.photoItem}
                    onPress={() => {
                      setSelectedPhoto(index);
                      setPhotoModalVisible(true);
                      if (Platform.OS !== 'web') {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                  >
                    <SafeImage
                      source={source}
                      style={styles.photoImage}
                      contentFit="cover"
                    />
                    {index === 0 && (
                      <View style={[styles.primaryBadge, { backgroundColor: theme.primary }]}>
                        <ThemedText style={styles.primaryBadgeText}>
                          {t('primary')}
                        </ThemedText>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>
            {t('account')}
          </ThemedText>
          <View style={[styles.menuContainer, { backgroundColor: theme.surface }]}>
            <Pressable
              style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: theme.border }]}
              onPress={() => navigation.navigate("Settings")}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconContainer, { backgroundColor: theme.primary + '15' }]}>
                  <Feather name="settings" size={18} color={theme.primary} />
                </View>
                <ThemedText style={[styles.menuItemLabel, { color: theme.text }]}>
                  {t('settings')}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
            <Pressable
              style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: theme.border }]}
              onPress={() => navigation.navigate("Premium" as any)}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconContainer, { backgroundColor: '#FFD700' + '15' }]}>
                  <Feather name="star" size={18} color="#FFD700" />
                </View>
                <ThemedText style={[styles.menuItemLabel, { color: theme.text }]}>
                  Upgrade to Premium
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
            {(user as any)?.isAdmin && (
              <Pressable
                style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: theme.border }]}
                onPress={() => navigation.navigate("Admin" as any)}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIconContainer, { backgroundColor: '#9C27B0' + '15' }]}>
                    <Feather name="shield" size={18} color="#9C27B0" />
                  </View>
                  <ThemedText style={[styles.menuItemLabel, { color: theme.text }]}>
                    Admin Dashboard
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>
            )}
            <Pressable
              style={styles.menuItem}
              onPress={handleLogout}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconContainer, { backgroundColor: theme.error + '15' }]}>
                  <Feather name="log-out" size={18} color={theme.error} />
                </View>
                <ThemedText style={[styles.menuItemLabel, { color: theme.error }]}>
                  {t('logout')}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={photoModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModalVisible(false)}
      >
        <View style={styles.photoModalOverlay}>
          <Pressable 
            style={styles.photoModalClose} 
            onPress={() => setPhotoModalVisible(false)}
          >
            <Feather name="x" size={28} color="#fff" />
          </Pressable>
          
          {user?.photos && user.photos.length > 0 && (
            <>
              <FlatList
                ref={flatListRef}
                data={user.photos}
                renderItem={renderPhotoItem}
                keyExtractor={(_, index) => index.toString()}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                initialScrollIndex={selectedPhoto}
                getItemLayout={(_, index) => ({
                  length: width,
                  offset: width * index,
                  index,
                })}
              />

              <View style={styles.photoModalActions}>
                <Pressable 
                  style={[styles.photoModalButton, { backgroundColor: theme.error }]}
                  onPress={() => handleDeletePhoto(selectedPhoto)}
                >
                  <Feather name="trash-2" size={18} color="#FFF" />
                  <ThemedText style={styles.photoModalButtonText}>{t('delete')}</ThemedText>
                </Pressable>
              </View>

              <View style={styles.modalPhotoIndicators}>
                {user.photos.map((_, index) => (
                  <Pressable 
                    key={index} 
                    onPress={() => {
                      setSelectedPhoto(index);
                      flatListRef.current?.scrollToIndex({ index, animated: true });
                    }}
                    style={[
                      styles.modalPhotoIndicator, 
                      { backgroundColor: index === selectedPhoto ? '#fff' : 'rgba(255,255,255,0.4)' }
                    ]} 
                  />
                ))}
              </View>

              <ThemedText style={styles.photoCounter}>
                {selectedPhoto + 1} / {user.photos.length}
              </ThemedText>
            </>
          )}
        </View>
      </Modal>
      <AlertComponent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  heroContainer: {
    width: width,
    height: HERO_HEIGHT,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HERO_HEIGHT * 0.5,
  },
  photoIndicators: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    zIndex: 10,
  },
  tapControls: {
    position: 'absolute',
    top: 60,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    flexDirection: 'row',
  },
  tapArea: {
    flex: 1,
  },
  photoIndicator: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    maxWidth: 60,
  },
  heroContent: {
    position: 'absolute',
    bottom: 20,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  heroName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    includeFontPadding: false,
    paddingBottom: 4,
  },
  heroAge: {
    fontSize: 28,
    fontWeight: "400",
    color: "#fff",
    marginLeft: 8,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    includeFontPadding: false,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  heroLocation: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  settingsButton: {
    position: 'absolute',
    top: 50,
    right: Spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.bodyBold,
    marginBottom: Spacing.sm,
  },
  editLink: {
    ...Typography.body,
    fontWeight: '500',
  },
  card: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  bio: {
    ...Typography.body,
    lineHeight: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  detailIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: {
    ...Typography.body,
  },
  detailValue: {
    ...Typography.body,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: Spacing.md,
  },
  interestsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  interestTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  interestText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  photoScroll: {
    marginTop: Spacing.sm,
  },
  photoItem: {
    width: 120,
    height: 160,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginRight: Spacing.sm,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  primaryBadge: {
    position: 'absolute',
    bottom: Spacing.xs,
    left: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  primaryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFF',
  },
  menuContainer: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemLabel: {
    ...Typography.body,
    fontWeight: "500",
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: Spacing.sm,
  },
  photoSlideContainer: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullPhoto: {
    width: width,
    height: width * 1.2,
  },
  photoModalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  photoModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  photoModalButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  modalPhotoIndicators: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.lg,
  },
  modalPhotoIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  photoCounter: {
    color: '#fff',
    marginTop: Spacing.md,
    opacity: 0.7,
  },
  premiumBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
    gap: 4,
  },
  premiumBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
  },
});

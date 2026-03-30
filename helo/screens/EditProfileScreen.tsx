import React, { useState, useEffect } from "react";
import { 
  View, 
  StyleSheet, 
  TextInput, 
  Pressable, 
  ScrollView, 
  Modal, 
  Alert, 
  FlatList,
  ActivityIndicator,
  Dimensions,
  Switch,
  Platform,
} from "react-native";
import { SafeImage } from "@/components/SafeImage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useThemedAlert } from "@/components/ThemedAlert";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useApi } from "@/hooks/useApi";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type EditProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "EditProfile">;

interface EditProfileScreenProps {
  navigation: EditProfileScreenNavigationProp;
}

const ZODIAC_OPTIONS = [
  { value: 'aries', label: 'Aries ♈' },
  { value: 'taurus', label: 'Taurus ♉' },
  { value: 'gemini', label: 'Gemini ♊' },
  { value: 'cancer', label: 'Cancer ♋' },
  { value: 'leo', label: 'Leo ♌' },
  { value: 'virgo', label: 'Virgo ♍' },
  { value: 'libra', label: 'Libra ♎' },
  { value: 'scorpio', label: 'Scorpio ♏' },
  { value: 'sagittarius', label: 'Sagittarius ♐' },
  { value: 'capricorn', label: 'Capricorn ♑' },
  { value: 'aquarius', label: 'Aquarius ♒' },
  { value: 'pisces', label: 'Pisces ♓' },
];

const EDUCATION_OPTIONS = [
  { value: 'high_school', label: 'High School' },
  { value: 'some_college', label: 'Some College' },
  { value: 'bachelors', label: "Bachelor's Degree" },
  { value: 'masters', label: "Master's Degree" },
  { value: 'doctorate', label: 'Doctorate' },
  { value: 'trade_school', label: 'Trade School' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const LOOKING_FOR_OPTIONS = [
  { value: 'relationship', label: 'Relationship' },
  { value: 'friendship', label: 'Friendship' },
  { value: 'casual', label: 'Casual' },
  { value: 'networking', label: 'Networking' },
];

const SMOKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const DRINKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const WORKOUT_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'rarely', label: 'Rarely' },
  { value: 'sometimes', label: 'Sometimes' },
  { value: 'often', label: 'Often' },
  { value: 'daily', label: 'Daily' },
];

const RELIGION_OPTIONS = [
  { value: 'christian', label: 'Christian' },
  { value: 'muslim', label: 'Muslim' },
  { value: 'traditional', label: 'Traditional' },
  { value: 'atheist', label: 'Atheist' },
  { value: 'agnostic', label: 'Agnostic' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const ETHNICITY_OPTIONS = [
  { value: 'african', label: 'African' },
  { value: 'african_american', label: 'African American' },
  { value: 'caribbean', label: 'Caribbean' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const PETS_OPTIONS = [
  { value: 'none', label: 'No pets' },
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'parrot', label: 'Parrot' },
  { value: 'other', label: 'Other' },
  { value: 'allergic', label: 'Allergic to pets' },
];

const RELATIONSHIP_STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'single_parent', label: 'Single Parent' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
];

const RELATIONSHIP_GOAL_OPTIONS = [
  { value: 'short_term', label: 'Short-term relationship' },
  { value: 'long_term', label: 'Long-term relationship' },
  { value: 'friendship', label: 'Friendship' },
  { value: 'networking', label: 'Networking' },
  { value: 'casual', label: 'Casual dating' },
  { value: 'marriage', label: 'Marriage' },
  { value: 'open_to_everything', label: 'Open to everything' },
  { value: 'not_sure_yet', label: 'Not sure yet' },
];

const COMMUNICATION_STYLE_OPTIONS = [
  { value: 'introverted', label: 'Introverted' },
  { value: 'extroverted', label: 'Extroverted' },
  { value: 'ambivert', label: 'Ambivert' },
  { value: 'big_talker', label: 'Big Talker' },
  { value: 'listener', label: 'Better Listener' },
  { value: 'texter', label: 'Prefer Texting' },
  { value: 'caller', label: 'Prefer Calling' },
];

const LOVE_STYLE_OPTIONS = [
  { value: 'romantic', label: 'Romantic' },
  { value: 'playful', label: 'Playful' },
  { value: 'practical', label: 'Practical' },
  { value: 'selfless', label: 'Selfless' },
  { value: 'physical', label: 'Physical Touch' },
  { value: 'acts_of_service', label: 'Acts of Service' },
  { value: 'words_of_affirmation', label: 'Words of Affirmation' },
  { value: 'quality_time', label: 'Quality Time' },
  { value: 'gift_giving', label: 'Gift Giving' },
];
const GENDER_OPTIONS = [
  { value: 'man', label: 'Man' },
  { value: 'woman', label: 'Woman' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

const HEIGHT_OPTIONS = Array.from({ length: 81 }, (_, i) => {
  const cm = 140 + i;
  const totalInches = Math.round(cm / 2.54);
  const ft = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { value: `${cm}`, label: `${cm} cm (${ft}'${inches}")` };
});
const EDIT_PROFILE_STORAGE_KEY = "afroconnect_edit_profile_draft";

const INTEREST_OPTIONS = [
  { id: 'music', label: 'Music', icon: 'musical-notes' },
  { id: 'travel', label: 'Travel', icon: 'airplane' },
  { id: 'cooking', label: 'Cooking', icon: 'restaurant' },
  { id: 'fitness', label: 'Fitness', icon: 'fitness' },
  { id: 'art', label: 'Art', icon: 'color-palette' },
  { id: 'gaming', label: 'Gaming', icon: 'game-controller' },
  { id: 'movies', label: 'Movies', icon: 'film' },
  { id: 'reading', label: 'Reading', icon: 'book' },
  { id: 'photography', label: 'Photography', icon: 'camera' },
  { id: 'dancing', label: 'Dancing', icon: 'footsteps' },
  { id: 'coding', label: 'Coding', icon: 'code-slash' },
  { id: 'sports', label: 'Sports', icon: 'basketball' },
  { id: 'fashion', label: 'Fashion', icon: 'shirt' },
  { id: 'nature', label: 'Nature', icon: 'leaf' },
  { id: 'technology', label: 'Technology', icon: 'hardware-chip' },
  { id: 'business', label: 'Business', icon: 'briefcase' },
  { id: 'outdoors', label: 'Outdoors', icon: 'trail-sign' },
  { id: 'socializing', label: 'Socializing', icon: 'people' },
  { id: 'wellness', label: 'Wellness', icon: 'heart-half' },
  { id: 'creativity', label: 'Creativity', icon: 'brush' },
  { id: 'values', label: 'Values', icon: 'diamond' },
  { id: 'food', label: 'Food', icon: 'fast-food' },
];

export default function EditProfileScreen({ navigation }: EditProfileScreenProps) {
  const { theme, isDark } = useTheme();
  const { user, updateProfile, fetchUser, token } = useAuth();
  const { del } = useApi();
  const { showAlert, AlertComponent } = useThemedAlert();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || "");
  const [livingIn, setLivingIn] = useState(user?.livingIn || "");
  const [zodiacSign, setZodiacSign] = useState(user?.zodiacSign || "");
  const [education, setEducation] = useState(user?.education || "");
  const [lookingFor, setLookingFor] = useState(user?.lookingFor || "relationship");
  const [songTitle, setSongTitle] = useState(user?.favoriteSong?.title || "");
  const [songArtist, setSongArtist] = useState(user?.favoriteSong?.artist || "");

  const [smoking, setSmoking] = useState(user?.lifestyle?.smoking || "");
  const [drinking, setDrinking] = useState(user?.lifestyle?.drinking || "");
  const [workout, setWorkout] = useState(user?.lifestyle?.workout || "");
  const [religion, setReligion] = useState(user?.lifestyle?.religion || "");
  const [ethnicity, setEthnicity] = useState(user?.lifestyle?.ethnicity || "");
  const [pets, setPets] = useState(user?.lifestyle?.pets || "");
  const [relationshipStatus, setRelationshipStatus] = useState(user?.lifestyle?.relationshipStatus || "");
  const [personalityType, setPersonalityType] = useState(user?.lifestyle?.personalityType || "");
  const [communicationStyle, setCommunicationStyle] = useState(user?.lifestyle?.communicationStyle || "");
  const [loveStyle, setLoveStyle] = useState(user?.lifestyle?.loveStyle || "");
  const [hasKids, setHasKids] = useState<boolean>(user?.lifestyle?.hasKids ?? false);
  const [wantsKids, setWantsKids] = useState<boolean>(user?.lifestyle?.wantsKids ?? false);
  const [relationshipGoal, setRelationshipGoal] = useState((user as any)?.relationshipGoal || "");
  const [gender, setGender] = useState(user?.gender || "");
  const [height, setHeight] = useState(user?.height?.toString() || "");
  const [username, setUsername] = useState(user?.username || "");
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [saving, setSaving] = useState(false);

  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [interestsModalVisible, setInterestsModalVisible] = useState(false);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem(EDIT_PROFILE_STORAGE_KEY);
        if (draft) {
          const d = JSON.parse(draft);
          if (d.name) setName(d.name);
          if (d.bio) setBio(d.bio);
          if (d.jobTitle) setJobTitle(d.jobTitle);
          if (d.livingIn) setLivingIn(d.livingIn);
          if (d.zodiacSign) setZodiacSign(d.zodiacSign);
          if (d.education) setEducation(d.education);
          if (d.lookingFor) setLookingFor(d.lookingFor);
          if (d.songTitle) setSongTitle(d.songTitle);
          if (d.songArtist) setSongArtist(d.songArtist);
          if (d.smoking) setSmoking(d.smoking);
          if (d.drinking) setDrinking(d.drinking);
          if (d.workout) setWorkout(d.workout);
          if (d.religion) setReligion(d.religion);
          if (d.ethnicity) setEthnicity(d.ethnicity);
          if (d.pets) setPets(d.pets);
          if (d.relationshipStatus) setRelationshipStatus(d.relationshipStatus);
          if (d.personalityType) setPersonalityType(d.personalityType);
          if (d.communicationStyle) setCommunicationStyle(d.communicationStyle);
          if (d.loveStyle) setLoveStyle(d.loveStyle);
          if (d.hasKids != null) setHasKids(d.hasKids);
          if (d.wantsKids != null) setWantsKids(d.wantsKids);
          if (d.relationshipGoal) setRelationshipGoal(d.relationshipGoal);
          if (d.interests) setInterests(d.interests);
        }
      } catch (e) {
        console.error("Failed to load edit profile draft:", e);
      }
    };
    loadDraft();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert("Error", "Name is required", [{ text: "OK", style: "default" }], "alert-circle");
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        bio: bio.trim(),
        jobTitle: jobTitle.trim(),
        livingIn: livingIn.trim(),
        zodiacSign: zodiacSign || undefined,
        education: education || undefined,
        lookingFor: lookingFor as any,
        relationshipGoal: relationshipGoal || undefined,
        gender: gender || undefined,
        height: height ? parseInt(height) : undefined,
        username: username.trim() || undefined,
        favoriteSong: (songTitle.trim() || songArtist.trim()) ? {
          title: songTitle.trim(),
          artist: songArtist.trim(),
        } : undefined,
        lifestyle: {
          smoking: smoking || undefined,
          drinking: drinking || undefined,
          workout: workout || undefined,
          religion: religion || undefined,
          ethnicity: ethnicity || undefined,
          pets: pets || undefined,
          relationshipStatus: relationshipStatus || undefined,
          personalityType: personalityType.trim() || undefined,
          communicationStyle: communicationStyle || undefined,
          loveStyle: loveStyle || undefined,
          hasKids,
          wantsKids,
        },
        interests,
        language: user?.language || 'en'
      } as any);

      await AsyncStorage.removeItem(EDIT_PROFILE_STORAGE_KEY);
      if (fetchUser) await fetchUser();
      Alert.alert("Success", "Profile updated successfully", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to update profile", [{ text: "OK", style: "default" }], "alert-circle");
    } finally {
      setSaving(false);
    }
  };

  const toggleInterest = (id: string) => {
    setInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const InterestModal = ({ visible, onClose }: any) => (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface, height: '70%' }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Select Interests</ThemedText>
            <Pressable onPress={onClose}><Feather name="x" size={24} color={theme.text} /></Pressable>
          </View>
          <FlatList
            data={INTEREST_OPTIONS}
            keyExtractor={(item) => item.id}
            numColumns={2}
            renderItem={({ item }) => {
              const isSelected = interests.includes(item.id);
              return (
                <Pressable
                  style={[
                    styles.interestOptionItem,
                    {
                      borderColor: isSelected ? theme.primary : theme.border,
                      backgroundColor: isSelected ? theme.primary + '10' : 'transparent'
                    }
                  ]}
                  onPress={() => toggleInterest(item.id)}
                >
                  <Ionicons name={item.icon as any} size={20} color={isSelected ? theme.primary : theme.textSecondary} />
                  <ThemedText style={[styles.interestOptionLabel, { color: theme.text }, isSelected && { color: theme.primary, fontWeight: '700' }]}>
                    {item.label}
                  </ThemedText>
                  {isSelected && <Feather name="check-circle" size={16} color={theme.primary} />}
                </Pressable>
              );
            }}
          />
          <Pressable style={[styles.doneButton, { backgroundColor: theme.primary }]} onPress={onClose}>
            <ThemedText style={styles.doneButtonText}>Done ({interests.length})</ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );

  const OptionModal = ({ visible, onClose, title, options, selectedValue, onSelect }: any) => (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>{title}</ThemedText>
            <Pressable onPress={onClose}><Feather name="x" size={24} color={theme.text} /></Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item: any) => item.value}
            renderItem={({ item }: any) => (
              <Pressable
                style={[styles.optionItem, { borderBottomColor: theme.border }]}
                onPress={() => { onSelect(item.value); onClose(); }}
              >
                <ThemedText style={[styles.optionLabel, { color: theme.text }, selectedValue === item.value && { color: theme.primary, fontWeight: '700' }]}>
                  {item.label}
                </ThemedText>
                {selectedValue === item.value && <Feather name="check" size={20} color={theme.primary} />}
              </Pressable>
            )}
          />
        </View>
      </Pressable>
    </Modal>
  );

  const SelectButton = ({ label, value, options, onPress, icon }: any) => {
    const displayLabel = options ? options.find((o: any) => o.value === value)?.label : value;
    return (
      <Pressable style={[styles.selectButton, { backgroundColor: isDark ? theme.surface : '#F8F9FA', borderColor: theme.border }]} onPress={onPress}>
        {icon && <Feather name={icon} size={18} color={value ? theme.primary : theme.textSecondary} style={{ marginRight: 10 }} />}
        <ThemedText style={[styles.selectButtonText, { color: theme.text, flex: 1 }, !value && { color: theme.textSecondary }]}>{displayLabel || label}</ThemedText>
        <Feather name="chevron-down" size={18} color={theme.textSecondary} />
      </Pressable>
    );
  };

  const InputField = ({ label, value, onChangeText, placeholder, multiline, icon }: any) => (
    <View style={styles.fieldContainer}>
      <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
      <View style={[styles.inputRow, { backgroundColor: isDark ? theme.surface : '#F8F9FA', borderColor: theme.border }]}>
        {icon && <Feather name={icon} size={18} color={theme.textSecondary} style={{ marginRight: 10 }} />}
        <TextInput
          style={[styles.textInput, { color: theme.text }, multiline && styles.multilineInput]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          multiline={multiline}
        />
      </View>
    </View>
  );

  const ToggleField = ({ label, value, onValueChange, icon }: any) => (
    <View style={[styles.toggleRow, { backgroundColor: isDark ? theme.surface : '#F8F9FA', borderColor: theme.border }]}>
      <View style={styles.toggleLeft}>
        {icon && <Feather name={icon} size={18} color={theme.primary} style={{ marginRight: 10 }} />}
        <ThemedText style={[styles.toggleLabel, { color: theme.text }]}>{label}</ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: theme.primary + '80' }}
        thumbColor={value ? theme.primary : theme.textTertiary}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Ionicons name="close" size={26} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Edit Profile</ThemedText>
        <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, { backgroundColor: theme.primary }]}>
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <ThemedText style={styles.saveBtnText}>Save</ThemedText>
          )}
        </Pressable>
      </View>

      <ScreenKeyboardAwareScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        <Pressable
          style={[styles.photoSection, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => navigation.navigate('ChangeProfilePicture')}
        >
          <View style={[styles.photoWrap, { backgroundColor: theme.background }]}>
            {user?.photos?.[0] ? (
              <SafeImage
                source={typeof user.photos[0] === 'string' ? user.photos[0] : user.photos[0].url}
                style={styles.photoImage}
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="camera" size={36} color={theme.textSecondary} />
              </View>
            )}
            <View style={[styles.editBadge, { backgroundColor: theme.primary }]}>
              <Feather name="camera" size={14} color="#FFF" />
            </View>
          </View>
          <View style={{ marginLeft: 16, flex: 1 }}>
            <ThemedText style={[styles.photoTitle, { color: theme.text }]}>Profile Photo</ThemedText>
            <ThemedText style={[styles.photoSubtitle, { color: theme.textSecondary }]}>Tap to change photos</ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={theme.textSecondary} />
        </Pressable>

        {/* ── CARD 1: Basic Info ── */}
        <View style={[styles.card, { backgroundColor: theme.card || theme.surface, borderColor: theme.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: theme.border }]}>
            <View style={[styles.cardIconWrap, { backgroundColor: theme.primary + '18' }]}>
              <Feather name="user" size={16} color={theme.primary} />
            </View>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Basic Info</ThemedText>
          </View>
          <InputField label="Name *" value={name} onChangeText={setName} placeholder="Your full name" icon="user" />
          <InputField label="Username" value={username} onChangeText={setUsername} placeholder="@yourhandle" icon="at-sign" />
          <InputField label="Bio" value={bio} onChangeText={setBio} placeholder="Tell people about yourself..." multiline icon="edit-3" />
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Gender</ThemedText>
            <SelectButton label="Select your gender" value={gender} options={GENDER_OPTIONS} onPress={() => setActiveModal('gender')} icon="user" />
          </View>
        </View>

        {/* ── CARD 2: Personal Details ── */}
        <View style={[styles.card, { backgroundColor: theme.card || theme.surface, borderColor: theme.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: theme.border }]}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#9B59B6' + '18' }]}>
              <Feather name="sliders" size={16} color="#9B59B6" />
            </View>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Personal Details</ThemedText>
          </View>
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Height</ThemedText>
            <SelectButton label="Your height" value={height} options={HEIGHT_OPTIONS} onPress={() => setActiveModal('height')} icon="trending-up" />
          </View>
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Zodiac Sign</ThemedText>
            <SelectButton label="Your star sign" value={zodiacSign} options={ZODIAC_OPTIONS} onPress={() => setActiveModal('zodiac')} icon="star" />
          </View>
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Ethnicity</ThemedText>
            <SelectButton label="Your background" value={ethnicity} options={ETHNICITY_OPTIONS} onPress={() => setActiveModal('ethnicity')} icon="globe" />
          </View>
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Religion</ThemedText>
            <SelectButton label="Your beliefs" value={religion} options={RELIGION_OPTIONS} onPress={() => setActiveModal('religion')} icon="sun" />
          </View>
        </View>

        {/* ── CARD 3: Dating Preferences ── */}
        <View style={[styles.card, { backgroundColor: theme.card || theme.surface, borderColor: theme.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: theme.border }]}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#E91E63' + '18' }]}>
              <Feather name="heart" size={16} color="#E91E63" />
            </View>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Dating Preferences</ThemedText>
          </View>
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Looking For</ThemedText>
            <SelectButton label="What are you looking for?" value={lookingFor} options={LOOKING_FOR_OPTIONS} onPress={() => setActiveModal('lookingFor')} icon="search" />
          </View>
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Relationship Goal</ThemedText>
            <SelectButton label="Your relationship goal" value={relationshipGoal} options={RELATIONSHIP_GOAL_OPTIONS} onPress={() => setActiveModal('relationshipGoal')} icon="target" />
          </View>
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Relationship Status</ThemedText>
            <SelectButton label="Current relationship status" value={relationshipStatus} options={RELATIONSHIP_STATUS_OPTIONS} onPress={() => setActiveModal('relationshipStatus')} icon="heart" />
          </View>
        </View>

        {/* ── CARD 4: Personality ── */}
        <View style={[styles.card, { backgroundColor: theme.card || theme.surface, borderColor: theme.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: theme.border }]}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#FF9800' + '18' }]}>
              <Feather name="zap" size={16} color="#FF9800" />
            </View>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Personality</ThemedText>
          </View>
          <InputField label="Personality Type" value={personalityType} onChangeText={setPersonalityType} placeholder="e.g. ENFP, Adventurer, Creative..." icon="zap" />
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Communication Style</ThemedText>
            <SelectButton label="How you communicate" value={communicationStyle} options={COMMUNICATION_STYLE_OPTIONS} onPress={() => setActiveModal('communicationStyle')} icon="message-circle" />
          </View>
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Love Style</ThemedText>
            <SelectButton label="How you express love" value={loveStyle} options={LOVE_STYLE_OPTIONS} onPress={() => setActiveModal('loveStyle')} icon="heart" />
          </View>
        </View>

        {/* ── CARD 5: Lifestyle ── */}
        <View style={[styles.card, { backgroundColor: theme.card || theme.surface, borderColor: theme.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: theme.border }]}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#4CAF50' + '18' }]}>
              <Feather name="activity" size={16} color="#4CAF50" />
            </View>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Lifestyle</ThemedText>
          </View>
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Smoking</ThemedText>
            <SelectButton label="Do you smoke?" value={smoking} options={SMOKING_OPTIONS} onPress={() => setActiveModal('smoking')} icon="wind" />
          </View>
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Drinking</ThemedText>
            <SelectButton label="Do you drink?" value={drinking} options={DRINKING_OPTIONS} onPress={() => setActiveModal('drinking')} icon="coffee" />
          </View>
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Workout</ThemedText>
            <SelectButton label="How often do you work out?" value={workout} options={WORKOUT_OPTIONS} onPress={() => setActiveModal('workout')} icon="activity" />
          </View>
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Pets</ThemedText>
            <SelectButton label="Do you have pets?" value={pets} options={PETS_OPTIONS} onPress={() => setActiveModal('pets')} icon="heart" />
          </View>
          <View style={[styles.togglesRow, { backgroundColor: isDark ? theme.background : '#F8F9FA', borderColor: theme.border }]}>
            <ToggleField label="Has Kids" value={hasKids} onValueChange={setHasKids} icon="users" />
            <View style={[styles.toggleDivider, { backgroundColor: theme.border }]} />
            <ToggleField label="Wants Kids" value={wantsKids} onValueChange={setWantsKids} icon="smile" />
          </View>
        </View>

        {/* ── CARD 6: Interests ── */}
        <View style={[styles.card, { backgroundColor: theme.card || theme.surface, borderColor: theme.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: theme.border }]}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#00B2FF' + '18' }]}>
              <Feather name="star" size={16} color="#00B2FF" />
            </View>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Interests</ThemedText>
            {interests.length > 0 && (
              <View style={[styles.interestBadge, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.interestBadgeText}>{interests.length}</ThemedText>
              </View>
            )}
          </View>
          <Pressable
            style={[styles.selectButton, { backgroundColor: isDark ? theme.background : '#F8F9FA', borderColor: theme.primary, borderStyle: 'dashed' }]}
            onPress={() => setInterestsModalVisible(true)}
          >
            <Feather name="plus-circle" size={18} color={theme.primary} style={{ marginRight: 10 }} />
            <ThemedText style={[styles.selectButtonText, { color: theme.primary, flex: 1 }]}>
              {interests.length > 0 ? `Edit ${interests.length} interests` : "Add your interests"}
            </ThemedText>
            <Feather name="chevron-right" size={18} color={theme.primary} />
          </Pressable>
          {interests.length > 0 && (
            <View style={styles.interestsRow}>
              {interests.map((interest: string) => {
                const opt = INTEREST_OPTIONS.find(o => o.id === interest);
                return (
                  <View key={interest} style={[styles.interestChip, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}>
                    {opt && <Ionicons name={opt.icon as any} size={13} color={theme.primary} />}
                    <ThemedText style={[styles.interestChipText, { color: theme.text }]}>{opt?.label || interest}</ThemedText>
                    <Pressable onPress={() => toggleInterest(interest)} style={styles.removeInterest} hitSlop={8}>
                      <Feather name="x" size={12} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── CARD 7: Work & Location ── */}
        <View style={[styles.card, { backgroundColor: theme.card || theme.surface, borderColor: theme.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: theme.border }]}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#FF6B6B' + '18' }]}>
              <Feather name="briefcase" size={16} color="#FF6B6B" />
            </View>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Work & Location</ThemedText>
          </View>
          <InputField label="Job Title" value={jobTitle} onChangeText={setJobTitle} placeholder="What do you do for work?" icon="briefcase" />
          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Education</ThemedText>
            <SelectButton label="Education level" value={education} options={EDUCATION_OPTIONS} onPress={() => setActiveModal('education')} icon="book" />
          </View>
          <InputField label="Living In" value={livingIn} onChangeText={setLivingIn} placeholder="City you live in" icon="map-pin" />
        </View>

        {/* ── CARD 8: Favorite Song ── */}
        <View style={[styles.card, { backgroundColor: theme.card || theme.surface, borderColor: theme.border }]}>
          <View style={[styles.cardHeader, { borderBottomColor: theme.border }]}>
            <View style={[styles.cardIconWrap, { backgroundColor: '#FF9800' + '18' }]}>
              <Feather name="music" size={16} color="#FF9800" />
            </View>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Favorite Song</ThemedText>
          </View>
          <InputField label="Song Title" value={songTitle} onChangeText={setSongTitle} placeholder="What's your current jam?" icon="music" />
          <InputField label="Artist" value={songArtist} onChangeText={setSongArtist} placeholder="Who sings it?" icon="mic" />
        </View>
      </ScreenKeyboardAwareScrollView>

      <OptionModal visible={activeModal === 'gender'} onClose={() => setActiveModal(null)} title="Gender" options={GENDER_OPTIONS} selectedValue={gender} onSelect={setGender} />
      <OptionModal visible={activeModal === 'height'} onClose={() => setActiveModal(null)} title="Height" options={HEIGHT_OPTIONS} selectedValue={height} onSelect={setHeight} />
      <OptionModal visible={activeModal === 'lookingFor'} onClose={() => setActiveModal(null)} title="Looking For" options={LOOKING_FOR_OPTIONS} selectedValue={lookingFor} onSelect={setLookingFor} />
      <OptionModal visible={activeModal === 'relationshipGoal'} onClose={() => setActiveModal(null)} title="Relationship Goal" options={RELATIONSHIP_GOAL_OPTIONS} selectedValue={relationshipGoal} onSelect={setRelationshipGoal} />
      <OptionModal visible={activeModal === 'relationshipStatus'} onClose={() => setActiveModal(null)} title="Relationship Status" options={RELATIONSHIP_STATUS_OPTIONS} selectedValue={relationshipStatus} onSelect={setRelationshipStatus} />
      <OptionModal visible={activeModal === 'smoking'} onClose={() => setActiveModal(null)} title="Smoking" options={SMOKING_OPTIONS} selectedValue={smoking} onSelect={setSmoking} />
      <OptionModal visible={activeModal === 'drinking'} onClose={() => setActiveModal(null)} title="Drinking" options={DRINKING_OPTIONS} selectedValue={drinking} onSelect={setDrinking} />
      <OptionModal visible={activeModal === 'workout'} onClose={() => setActiveModal(null)} title="Workout" options={WORKOUT_OPTIONS} selectedValue={workout} onSelect={setWorkout} />
      <OptionModal visible={activeModal === 'religion'} onClose={() => setActiveModal(null)} title="Religion" options={RELIGION_OPTIONS} selectedValue={religion} onSelect={setReligion} />
      <OptionModal visible={activeModal === 'zodiac'} onClose={() => setActiveModal(null)} title="Zodiac Sign" options={ZODIAC_OPTIONS} selectedValue={zodiacSign} onSelect={setZodiacSign} />
      <OptionModal visible={activeModal === 'education'} onClose={() => setActiveModal(null)} title="Education" options={EDUCATION_OPTIONS} selectedValue={education} onSelect={setEducation} />
      <OptionModal visible={activeModal === 'ethnicity'} onClose={() => setActiveModal(null)} title="Ethnicity" options={ETHNICITY_OPTIONS} selectedValue={ethnicity} onSelect={setEthnicity} />
      <OptionModal visible={activeModal === 'pets'} onClose={() => setActiveModal(null)} title="Pets" options={PETS_OPTIONS} selectedValue={pets} onSelect={setPets} />
      <OptionModal visible={activeModal === 'communicationStyle'} onClose={() => setActiveModal(null)} title="Communication Style" options={COMMUNICATION_STYLE_OPTIONS} selectedValue={communicationStyle} onSelect={setCommunicationStyle} />
      <OptionModal visible={activeModal === 'loveStyle'} onClose={() => setActiveModal(null)} title="Love Style" options={LOVE_STYLE_OPTIONS} selectedValue={loveStyle} onSelect={setLoveStyle} />
      <InterestModal visible={interestsModalVisible} onClose={() => setInterestsModalVisible(false)} />
      <AlertComponent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
  },
  saveBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  scrollView: { flex: 1 },
  photoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  photoWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
  },
  photoImage: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  photoTitle: { fontSize: 16, fontWeight: '700' },
  photoSubtitle: { fontSize: 13, marginTop: 2 },
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  fieldContainer: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.4, textTransform: 'uppercase' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  textInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  multilineInput: { minHeight: 90, textAlignVertical: 'top' },
  selectButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  selectButtonText: { fontSize: 15 },
  togglesRow: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 0,
  },
  toggleDivider: {
    height: 1,
    marginHorizontal: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: '500' },
  interestBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  interestBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  interestChipText: { fontSize: 13, fontWeight: '500' },
  removeInterest: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 0, maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  interestOptionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    margin: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  interestOptionLabel: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  doneButton: {
    margin: 16,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionLabel: { fontSize: 16 },
});

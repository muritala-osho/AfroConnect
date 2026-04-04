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
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import VoiceBio from "@/components/VoiceBio";
import { getApiBaseUrl } from "@/constants/config";

type EditProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "EditProfile">;

interface EditProfileScreenProps {
  navigation: EditProfileScreenNavigationProp;
}

const EDIT_PROFILE_STORAGE_KEY = "afroconnect_edit_profile_draft";

const ZODIAC_OPTIONS = [
  { value: 'aries', label: 'Aries â™ˆ' },
  { value: 'taurus', label: 'Taurus â™‰' },
  { value: 'gemini', label: 'Gemini â™Š' },
  { value: 'cancer', label: 'Cancer â™‹' },
  { value: 'leo', label: 'Leo â™Œ' },
  { value: 'virgo', label: 'Virgo â™' },
  { value: 'libra', label: 'Libra â™Ž' },
  { value: 'scorpio', label: 'Scorpio â™' },
  { value: 'sagittarius', label: 'Sagittarius â™' },
  { value: 'capricorn', label: 'Capricorn â™‘' },
  { value: 'aquarius', label: 'Aquarius â™’' },
  { value: 'pisces', label: 'Pisces â™“' },
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

const DIASPORA_GENERATION_OPTIONS = [
  { value: '1st', label: '1st Generation (Born in Africa)' },
  { value: '2nd', label: '2nd Generation (Parents born in Africa)' },
  { value: '3rd', label: '3rd Generation (Grandparents born in Africa)' },
  { value: 'returnee', label: 'Returnee (Moved back to Africa)' },
  { value: 'other', label: 'Other' },
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
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [saving, setSaving] = useState(false);

  const [countryOfOrigin, setCountryOfOrigin] = useState((user as any)?.countryOfOrigin || "");
  const [tribe, setTribe] = useState((user as any)?.tribe || "");
  const [languagesSpoken, setLanguagesSpoken] = useState((user as any)?.languages?.join(", ") || "");
  const [diasporaGeneration, setDiasporaGeneration] = useState((user as any)?.diasporaGeneration || "");
  const [voiceBioUrl, setVoiceBioUrl] = useState((user as any)?.voiceBio?.url || "");
  const [voiceBioDuration, setVoiceBioDuration] = useState((user as any)?.voiceBio?.duration || 0);

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
        language: user?.language || 'en',
        countryOfOrigin: countryOfOrigin.trim() || undefined,
        tribe: tribe.trim() || undefined,
        languages: languagesSpoken.trim() ? languagesSpoken.split(",").map((l: string) => l.trim()).filter(Boolean) : undefined,
        diasporaGeneration: diasporaGeneration || undefined,
      } as any);

      await AsyncStorage.removeItem(EDIT_PROFILE_STORAGE_KEY);
      if (fetchUser) await fetchUser();
      Alert.alert("Success", "Profile updated successfully", [
        { text: "OK", onPress: () => navigation.goBack() },
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

  const handleVoiceBioRecord = async (uri: string, duration: number) => {
    try {
      const formData = new FormData();
      formData.append('audio', { uri, name: 'voice_bio.m4a', type: 'audio/mp4' } as any);
      const res = await fetch(`${getApiBaseUrl()}/api/upload/voice-bio`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      let data: any;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        throw new Error(text.startsWith('<') ? 'Server error. Please try again.' : text || 'Upload failed');
      }

      if (!res.ok) throw new Error(data?.message || 'Upload failed');
      setVoiceBioUrl(data.url);
      setVoiceBioDuration(duration);
      if (fetchUser) await fetchUser();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to upload voice bio', [{ text: 'OK', style: 'default' }], 'alert-circle');
    }
  };

  const handleVoiceBioDelete = async () => {
    try {
      await del('/upload/voice-bio', token ?? undefined);
      setVoiceBioUrl('');
      setVoiceBioDuration(0);
      if (fetchUser) await fetchUser();
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to delete voice bio', [{ text: 'OK', style: 'default' }], 'alert-circle');
    }
  };

  const InterestModal = ({ visible, onClose }: any) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
          <View style={[styles.modalDragHandle, { backgroundColor: theme.border }]} />
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <View>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Your Interests</ThemedText>
              <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                {interests.length} selected
              </ThemedText>
            </View>
            <Pressable onPress={onClose} style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F0F0F0' }]}>
              <Feather name="x" size={18} color={theme.text} />
            </Pressable>
          </View>
          <FlatList
            data={INTEREST_OPTIONS}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            renderItem={({ item }) => {
              const isSelected = interests.includes(item.id);
              return (
                <Pressable
                  style={[
                    styles.interestOptionItem,
                    {
                      borderColor: isSelected ? theme.primary : theme.border,
                      backgroundColor: isSelected ? theme.primary + '18' : isDark ? 'rgba(255,255,255,0.04)' : '#FAFAFA',
                    },
                  ]}
                  onPress={() => toggleInterest(item.id)}
                >
                  <View style={[styles.interestIconWrap, { backgroundColor: isSelected ? theme.primary + '25' : theme.border + '40' }]}>
                    <Ionicons name={item.icon as any} size={16} color={isSelected ? theme.primary : theme.textSecondary} />
                  </View>
                  <ThemedText style={[styles.interestOptionLabel, { color: isSelected ? theme.primary : theme.text, fontWeight: isSelected ? '700' : '500' }]}>
                    {item.label}
                  </ThemedText>
                  {isSelected && (
                    <View style={[styles.interestCheckBadge, { backgroundColor: theme.primary }]}>
                      <Feather name="check" size={10} color="#FFF" />
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
          <View style={[styles.modalFooter, { borderTopColor: theme.border, backgroundColor: theme.surface, paddingBottom: insets.bottom + 8 }]}>
            <Pressable style={[styles.doneButton, { backgroundColor: theme.primary }]} onPress={onClose}>
              <ThemedText style={styles.doneButtonText}>Done  Â·  {interests.length} selected</ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  const OptionModal = ({ visible, onClose, title, subtitle, options, selectedValue, onSelect }: any) => (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalSheet, { backgroundColor: theme.surface }]}>
          <View style={[styles.modalDragHandle, { backgroundColor: theme.border }]} />
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <View>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>{title}</ThemedText>
              {subtitle && (
                <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>{subtitle}</ThemedText>
              )}
            </View>
            <Pressable onPress={onClose} style={[styles.modalCloseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F0F0F0' }]}>
              <Feather name="x" size={18} color={theme.text} />
            </Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item: any) => item.value}
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item }: any) => {
              const isSelected = selectedValue === item.value;
              return (
                <Pressable
                  style={[
                    styles.optionItem,
                    { borderBottomColor: theme.border },
                    isSelected && { backgroundColor: theme.primary + '0C' },
                  ]}
                  onPress={() => { onSelect(item.value); onClose(); }}
                >
                  <ThemedText style={[styles.optionLabel, { color: isSelected ? theme.primary : theme.text, fontWeight: isSelected ? '700' : '400' }]}>
                    {item.label}
                  </ThemedText>
                  {isSelected && (
                    <View style={[styles.optionCheckCircle, { backgroundColor: theme.primary }]}>
                      <Feather name="check" size={12} color="#FFF" />
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );

  const SelectButton = ({ label, value, options, onPress, icon, accent }: any) => {
    const displayLabel = options ? options.find((o: any) => o.value === value)?.label : value;
    const hasValue = !!value;
    return (
      <Pressable
        style={[
          styles.selectButton,
          {
            backgroundColor: hasValue
              ? (accent ? accent + '10' : theme.primary + '0D')
              : (isDark ? 'rgba(255,255,255,0.04)' : '#F7F8FA'),
            borderColor: hasValue ? (accent || theme.primary) + '40' : theme.border,
          },
        ]}
        onPress={onPress}
      >
        {icon && (
          <View style={[styles.selectIconWrap, { backgroundColor: hasValue ? (accent || theme.primary) + '15' : theme.border + '50' }]}>
            <Feather name={icon} size={15} color={hasValue ? (accent || theme.primary) : theme.textSecondary} />
          </View>
        )}
        <ThemedText style={[styles.selectButtonText, { color: hasValue ? theme.text : theme.textSecondary, fontWeight: hasValue ? '500' : '400' }]}>
          {displayLabel || label}
        </ThemedText>
        <Feather name="chevron-down" size={16} color={hasValue ? (accent || theme.primary) : theme.textSecondary} />
      </Pressable>
    );
  };

  const InputField = ({ label, value, onChangeText, placeholder, multiline, icon, accent }: any) => (
    <View style={styles.fieldContainer}>
      <View style={styles.fieldLabelRow}>
        <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
        {value?.length > 0 && (
          <View style={[styles.fieldFilledDot, { backgroundColor: accent || theme.primary }]} />
        )}
      </View>
      <View style={[
        styles.inputRow,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F7F8FA',
          borderColor: value?.length > 0 ? (accent || theme.primary) + '40' : theme.border,
        },
      ]}>
        {icon && (
          <View style={[styles.selectIconWrap, { backgroundColor: value?.length > 0 ? (accent || theme.primary) + '15' : theme.border + '50' }]}>
            <Feather name={icon} size={15} color={value?.length > 0 ? (accent || theme.primary) : theme.textSecondary} />
          </View>
        )}
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

  const ToggleField = ({ label, description, value, onValueChange, icon, accent }: any) => (
    <View style={[styles.toggleRow, { backgroundColor: 'transparent' }]}>
      <View style={styles.toggleLeft}>
        <View style={[styles.toggleIconWrap, { backgroundColor: (accent || theme.primary) + '15' }]}>
          <Feather name={icon} size={16} color={accent || theme.primary} />
        </View>
        <View style={styles.toggleTextGroup}>
          <ThemedText style={[styles.toggleLabel, { color: theme.text }]}>{label}</ThemedText>
          {description && (
            <ThemedText style={[styles.toggleDescription, { color: theme.textSecondary }]}>{description}</ThemedText>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.border, true: (accent || theme.primary) + '90' }}
        thumbColor={value ? (accent || theme.primary) : isDark ? '#888' : '#CCC'}
      />
    </View>
  );

  const SectionHeader = ({ icon, label, color, description }: { icon: any; label: string; color: string; description?: string }) => (
    <View style={[styles.sectionHeader, { borderBottomColor: theme.border + '60' }]}>
      <LinearGradient
        colors={[color + '25', color + '10']}
        style={styles.sectionIconWrap}
      >
        <Feather name={icon} size={17} color={color} />
      </LinearGradient>
      <View style={styles.sectionHeaderText}>
        <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{label}</ThemedText>
        {description && (
          <ThemedText style={[styles.sectionDescription, { color: theme.textSecondary }]}>{description}</ThemedText>
        )}
      </View>
    </View>
  );

  const filledFields = [
    name, bio, jobTitle, livingIn, zodiacSign, education, lookingFor,
    songTitle, smoking, drinking, workout, religion, ethnicity, pets,
    relationshipStatus, communicationStyle, loveStyle, gender, height,
    personalityType, countryOfOrigin, tribe,
  ].filter(Boolean).length + (interests.length > 0 ? 1 : 0);
  const totalFields = 23;
  const completionPct = Math.round((filledFields / totalFields) * 100);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <LinearGradient
        colors={isDark
          ? [theme.primary + '22', theme.primary + '08', 'transparent']
          : [theme.primary + '18', theme.primary + '06', 'transparent']}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <Pressable onPress={() => navigation.goBack()} style={[styles.headerIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>Edit Profile</ThemedText>
          <ThemedText style={[styles.headerTagline, { color: theme.primary }]}>
            {completionPct}% complete
          </ThemedText>
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={[styles.saveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Feather name="check" size={15} color="#FFF" />
              <ThemedText style={styles.saveBtnText}>Save</ThemedText>
            </>
          )}
        </Pressable>
      </LinearGradient>

      {/* COMPLETION BAR */}
      <View style={[styles.completionBarWrap, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <View style={[styles.completionBarTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#EFEFEF' }]}>
          <LinearGradient
            colors={[theme.primary, theme.primary + 'BB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.completionBarFill, { width: `${completionPct}%` as any }]}
          />
        </View>
        <ThemedText style={[styles.completionBarLabel, { color: theme.textSecondary }]}>
          {totalFields - filledFields > 0 ? `${totalFields - filledFields} fields left to fill` : 'Profile complete!'}
        </ThemedText>
      </View>

      <ScreenKeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* PHOTO CARD */}
        <Pressable
          style={[styles.photoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={() => navigation.navigate('ChangeProfilePicture')}
        >
          <LinearGradient
            colors={[theme.primary + '18', theme.primary + '06']}
            style={styles.photoCardGradient}
          >
            <View style={styles.photoCardLeft}>
              <View style={[styles.photoAvatarRing, { borderColor: theme.primary + '50' }]}>
                {user?.photos?.[0] ? (
                  <SafeImage
                    source={typeof user.photos[0] === 'string' ? user.photos[0] : user.photos[0].url}
                    style={styles.photoImage}
                  />
                ) : (
                  <View style={[styles.photoPlaceholder, { backgroundColor: theme.primary + '15' }]}>
                    <Ionicons name="camera" size={32} color={theme.primary} />
                  </View>
                )}
                <View style={[styles.photoEditBadge, { backgroundColor: theme.primary, borderColor: theme.surface }]}>
                  <Feather name="camera" size={11} color="#FFF" />
                </View>
              </View>
            </View>
            <View style={styles.photoCardBody}>
              <ThemedText style={[styles.photoCardTitle, { color: theme.text }]}>
                {user?.name || 'Your Photos'}
              </ThemedText>
              <ThemedText style={[styles.photoCardSub, { color: theme.textSecondary }]}>
                {user?.photos?.length
                  ? `${user.photos.length} photo${user.photos.length !== 1 ? 's' : ''} Â· Tap to edit`
                  : 'Add up to 6 photos'}
              </ThemedText>
              <View style={styles.photoDotsRow}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.photoDot,
                      {
                        backgroundColor: i < (user?.photos?.length || 0)
                          ? theme.primary
                          : isDark ? 'rgba(255,255,255,0.15)' : '#DDD',
                        width: i < (user?.photos?.length || 0) ? 16 : 8,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textSecondary} />
          </LinearGradient>
        </Pressable>

        <View style={styles.content}>

          {/* BASIC INFO */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionHeader icon="user" label="Basic Info" color={theme.primary} description="How others see you" />
            <View style={styles.sectionBody}>
              <InputField label="Full Name *" value={name} onChangeText={setName} placeholder="Your name" icon="user" />
              <InputField label="Bio" value={bio} onChangeText={setBio} placeholder="Tell others about yourself..." multiline icon="edit-3" />
              <View style={styles.row2}>
                <View style={styles.halfField}>
                  <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Gender</ThemedText>
                  <SelectButton label="Gender" value={gender} options={GENDER_OPTIONS} onPress={() => setActiveModal('gender')} icon="users" />
                </View>
                <View style={styles.halfField}>
                  <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Height</ThemedText>
                  <SelectButton label="Height" value={height} options={HEIGHT_OPTIONS} onPress={() => setActiveModal('height')} icon="trending-up" />
                </View>
              </View>
            </View>
          </View>

          {/* INTERESTS */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionHeader icon="heart" label="Interests" color="#FF6B9D" description="What makes you, you" />
            <View style={styles.sectionBody}>
              <Pressable
                style={[styles.interestsTrigger, { borderColor: interests.length > 0 ? '#FF6B9D40' : theme.border, backgroundColor: interests.length > 0 ? '#FF6B9D08' : isDark ? 'rgba(255,255,255,0.04)' : '#F7F8FA' }]}
                onPress={() => setInterestsModalVisible(true)}
              >
                <View style={[styles.selectIconWrap, { backgroundColor: interests.length > 0 ? '#FF6B9D20' : theme.border + '50' }]}>
                  <Feather name="plus-circle" size={15} color={interests.length > 0 ? '#FF6B9D' : theme.textSecondary} />
                </View>
                <ThemedText style={[styles.selectButtonText, { color: interests.length > 0 ? theme.text : theme.textSecondary, flex: 1 }]}>
                  {interests.length > 0 ? `${interests.length} interests selected` : 'Choose your interests'}
                </ThemedText>
                <Feather name="chevron-right" size={16} color={interests.length > 0 ? '#FF6B9D' : theme.textSecondary} />
              </Pressable>

              {interests.length > 0 && (
                <View style={styles.interestsGrid}>
                  {interests.map((interest) => {
                    const opt = INTEREST_OPTIONS.find(o => o.id === interest);
                    return (
                      <View key={interest} style={[styles.interestChip, { backgroundColor: '#FF6B9D12', borderColor: '#FF6B9D30' }]}>
                        {opt && <Ionicons name={opt.icon as any} size={12} color="#FF6B9D" />}
                        <ThemedText style={[styles.interestChipText, { color: theme.text }]}>{opt?.label || interest}</ThemedText>
                        <Pressable onPress={() => toggleInterest(interest)} hitSlop={8}>
                          <Feather name="x" size={11} color={theme.textSecondary} />
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {/* DATING PREFERENCES */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionHeader icon="target" label="Dating Preferences" color="#8B5CF6" description="What you're looking for" />
            <View style={styles.sectionBody}>
              <View style={styles.fieldContainer}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Looking For</ThemedText>
                <SelectButton label="What are you seeking?" value={lookingFor} options={LOOKING_FOR_OPTIONS} onPress={() => setActiveModal('lookingFor')} icon="search" accent="#8B5CF6" />
              </View>
              <View style={styles.fieldContainer}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Relationship Goal</ThemedText>
                <SelectButton label="Your goal" value={relationshipGoal} options={RELATIONSHIP_GOAL_OPTIONS} onPress={() => setActiveModal('relationshipGoal')} icon="heart" accent="#8B5CF6" />
              </View>
              <View style={styles.fieldContainer}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Relationship Status</ThemedText>
                <SelectButton label="Current status" value={relationshipStatus} options={RELATIONSHIP_STATUS_OPTIONS} onPress={() => setActiveModal('relationshipStatus')} icon="info" accent="#8B5CF6" />
              </View>
            </View>
          </View>

          {/* PERSONALITY */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionHeader icon="zap" label="Personality" color="#F59E0B" description="Your inner world" />
            <View style={styles.sectionBody}>
              <InputField label="Personality Type" value={personalityType} onChangeText={setPersonalityType} placeholder="e.g. ENFP, Creative, Empath..." icon="star" accent="#F59E0B" />
              <View style={styles.fieldContainer}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Communication Style</ThemedText>
                <SelectButton label="How you communicate" value={communicationStyle} options={COMMUNICATION_STYLE_OPTIONS} onPress={() => setActiveModal('communicationStyle')} icon="message-circle" accent="#F59E0B" />
              </View>
              <View style={styles.fieldContainer}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Love Language</ThemedText>
                <SelectButton label="How you express love" value={loveStyle} options={LOVE_STYLE_OPTIONS} onPress={() => setActiveModal('loveStyle')} icon="heart" accent="#F59E0B" />
              </View>
              <View style={styles.fieldContainer}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Zodiac Sign</ThemedText>
                <SelectButton label="Your star sign" value={zodiacSign} options={ZODIAC_OPTIONS} onPress={() => setActiveModal('zodiac')} icon="star" accent="#F59E0B" />
              </View>
            </View>
          </View>

          {/* LIFESTYLE */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionHeader icon="coffee" label="Lifestyle" color="#10B981" description="Your day-to-day life" />
            <View style={styles.sectionBody}>
              <View style={styles.row2}>
                <View style={styles.halfField}>
                  <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Smoking</ThemedText>
                  <SelectButton label="Habits" value={smoking} options={SMOKING_OPTIONS} onPress={() => setActiveModal('smoking')} icon="wind" accent="#10B981" />
                </View>
                <View style={styles.halfField}>
                  <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Drinking</ThemedText>
                  <SelectButton label="Habits" value={drinking} options={DRINKING_OPTIONS} onPress={() => setActiveModal('drinking')} icon="coffee" accent="#10B981" />
                </View>
              </View>
              <View style={styles.row2}>
                <View style={styles.halfField}>
                  <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Workout</ThemedText>
                  <SelectButton label="Frequency" value={workout} options={WORKOUT_OPTIONS} onPress={() => setActiveModal('workout')} icon="activity" accent="#10B981" />
                </View>
                <View style={styles.halfField}>
                  <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Pets</ThemedText>
                  <SelectButton label="Pets?" value={pets} options={PETS_OPTIONS} onPress={() => setActiveModal('pets')} icon="heart" accent="#10B981" />
                </View>
              </View>
              <View style={[styles.toggleCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F7F8FA', borderColor: theme.border }]}>
                <ToggleField
                  label="Has Kids"
                  description="I currently have children"
                  value={hasKids}
                  onValueChange={setHasKids}
                  icon="users"
                  accent="#10B981"
                />
                <View style={[styles.toggleDivider, { backgroundColor: theme.border }]} />
                <ToggleField
                  label="Wants Kids"
                  description="Open to having children"
                  value={wantsKids}
                  onValueChange={setWantsKids}
                  icon="smile"
                  accent="#10B981"
                />
              </View>
            </View>
          </View>

          {/* BACKGROUND */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionHeader icon="globe" label="Background" color="#0EA5E9" description="Your roots and beliefs" />
            <View style={styles.sectionBody}>
              <View style={styles.fieldContainer}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Ethnicity</ThemedText>
                <SelectButton label="Your ethnicity" value={ethnicity} options={ETHNICITY_OPTIONS} onPress={() => setActiveModal('ethnicity')} icon="globe" accent="#0EA5E9" />
              </View>
              <View style={styles.fieldContainer}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Religion</ThemedText>
                <SelectButton label="Your beliefs" value={religion} options={RELIGION_OPTIONS} onPress={() => setActiveModal('religion')} icon="sun" accent="#0EA5E9" />
              </View>
              <View style={styles.fieldContainer}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Education</ThemedText>
                <SelectButton label="Education level" value={education} options={EDUCATION_OPTIONS} onPress={() => setActiveModal('education')} icon="book" accent="#0EA5E9" />
              </View>
            </View>
          </View>

          {/* WORK & LOCATION */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionHeader icon="briefcase" label="Work & Location" color="#EF4444" description="Where you are and what you do" />
            <View style={styles.sectionBody}>
              <InputField label="Job Title" value={jobTitle} onChangeText={setJobTitle} placeholder="What you do" icon="briefcase" accent="#EF4444" />
              <InputField label="Location" value={livingIn} onChangeText={setLivingIn} placeholder="City, Country" icon="map-pin" accent="#EF4444" />
            </View>
          </View>

          {/* SOUNDTRACK */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionHeader icon="music" label="Soundtrack" color="#9333EA" description="Your current anthem" />
            <View style={styles.sectionBody}>
              <View style={[styles.songCard, { backgroundColor: isDark ? 'rgba(147,51,234,0.08)' : '#9333EA0A', borderColor: '#9333EA25' }]}>
                <View style={styles.songCardIcon}>
                  <LinearGradient colors={['#9333EA', '#7C3AED']} style={styles.songIconGradient}>
                    <Feather name="music" size={20} color="#FFF" />
                  </LinearGradient>
                  <View style={styles.songMusicBars}>
                    {[1, 2, 3].map((i) => (
                      <View key={i} style={[styles.songBar, { backgroundColor: '#9333EA', height: i === 2 ? 14 : 9 }]} />
                    ))}
                  </View>
                </View>
                <View style={styles.songCardFields}>
                  <TextInput
                    style={[styles.songInput, { color: theme.text, borderBottomColor: theme.border }]}
                    value={songTitle}
                    onChangeText={setSongTitle}
                    placeholder="Song title"
                    placeholderTextColor={theme.textSecondary}
                  />
                  <TextInput
                    style={[styles.songInput, { color: theme.textSecondary, borderBottomColor: 'transparent', fontSize: 13 }]}
                    value={songArtist}
                    onChangeText={setSongArtist}
                    placeholder="Artist name"
                    placeholderTextColor={theme.textSecondary + '90'}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* CULTURAL IDENTITY */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <SectionHeader icon="globe" label="Cultural Identity" color="#F97316" description="Your African roots" />
            <View style={styles.sectionBody}>
              <InputField label="Country of Origin" value={countryOfOrigin} onChangeText={setCountryOfOrigin} placeholder="e.g. Nigeria, Ghana, Kenya..." icon="map-pin" accent="#F97316" />
              <InputField label="Tribe / Ethnic Group" value={tribe} onChangeText={setTribe} placeholder="e.g. Yoruba, Ashanti, Kikuyu..." icon="users" accent="#F97316" />
              <InputField label="African Languages Spoken" value={languagesSpoken} onChangeText={setLanguagesSpoken} placeholder="Comma-separated, e.g. Yoruba, Twi" icon="message-square" accent="#F97316" />
              <View style={styles.fieldContainer}>
                <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>Diaspora Generation</ThemedText>
                <SelectButton label="Which generation?" value={diasporaGeneration} options={DIASPORA_GENERATION_OPTIONS} onPress={() => setActiveModal('diasporaGeneration')} icon="git-branch" accent="#F97316" />
              </View>
              {/* Cultural Compatibility Quiz CTA */}
              <Pressable
                onPress={() => navigation.navigate('CompatibilityQuiz')}
                style={({ pressed }) => [{
                  marginTop: 8,
                  borderRadius: 14,
                  overflow: 'hidden' as const,
                  opacity: pressed ? 0.85 : 1,
                }]}
              >
                <LinearGradient
                  colors={['#F97316', '#FB923C']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <Ionicons name="heart-circle" size={22} color="#FFF" />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ fontSize: 14, fontWeight: '700', color: '#FFF' }}>Take Cultural Compatibility Quiz</ThemedText>
                    <ThemedText style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>Boost your cultural match score with other users</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
                </LinearGradient>
              </Pressable>
            </View>
          </View>

          {/* VOICE BIO */}
          <View style={[styles.section, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.sectionHeader, { borderBottomColor: theme.border + '60' }]}>
              <LinearGradient colors={['#EC489925', '#EC489910']} style={styles.sectionIconWrap}>
                <Feather name="mic" size={17} color="#EC4899" />
              </LinearGradient>
              <View style={styles.sectionHeaderText}>
                <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>Voice Bio</ThemedText>
                <ThemedText style={[styles.sectionDescription, { color: theme.textSecondary }]}>Record a 30-second intro</ThemedText>
              </View>
              {voiceBioUrl ? (
                <Pressable onPress={handleVoiceBioDelete} hitSlop={8} style={{ padding: 4 }}>
                  <Feather name="trash-2" size={16} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.sectionBody}>
              <VoiceBio
                voiceBioUrl={voiceBioUrl}
                duration={voiceBioDuration}
                isOwn={true}
                hideHeader={true}
                onRecord={handleVoiceBioRecord}
                onDelete={handleVoiceBioDelete}
              />
            </View>
          </View>

          {/* BOTTOM SAVE BUTTON */}
          <Pressable
            style={[styles.bottomSaveBtn, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Feather name="check-circle" size={20} color="#FFF" />
                <ThemedText style={styles.bottomSaveBtnText}>Save Profile</ThemedText>
              </>
            )}
          </Pressable>

        </View>
      </ScreenKeyboardAwareScrollView>

      {/* MODALS */}
      <OptionModal visible={activeModal === 'gender'} onClose={() => setActiveModal(null)} title="Gender" options={GENDER_OPTIONS} selectedValue={gender} onSelect={setGender} />
      <OptionModal visible={activeModal === 'height'} onClose={() => setActiveModal(null)} title="Height" options={HEIGHT_OPTIONS} selectedValue={height} onSelect={setHeight} />
      <OptionModal visible={activeModal === 'lookingFor'} onClose={() => setActiveModal(null)} title="Looking For" subtitle="What are you here for?" options={LOOKING_FOR_OPTIONS} selectedValue={lookingFor} onSelect={setLookingFor} />
      <OptionModal visible={activeModal === 'relationshipGoal'} onClose={() => setActiveModal(null)} title="Relationship Goal" subtitle="Your vision for the future" options={RELATIONSHIP_GOAL_OPTIONS} selectedValue={relationshipGoal} onSelect={setRelationshipGoal} />
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
      <OptionModal visible={activeModal === 'loveStyle'} onClose={() => setActiveModal(null)} title="Love Language" subtitle="How do you give and receive love?" options={LOVE_STYLE_OPTIONS} selectedValue={loveStyle} onSelect={setLoveStyle} />
      <OptionModal visible={activeModal === 'diasporaGeneration'} onClose={() => setActiveModal(null)} title="Diaspora Generation" subtitle="Which generation of the African diaspora are you?" options={DIASPORA_GENERATION_OPTIONS} selectedValue={diasporaGeneration} onSelect={setDiasporaGeneration} />
      <InterestModal visible={interestsModalVisible} onClose={() => setInterestsModalVisible(false)} />
      <AlertComponent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // HEADER
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headerTagline: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // COMPLETION BAR
  completionBarWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 6,
  },
  completionBarTrack: {
    height: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  completionBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  completionBarLabel: {
    fontSize: 11,
    fontWeight: '500',
  },

  scrollView: { flex: 1 },
  content: { paddingHorizontal: 14, paddingTop: 16, gap: 16 },

  // PHOTO CARD
  photoCard: {
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
  },
  photoCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  photoCardLeft: {},
  photoAvatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: { width: '100%', height: '100%' },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEditBadge: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  photoCardBody: { flex: 1 },
  photoCardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  photoCardSub: { fontSize: 12, marginBottom: 8 },
  photoDotsRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  photoDot: { height: 4, borderRadius: 2 },

  // SECTION
  section: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  sectionIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: { flex: 1 },
  sectionTitle: { fontSize: 15, fontWeight: '700' },
  sectionDescription: { fontSize: 12, marginTop: 1 },
  sectionBody: { padding: 16, gap: 12 },

  // FIELDS
  fieldContainer: { marginBottom: 0 },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldFilledDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 50,
    gap: 10,
  },
  textInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  multilineInput: { minHeight: 90, textAlignVertical: 'top' },

  selectButton: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  selectIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectButtonText: { fontSize: 14, flex: 1 },

  // ROW LAYOUT
  row2: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 0,
  },
  halfField: { flex: 1, gap: 6 },

  // INTERESTS
  interestsTrigger: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 0,
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
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
  interestChipText: { fontSize: 12, fontWeight: '500' },

  // TOGGLE
  toggleCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 0,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  toggleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleTextGroup: { flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleDescription: { fontSize: 12, marginTop: 1 },
  toggleDivider: { height: 1, marginHorizontal: 14 },

  // SONG CARD
  songCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  songCardIcon: {
    alignItems: 'center',
    gap: 6,
  },
  songIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  songMusicBars: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'flex-end',
  },
  songBar: {
    width: 3,
    borderRadius: 2,
  },
  songCardFields: { flex: 1 },
  songInput: {
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 6,
    borderBottomWidth: 1,
    marginBottom: 4,
  },

  // MODALS
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '82%',
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalSubtitle: { fontSize: 12, marginTop: 2 },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
  },
  doneButton: {
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  interestOptionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    margin: 5,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
    position: 'relative',
  },
  interestIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestOptionLabel: { flex: 1, fontSize: 13 },
  interestCheckBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  optionLabel: { fontSize: 16 },
  optionCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // BOTTOM SAVE
  bottomSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    borderRadius: 27,
    marginTop: 6,
    marginBottom: 8,
  },
  bottomSaveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
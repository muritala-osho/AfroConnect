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
  Dimensions
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
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type EditProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "EditProfile">;

interface EditProfileScreenProps {
  navigation: EditProfileScreenNavigationProp;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  { id: 'dancing', label: 'Dancing', icon: ' footsteps' },
  { id: 'coding', label: 'Coding', icon: 'code-slash' },
  { id: 'sports', label: 'Sports', icon: 'basketball' },
  { id: 'fashion', label: 'Fashion', icon: 'shirt' },
  { id: 'nature', label: 'Nature', icon: 'leaf' },
  { id: 'technology', label: 'Technology', icon: 'hardware-chip' },
];

export default function EditProfileScreen({ navigation }: EditProfileScreenProps) {
  const { theme } = useTheme();
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
  const [religion, setReligion] = useState(user?.lifestyle?.religion || "");
  const [ethnicity, setEthnicity] = useState(user?.lifestyle?.ethnicity || "");
  const [pets, setPets] = useState(user?.lifestyle?.pets || "");
  const [relationshipStatus, setRelationshipStatus] = useState(user?.lifestyle?.relationshipStatus || "");
  const [personalityType, setPersonalityType] = useState(user?.lifestyle?.personalityType || "");

  const [interests, setInterests] = useState<string[]>(user?.interests || []);

  const [saving, setSaving] = useState(false);
  const [lookingForModalVisible, setLookingForModalVisible] = useState(false);
  const [smokingModalVisible, setSmokingModalVisible] = useState(false);
  const [drinkingModalVisible, setDrinkingModalVisible] = useState(false);
  const [religionModalVisible, setReligionModalVisible] = useState(false);
  const [zodiacModalVisible, setZodiacModalVisible] = useState(false);
  const [educationModalVisible, setEducationModalVisible] = useState(false);
  const [ethnicityModalVisible, setEthnicityModalVisible] = useState(false);
  const [petsModalVisible, setPetsModalVisible] = useState(false);
  const [relationshipStatusModalVisible, setRelationshipStatusModalVisible] = useState(false);
  const [interestsModalVisible, setInterestsModalVisible] = useState(false);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem(EDIT_PROFILE_STORAGE_KEY);
        if (draft) {
          const data = JSON.parse(draft);
          if (data.name) setName(data.name);
          if (data.bio) setBio(data.bio);
          if (data.jobTitle) setJobTitle(data.jobTitle);
          if (data.livingIn) setLivingIn(data.livingIn);
          if (data.zodiacSign) setZodiacSign(data.zodiacSign);
          if (data.education) setEducation(data.education);
          if (data.lookingFor) setLookingFor(data.lookingFor);
          if (data.songTitle) setSongTitle(data.songTitle);
          if (data.songArtist) setSongArtist(data.songArtist);
          if (data.smoking) setSmoking(data.smoking);
          if (data.drinking) setDrinking(data.drinking);
          if (data.religion) setReligion(data.religion);
          if (data.ethnicity) setEthnicity(data.ethnicity);
          if (data.pets) setPets(data.pets);
          if (data.relationshipStatus) setRelationshipStatus(data.relationshipStatus);
          if (data.personalityType) setPersonalityType(data.personalityType);
          if (data.interests) setInterests(data.interests);
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
        favoriteSong: (songTitle.trim() || songArtist.trim()) ? {
          title: songTitle.trim(),
          artist: songArtist.trim(),
        } : undefined,
        lifestyle: {
          smoking: smoking || undefined,
          drinking: drinking || undefined,
          religion: religion || undefined,
          ethnicity: ethnicity || undefined,
          pets: pets || undefined,
          relationshipStatus: relationshipStatus || undefined,
          personalityType: personalityType.trim() || undefined,
        },
        interests: interests,
        language: user?.language || 'en'
      } as any);
      
      await AsyncStorage.removeItem(EDIT_PROFILE_STORAGE_KEY);
      // Ensure global state is updated
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
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Select Interests</ThemedText>
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
                  <ThemedText style={[styles.interestOptionLabel, isSelected && { color: theme.primary, fontWeight: '700' }]}>
                    {item.label}
                  </ThemedText>
                  {isSelected && <Feather name="check-circle" size={16} color={theme.primary} style={styles.checkIcon} />}
                </Pressable>
              );
            }}
          />
          <Pressable style={[styles.saveButton, { backgroundColor: theme.primary }]} onPress={onClose}>
            <ThemedText style={styles.saveButtonText}>Done</ThemedText>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );

  const OptionModal = ({ visible, onClose, title, options, selectedValue, onSelect }: any) => (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>{title}</ThemedText>
            <Pressable onPress={onClose}><Feather name="x" size={24} color={theme.text} /></Pressable>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.optionItem, { borderBottomColor: theme.border }]}
                onPress={() => { onSelect(item.value); onClose(); }}
              >
                <ThemedText style={[styles.optionLabel, selectedValue === item.value && { color: theme.primary, fontWeight: '700' }]}>
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

  const SelectButton = ({ label, value, options, onPress }: any) => {
    const displayLabel = options ? options.find((o: any) => o.value === value)?.label : value;
    return (
      <Pressable style={[styles.selectButton, { backgroundColor: theme.background, borderColor: theme.border }]} onPress={onPress}>
        <ThemedText style={[styles.selectButtonText, !value && { color: theme.textSecondary }]}>{displayLabel || label}</ThemedText>
        <Feather name="chevron-down" size={20} color={theme.textSecondary} />
      </Pressable>
    );
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <ThemedText style={[styles.sectionTitle, { color: theme.primary }]}>{title}</ThemedText>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="close" size={28} color={theme.text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Edit Profile</ThemedText>
        <Pressable onPress={handleSave} disabled={saving} style={styles.headerButton}>
          {saving ? <ActivityIndicator size="small" color={theme.primary} /> : <ThemedText style={[styles.saveText, { color: theme.primary }]}>Save</ThemedText>}
        </Pressable>
      </View>

      <ScreenKeyboardAwareScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.photoSection}>
             <Pressable 
              style={[styles.mainPhoto, { backgroundColor: theme.surface }]}
              onPress={() => navigation.navigate('ChangeProfilePicture')}
            >
              {user?.photos?.[0] ? (
                <SafeImage 
                  source={typeof user.photos[0] === 'string' ? user.photos[0] : user.photos[0].url} 
                  style={styles.photoImage} 
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera" size={40} color={theme.textSecondary} />
                </View>
              )}
              <View style={[styles.editBadge, { backgroundColor: theme.primary }]}>
                <Feather name="edit-2" size={16} color="#FFF" />
              </View>
            </Pressable>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Basic Info" />
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Name</ThemedText>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} value={name} onChangeText={setName} />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Bio</ThemedText>
              <TextInput style={[styles.input, styles.bioInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} value={bio} onChangeText={setBio} multiline placeholder="Tell us about yourself..." placeholderTextColor={theme.textSecondary} />
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Lifestyle" />
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Looking For</ThemedText>
              <SelectButton label="What are you looking for?" value={lookingFor} options={LOOKING_FOR_OPTIONS} onPress={() => setLookingForModalVisible(true)} />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Education</ThemedText>
              <SelectButton label="Education level" value={education} options={EDUCATION_OPTIONS} onPress={() => setEducationModalVisible(true)} />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Zodiac Sign</ThemedText>
              <SelectButton label="Your sign" value={zodiacSign} options={ZODIAC_OPTIONS} onPress={() => setZodiacModalVisible(true)} />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Religion</ThemedText>
              <SelectButton label="Your beliefs" value={religion} options={RELIGION_OPTIONS} onPress={() => setReligionModalVisible(true)} />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Ethnicity</ThemedText>
              <SelectButton label="Your ethnicity" value={ethnicity} options={ETHNICITY_OPTIONS} onPress={() => setEthnicityModalVisible(true)} />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Pets</ThemedText>
              <SelectButton label="Do you have pets?" value={pets} options={PETS_OPTIONS} onPress={() => setPetsModalVisible(true)} />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Smoking</ThemedText>
              <SelectButton label="Do you smoke?" value={smoking} options={SMOKING_OPTIONS} onPress={() => setSmokingModalVisible(true)} />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Drinking</ThemedText>
              <SelectButton label="Do you drink?" value={drinking} options={DRINKING_OPTIONS} onPress={() => setDrinkingModalVisible(true)} />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Relationship Status</ThemedText>
              <SelectButton label="Current status" value={relationshipStatus} options={RELATIONSHIP_STATUS_OPTIONS} onPress={() => setRelationshipStatusModalVisible(true)} />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Personality Type</ThemedText>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} value={personalityType} onChangeText={setPersonalityType} placeholder="e.g. ENFP, Adventurous..." placeholderTextColor={theme.textSecondary} />
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Interests" />
            <Pressable 
              style={[styles.selectButton, { backgroundColor: theme.background, borderColor: theme.border }]} 
              onPress={() => setInterestsModalVisible(true)}
            >
              <ThemedText style={[styles.selectButtonText, interests.length === 0 && { color: theme.textSecondary }]}>
                {interests.length > 0 ? `${interests.length} interests selected` : "Select interests"}
              </ThemedText>
              <Feather name="plus" size={20} color={theme.textSecondary} />
            </Pressable>
            
            <View style={styles.interestsRow}>
              {interests.map((interest: string) => {
                const opt = INTEREST_OPTIONS.find(o => o.id === interest);
                return (
                  <View key={interest} style={[styles.interestChip, { backgroundColor: theme.primary + '15' }]}>
                    {opt && <Ionicons name={opt.icon as any} size={14} color={theme.primary} style={{ marginRight: 4 }} />}
                    <ThemedText style={{ color: theme.text }}>{opt?.label || interest}</ThemedText>
                    <Pressable 
                      onPress={() => toggleInterest(interest)}
                      style={styles.removeInterest}
                    >
                      <Feather name="x" size={14} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Work & Education" />
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Job Title</ThemedText>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} value={jobTitle} onChangeText={setJobTitle} placeholder="What do you do?" placeholderTextColor={theme.textSecondary} />
            </View>
            <View style={styles.inputContainer}>
              <ThemedText style={styles.label}>Living In</ThemedText>
              <TextInput style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]} value={livingIn} onChangeText={setLivingIn} placeholder="Your city" placeholderTextColor={theme.textSecondary} />
            </View>
          </View>
        </View>
      </ScreenKeyboardAwareScrollView>

      <OptionModal visible={lookingForModalVisible} onClose={() => setLookingForModalVisible(false)} title="Looking For" options={LOOKING_FOR_OPTIONS} selectedValue={lookingFor} onSelect={setLookingFor} />
      <OptionModal visible={smokingModalVisible} onClose={() => setSmokingModalVisible(false)} title="Smoking" options={SMOKING_OPTIONS} selectedValue={smoking} onSelect={setSmoking} />
      <OptionModal visible={drinkingModalVisible} onClose={() => setDrinkingModalVisible(false)} title="Drinking" options={DRINKING_OPTIONS} selectedValue={drinking} onSelect={setDrinking} />
      <OptionModal visible={religionModalVisible} onClose={() => setReligionModalVisible(false)} title="Religion" options={RELIGION_OPTIONS} selectedValue={religion} onSelect={setReligion} />
      <OptionModal visible={zodiacModalVisible} onClose={() => setZodiacModalVisible(false)} title="Zodiac Sign" options={ZODIAC_OPTIONS} selectedValue={zodiacSign} onSelect={setZodiacSign} />
      <OptionModal visible={educationModalVisible} onClose={() => setEducationModalVisible(false)} title="Education" options={EDUCATION_OPTIONS} selectedValue={education} onSelect={setEducation} />
      <OptionModal visible={ethnicityModalVisible} onClose={() => setEthnicityModalVisible(false)} title="Ethnicity" options={ETHNICITY_OPTIONS} selectedValue={ethnicity} onSelect={setEthnicity} />
      <OptionModal visible={petsModalVisible} onClose={() => setPetsModalVisible(false)} title="Pets" options={PETS_OPTIONS} selectedValue={pets} onSelect={setPets} />
      <OptionModal visible={relationshipStatusModalVisible} onClose={() => setRelationshipStatusModalVisible(false)} title="Relationship Status" options={RELATIONSHIP_STATUS_OPTIONS} selectedValue={relationshipStatus} onSelect={setRelationshipStatus} />
      
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
    paddingBottom: 12
  },
  headerButton: { width: 50, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  saveText: { fontSize: 16, fontWeight: '600' },
  scrollView: { flex: 1 },
  content: { padding: 20 },
  photoSection: { alignItems: 'center', marginBottom: 30 },
  mainPhoto: { 
    width: 150, 
    height: 150, 
    borderRadius: 75, 
    overflow: 'hidden',
    position: 'relative',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  photoImage: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  editBadge: { 
    position: 'absolute', 
    bottom: 5, 
    right: 5, 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF'
  },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
  inputContainer: { marginBottom: 15 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, opacity: 0.7 },
  input: { height: 50, borderRadius: 12, paddingHorizontal: 16, borderWidth: 1 },
  bioInput: { height: 100, textAlignVertical: 'top', paddingTop: 12 },
  promptSection: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 16, 
    borderRadius: 16, 
    borderWidth: 1,
    marginBottom: 30
  },
  promptContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  promptText: { marginLeft: 15, flex: 1 },
  promptTitle: { fontSize: 16, fontWeight: '700' },
  promptSubtitle: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  selectButton: { height: 50, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  selectButtonText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: 'rgba(0,0,0,0.05)' 
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
  checkIcon: {
    marginLeft: 4,
  },
  saveButton: {
    margin: 20,
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  optionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 16, 
    borderBottomWidth: 1 
  },
  optionLabel: { fontSize: 16 },
  interestsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  removeInterest: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

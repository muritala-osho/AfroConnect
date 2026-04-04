import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
  Modal,
  StatusBar,
  SafeAreaView,
  Animated,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { getApiBaseUrl } from "@/constants/config";

const ActionSheetIOS = Platform.OS === "ios" ? require("react-native").ActionSheetIOS : null;
const { width } = Dimensions.get("window");

type ProfileSetupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "ProfileSetup">;
interface ProfileSetupScreenProps {
  navigation: ProfileSetupScreenNavigationProp;
}

type PhotoPrivacy = "public" | "friends" | "private";
interface PhotoItem {
  url: string;
  publicId?: string;
  privacy: PhotoPrivacy;
}
type PhotoSlot = PhotoItem | null;

const PROFILE_SETUP_STORAGE_KEY = "afroconnect_profile_setup_draft";

const INTERESTS_OPTIONS = [
  { label: "🎵 Music", value: "Music" },
  { label: "✈️ Travel", value: "Travel" },
  { label: "🍕 Food", value: "Food" },
  { label: "⚽ Sports", value: "Sports" },
  { label: "🎨 Art", value: "Art" },
  { label: "🎬 Movies", value: "Movies" },
  { label: "📚 Reading", value: "Reading" },
  { label: "🎮 Gaming", value: "Gaming" },
  { label: "💪 Fitness", value: "Fitness" },
  { label: "📸 Photography", value: "Photography" },
  { label: "💃 Dancing", value: "Dancing" },
  { label: "👨‍🍳 Cooking", value: "Cooking" },
  { label: "👗 Fashion", value: "Fashion" },
  { label: "💻 Technology", value: "Technology" },
];

const ZODIAC_SIGNS = [
  { value: "aries", label: "♈ Aries" },
  { value: "taurus", label: "♉ Taurus" },
  { value: "gemini", label: "♊ Gemini" },
  { value: "cancer", label: "♋ Cancer" },
  { value: "leo", label: "♌ Leo" },
  { value: "virgo", label: "♍ Virgo" },
  { value: "libra", label: "♎ Libra" },
  { value: "scorpio", label: "♏ Scorpio" },
  { value: "sagittarius", label: "♐ Sagittarius" },
  { value: "capricorn", label: "♑ Capricorn" },
  { value: "aquarius", label: "♒ Aquarius" },
  { value: "pisces", label: "♓ Pisces" },
];

const EDUCATION_OPTIONS = [
  { value: "high_school", label: "High School" },
  { value: "some_college", label: "Some College" },
  { value: "bachelors", label: "Bachelor's Degree" },
  { value: "masters", label: "Master's Degree" },
  { value: "doctorate", label: "Doctorate" },
  { value: "trade_school", label: "Trade School" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const PRIVACY_OPTIONS: { value: PhotoPrivacy; label: string; icon: string; description: string }[] = [
  { value: "public", label: "Public", icon: "globe", description: "Everyone can see" },
  { value: "friends", label: "Friends Only", icon: "users", description: "Only matches can see" },
  { value: "private", label: "Private", icon: "lock", description: "Only you can see" },
];

const LOOKING_FOR_OPTIONS = [
  { label: "💍 Relationship", value: "Relationship", desc: "Serious & long-term" },
  { label: "👯 Friendship", value: "Friendship", desc: "Platonic connection" },
  { label: "😊 Casual", value: "Casual", desc: "Keeping it light" },
  { label: "🤷 Not sure", value: "Not sure", desc: "Open to anything" },
];

const STEP_META = [
  { icon: "user", title: "About You", subtitle: "Tell us a little about yourself", color: "#10B981" },
  { icon: "edit-3", title: "Your Bio", subtitle: "Write something that shows your personality", color: "#059669" },
  { icon: "camera", title: "Add Photos", subtitle: "Add at least 4 photos to continue", color: "#0D9488" },
  { icon: "heart", title: "Interests", subtitle: "Select 3–5 things you love", color: "#10B981" },
  { icon: "sliders", title: "Preferences", subtitle: "Who would you like to meet?", color: "#059669" },
];

function StepCard({ children, theme }: { children: React.ReactNode; theme: any }) {
  const slideAnim = useRef(new Animated.Value(24)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slideAnim.setValue(24);
    fadeAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      {children}
    </Animated.View>
  );
}

export default function ProfileSetupScreen({ navigation }: ProfileSetupScreenProps) {
  const { theme } = useTheme();
  const { completeProfileSetup, token } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<number | null>(null);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);

  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [zodiacSign, setZodiacSign] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [education, setEducation] = useState("");
  const [livingIn, setLivingIn] = useState("");
  const [religion, setReligion] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [personalityType, setPersonalityType] = useState("");
  const [smoking, setSmoking] = useState("");
  const [drinking, setDrinking] = useState("");
  const [hasKids, setHasKids] = useState<boolean | null>(null);
  const [hasPets, setHasPets] = useState<boolean | null>(null);
  const [bio, setBio] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [photos, setPhotos] = useState<PhotoSlot[]>([null, null, null, null, null, null]);
  const [minAge, setMinAge] = useState("18");
  const [maxAge, setMaxAge] = useState("50");
  const [maxDistance, setMaxDistance] = useState("50");
  const [preferredGenders, setPreferredGenders] = useState<string[]>([]);
  const [favoriteSongTitle, setFavoriteSongTitle] = useState("");
  const [favoriteSongArtist, setFavoriteSongArtist] = useState("");
  const [communicationStyle, setCommunicationStyle] = useState("");
  const [loveStyle, setLoveStyle] = useState("");

  const [zodiacModalVisible, setZodiacModalVisible] = useState(false);
  const [educationModalVisible, setEducationModalVisible] = useState(false);
  const [religionModalVisible, setReligionModalVisible] = useState(false);
  const [photoPickerModalVisible, setPhotoPickerModalVisible] = useState(false);
  const [photoPickerSlotIndex, setPhotoPickerSlotIndex] = useState<number>(0);

  const RELIGION_OPTIONS = [
    { value: "christian", label: "Christian" },
    { value: "muslim", label: "Muslim" },
    { value: "traditional", label: "Traditional" },
    { value: "atheist", label: "Atheist" },
    { value: "agnostic", label: "Agnostic" },
    { value: "spiritual", label: "Spiritual" },
    { value: "other", label: "Other" },
    { value: "prefer_not_to_say", label: "Prefer not to say" },
  ];

  const progressAnim = useRef(new Animated.Value(1 / 5)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / 5,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [step]);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem(PROFILE_SETUP_STORAGE_KEY);
        if (draft) {
          const data = JSON.parse(draft);
          setName(data.name || "");
          setAge(data.age || "");
          setGender(data.gender || "");
          setZodiacSign(data.zodiacSign || "");
          setJobTitle(data.jobTitle || "");
          setEducation(data.education || "");
          setLivingIn(data.livingIn || "");
          setReligion(data.religion || "");
          setEthnicity(data.ethnicity || "");
          setBio(data.bio || "");
          setLookingFor(data.lookingFor || "");
          setInterests(data.interests || []);
          setPhotos(data.photos || [null, null, null, null, null, null]);
          setMinAge(data.minAge || "18");
          setMaxAge(data.maxAge || "50");
          setMaxDistance(data.maxDistance || "50");
          setPreferredGenders(data.preferredGenders || []);
          setStep(data.step || 1);
        }
      } catch {}
    };
    loadDraft();
  }, []);

  useEffect(() => {
    const saveDraft = async () => {
      try {
        const data = {
          name, age, gender, zodiacSign, jobTitle, education, livingIn, religion, ethnicity,
          bio, lookingFor, interests, photos, minAge, maxAge, maxDistance, preferredGenders, step,
        };
        await AsyncStorage.setItem(PROFILE_SETUP_STORAGE_KEY, JSON.stringify(data));
      } catch {}
    };
    saveDraft();
  }, [name, age, gender, zodiacSign, jobTitle, education, livingIn, religion, ethnicity, bio, lookingFor, interests, photos, minAge, maxAge, maxDistance, preferredGenders, step]);

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter((i) => i !== interest));
    } else if (interests.length < 5) {
      Haptics.selectionAsync();
      setInterests([...interests, interest]);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      const trimmedName = name.trim();
      const trimmedAge = age.trim();
      if (!trimmedName || !trimmedAge || !gender || !jobTitle.trim() || !education || !livingIn.trim() || !ethnicity) {
        Alert.alert("Required Fields", "Please fill in all required fields (Name, Age, Gender, Job Title, Education, Living In, Ethnicity)");
        return;
      }
      if (!/^\d+$/.test(trimmedAge)) {
        Alert.alert("Invalid Age", "Age must be a number");
        return;
      }
      const ageNum = parseInt(trimmedAge, 10);
      if (isNaN(ageNum) || ageNum < 18 || ageNum > 99) {
        Alert.alert("Invalid Age", "Please enter a valid age (18–99)");
        return;
      }
      setName(trimmedName);
      setAge(trimmedAge);
    } else if (step === 2) {
      if (!bio.trim()) {
        Alert.alert("Bio Required", "Please add a short bio");
        return;
      }
      setBio(bio.trim());
    } else if (step === 3) {
      const photoCount = photos.filter((p) => p !== null).length;
      if (photoCount < 4) {
        Alert.alert("More Photos Needed", "Please add at least 4 photos to continue");
        return;
      }
    } else if (step === 4) {
      if (interests.length < 3) {
        Alert.alert("More Interests Needed", "Please select at least 3 interests");
        return;
      }
      if (!lookingFor) {
        Alert.alert("Looking For?", "Please select what you're looking for");
        return;
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(step + 1);
  };

  const togglePreferredGender = (g: string) => {
    if (preferredGenders.includes(g)) {
      setPreferredGenders(preferredGenders.filter((pg) => pg !== g));
    } else {
      setPreferredGenders([...preferredGenders, g]);
    }
  };

  const uploadPhoto = async (uri: string): Promise<{ url: string; publicId: string } | null> => {
    try {
      const formData = new FormData();
      const filename = uri.split("/").pop() || "photo.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";
      formData.append("file", { uri, name: filename, type } as any);
      const response = await fetch(`${getApiBaseUrl()}/api/upload/photo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        body: formData,
      });
      const data = await response.json();
      if (data.success && data.url) return { url: data.url, publicId: data.publicId };
      return null;
    } catch {
      return null;
    }
  };

  const pickImage = async (useCamera: boolean, slotIndex: number) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", `Please allow access to your ${useCamera ? "camera" : "photo library"}`);
      return;
    }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 5], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 5], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      setUploadingPhoto(slotIndex);
      const uploaded = await uploadPhoto(result.assets[0].uri);
      setUploadingPhoto(null);
      if (uploaded) {
        const newPhotos = [...photos];
        const existingPhoto = newPhotos[slotIndex];
        newPhotos[slotIndex] = { ...uploaded, privacy: existingPhoto?.privacy || "public" };
        setPhotos(newPhotos);
      } else {
        Alert.alert("Upload Failed", "Could not upload photo. Please try again.");
      }
    }
  };

  const showPhotoOptions = (slotIndex: number) => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", "Take Photo", "Choose from Library"], cancelButtonIndex: 0 },
        (buttonIndex: number) => {
          if (buttonIndex === 1) pickImage(true, slotIndex);
          else if (buttonIndex === 2) pickImage(false, slotIndex);
        },
      );
    } else {
      setPhotoPickerSlotIndex(slotIndex);
      setPhotoPickerModalVisible(true);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos[index] = null;
    const validPhotos = newPhotos.filter((p): p is PhotoItem => p !== null);
    const compacted: PhotoSlot[] = [null, null, null, null, null, null];
    validPhotos.forEach((photo, i) => { compacted[i] = photo; });
    setPhotos(compacted);
  };

  const openPrivacyModal = (index: number) => {
    setSelectedPhotoIndex(index);
    setPrivacyModalVisible(true);
  };

  const setPhotoPrivacy = (privacy: PhotoPrivacy) => {
    if (selectedPhotoIndex === null) return;
    const photo = photos[selectedPhotoIndex];
    if (!photo) return;
    const newPhotos = [...photos];
    newPhotos[selectedPhotoIndex] = { ...photo, privacy };
    setPhotos(newPhotos);
    setPrivacyModalVisible(false);
    setSelectedPhotoIndex(null);
  };

  const getPrivacyIcon = (privacy: PhotoPrivacy): string => {
    switch (privacy) {
      case "public": return "globe";
      case "friends": return "users";
      case "private": return "lock";
      default: return "globe";
    }
  };

  const handleComplete = async () => {
    if (preferredGenders.length === 0) {
      Alert.alert("Show Me", "Please select at least one preferred gender");
      return;
    }
    const minAgeNum = parseInt(minAge, 10);
    const maxAgeNum = parseInt(maxAge, 10);
    const maxDistanceNum = parseInt(maxDistance, 10);
    if (isNaN(minAgeNum) || minAgeNum < 18 || minAgeNum > 99) {
      Alert.alert("Invalid Age Range", "Minimum age must be between 18 and 99");
      return;
    }
    if (isNaN(maxAgeNum) || maxAgeNum < 18 || maxAgeNum > 99) {
      Alert.alert("Invalid Age Range", "Maximum age must be between 18 and 99");
      return;
    }
    if (minAgeNum > maxAgeNum) {
      Alert.alert("Invalid Age Range", "Minimum age cannot be greater than maximum age");
      return;
    }
    if (isNaN(maxDistanceNum) || maxDistanceNum < 1 || maxDistanceNum > 500) {
      Alert.alert("Invalid Distance", "Max distance must be between 1 and 500 km");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    try {
      const ageNum = parseInt(age.trim(), 10);
      const validPhotos = photos.filter((p): p is PhotoItem => p !== null);
      const formattedPhotos = validPhotos.map((photo, index) => ({
        url: photo.url,
        publicId: photo.publicId,
        privacy: photo.privacy,
        isPrimary: index === 0,
        order: index,
      }));
      const finalGender = gender.toLowerCase() === "other" ? "other" : gender.toLowerCase();
      const finalPreferredGenders = preferredGenders.length > 0
        ? preferredGenders.map((g) => g.toLowerCase())
        : [finalGender === "male" ? "female" : "male"];

      await completeProfileSetup({
        name: name.trim(),
        age: ageNum,
        gender: finalGender,
        zodiacSign: zodiacSign || undefined,
        jobTitle: jobTitle.trim() || undefined,
        education: education || undefined,
        livingIn: livingIn.trim() || undefined,
        religion: religion || undefined,
        ethnicity: ethnicity.trim() || undefined,
        communicationStyle: communicationStyle || undefined,
        loveStyle: loveStyle || undefined,
        personalityType: personalityType.trim() || undefined,
        lifestyle: {
          smoking: smoking || undefined,
          drinking: drinking || undefined,
          religion: religion || undefined,
        },
        bio: bio.trim(),
        interests,
        lookingFor: lookingFor.toLowerCase() || "friends",
        photos: formattedPhotos,
        favoriteSong: favoriteSongTitle.trim() ? { title: favoriteSongTitle.trim(), artist: favoriteSongArtist.trim() } : undefined,
        location: { type: "Point", coordinates: [3.3792, 6.5244] },
        preferences: {
          ageRange: { min: minAgeNum, max: maxAgeNum },
          maxDistance: maxDistanceNum * 1000,
          genders: finalPreferredGenders,
        },
      });
      await AsyncStorage.removeItem(PROFILE_SETUP_STORAGE_KEY);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const stepMeta = STEP_META[step - 1];
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar barStyle="light-content" />

      {/* Gradient Header */}
      <LinearGradient
        colors={["#10B981", "#059669"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientHeader}
      >
        {/* Step counter */}
        <View style={styles.stepCounterRow}>
          <ThemedText style={styles.stepCounter}>Step {step} of 5</ThemedText>
          <View style={styles.stepIconBubble}>
            <Feather name={stepMeta.icon as any} size={16} color="#fff" />
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>

        {/* Step dots */}
        <View style={styles.stepDots}>
          {[1, 2, 3, 4, 5].map((s) => (
            <View
              key={s}
              style={[
                styles.stepDot,
                s === step && styles.stepDotActive,
                s < step && styles.stepDotDone,
              ]}
            >
              {s < step && <Feather name="check" size={8} color="#fff" />}
            </View>
          ))}
        </View>

        {/* Title */}
        <ThemedText style={styles.headerTitle}>{stepMeta.title}</ThemedText>
        <ThemedText style={styles.headerSubtitle}>{stepMeta.subtitle}</ThemedText>
      </LinearGradient>

      {/* Scrollable content */}
      <ScreenKeyboardAwareScrollView contentContainerStyle={{ paddingTop: 0 }}>
        <View style={styles.content}>
          <StepCard theme={theme}>

            {/* ── STEP 1: Basic Info ── */}
            {step === 1 && (
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Full Name *</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="Your name"
                    placeholderTextColor={theme.textSecondary}
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Age *</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="18"
                    placeholderTextColor={theme.textSecondary}
                    value={age}
                    onChangeText={setAge}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Gender *</ThemedText>
                  <View style={styles.pillRow}>
                    {["Male", "Female", "Other"].map((g) => (
                      <Pressable
                        key={g}
                        style={[
                          styles.pill,
                          { borderColor: theme.border, backgroundColor: theme.surface },
                          gender.toLowerCase() === g.toLowerCase() && { backgroundColor: theme.primary, borderColor: theme.primary },
                        ]}
                        onPress={() => { Haptics.selectionAsync(); setGender(g); }}
                      >
                        <ThemedText style={[styles.pillText, { color: gender.toLowerCase() === g.toLowerCase() ? "#fff" : theme.text }]}>
                          {g}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Zodiac Sign</ThemedText>
                  <Pressable
                    style={[styles.dropdownButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    onPress={() => setZodiacModalVisible(true)}
                  >
                    <ThemedText style={{ color: zodiacSign ? theme.text : theme.textSecondary, fontSize: 15 }}>
                      {zodiacSign ? ZODIAC_SIGNS.find((z) => z.value === zodiacSign)?.label : "Select your sign"}
                    </ThemedText>
                    <Feather name="chevron-down" size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Job Title *</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="e.g. Software Engineer"
                    placeholderTextColor={theme.textSecondary}
                    value={jobTitle}
                    onChangeText={setJobTitle}
                    maxLength={100}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Education *</ThemedText>
                  <Pressable
                    style={[styles.dropdownButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    onPress={() => setEducationModalVisible(true)}
                  >
                    <ThemedText style={{ color: education ? theme.text : theme.textSecondary, fontSize: 15 }}>
                      {education ? EDUCATION_OPTIONS.find((e) => e.value === education)?.label : "Select education level"}
                    </ThemedText>
                    <Feather name="chevron-down" size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Living In *</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="e.g. Lagos, Nigeria"
                    placeholderTextColor={theme.textSecondary}
                    value={livingIn}
                    onChangeText={setLivingIn}
                    maxLength={100}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Religion</ThemedText>
                  <Pressable
                    style={[styles.dropdownButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                    onPress={() => setReligionModalVisible(true)}
                  >
                    <ThemedText style={{ color: religion ? theme.text : theme.textSecondary, fontSize: 15 }}>
                      {religion ? RELIGION_OPTIONS.find((r) => r.value === religion)?.label : "Select religion"}
                    </ThemedText>
                    <Feather name="chevron-down" size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Ethnicity *</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="e.g. Yoruba, Igbo, Ashanti"
                    placeholderTextColor={theme.textSecondary}
                    value={ethnicity}
                    onChangeText={setEthnicity}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Personality Type</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="e.g. INFJ, ENFP"
                    placeholderTextColor={theme.textSecondary}
                    value={personalityType}
                    onChangeText={setPersonalityType}
                    maxLength={4}
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Smoking</ThemedText>
                  <View style={styles.pillRow}>
                    {["Never", "Socially", "Regularly"].map((s) => (
                      <Pressable
                        key={s}
                        style={[
                          styles.pill,
                          { borderColor: theme.border, backgroundColor: theme.surface },
                          smoking === s.toLowerCase() && { backgroundColor: theme.primary, borderColor: theme.primary },
                        ]}
                        onPress={() => setSmoking(s.toLowerCase())}
                      >
                        <ThemedText style={[styles.pillText, { color: smoking === s.toLowerCase() ? "#fff" : theme.text }]}>{s}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Drinking</ThemedText>
                  <View style={styles.pillRow}>
                    {["Never", "Socially", "Regularly"].map((d) => (
                      <Pressable
                        key={d}
                        style={[
                          styles.pill,
                          { borderColor: theme.border, backgroundColor: theme.surface },
                          drinking === d.toLowerCase() && { backgroundColor: theme.primary, borderColor: theme.primary },
                        ]}
                        onPress={() => setDrinking(d.toLowerCase())}
                      >
                        <ThemedText style={[styles.pillText, { color: drinking === d.toLowerCase() ? "#fff" : theme.text }]}>{d}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={styles.binaryRow}>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Have Kids?</ThemedText>
                    <View style={styles.pillRow}>
                      {[{ l: "Yes", v: true }, { l: "No", v: false }].map((item) => (
                        <Pressable
                          key={item.l}
                          style={[
                            styles.pill,
                            { flex: 1, borderColor: theme.border, backgroundColor: theme.surface },
                            hasKids === item.v && { backgroundColor: theme.primary, borderColor: theme.primary },
                          ]}
                          onPress={() => setHasKids(item.v)}
                        >
                          <ThemedText style={[styles.pillText, { color: hasKids === item.v ? "#fff" : theme.text }]}>{item.l}</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Have Pets?</ThemedText>
                    <View style={styles.pillRow}>
                      {[{ l: "Yes", v: true }, { l: "No", v: false }].map((item) => (
                        <Pressable
                          key={item.l}
                          style={[
                            styles.pill,
                            { flex: 1, borderColor: theme.border, backgroundColor: theme.surface },
                            hasPets === item.v && { backgroundColor: theme.primary, borderColor: theme.primary },
                          ]}
                          onPress={() => setHasPets(item.v)}
                        >
                          <ThemedText style={[styles.pillText, { color: hasPets === item.v ? "#fff" : theme.text }]}>{item.l}</ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* ── STEP 2: Bio ── */}
            {step === 2 && (
              <View style={styles.form}>
                <View style={[styles.bioCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.bioInput, { color: theme.text }]}
                    placeholder="Tell people about yourself, your culture, your passions, and what makes you unique..."
                    placeholderTextColor={theme.textSecondary}
                    value={bio}
                    onChangeText={setBio}
                    multiline
                    maxLength={300}
                    textAlignVertical="top"
                  />
                  <View style={styles.bioFooter}>
                    <ThemedText style={[styles.charCount, { color: bio.length > 250 ? theme.primary : theme.textSecondary }]}>
                      {bio.length}/300
                    </ThemedText>
                  </View>
                </View>

                <View style={[styles.bioTipsCard, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}25` }]}>
                  <ThemedText style={[styles.bioTipsTitle, { color: theme.primary }]}>✨ Tips for a great bio</ThemedText>
                  {["Share your cultural background", "Mention what makes you laugh", "Talk about your passions", "Keep it authentic and genuine"].map((tip) => (
                    <View key={tip} style={styles.bioTipRow}>
                      <Feather name="check-circle" size={13} color={theme.primary} />
                      <ThemedText style={[styles.bioTipText, { color: theme.text }]}>{tip}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── STEP 3: Photos ── */}
            {step === 3 && (
              <View style={styles.form}>
                <View style={styles.photoGrid}>
                  {[[0, 1], [2, 3], [4, 5]].map((rowIndices, rowIndex) => (
                    <View key={rowIndex} style={styles.photoRow}>
                      {rowIndices.map((slotIndex) => {
                        const photo = photos[slotIndex];
                        const isUploading = uploadingPhoto === slotIndex;
                        const isProfilePhoto = slotIndex === 0;
                        return (
                          <View
                            key={slotIndex}
                            style={[
                              styles.photoSlot,
                              isProfilePhoto && { borderColor: theme.primary, borderWidth: 2.5 },
                              !isProfilePhoto && { borderColor: theme.border },
                            ]}
                          >
                            {photo ? (
                              <>
                                <Image source={{ uri: photo.url }} style={styles.photoImage} contentFit="cover" />
                                <Pressable
                                  style={[styles.removePhotoBtn, { backgroundColor: theme.error }]}
                                  onPress={() => removePhoto(slotIndex)}
                                >
                                  <Feather name="x" size={12} color="#fff" />
                                </Pressable>
                                <View style={[styles.photoBadge, { backgroundColor: isProfilePhoto ? theme.primary : "rgba(0,0,0,0.45)" }]}>
                                  <ThemedText style={styles.photoBadgeText}>
                                    {isProfilePhoto ? "Main" : `${slotIndex + 1}`}
                                  </ThemedText>
                                </View>
                                <Pressable
                                  style={[styles.privacyBtn, { backgroundColor: "rgba(0,0,0,0.5)" }]}
                                  onPress={() => openPrivacyModal(slotIndex)}
                                >
                                  <Feather
                                    name={getPrivacyIcon(photo.privacy) as any}
                                    size={13}
                                    color={photo.privacy === "private" ? "#FF6B6B" : photo.privacy === "friends" ? "#FFC629" : "#10B981"}
                                  />
                                </Pressable>
                              </>
                            ) : (
                              <Pressable
                                style={[styles.emptyPhotoSlot, { backgroundColor: theme.surface }]}
                                onPress={() => showPhotoOptions(slotIndex)}
                                disabled={isUploading}
                              >
                                {isUploading ? (
                                  <ActivityIndicator color={theme.primary} />
                                ) : (
                                  <>
                                    <View style={[styles.addPhotoIcon, { backgroundColor: `${theme.primary}15` }]}>
                                      <Feather name={isProfilePhoto ? "user" : "plus"} size={22} color={theme.primary} />
                                    </View>
                                    <ThemedText style={[styles.slotLabel, { color: isProfilePhoto ? theme.primary : theme.textSecondary }]}>
                                      {isProfilePhoto ? "Profile Photo" : `Photo ${slotIndex + 1}`}
                                    </ThemedText>
                                  </>
                                )}
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </View>

                <View style={[styles.photoInfoRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <ThemedText style={[styles.photoCount, { color: theme.primary }]}>
                    {photos.filter((p) => p !== null).length}/6
                  </ThemedText>
                  <ThemedText style={[styles.photoInfoText, { color: theme.textSecondary }]}>
                    photos added · 4 minimum required
                  </ThemedText>
                </View>

                <View style={styles.privacyLegend}>
                  {[
                    { icon: "globe", color: theme.primary, label: "Public" },
                    { icon: "users", color: "#FFC629", label: "Friends only" },
                    { icon: "lock", color: "#FF6B6B", label: "Private" },
                  ].map((item) => (
                    <View key={item.label} style={styles.legendItem}>
                      <Feather name={item.icon as any} size={13} color={item.color} />
                      <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>{item.label}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── STEP 4: Interests ── */}
            {step === 4 && (
              <View style={styles.form}>
                <View style={[styles.selectionHint, { backgroundColor: `${theme.primary}10` }]}>
                  <ThemedText style={[styles.selectionHintText, { color: theme.primary }]}>
                    {interests.length}/5 selected · min 3
                  </ThemedText>
                </View>

                <View style={styles.chipsWrap}>
                  {INTERESTS_OPTIONS.map((item) => {
                    const selected = interests.includes(item.value);
                    return (
                      <Pressable
                        key={item.value}
                        onPress={() => toggleInterest(item.value)}
                        style={[
                          styles.chip,
                          selected
                            ? { backgroundColor: theme.primary, borderColor: theme.primary }
                            : { backgroundColor: theme.surface, borderColor: theme.border },
                        ]}
                      >
                        <ThemedText style={[styles.chipText, { color: selected ? "#fff" : theme.text }]}>
                          {item.label}
                        </ThemedText>
                        {selected && <Feather name="check" size={12} color="#fff" style={{ marginLeft: 4 }} />}
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Looking For</ThemedText>
                  <View style={styles.lookingForGrid}>
                    {LOOKING_FOR_OPTIONS.map((opt) => {
                      const selected = lookingFor === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          style={[
                            styles.lookingForCard,
                            { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? `${theme.primary}12` : theme.surface },
                          ]}
                          onPress={() => { Haptics.selectionAsync(); setLookingFor(opt.value); }}
                        >
                          <ThemedText style={[styles.lookingForEmoji]}>{opt.label.split(" ")[0]}</ThemedText>
                          <ThemedText style={[styles.lookingForLabel, { color: selected ? theme.primary : theme.text }]}>
                            {opt.label.split(" ").slice(1).join(" ")}
                          </ThemedText>
                          <ThemedText style={[styles.lookingForDesc, { color: theme.textSecondary }]}>{opt.desc}</ThemedText>
                          {selected && (
                            <View style={[styles.lookingForCheck, { backgroundColor: theme.primary }]}>
                              <Feather name="check" size={10} color="#fff" />
                            </View>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

            {/* ── STEP 5: Preferences ── */}
            {step === 5 && (
              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Age Range</ThemedText>
                  <View style={styles.ageRangeRow}>
                    <TextInput
                      style={[styles.ageInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                      placeholder="18"
                      placeholderTextColor={theme.textSecondary}
                      value={minAge}
                      onChangeText={setMinAge}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                    <ThemedText style={[styles.rangeSep, { color: theme.textSecondary }]}>to</ThemedText>
                    <TextInput
                      style={[styles.ageInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                      placeholder="50"
                      placeholderTextColor={theme.textSecondary}
                      value={maxAge}
                      onChangeText={setMaxAge}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Max Distance (km)</ThemedText>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="50"
                    placeholderTextColor={theme.textSecondary}
                    value={maxDistance}
                    onChangeText={setMaxDistance}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Show Me</ThemedText>
                  <View style={styles.pillRow}>
                    {["Male", "Female", "Other"].map((g) => (
                      <Pressable
                        key={g}
                        style={[
                          styles.pill,
                          { borderColor: theme.border, backgroundColor: theme.surface },
                          preferredGenders.includes(g) && { backgroundColor: theme.primary, borderColor: theme.primary },
                        ]}
                        onPress={() => { Haptics.selectionAsync(); togglePreferredGender(g); }}
                      >
                        <ThemedText style={[styles.pillText, { color: preferredGenders.includes(g) ? "#fff" : theme.text }]}>
                          {g}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View style={[styles.completeCard, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}25` }]}>
                  <ThemedText style={{ fontSize: 32, textAlign: "center" }}>🎉</ThemedText>
                  <ThemedText style={[styles.completeTitle, { color: theme.text }]}>You're almost done!</ThemedText>
                  <ThemedText style={[styles.completeDesc, { color: theme.textSecondary }]}>
                    Hit Complete Profile to start discovering amazing connections.
                  </ThemedText>
                </View>
              </View>
            )}

          </StepCard>

          {/* Navigation Buttons */}
          <View style={styles.navRow}>
            {step > 1 && (
              <Pressable
                style={[styles.backBtn, { borderColor: theme.border }]}
                onPress={() => { Haptics.selectionAsync(); setStep(step - 1); }}
              >
                <Feather name="arrow-left" size={18} color={theme.text} />
                <ThemedText style={[styles.backBtnText, { color: theme.text }]}>Back</ThemedText>
              </Pressable>
            )}
            <Pressable
              style={[styles.nextBtn, { flex: step > 1 ? 1.6 : 1 }]}
              onPress={step < 5 ? handleNext : handleComplete}
              disabled={loading}
            >
              <LinearGradient
                colors={["#10B981", "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.nextBtnGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <ThemedText style={styles.nextBtnText}>{step < 5 ? "Continue" : "Complete Profile"}</ThemedText>
                    <Feather name={step < 5 ? "arrow-right" : "check"} size={18} color="#fff" style={{ marginLeft: 6 }} />
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </ScreenKeyboardAwareScrollView>

      {/* Privacy Modal */}
      <Modal visible={privacyModalVisible} transparent animationType="fade" onRequestClose={() => setPrivacyModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPrivacyModalVisible(false)}>
          <View style={[styles.sheetModal, { backgroundColor: theme.background }]}>
            <View style={styles.sheetHandle} />
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Photo Privacy</ThemedText>
            <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>Who can see this photo?</ThemedText>
            {PRIVACY_OPTIONS.map((option) => {
              const isSelected = selectedPhotoIndex !== null && photos[selectedPhotoIndex]?.privacy === option.value;
              const iconColor = option.value === "private" ? "#FF6B6B" : option.value === "friends" ? "#FFC629" : theme.primary;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.privacyOption, { borderColor: isSelected ? theme.primary : theme.border, backgroundColor: isSelected ? `${theme.primary}10` : theme.surface }]}
                  onPress={() => setPhotoPrivacy(option.value)}
                >
                  <View style={[styles.privacyIconBox, { backgroundColor: `${iconColor}15` }]}>
                    <Feather name={option.icon as any} size={20} color={iconColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[styles.privacyLabel, { color: theme.text }]}>{option.label}</ThemedText>
                    <ThemedText style={[styles.privacyDesc, { color: theme.textSecondary }]}>{option.description}</ThemedText>
                  </View>
                  {isSelected && <Feather name="check-circle" size={20} color={theme.primary} />}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      {/* Zodiac Modal */}
      <Modal visible={zodiacModalVisible} transparent animationType="slide" onRequestClose={() => setZodiacModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.listModal, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Zodiac Sign</ThemedText>
              <Pressable onPress={() => setZodiacModalVisible(false)} hitSlop={8}>
                <Feather name="x" size={22} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.zodiacGrid}>
                {ZODIAC_SIGNS.map((sign) => (
                  <Pressable
                    key={sign.value}
                    style={[
                      styles.zodiacChip,
                      { borderColor: zodiacSign === sign.value ? theme.primary : theme.border, backgroundColor: zodiacSign === sign.value ? theme.primary : theme.surface },
                    ]}
                    onPress={() => { setZodiacSign(sign.value); setZodiacModalVisible(false); }}
                  >
                    <ThemedText style={[styles.zodiacText, { color: zodiacSign === sign.value ? "#fff" : theme.text }]}>{sign.label}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Education Modal */}
      <Modal visible={educationModalVisible} transparent animationType="slide" onRequestClose={() => setEducationModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.listModal, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Education Level</ThemedText>
              <Pressable onPress={() => setEducationModalVisible(false)} hitSlop={8}>
                <Feather name="x" size={22} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {EDUCATION_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.listItem,
                    { borderColor: education === option.value ? theme.primary : theme.border, backgroundColor: education === option.value ? `${theme.primary}10` : theme.surface },
                  ]}
                  onPress={() => { setEducation(option.value); setEducationModalVisible(false); }}
                >
                  <ThemedText style={[styles.listItemText, { color: theme.text }]}>{option.label}</ThemedText>
                  {education === option.value && <Feather name="check" size={18} color={theme.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Religion Modal */}
      <Modal visible={religionModalVisible} transparent animationType="slide" onRequestClose={() => setReligionModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.listModal, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Religion</ThemedText>
              <Pressable onPress={() => setReligionModalVisible(false)} hitSlop={8}>
                <Feather name="x" size={22} color={theme.text} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {RELIGION_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.listItem,
                    { borderColor: religion === option.value ? theme.primary : theme.border, backgroundColor: religion === option.value ? `${theme.primary}10` : theme.surface },
                  ]}
                  onPress={() => { setReligion(option.value); setReligionModalVisible(false); }}
                >
                  <ThemedText style={[styles.listItemText, { color: theme.text }]}>{option.label}</ThemedText>
                  {religion === option.value && <Feather name="check" size={18} color={theme.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Photo Picker Modal (Android) */}
      <Modal visible={photoPickerModalVisible} transparent animationType="fade" onRequestClose={() => setPhotoPickerModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPhotoPickerModalVisible(false)}>
          <View style={[styles.sheetModal, { backgroundColor: theme.background }]}>
            <View style={styles.sheetHandle} />
            <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Add Photo</ThemedText>
            <Pressable
              style={[styles.photoPickerRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => { setPhotoPickerModalVisible(false); pickImage(true, photoPickerSlotIndex); }}
            >
              <View style={[styles.photoPickerRowIcon, { backgroundColor: `${theme.primary}15` }]}>
                <Feather name="camera" size={22} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.photoPickerRowTitle, { color: theme.text }]}>Take Photo</ThemedText>
                <ThemedText style={[styles.photoPickerRowDesc, { color: theme.textSecondary }]}>Use your camera</ThemedText>
              </View>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>
            <Pressable
              style={[styles.photoPickerRow, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => { setPhotoPickerModalVisible(false); pickImage(false, photoPickerSlotIndex); }}
            >
              <View style={[styles.photoPickerRowIcon, { backgroundColor: `${"#00B2FF"}15` }]}>
                <Feather name="image" size={22} color="#00B2FF" />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.photoPickerRowTitle, { color: theme.text }]}>Choose from Library</ThemedText>
                <ThemedText style={[styles.photoPickerRowDesc, { color: theme.textSecondary }]}>Select from your photos</ThemedText>
              </View>
              <Feather name="chevron-right" size={18} color={theme.textSecondary} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const PHOTO_SLOT_WIDTH = (width - Spacing.xl * 2 - Spacing.md) / 2;

const styles = StyleSheet.create({
  gradientHeader: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  stepCounterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  stepCounter: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },
  stepIconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 5,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 3,
  },
  stepDots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: Spacing.md,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotActive: {
    width: 24,
    backgroundColor: "#fff",
  },
  stepDotDone: {
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.4,
    marginBottom: 3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  form: {
    gap: Spacing.lg,
  },
  inputGroup: {
    gap: Spacing.xs + 2,
  },
  binaryRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginLeft: 2,
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    fontWeight: "500",
    borderWidth: 1.5,
  },
  dropdownButton: {
    height: 52,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pillRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  pill: {
    flex: 1,
    height: 46,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: 14,
    fontWeight: "600",
  },
  bioCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.lg,
    minHeight: 160,
  },
  bioInput: {
    fontSize: 15,
    fontWeight: "400",
    lineHeight: 22,
    minHeight: 120,
  },
  bioFooter: {
    alignItems: "flex-end",
    marginTop: Spacing.sm,
  },
  charCount: {
    fontSize: 12,
    fontWeight: "500",
  },
  bioTipsCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  bioTipsTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  bioTipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  bioTipText: {
    fontSize: 13,
    fontWeight: "400",
  },
  photoGrid: {
    gap: 0,
  },
  photoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  photoSlot: {
    width: PHOTO_SLOT_WIDTH,
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    borderWidth: 1.5,
    position: "relative",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  removePhotoBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  photoBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  photoBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  privacyBtn: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPhotoSlot: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addPhotoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  slotLabel: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  photoInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  photoCount: {
    fontSize: 16,
    fontWeight: "800",
  },
  photoInfoText: {
    fontSize: 13,
    fontWeight: "400",
  },
  privacyLegend: {
    flexDirection: "row",
    gap: Spacing.lg,
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: "500",
  },
  selectionHint: {
    borderRadius: BorderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    alignSelf: "flex-start",
  },
  selectionHintText: {
    fontSize: 12,
    fontWeight: "700",
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  lookingForGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  lookingForCard: {
    width: (width - Spacing.xl * 2 - Spacing.sm) / 2,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: Spacing.md,
    position: "relative",
  },
  lookingForEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  lookingForLabel: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  lookingForDesc: {
    fontSize: 11,
    fontWeight: "400",
  },
  lookingForCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  ageRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  ageInput: {
    flex: 1,
    height: 52,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
    fontWeight: "600",
    borderWidth: 1.5,
    textAlign: "center",
  },
  rangeSep: {
    fontSize: 14,
    fontWeight: "500",
  },
  completeCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  completeTitle: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  completeDesc: {
    fontSize: 14,
    fontWeight: "400",
    textAlign: "center",
    lineHeight: 20,
  },
  navRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xxl,
  },
  backBtn: {
    height: 56,
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    gap: 6,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  nextBtn: {
    borderRadius: BorderRadius.full,
    overflow: "hidden",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  nextBtnGradient: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheetModal: {
    width: "100%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.12)",
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  listModal: {
    width: "100%",
    maxHeight: "70%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: "400",
    marginTop: -Spacing.xs,
    marginBottom: Spacing.xs,
  },
  privacyOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
  },
  privacyIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  privacyLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  privacyDesc: {
    fontSize: 12,
    fontWeight: "400",
  },
  zodiacGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  zodiacChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  zodiacText: {
    fontSize: 14,
    fontWeight: "500",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
  },
  listItemText: {
    fontSize: 15,
    fontWeight: "500",
  },
  photoPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
  },
  photoPickerRowIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPickerRowTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  photoPickerRowDesc: {
    fontSize: 12,
    fontWeight: "400",
  },
});

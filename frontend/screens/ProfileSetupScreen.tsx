import React, { useState, useEffect } from "react";
import { View, StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, Dimensions, Platform, Modal, StatusBar, SafeAreaView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ActionSheetIOS = Platform.OS === 'ios' ? require('react-native').ActionSheetIOS : null;
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

type ProfileSetupScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "ProfileSetup">;

interface ProfileSetupScreenProps {
  navigation: ProfileSetupScreenNavigationProp;
}

type PhotoPrivacy = 'public' | 'friends' | 'private';

interface PhotoItem {
  url: string;
  publicId?: string;
  privacy: PhotoPrivacy;
}

type PhotoSlot = PhotoItem | null;

const PROFILE_SETUP_STORAGE_KEY = "afroconnect_profile_setup_draft";

const INTERESTS_OPTIONS = [
  "Music", "Travel", "Food", "Sports", "Art", "Movies", "Reading", "Gaming",
  "Fitness", "Photography", "Dancing", "Cooking", "Fashion", "Technology"
];

const ZODIAC_SIGNS = [
  { value: 'aries', label: 'Aries' },
  { value: 'taurus', label: 'Taurus' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'cancer', label: 'Cancer' },
  { value: 'leo', label: 'Leo' },
  { value: 'virgo', label: 'Virgo' },
  { value: 'libra', label: 'Libra' },
  { value: 'scorpio', label: 'Scorpio' },
  { value: 'sagittarius', label: 'Sagittarius' },
  { value: 'capricorn', label: 'Capricorn' },
  { value: 'aquarius', label: 'Aquarius' },
  { value: 'pisces', label: 'Pisces' },
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

const PRIVACY_OPTIONS: { value: PhotoPrivacy; label: string; icon: string; description: string }[] = [
  { value: 'public', label: 'Public', icon: 'globe', description: 'Everyone can see' },
  { value: 'friends', label: 'Friends Only', icon: 'users', description: 'Only matches can see' },
  { value: 'private', label: 'Private', icon: 'lock', description: 'Only you can see' },
];

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
  const [religionModalVisible, setReligionModalVisible] = useState(false);
  const [ethnicity, setEthnicity] = useState("");

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
  const [communicationStyle, setCommunicationStyle] = useState("");
  const [loveStyle, setLoveStyle] = useState("");
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
  const [zodiacModalVisible, setZodiacModalVisible] = useState(false);
  const [educationModalVisible, setEducationModalVisible] = useState(false);
  const [ethnicityModalVisible, setEthnicityModalVisible] = useState(false);
  const [photoPickerModalVisible, setPhotoPickerModalVisible] = useState(false);
  const [photoPickerSlotIndex, setPhotoPickerSlotIndex] = useState<number>(0);

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
      } catch (error) {
        console.error("Failed to load profile draft:", error);
      }
    };
    loadDraft();
  }, []);

  useEffect(() => {
    const saveDraft = async () => {
      try {
        const data = {
          name, age, gender, zodiacSign, jobTitle, education, livingIn, religion, ethnicity,
          bio, lookingFor, interests, photos, minAge, maxAge, maxDistance, preferredGenders, step
        };
        await AsyncStorage.setItem(PROFILE_SETUP_STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.error("Failed to save profile draft:", error);
      }
    };
    saveDraft();
  }, [name, age, gender, zodiacSign, jobTitle, education, livingIn, religion, ethnicity, bio, lookingFor, interests, photos, minAge, maxAge, maxDistance, preferredGenders, step]);

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter(i => i !== interest));
    } else if (interests.length < 5) {
      setInterests([...interests, interest]);
    }
  };

  const handleNext = () => {
    if (step === 1) {
      const trimmedName = name.trim();
      const trimmedAge = age.trim();
      const trimmedJob = jobTitle.trim();
      const trimmedLiving = livingIn.trim();

      if (!trimmedAge || !gender || !education) {
        Alert.alert("Error", "Please fill in Age, Gender, and Education to continue");
        return;
      }

      if (!/^\d+$/.test(trimmedAge)) {
        Alert.alert("Error", "Age must contain only numbers");
        return;
      }

      const ageNum = parseInt(trimmedAge, 10);
      if (isNaN(ageNum) || ageNum < 18 || ageNum > 99) {
        Alert.alert("Error", "Please enter a valid age (18-99)");
        return;
      }

      setName(trimmedName);
      setAge(trimmedAge);
      setStep(2);
    } else if (step === 2) {
      if (!bio.trim()) {
        Alert.alert("Error", "Please add a bio");
        return;
      }
      setBio(bio.trim());
      setStep(3);
    } else if (step === 3) {
      const photoCount = photos.filter(p => p !== null).length;
      if (photoCount < 4) {
        Alert.alert("Error", "Please add at least 4 photos to continue");
        return;
      }
      setStep(4);
    } else if (step === 4) {
      if (interests.length < 3) {
        Alert.alert("Error", "Please select at least 3 interests");
        return;
      }
      if (!lookingFor) {
        Alert.alert("Error", "Please select what you're looking for");
        return;
      }
      setStep(5);
    }
  };

  const togglePreferredGender = (g: string) => {
    if (preferredGenders.includes(g)) {
      setPreferredGenders(preferredGenders.filter(pg => pg !== g));
    } else {
      setPreferredGenders([...preferredGenders, g]);
    }
  };

  const uploadPhoto = async (uri: string): Promise<{ url: string; publicId: string } | null> => {
    try {
      console.log('Starting photo upload to:', `${getApiBaseUrl()}/api/upload/photo`);
      console.log('Token available:', !!token);

      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', {
        uri,
        name: filename,
        type,
      } as any);

      const response = await fetch(`${getApiBaseUrl()}/api/upload/photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
        body: formData,
      });

      console.log('Upload response status:', response.status);
      const data = await response.json();
      console.log('Upload response data:', JSON.stringify(data));

      if (data.success && data.url) {
        return { url: data.url, publicId: data.publicId };
      }
      console.log('Upload failed - success:', data.success, 'url:', data.url);
      return null;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const pickImage = async (useCamera: boolean, slotIndex: number) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", `Please allow access to your ${useCamera ? 'camera' : 'photo library'}`);
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 5],
          quality: 0.8,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [4, 5],
          quality: 0.8,
        });

    if (!result.canceled && result.assets[0]) {
      setUploadingPhoto(slotIndex);
      const uploaded = await uploadPhoto(result.assets[0].uri);
      setUploadingPhoto(null);

      if (uploaded) {
        const newPhotos = [...photos];
        const existingPhoto = newPhotos[slotIndex];
        newPhotos[slotIndex] = { 
          ...uploaded, 
          privacy: existingPhoto?.privacy || 'public' 
        };
        setPhotos(newPhotos);
      } else {
        Alert.alert("Upload failed", "Could not upload photo. Please try again.");
      }
    }
  };

  const showPhotoOptions = (slotIndex: number) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex: number) => {
          if (buttonIndex === 1) {
            pickImage(true, slotIndex);
          } else if (buttonIndex === 2) {
            pickImage(false, slotIndex);
          }
        }
      );
    } else {
      setPhotoPickerSlotIndex(slotIndex);
      setPhotoPickerModalVisible(true);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos[index] = null;

    // Compact the array: shift all photos forward to fill gaps
    const validPhotos = newPhotos.filter((p): p is PhotoItem => p !== null);
    const compactedPhotos: PhotoSlot[] = [null, null, null, null, null, null];
    validPhotos.forEach((photo, i) => {
      compactedPhotos[i] = photo;
    });

    setPhotos(compactedPhotos);
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
      case 'public': return 'globe';
      case 'friends': return 'users';
      case 'private': return 'lock';
      default: return 'globe';
    }
  };

  const handleComplete = async () => {
    if (preferredGenders.length === 0) {
      Alert.alert("Error", "Please select at least one preferred gender");
      return;
    }

    const minAgeNum = parseInt(minAge, 10);
    const maxAgeNum = parseInt(maxAge, 10);
    const maxDistanceNum = parseInt(maxDistance, 10);

    if (isNaN(minAgeNum) || minAgeNum < 18 || minAgeNum > 99) {
      Alert.alert("Error", "Minimum age must be between 18 and 99");
      return;
    }

    if (isNaN(maxAgeNum) || maxAgeNum < 18 || maxAgeNum > 99) {
      Alert.alert("Error", "Maximum age must be between 18 and 99");
      return;
    }

    if (minAgeNum > maxAgeNum) {
      Alert.alert("Error", "Minimum age cannot be greater than maximum age");
      return;
    }

    if (isNaN(maxDistanceNum) || maxDistanceNum < 1 || maxDistanceNum > 500) {
      Alert.alert("Error", "Max distance must be between 1 and 500 km");
      return;
    }

    const trimmedAge = age.trim();
    const ageNum = parseInt(trimmedAge, 10);

    setLoading(true);
    try {
      const validPhotos = photos.filter((p): p is PhotoItem => p !== null);
      const formattedPhotos = validPhotos.map((photo, index) => ({
        url: photo.url,
        publicId: photo.publicId,
        privacy: photo.privacy,
        isPrimary: index === 0,
        order: index,
      }));

      const finalGender = gender.toLowerCase() === 'other' ? 'other' : gender.toLowerCase();
      const finalPreferredGenders = preferredGenders.length > 0 
        ? preferredGenders.map(g => g.toLowerCase())
        : [finalGender === 'male' ? 'female' : 'male'];

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
          hasKids: hasKids,
          hasPets: hasPets,
          smoking: smoking,
          drinking: drinking,
          religion: religion,
          ethnicity: ethnicity.trim(),
          personalityType: personalityType.trim(),
        },
        bio: bio.trim(),
        interests,
        lookingFor: lookingFor.toLowerCase() || 'friends',
        photos: formattedPhotos,
        favoriteSong: favoriteSongTitle.trim() ? {
          title: favoriteSongTitle.trim(),
          artist: favoriteSongArtist.trim(),
        } : undefined,
        location: { 
          type: 'Point',
          coordinates: [3.3792, 6.5244],
        },
        preferences: {
          ageRange: { min: minAgeNum, max: maxAgeNum },
          maxDistance: maxDistanceNum * 1000,
          genders: finalPreferredGenders,
        },
      });
      await AsyncStorage.removeItem(PROFILE_SETUP_STORAGE_KEY);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const STEP_META: Record<number, { title: string; subtitle: string }> = {
    1: { title: 'Tell us about yourself', subtitle: 'Basic information to get started' },
    2: { title: 'Describe yourself', subtitle: 'Write a bio that shows your personality' },
    3: { title: 'Add your photos', subtitle: 'Upload 1-6 photos. Tap the lock icon to set privacy.' },
    4: { title: 'Your interests', subtitle: 'Select at least 3 interests (max 5)' },
    5: { title: 'Your preferences', subtitle: 'Who would you like to meet?' },
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Fixed header — stays put when keyboard opens */}
      <View style={styles.header}>
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: theme.backgroundSecondary }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.primary, width: `${(step / 5) * 100}%` },
              ]}
            />
          </View>
          <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
            Step {step} of 5
          </ThemedText>
        </View>
        <ThemedText style={[styles.title, { color: theme.text, marginTop: Spacing.md }]}>
          {STEP_META[step].title}
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
          {STEP_META[step].subtitle}
        </ThemedText>
      </View>

      <ScreenKeyboardAwareScrollView contentContainerStyle={{ paddingTop: 0 }}>
      <View style={styles.content}>
        {step === 1 ? (
          <>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Name</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="Your name"
                  placeholderTextColor={theme.textSecondary}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Age</ThemedText>
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

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Gender</ThemedText>
                <View style={styles.genderButtons}>
                  {["Male", "Female", "Other"].map((g) => (
                    <Pressable
                      key={g}
                      style={[
                        styles.genderButton,
                        { borderColor: theme.border },
                        gender.toLowerCase() === g.toLowerCase() && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}
                      onPress={() => setGender(g)}
                    >
                      <ThemedText
                        style={[
                          styles.genderButtonText,
                          { color: theme.text },
                          gender.toLowerCase() === g.toLowerCase() && { color: theme.buttonText },
                        ]}
                      >
                        {g}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Zodiac Sign</ThemedText>
                <Pressable
                  style={[styles.selectButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setZodiacModalVisible(true)}
                >
                  <ThemedText style={[styles.selectButtonText, { color: zodiacSign ? theme.text : theme.textSecondary }]}>
                    {zodiacSign ? ZODIAC_SIGNS.find(z => z.value === zodiacSign)?.label : 'Select your sign'}
                  </ThemedText>
                  <Feather name="chevron-down" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Job Title</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. Software Engineer"
                  placeholderTextColor={theme.textSecondary}
                  value={jobTitle}
                  onChangeText={setJobTitle}
                  maxLength={100}
                />
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Education</ThemedText>
                <Pressable
                  style={[styles.selectButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setEducationModalVisible(true)}
                >
                  <ThemedText style={[styles.selectButtonText, { color: education ? theme.text : theme.textSecondary }]}>
                    {education ? EDUCATION_OPTIONS.find(e => e.value === education)?.label : 'Select education level'}
                  </ThemedText>
                  <Feather name="chevron-down" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Living In</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. Lagos, Nigeria"
                  placeholderTextColor={theme.textSecondary}
                  value={livingIn}
                  onChangeText={setLivingIn}
                  maxLength={100}
                />
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Religion</ThemedText>
                <Pressable
                  style={[styles.selectButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={() => setReligionModalVisible(true)}
                >
                  <ThemedText style={[styles.selectButtonText, { color: religion ? theme.text : theme.textSecondary }]}>
                    {religion ? RELIGION_OPTIONS.find(r => r.value === religion)?.label : 'Select religion'}
                  </ThemedText>
                  <Feather name="chevron-down" size={20} color={theme.textSecondary} />
                </Pressable>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Ethnicity</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. Yoruba, Igbo"
                  placeholderTextColor={theme.textSecondary}
                  value={ethnicity}
                  onChangeText={setEthnicity}
                />
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Personality Type</ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                  placeholder="e.g. INFJ, ENFP"
                  placeholderTextColor={theme.textSecondary}
                  value={personalityType}
                  onChangeText={setPersonalityType}
                  maxLength={4}
                />
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Smoking</ThemedText>
                <View style={styles.genderButtons}>
                  {["Never", "Socially", "Regularly"].map((s) => (
                    <Pressable
                      key={s}
                      style={[
                        styles.genderButton,
                        { borderColor: theme.border },
                        smoking === s.toLowerCase() && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}
                      onPress={() => setSmoking(s.toLowerCase())}
                    >
                      <ThemedText style={[styles.genderButtonText, { color: theme.text }, smoking === s.toLowerCase() && { color: theme.buttonText }]}>{s}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Drinking</ThemedText>
                <View style={styles.genderButtons}>
                  {["Never", "Socially", "Regularly"].map((d) => (
                    <Pressable
                      key={d}
                      style={[
                        styles.genderButton,
                        { borderColor: theme.border },
                        drinking === d.toLowerCase() && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}
                      onPress={() => setDrinking(d.toLowerCase())}
                    >
                      <ThemedText style={[styles.genderButtonText, { color: theme.text }, drinking === d.toLowerCase() && { color: theme.buttonText }]}>{d}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Have Kids?</ThemedText>
                <View style={styles.genderButtons}>
                  {[ {l: "Yes", v: true}, {l: "No", v: false} ].map((item) => (
                    <Pressable
                      key={item.l}
                      style={[
                        styles.genderButton,
                        { borderColor: theme.border },
                        hasKids === item.v && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}
                      onPress={() => setHasKids(item.v)}
                    >
                      <ThemedText style={[styles.genderButtonText, { color: theme.text }, hasKids === item.v && { color: theme.buttonText }]}>{item.l}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Have Pets?</ThemedText>
                <View style={styles.genderButtons}>
                  {[ {l: "Yes", v: true}, {l: "No", v: false} ].map((item) => (
                    <Pressable
                      key={item.l}
                      style={[
                        styles.genderButton,
                        { borderColor: theme.border },
                        hasPets === item.v && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}
                      onPress={() => setHasPets(item.v)}
                    >
                      <ThemedText style={[styles.genderButtonText, { color: theme.text }, hasPets === item.v && { color: theme.buttonText }]}>{item.l}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </>
        ) : step === 2 ? (
          <>
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>Bio</ThemedText>
                <TextInput
                  style={[
                    styles.input,
                    styles.bioInput,
                    { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
                  ]}
                  placeholder="Tell people about yourself, your interests, and what makes you unique..."
                  placeholderTextColor={theme.textSecondary}
                  value={bio}
                  onChangeText={setBio}
                  multiline
                  numberOfLines={5}
                  maxLength={300}
                  textAlignVertical="top"
                />
                <ThemedText style={[styles.charCount, { color: theme.textSecondary }]}>
                  {bio.length}/300
                </ThemedText>
              </View>
            </View>
          </>
        ) : step === 3 ? (
          <>
            <View style={styles.form}>
              <View style={styles.photoGrid}>
                {/* 2x3 Grid - 2 photos per row, 3 rows */}
                {[[0, 1], [2, 3], [4, 5]].map((rowIndices, rowIndex) => (
                  <View key={rowIndex} style={styles.photoRow}>
                    {rowIndices.map((slotIndex) => {
                      const photo = photos[slotIndex];
                      const isUploading = uploadingPhoto === slotIndex;
                      const isProfilePhoto = slotIndex === 0;
                      return (
                        <View key={slotIndex} style={[
                          styles.photoItem,
                          { width: '48%' },
                          isProfilePhoto && { borderColor: theme.primary, borderWidth: 3 }
                        ]}>
                          {photo ? (
                            <>
                              <Image source={{ uri: photo.url }} style={styles.photoImage} contentFit="cover" />
                              <Pressable style={[styles.removePhotoButton, { backgroundColor: theme.error }]} onPress={() => removePhoto(slotIndex)}>
                                <Feather name="x" size={14} color="#fff" />
                              </Pressable>
                              {isProfilePhoto ? (
                                <View style={[styles.profilePhotoBadge, { backgroundColor: theme.primary }]}>
                                  <ThemedText style={[styles.profilePhotoBadgeText, { color: theme.buttonText }]}>Profile</ThemedText>
                                </View>
                              ) : (
                                <View style={[styles.selectedBadge, { backgroundColor: theme.primary }]}>
                                  <ThemedText style={[styles.selectedBadgeText, { color: theme.buttonText }]}>{slotIndex + 1}</ThemedText>
                                </View>
                              )}
                              <Pressable style={[styles.privacyButton, { backgroundColor: theme.surface }]} onPress={() => openPrivacyModal(slotIndex)}>
                                <Feather name={getPrivacyIcon(photo.privacy) as any} size={14} color={photo.privacy === 'private' ? theme.error : photo.privacy === 'friends' ? theme.warning : theme.primary} />
                              </Pressable>
                            </>
                          ) : (
                            <Pressable
                              style={[styles.emptyPhotoSlot, { backgroundColor: theme.surface, borderColor: isProfilePhoto ? theme.primary : theme.border }]}
                              onPress={() => showPhotoOptions(slotIndex)}
                              disabled={isUploading}
                            >
                              {isUploading ? <ActivityIndicator color={theme.primary} /> : (
                                <>
                                  <Feather name={isProfilePhoto ? "user" : "plus"} size={28} color={theme.primary} />
                                  <ThemedText style={[styles.slotNumber, { color: isProfilePhoto ? theme.primary : theme.textSecondary }]}>
                                    {isProfilePhoto ? "Profile" : slotIndex + 1}
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
              <ThemedText style={[styles.photoHint, { color: theme.textSecondary }]}>
                {photos.filter(p => p !== null).length}/6 photos added. First photo will be your main profile picture.
              </ThemedText>

              <View style={styles.privacyLegend}>
                <View style={styles.legendItem}>
                  <Feather name="globe" size={14} color={theme.primary} />
                  <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Public</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <Feather name="users" size={14} color={theme.warning} />
                  <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Friends</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <Feather name="lock" size={14} color={theme.error} />
                  <ThemedText style={[styles.legendText, { color: theme.textSecondary }]}>Private</ThemedText>
                </View>
              </View>
            </View>

            <Modal
              visible={privacyModalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setPrivacyModalVisible(false)}
            >
              <Pressable 
                style={styles.modalOverlay} 
                onPress={() => setPrivacyModalVisible(false)}
              >
                <View style={[styles.privacyModal, { backgroundColor: theme.background }]}>
                  <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                    Photo Privacy
                  </ThemedText>
                  <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                    Who can see this photo?
                  </ThemedText>

                  {PRIVACY_OPTIONS.map((option) => {
                    const isSelected = selectedPhotoIndex !== null && photos[selectedPhotoIndex]?.privacy === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[
                          styles.privacyOption,
                          { borderColor: theme.border },
                          isSelected && { borderColor: theme.primary, backgroundColor: theme.primaryLight },
                        ]}
                        onPress={() => setPhotoPrivacy(option.value)}
                      >
                        <View style={styles.privacyOptionContent}>
                          <View style={[styles.privacyIconContainer, { backgroundColor: theme.surface }]}>
                            <Feather 
                              name={option.icon as any} 
                              size={20} 
                              color={option.value === 'private' ? theme.error : option.value === 'friends' ? theme.warning : theme.primary} 
                            />
                          </View>
                          <View style={styles.privacyOptionText}>
                            <ThemedText style={[styles.privacyOptionLabel, { color: theme.text }]}>
                              {option.label}
                            </ThemedText>
                            <ThemedText style={[styles.privacyOptionDesc, { color: theme.textSecondary }]}>
                              {option.description}
                            </ThemedText>
                          </View>
                        </View>
                        {isSelected ? (
                          <Feather name="check-circle" size={22} color={theme.primary} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </Pressable>
            </Modal>
          </>
        ) : step === 4 ? (
          <>
            <View style={styles.form}>
              <View style={styles.interestsGrid}>
                {INTERESTS_OPTIONS.map((interest) => (
                  <Pressable
                    key={interest}
                    style={[
                      styles.interestChip,
                      { borderColor: theme.border, backgroundColor: theme.surface },
                      interests.includes(interest) && {
                        backgroundColor: theme.primary,
                        borderColor: theme.primary,
                      },
                    ]}
                    onPress={() => toggleInterest(interest)}
                  >
                    <ThemedText
                      style={[
                        styles.interestText,
                        { color: theme.text },
                        interests.includes(interest) && { color: theme.buttonText },
                      ]}
                    >
                      {interest}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>
                  Looking for
                </ThemedText>
                <View style={styles.lookingForButtons}>
                  {["Relationship", "Friendship", "Casual", "Not sure"].map((option) => (
                    <Pressable
                      key={option}
                      style={[
                        styles.lookingForButton,
                        { borderColor: theme.border },
                        lookingFor === option && {
                          backgroundColor: theme.primary,
                          borderColor: theme.primary,
                        },
                      ]}
                      onPress={() => setLookingFor(option)}
                    >
                      <ThemedText
                        style={[
                          styles.lookingForText,
                          { color: theme.text },
                          lookingFor === option && { color: theme.buttonText },
                        ]}
                      >
                        {option}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>
                  Age range
                </ThemedText>
                <View style={styles.ageRangeContainer}>
                  <TextInput
                    style={[styles.ageInput, { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border }]}
                    placeholder="18"
                    placeholderTextColor={theme.textSecondary}
                    value={minAge}
                    onChangeText={setMinAge}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <ThemedText style={{ color: theme.text }}>to</ThemedText>
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

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>
                  Maximum distance (km)
                </ThemedText>
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

              <View style={styles.inputContainer}>
                <ThemedText style={[styles.label, { color: theme.text }]}>
                  Show me
                </ThemedText>
                <View style={styles.genderButtons}>
                  {["Male", "Female", "Other"].map((g) => (
                    <Pressable
                      key={g}
                      style={[
                        styles.genderButton,
                        { borderColor: theme.border },
                        preferredGenders.includes(g) && { backgroundColor: theme.primary, borderColor: theme.primary },
                      ]}
                      onPress={() => togglePreferredGender(g)}
                    >
                      <ThemedText
                        style={[
                          styles.genderButtonText,
                          { color: theme.text },
                          preferredGenders.includes(g) && { color: theme.buttonText },
                        ]}
                      >
                        {g}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </>
        )}

        <View style={styles.buttonContainer}>
          {step > 1 && (
            <Pressable
              style={[styles.button, styles.secondaryButton, { borderColor: theme.border }]}
              onPress={() => setStep(step - 1)}
            >
              <ThemedText style={[styles.buttonText, { color: theme.text }]}>
                Back
              </ThemedText>
            </Pressable>
          )}
          <Pressable
            style={[styles.button, styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={step < 5 ? handleNext : handleComplete}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.buttonText} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: theme.buttonText }]}>
                {step < 5 ? "Next" : "Complete"}
              </ThemedText>
            )}
          </Pressable>
        </View>
      </View>

      {/* Zodiac Sign Modal */}
      <Modal
        visible={zodiacModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setZodiacModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Select Zodiac Sign</ThemedText>
              <Pressable onPress={() => setZodiacModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <View style={styles.zodiacGrid}>
              {ZODIAC_SIGNS.map((sign) => (
                <Pressable
                  key={sign.value}
                  style={[
                    styles.zodiacItem,
                    { borderColor: theme.border },
                    zodiacSign === sign.value && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                  onPress={() => {
                    setZodiacSign(sign.value);
                    setZodiacModalVisible(false);
                  }}
                >
                  <ThemedText style={[styles.zodiacLabel, { color: zodiacSign === sign.value ? theme.buttonText : theme.text }]}>
                    {sign.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Education Modal */}
      <Modal
        visible={educationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEducationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Select Education Level</ThemedText>
              <Pressable onPress={() => setEducationModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <View style={styles.educationList}>
              {EDUCATION_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.educationItem,
                    { borderColor: theme.border },
                    education === option.value && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                  onPress={() => {
                    setEducation(option.value);
                    setEducationModalVisible(false);
                  }}
                >
                  <ThemedText style={[styles.educationLabel, { color: education === option.value ? theme.buttonText : theme.text }]}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Religion Modal */}
      <Modal
        visible={religionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReligionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Select Religion</ThemedText>
              <Pressable onPress={() => setReligionModalVisible(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>
            <View style={styles.educationList}>
              {RELIGION_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.educationItem,
                    { borderColor: theme.border },
                    religion === option.value && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}
                  onPress={() => {
                    setReligion(option.value);
                    setReligionModalVisible(false);
                  }}
                >
                  <ThemedText style={[styles.educationLabel, { color: religion === option.value ? theme.buttonText : theme.text }]}>
                    {option.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Photo Picker Modal (Android) */}
      <Modal
        visible={photoPickerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPickerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.photoPickerModal, { backgroundColor: theme.surface }]}>
            <View style={styles.photoPickerHeader}>
              <View style={[styles.photoPickerIconContainer, { backgroundColor: `${theme.primary}20` }]}>
                <Feather name="camera" size={28} color={theme.primary} />
              </View>
              <ThemedText style={[styles.photoPickerTitle, { color: theme.text }]}>Add Photo</ThemedText>
              <ThemedText style={[styles.photoPickerSubtitle, { color: theme.textSecondary }]}>
                Choose how you want to add your photo
              </ThemedText>
            </View>

            <View style={styles.photoPickerOptions}>
              <Pressable
                style={[styles.photoPickerOption, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                onPress={() => {
                  setPhotoPickerModalVisible(false);
                  pickImage(true, photoPickerSlotIndex);
                }}
              >
                <View style={[styles.photoPickerOptionIcon, { backgroundColor: `${theme.primary}15` }]}>
                  <Feather name="camera" size={24} color={theme.primary} />
                </View>
                <View style={styles.photoPickerOptionText}>
                  <ThemedText style={[styles.photoPickerOptionTitle, { color: theme.text }]}>Take Photo</ThemedText>
                  <ThemedText style={[styles.photoPickerOptionDesc, { color: theme.textSecondary }]}>Use your camera</ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>

              <Pressable
                style={[styles.photoPickerOption, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                onPress={() => {
                  setPhotoPickerModalVisible(false);
                  pickImage(false, photoPickerSlotIndex);
                }}
              >
                <View style={[styles.photoPickerOptionIcon, { backgroundColor: `${theme.secondary}15` }]}>
                  <Feather name="image" size={24} color={theme.secondary} />
                </View>
                <View style={styles.photoPickerOptionText}>
                  <ThemedText style={[styles.photoPickerOptionTitle, { color: theme.text }]}>Choose from Library</ThemedText>
                  <ThemedText style={[styles.photoPickerOptionDesc, { color: theme.textSecondary }]}>Select from your photos</ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            <Pressable
              style={[styles.photoPickerCancelButton, { borderColor: theme.border }]}
              onPress={() => setPhotoPickerModalVisible(false)}
            >
              <ThemedText style={[styles.photoPickerCancelText, { color: theme.textSecondary }]}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
      </ScreenKeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  progressContainer: {
    gap: Spacing.sm,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressText: {
    ...Typography.small,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    marginBottom: Spacing.xl,
  },
  form: {
    gap: Spacing.lg,
  },
  inputContainer: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.body,
    fontWeight: "500",
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    borderWidth: 1,
  },
  bioInput: {
    height: 120,
    paddingTop: Spacing.md,
  },
  charCount: {
    ...Typography.small,
    textAlign: "right",
  },
  genderButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  genderButton: {
    flex: 1,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  genderButtonText: {
    ...Typography.body,
    fontWeight: "500",
  },
  ageRangeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  ageInput: {
    flex: 1,
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
    borderWidth: 1,
    textAlign: "center",
  },
  interestsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  interestChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  interestText: {
    ...Typography.caption,
    fontWeight: "500",
  },
  lookingForButtons: {
    gap: Spacing.sm,
  },
  lookingForButton: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  lookingForText: {
    ...Typography.body,
    fontWeight: "500",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  button: {
    flex: 1,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {},
  secondaryButton: {
    borderWidth: 2,
  },
  buttonText: {
    ...Typography.body,
    fontWeight: "600",
  },
  photoGrid: {
    gap: Spacing.md,
  },
  photoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  photoItem: {
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: "transparent",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  selectedBadge: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedBadgeText: {
    ...Typography.small,
    fontWeight: "700",
  },
  photoHint: {
    ...Typography.small,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  addPhotoButton: {
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  addPhotoText: {
    ...Typography.small,
    fontWeight: "500",
  },
  removePhotoButton: {
    position: "absolute",
    top: Spacing.xs,
    left: Spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPhotoSlot: {
    width: "100%",
    height: "100%",
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  profilePhotoBadge: {
    position: "absolute",
    bottom: Spacing.sm,
    left: Spacing.sm,
    right: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  profilePhotoBadgeText: {
    ...Typography.small,
    fontWeight: "700",
  },
  slotNumber: {
    ...Typography.small,
    fontWeight: "600",
  },
  privacyButton: {
    position: "absolute",
    bottom: Spacing.xs,
    right: Spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  privacyLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendText: {
    ...Typography.small,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  privacyModal: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h2,
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  modalSubtitle: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  privacyOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  privacyOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  privacyIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  privacyOptionText: {
    gap: 2,
  },
  privacyOptionLabel: {
    ...Typography.body,
    fontWeight: "600",
  },
  privacyOptionDesc: {
    ...Typography.small,
  },
  selectButton: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectButtonText: {
    ...Typography.body,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  zodiacGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "center",
  },
  zodiacItem: {
    width: 80,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  zodiacLabel: {
    ...Typography.small,
    fontWeight: "500",
  },
  educationList: {
    gap: Spacing.sm,
  },
  educationItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  educationLabel: {
    ...Typography.body,
    fontWeight: "500",
    textAlign: "center",
  },
  photoPickerModal: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  photoPickerHeader: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  photoPickerIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  photoPickerTitle: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  photoPickerSubtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  photoPickerOptions: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  photoPickerOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  photoPickerOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPickerOptionText: {
    flex: 1,
  },
  photoPickerOptionTitle: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: 2,
  },
  photoPickerOptionDesc: {
    ...Typography.small,
  },
  photoPickerCancelButton: {
    paddingVertical: Spacing.md,
    alignItems: "center",
    borderTopWidth: 1,
    marginTop: Spacing.sm,
  },
  photoPickerCancelText: {
    ...Typography.body,
    fontWeight: "500",
  },
});

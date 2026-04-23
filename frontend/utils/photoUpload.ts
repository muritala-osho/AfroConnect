
import { Alert, Platform } from "react-native";
import * as ImagePicker from 'expo-image-picker';

export interface PhotoResult {
  uri: string;
  base64?: string;
  width: number;
  height: number;
}

const CLOUDINARY_UPLOAD_PRESET = 'afroconnect_uploads';
const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'your-cloud-name';

export async function uploadToCloudinary(photoUri: string): Promise<string> {
  try {
    const formData = new FormData();
    
    const filename = photoUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri: photoUri,
      name: filename,
      type,
    } as any);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    const data = await response.json();
    
    if (data.secure_url) {
      return data.secure_url;
    } else {
      throw new Error('Upload failed');
    }
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

export async function pickImageFromGallery(options?: {
  allowsMultiple?: boolean;
  maxCount?: number;
}): Promise<PhotoResult[] | null> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant photo library access to upload photos.'
      );
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: options?.allowsMultiple || false,
      quality: 0.8,
      base64: false,
    });

    if (result.canceled) {
      return null;
    }

    const photos: PhotoResult[] = result.assets.map(asset => ({
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    }));

    return photos;
  } catch (error) {
    console.error('Error picking image:', error);
    Alert.alert('Error', 'Failed to pick image. Please try again.');
    return null;
  }
}

export async function takePhoto(): Promise<PhotoResult | null> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Please grant camera access to take photos.'
      );
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: false,
    });

    if (result.canceled) {
      return null;
    }

    const photo = result.assets[0];
    return {
      uri: photo.uri,
      width: photo.width,
      height: photo.height,
    };
  } catch (error) {
    console.error('Error taking photo:', error);
    Alert.alert('Error', 'Failed to take photo. Please try again.');
    return null;
  }
}

export function showPhotoSourceDialog(
  onGallery: () => void,
  onCamera: () => void
): void {
  if (Platform.OS === "web") {
    onGallery();
    return;
  }

  Alert.alert(
    "Add Photo",
    "Choose a source",
    [
      {
        text: "Gallery",
        onPress: onGallery,
      },
      {
        text: "Camera",
        onPress: onCamera,
      },
      {
        text: "Cancel",
        style: "cancel",
      },
    ]
  );
}

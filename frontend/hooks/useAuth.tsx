import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from "react";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import { useApi } from "./useApi";
import socketService from "@/services/socket";
import { getApiBaseUrl } from "@/constants/config";
import logger from "@/utils/logger";

function getDeviceInfo(): { deviceName: string; platform: string } {
  const model = Device.modelName || "Unknown Device";
  const osName = Device.osName || (Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Web");
  const osVersion = Device.osVersion || "";
  const deviceName = osVersion ? `${model} · ${osName} ${osVersion}` : `${model} · ${osName}`;
  const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";
  return { deviceName, platform };
}

export interface UserPhoto {
  _id?: string;
  url: string;
  publicId?: string;
  isPrimary?: boolean;
  privacy: 'public' | 'friends' | 'private';
  order?: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  age: number;
  gender: string;
  bio: string;
  interests: string[];
  photos: UserPhoto[];
  location: { 
    type?: string;
    coordinates?: [number, number];
    lat?: number; 
    lng?: number;
    city?: string;
    country?: string;
  };
  lookingFor: string;
  preferences?: {
    ageRange?: { min: number; max: number };
    maxDistance?: number;
    genders?: string[];
    genderPreference?: string;
    language?: string;
  };
  favoriteSong?: {
    title: string;
    artist: string;
    spotifyUri?: string;
  };
  spotify?: {
    connected: boolean;
    displayName?: string;
  };
  zodiacSign?: string;
  jobTitle?: string;
  education?: string;
  school?: string;
  livingIn?: string;
  privacySettings?: {
    hideAge?: boolean;
    showOnlineStatus?: boolean;
    showDistance?: boolean;
    showLastActive?: boolean;
  };
  lifestyle?: {
    lookingFor?: string;
    religion?: string;
    drinking?: string;
    smoking?: string;
    workout?: string;
    pets?: string;
    hasKids?: boolean;
    hasPets?: boolean;
    wantsKids?: boolean;
    communicationStyle?: string;
    loveStyle?: string;
    personalityType?: string;
    ethnicity?: string;
    relationshipStatus?: string;
  };
  googleId?: string;
  isAdmin?: boolean;
  premium?: { isActive: boolean; plan: string; expiresAt?: string };
  needsVerification?: boolean;
  profileIncomplete?: boolean;
  height?: string | number;
  language?: string;
  religion?: string;
  ethnicity?: string;
  additionalLocations?: Array<{ city?: string; country?: string; coordinates?: [number, number] }>;
  settings?: Record<string, any>;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<{ userId: string; email: string }>;
  verifyOTP: (userId: string, otp: string) => Promise<{ needsProfileSetup: boolean }>;
  resendOTP: (userId: string) => Promise<void>;
  completeProfileSetup: (data: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  fetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const PENDING_PROFILE_KEY = 'pending_profile_setup';
const LANGUAGE_SYNCED_KEY = 'app_language_synced';
const LANGUAGE_STORAGE_KEY = 'app_language_preference';

async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function deleteToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingProfileSetup, setPendingProfileSetup] = useState(false);
  const { post, put, get } = useApi();

  useEffect(() => {
    loadAuthData();
  }, []);

  const userProfileComplete = useMemo(() => {
    const hasPhotos = !!user?.photos && Array.isArray(user.photos) && user.photos.length > 0;
    return !!user && hasPhotos;
  }, [user?.photos, user]);
  
  useEffect(() => {
    const uid = (user as any)?._id || user?.id;
    if (uid && token) {
      try {
        socketService.connect(token);
        socketService.setUserOnline(uid);

        const handleBanned = (data: { reason?: string }) => {
          Alert.alert(
            'Account Suspended',
            `Your account has been suspended${data?.reason ? `: ${data.reason}` : '.'}`,
            [{ text: 'OK', onPress: () => clearAuthData() }],
            { cancelable: false }
          );
        };
        const handleSuspended = (data: { days?: number }) => {
          Alert.alert(
            'Account Temporarily Suspended',
            `Your account has been suspended for ${data?.days ?? 'several'} day(s). You will be logged out now.`,
            [{ text: 'OK', onPress: () => clearAuthData() }],
            { cancelable: false }
          );
        };
        const handleSessionRevoked = (data: { reason?: string }) => {
          Alert.alert(
            'Device Removed',
            data?.reason || 'This device has been logged out remotely.',
            [{ text: 'OK', onPress: () => clearAuthData() }],
            { cancelable: false }
          );
        };

        socketService.on('user:banned', handleBanned);
        socketService.on('user:suspended', handleSuspended);
        socketService.on('session:revoked', handleSessionRevoked);

        return () => {
          socketService.off('user:banned', handleBanned);
          socketService.off('user:suspended', handleSuspended);
          socketService.off('session:revoked', handleSessionRevoked);
        };
      } catch (err) {
        logger.error('Socket connection failed:', err);
      }
    }
    return () => {};
  }, [user?.id, token]);

  const loadAuthData = async () => {
    try {
      const [storedToken, storedUser, pendingSetup] = await Promise.all([
        getToken(),
        AsyncStorage.getItem(USER_KEY),
        AsyncStorage.getItem(PENDING_PROFILE_KEY),
      ]);

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        setPendingProfileSetup(pendingSetup === 'true');
      }
    } catch (error) {
      logger.error("Error loading auth data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAuthData = async (authToken: string, userData: User) => {
    try {
      const baseUrl = getApiBaseUrl();
      const userResponse = await fetch(`${baseUrl}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const userDataFull = await userResponse.json();
      const finalUserData = userDataFull.success ? userDataFull.user : userData;

      await Promise.all([
        saveToken(authToken),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(finalUserData)),
      ]);
      setToken(authToken);
      setUser(finalUserData);
    } catch (error) {
      logger.error("Error saving auth data:", error);
      await Promise.all([
        saveToken(authToken),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(userData)),
      ]);
      setToken(authToken);
      setUser(userData);
    }
  };

  const clearAuthData = async () => {
    try {
      const currentUserId = user?.id;
      const asyncKeys = [USER_KEY, PENDING_PROFILE_KEY, LANGUAGE_STORAGE_KEY];
      if (currentUserId) {
        asyncKeys.push(`${LANGUAGE_SYNCED_KEY}_${currentUserId}`);
      }
      await Promise.all([
        ...asyncKeys.map(key => AsyncStorage.removeItem(key)),
        deleteToken(),
      ]);
      setToken(null);
      setUser(null);
      setPendingProfileSetup(false);
      if (socketService) {
        socketService.disconnect();
      }
    } catch (error) {
      logger.error("Error clearing auth data:", error);
    }
  };

  const login = async (email: string, password: string) => {
    const baseUrl = getApiBaseUrl();
    const loginUrl = `${baseUrl}/api/auth/login`;
    
    try {
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email, password, ...getDeviceInfo() }),
      });

      const responseText = await response.text();

      if (responseText.startsWith('<')) {
        throw new Error('Server returned HTML instead of JSON. Check backend status.');
      }

      const data = JSON.parse(responseText);
      if (!response.ok) {
        const error: any = new Error(data.message || `Login failed (${response.status})`);
        error.isBanned = data.isBanned || false;
        error.status = response.status;
        error.appealToken = data.appealToken;
        error.email = data.email;
        error.banReason = data.banReason;
        error.bannedAt = data.bannedAt;
        error.appeal = data.appeal;
        throw error;
      }

      await saveAuthData(data.token, data.user);
      await fetchUser();
    } catch (error: any) {
      logger.error('Login error:', error.message);
      throw error;
    }
  };

  const signup = async (email: string, password: string) => {
    const baseUrl = getApiBaseUrl();
    const signupUrl = `${baseUrl}/api/auth/signup`;
    try {
      const response = await fetch(signupUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const responseText = await response.text();
      
      if (responseText.startsWith('<')) {
        throw new Error('Server returned HTML error page. Backend may be down or misconfigured.');
      }
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(`Server returned invalid response: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        throw new Error(data.message || `Signup failed with status ${response.status}`);
      }

      return data;
    } catch (error: any) {
      throw new Error(error.message || 'Network request failed');
    }
  };

  const verifyOTP = async (userId: string, otp: string) => {
    const response = await post<{ token: string; user: any }>('/auth/verify-otp', {
      userId,
      otp,
      ...getDeviceInfo(),
    });

    if (response.success && response.data) {
      await Promise.all([
        saveToken(response.data.token),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(response.data.user)),
        AsyncStorage.setItem(PENDING_PROFILE_KEY, 'true'),
      ]);
      setToken(response.data.token);
      setUser(response.data.user);
      setPendingProfileSetup(true);
      return { needsProfileSetup: true };
    } else {
      throw new Error(response.error || 'Verification failed');
    }
  };

  const completeProfileSetup = async (data: Partial<User>) => {
    if (!token) throw new Error('Not authenticated');

    const response = await put<{ user: User }>('/users/me', data, token);

    if (response.success && response.data) {
      const updatedUser = response.data.user;
      await Promise.all([
        AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser)),
        AsyncStorage.removeItem(PENDING_PROFILE_KEY),
      ]);
      setUser(updatedUser);
      setPendingProfileSetup(false);
    } else {
      throw new Error(response.error || 'Profile setup failed');
    }
  };

  const resendOTP = async (userId: string) => {
    const response = await post<{ message: string }>('/auth/resend-otp', {
      userId,
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to resend OTP');
    }
  };

  const logout = async () => {
    try {
      const currentToken = token || await getToken();
      if (currentToken) {
        await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentToken}`,
          },
        });
      }
    } catch (_) {}
    await clearAuthData();
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!token) return;

    const response = await put<{ user: User }>('/users/me', data, token);

    if (response.success && response.data) {
      const updatedUser = response.data.user;
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);
    } else {
      throw new Error(response.error || 'Update failed');
    }
  };

  const fetchUser = async () => {
    if (!token) return;

    const response = await get<{ user: User }>('/users/me', {}, token);

    if (response.success && response.data) {
      const updatedUser = response.data.user as any;
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      setUser(updatedUser);

      try {
        if (updatedUser.notificationPreferences) {
          await AsyncStorage.setItem(
            'notificationPreferences',
            JSON.stringify(updatedUser.notificationPreferences)
          );
        }
        const pushEnabled = updatedUser.settings?.pushNotifications;
        if (pushEnabled !== undefined) {
          await AsyncStorage.setItem(
            'pushNotificationsEnabled',
            pushEnabled ? 'true' : 'false'
          );
        }
      } catch {}
    }
  };

  const isProfileComplete = userProfileComplete;
  const isAuthenticated = !!token && !!user && isProfileComplete && !pendingProfileSetup;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isProfileComplete,
        isLoading,
        login,
        signup,
        verifyOTP,
        resendOTP,
        completeProfileSetup,
        logout,
        updateProfile,
        fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

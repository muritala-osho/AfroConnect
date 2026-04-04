import React, { useEffect, useCallback } from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Ionicons } from "@expo/vector-icons";

import RootNavigator from "@/navigation/RootNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { LanguageProvider, useLanguage } from "@/hooks/useLanguage";
import { UnreadProvider } from "@/context/UnreadContext";
import IncomingCallHandler from "@/components/IncomingCallHandler";
import {
  registerForPushNotificationsAsync,
  setupNotificationListeners,
} from "@/services/notifications";
import { getApiBaseUrl } from "@/constants/config";
import AsyncStorage from "@react-native-async-storage/async-storage";

SplashScreen.preventAutoHideAsync();

// Print API configuration on startup
console.log("\n\n========== AFROCONNECT APP STARTED ==========");
console.log("API Base URL:", getApiBaseUrl());
console.log("Signup URL:", `${getApiBaseUrl()}/api/auth/signup`);
console.log("Login URL:", `${getApiBaseUrl()}/api/auth/login`);
console.log("==========================================\n\n");

function LanguageSync() {
  const { user, isLoading } = useAuth();
  const { syncFromProfile, resetLanguage } = useLanguage();

  useEffect(() => {
    if (!isLoading) {
      if (user?.id && user?.preferences?.language) {
        syncFromProfile(user.preferences.language, user.id);
      } else if (!user) {
        resetLanguage();
      }
    }
  }, [
    isLoading,
    user?.id,
    user?.preferences?.language,
    syncFromProfile,
    resetLanguage,
    user,
  ]);

  return null;
}

function AppContent() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [isOverlayVisible, setIsOverlayVisible] = React.useState(false);

  const onLayoutRootView = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  // Initialize notifications when user is authenticated
  useEffect(() => {
    if (!user?.id) return;

    let unsubscribe: (() => void) | undefined;

    const setupNotifications = async () => {
      try {
        // Register for push notifications
        await registerForPushNotificationsAsync();

        // Setup listeners for incoming notifications
        unsubscribe = setupNotificationListeners(
          (notification) => {
            console.log("Notification received:", notification);
            // Handle notification when app is in foreground
          },
          async (response) => {
            console.log("User tapped notification:", response);
            // Track notification open for the timing engine
            try {
              const token = await AsyncStorage.getItem("token");
              if (token) {
                const screen = response?.notification?.request?.content?.data?.screen;
                fetch(`${getApiBaseUrl()}/api/engagement/notification-opened`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ screen: screen || "unknown" }),
                }).catch(() => {}); // fire and forget — never block UX
              }
            } catch {}
          },
        );
      } catch (error) {
        console.error("Failed to setup notifications:", error);
      }
    };

    setupNotifications();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  return (
    <GestureHandlerRootView style={styles.root} onLayout={onLayoutRootView}>
      <KeyboardProvider>
        <NavigationContainer>
          <RootNavigator />
          <IncomingCallHandler />
        </NavigationContainer>
        <StatusBar style={isDark ? "light" : "dark"} />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <UnreadProvider>
                <LanguageSync />
                <AppContent />
              </UnreadProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

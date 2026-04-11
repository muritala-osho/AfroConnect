import React, { useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, AppState } from "react-native";
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
import { CallProvider } from "@/contexts/CallContext";
import IncomingCallHandler from "@/components/IncomingCallHandler";
import FloatingCallBar from "@/components/FloatingCallBar";
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
  const { user, token } = useAuth();
  const [isOverlayVisible, setIsOverlayVisible] = React.useState(false);
  const appState = useRef(AppState.currentState);

  const onLayoutRootView = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  // Initialize notifications when user is authenticated
  useEffect(() => {
    if (!user?.id) return;

    let unsubscribe: (() => void) | undefined;

    const setupNotifications = async () => {
      try {
        // Register for push notifications — pass token directly so we
        // don't rely on AsyncStorage timing after a fresh login
        await registerForPushNotificationsAsync(token ?? undefined);

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
              const token = await AsyncStorage.getItem("auth_token");
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

    // Re-register push token every time the app comes back to the foreground.
    // This ensures the token stays fresh if Expo rotates it while the app was
    // in the background, and also retries any failed registration from login.
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        registerForPushNotificationsAsync(token ?? undefined).catch(() => {});
      }
      appState.current = nextState;
    });

    return () => {
      if (unsubscribe) unsubscribe();
      appStateSubscription.remove();
    };
  }, [user?.id]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  return (
    <GestureHandlerRootView style={styles.root} onLayout={onLayoutRootView}>
      <KeyboardProvider>
        <CallProvider>
          <NavigationContainer>
            <RootNavigator />
            <IncomingCallHandler />
            <FloatingCallBar />
          </NavigationContainer>
          <StatusBar style={isDark ? "light" : "dark"} />
        </CallProvider>
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

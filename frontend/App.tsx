import React, { useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, AppState, Platform } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Ionicons } from "@expo/vector-icons";
import { initCallKeep } from "@/services/callkeep";
import { registerVoipPushNotifications } from "@/services/voipPush";
import { requestFCMPermissionAndGetToken } from "@/services/firebaseMessaging";

import RootNavigator from "@/navigation/RootNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { LanguageProvider, useLanguage } from "@/hooks/useLanguage";
import { UnreadProvider } from "@/context/UnreadContext";
import { CallProvider } from "@/contexts/CallContext";
import { MaintenanceProvider } from "@/context/MaintenanceContext";
import MaintenanceOverlay from "@/components/MaintenanceOverlay";
import IncomingCallHandler from "@/components/IncomingCallHandler";
import FloatingCallBar from "@/components/FloatingCallBar";
import UpdateBanner from "@/components/UpdateBanner";
import {
  registerForPushNotificationsAsync,
  setupNotificationListeners,
} from "@/services/notifications";
import { getApiBaseUrl } from "@/constants/config";
import AsyncStorage from "@react-native-async-storage/async-storage";

SplashScreen.preventAutoHideAsync();

// Initialize CallKit (iOS) / ConnectionService (Android) as early as possible
// so the native call infrastructure is ready before the first call arrives.
if (Platform.OS !== 'web') {
  initCallKeep('AfroConnect');
}

export const navigationRef = createNavigationContainerRef<any>();

function navigateFromNotification(data: Record<string, any>) {
  if (!navigationRef.isReady()) return;
  const nav = navigationRef as any;
  const { type, screen, senderId, senderName } = data || {};
  if (type === "message" || screen === "ChatDetail") {
    if (senderId) {
      nav.navigate("ChatDetail", {
        userId: senderId,
        userName: senderName || "User",
        userPhoto: "",
      });
    } else {
      nav.navigate("MainTabs", { screen: "Chats" });
    }
    return;
  }
  if (type === "match" || screen === "Matches") {
    nav.navigate("MainTabs", { screen: "Matches" });
    return;
  }
  if (screen === "Discovery") {
    nav.navigate("MainTabs", { screen: "Discovery" });
    return;
  }
  if (type === "security" || screen === "DeviceManagement") {
    nav.navigate("DeviceManagement");
    return;
  }
}

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

        // Register VoIP push token (iOS only) for native CallKit incoming call
        // screen even when the app is completely killed.
        if (Platform.OS === 'ios') {
          registerVoipPushNotifications(async (voipToken) => {
            try {
              const authToken = token || (await AsyncStorage.getItem('auth_token'));
              if (!authToken) return;
              await fetch(`${getApiBaseUrl()}/api/notifications/register-voip-token`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ voipToken }),
              });
              console.log('[App] VoIP push token registered with backend.');
            } catch (err) {
              console.warn('[App] Failed to register VoIP token:', err);
            }
          });
        }

        // Register FCM token for direct Firebase data messages.
        // On Android this enables the background message handler to wake the
        // killed app and display the native ConnectionService call screen.
        try {
          const fcmToken = await requestFCMPermissionAndGetToken();
          if (fcmToken) {
            const authToken = token || (await AsyncStorage.getItem('auth_token'));
            if (authToken) {
              await fetch(`${getApiBaseUrl()}/api/notifications/register-fcm-token`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify({ fcmToken }),
              });
              console.log('[App] FCM token registered with backend.');
            }
          }
        } catch (fcmErr) {
          console.warn('[App] FCM token registration failed (non-fatal):', fcmErr);
        }

        // Handle a notification that launched the app from a killed state
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
          const data = lastResponse.notification.request.content.data as Record<string, any>;
          setTimeout(() => navigateFromNotification(data), 500);
        }

        // Setup listeners for incoming notifications
        unsubscribe = setupNotificationListeners(
          (notification) => {
            console.log("Notification received:", notification);
          },
          async (response) => {
            const data = response?.notification?.request?.content?.data as Record<string, any>;
            // Navigate to the right screen immediately
            navigateFromNotification(data);
            // Fire-and-forget engagement tracking — never block navigation
            try {
              const authToken = await AsyncStorage.getItem("auth_token");
              if (authToken) {
                fetch(`${getApiBaseUrl()}/api/engagement/notification-opened`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`,
                  },
                  body: JSON.stringify({ screen: data?.screen || "unknown" }),
                }).catch(() => {});
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
          <NavigationContainer ref={navigationRef}>
            <RootNavigator />
            <IncomingCallHandler />
            <FloatingCallBar />
          </NavigationContainer>
          <MaintenanceOverlay />
          <UpdateBanner />
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
            <MaintenanceProvider>
              <AuthProvider>
                <UnreadProvider>
                  <LanguageSync />
                  <AppContent />
                </UnreadProvider>
              </AuthProvider>
            </MaintenanceProvider>
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

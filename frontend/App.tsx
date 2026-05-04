import logger from '@/utils/logger';
import React, { useEffect, useCallback, useRef } from "react";
import { StyleSheet, View, Text, TouchableOpacity, AppState, Platform } from "react-native";
import * as Sentry from '@sentry/react-native';
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
import { pushLiveLocation } from "@/utils/liveLocation";
import { tokenManager } from "@/utils/tokenManager";

import RootNavigator from "@/navigation/RootNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { LanguageProvider, useLanguage } from "@/hooks/useLanguage";
import { UnreadProvider } from "@/contexts/UnreadContext";
import { CallProvider } from "@/contexts/CallContext";
import { MaintenanceProvider } from "@/contexts/MaintenanceContext";
import MaintenanceOverlay from "@/components/MaintenanceOverlay";
import IncomingCallHandler from "@/components/calls/IncomingCallHandler";
import FloatingCallBar from "@/components/calls/FloatingCallBar";
import UpdateBanner from "@/components/UpdateBanner";
import BatteryOptimizationPrompt from "@/components/BatteryOptimizationPrompt";
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
  const { type, screen, senderId, senderName, senderPhoto, callType } = data || {};
  const photo = senderPhoto || "";

  // Message — open the exact conversation
  if (type === "message" || screen === "ChatDetail") {
    if (senderId) {
      nav.navigate("ChatDetail", { userId: senderId, userName: senderName || "User", userPhoto: photo });
    } else {
      nav.navigate("MainTabs", { screen: "Chats" });
    }
    return;
  }

  // New match — open Matches tab
  if (type === "match" || screen === "Matches") {
    nav.navigate("MainTabs", { screen: "Matches" });
    return;
  }

  // Like or Super Like — open Matches tab (where likes are shown)
  if (type === "like" || type === "super_like") {
    nav.navigate("MainTabs", { screen: "Matches" });
    return;
  }

  // Missed call — open chat so user can call back
  if (type === "missed_call" || type === "call") {
    if (senderId) {
      nav.navigate("ChatDetail", { userId: senderId, userName: senderName || "User", userPhoto: photo });
    } else {
      nav.navigate("MainTabs", { screen: "Chats" });
    }
    return;
  }

  // Story view, reply, or reaction — open that user's story
  if (type === "story") {
    if (senderId) {
      nav.navigate("StoryViewer", { userId: senderId, userName: senderName || "User", userPhoto: photo });
    } else {
      nav.navigate("MainTabs", { screen: "Discovery" });
    }
    return;
  }

  // Profile view — open Visitors screen
  if (type === "profile_view" || screen === "Visitors") {
    nav.navigate("Visitors");
    return;
  }

  // Verification status update — open Verification screen
  if (type === "verification" || screen === "Verification") {
    nav.navigate("Verification");
    return;
  }

  // Subscription / premium update — open Premium screen
  if (type === "subscription" || screen === "Premium") {
    nav.navigate("Premium");
    return;
  }

  // Security / device alert — open Device Management
  if (type === "security" || screen === "DeviceManagement") {
    nav.navigate("DeviceManagement");
    return;
  }

  // Broadcast / system announcements — go to Discovery (home)
  if (type === "broadcast" || type === "system") {
    nav.navigate("MainTabs", { screen: "Discovery" });
    return;
  }

  // Generic screen-based fallback
  if (screen === "Discovery") {
    nav.navigate("MainTabs", { screen: "Discovery" });
    return;
  }
}

// Print API configuration on startup
try {
  logger.log("\n\n========== AFROCONNECT APP STARTED ==========");
  logger.log("API Base URL:", getApiBaseUrl());
  logger.log("Signup URL:", `${getApiBaseUrl()}/api/auth/signup`);
  logger.log("Login URL:", `${getApiBaseUrl()}/api/auth/login`);
  logger.log("==========================================\n\n");
} catch (e) {
  logger.error("[App] EXPO_PUBLIC_API_URL is not set — API calls will fail.", e);
}

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
  const lastTokenRegistration = useRef<number>(0);

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

        // Register the user's IANA device timezone so other users see
        // accurate "local time" on their profile even when GPS is missing.
        try {
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          const authToken = token || (await AsyncStorage.getItem('auth_token'));
          if (tz && authToken) {
            await fetch(`${getApiBaseUrl()}/api/notifications/register-timezone`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authToken}`,
              },
              body: JSON.stringify({ timezone: tz }),
            });
          }
        } catch (tzErr) {
          logger.warn('[App] Timezone registration failed (non-fatal):', tzErr);
        }

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
              logger.log('[App] VoIP push token registered with backend.');
            } catch (err) {
              logger.warn('[App] Failed to register VoIP token:', err);
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
              logger.log('[App] FCM token registered with backend.');
            }
          }
        } catch (fcmErr) {
          logger.warn('[App] FCM token registration failed (non-fatal):', fcmErr);
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
            logger.log("Notification received:", notification);
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
        logger.error("Failed to setup notifications:", error);
      }
    };

    setupNotifications();
    lastTokenRegistration.current = Date.now();

    pushLiveLocation(token ?? undefined, { force: true }).catch(() => {});

    // Re-register push token when the app comes back to the foreground, but
    // no more than once per hour to avoid TOO_MANY_REGISTRATIONS from Firebase.
    const ONE_HOUR_MS = 60 * 60 * 1000;
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === "active") {
        // The phone may have been asleep for hours. The proactive-refresh
        // setTimeout is paused while the JS thread is suspended, so the access
        // token can be expired by the time we wake up. Check immediately and
        // refresh BEFORE any other foregrounded code (push registration,
        // live-location push, screen mounts) makes its first API call.
        if (tokenManager.isAccessTokenExpiringSoon(token ?? null)) {
          tokenManager.refresh().catch(() => {});
        } else if (token) {
          // Re-arm the timer that was paused during background.
          tokenManager.armProactiveRefresh(token);
        }

        const timeSinceLastReg = Date.now() - lastTokenRegistration.current;
        if (timeSinceLastReg >= ONE_HOUR_MS) {
          lastTokenRegistration.current = Date.now();
          registerForPushNotificationsAsync(token ?? undefined).catch(() => {});
        }
        pushLiveLocation(token ?? undefined).catch(() => {});
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
          <BatteryOptimizationPrompt userId={user?.id} />
          <StatusBar style={isDark ? "light" : "dark"} />
        </CallProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

function App() {
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

export default Sentry.withProfiler(App);

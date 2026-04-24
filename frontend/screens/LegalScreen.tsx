import React, { useState, useEffect } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { getApiBaseUrl } from "@/constants/config";

const PRIVACY_POLICY_CONTENT = `Welcome to AfroConnect

Your privacy is important to us. This Privacy Policy explains how AfroConnect collects, uses, and protects your personal information when you use our dating application.

Information We Collect

Personal Information: When you create an account, we collect your name, email address, date of birth, gender, photos, and location data. This information helps us provide you with a personalized experience.

Profile Information: Any information you choose to share on your profile, including interests, bio, and preferences, is collected to help you find meaningful connections.

Usage Data: We collect information about how you use the app, including your interactions, matches, and messages, to improve our services.

Location Data: With your permission, we collect location data to show you nearby users and enhance your matching experience.

How We Use Your Information

We use your information to:
- Create and manage your account
- Match you with potential partners based on preferences
- Enable communication between matched users
- Improve our services and user experience
- Send important notifications about your account
- Ensure platform safety and security

Data Protection

We implement industry-standard security measures to protect your personal information. Your data is encrypted during transmission and stored securely on our servers.

Your Rights

You have the right to:
- Access your personal data
- Update or correct your information
- Delete your account and associated data
- Opt out of certain data processing activities

Third-Party Services

We may share limited data with trusted third parties for services like payment processing and analytics. These parties are bound by strict confidentiality agreements.

Contact Us

If you have questions about this Privacy Policy, please contact us at privacy@afroconnect.app

Last Updated: January 2026`;

const TERMS_OF_SERVICE_CONTENT = `Terms of Service for AfroConnect

By using AfroConnect, you agree to these Terms of Service. Please read them carefully.

Eligibility

You must be at least 18 years old to use AfroConnect. By creating an account, you confirm that you meet this age requirement and have the legal capacity to enter into this agreement.

Account Responsibilities

You are responsible for:
- Providing accurate and truthful information
- Maintaining the security of your account credentials
- All activities that occur under your account
- Reporting any unauthorized use of your account

Community Guidelines

To maintain a safe and respectful environment, you agree to:
- Treat other users with respect and dignity
- Not harass, threaten, or abuse other users
- Not share inappropriate, offensive, or illegal content
- Not use the platform for commercial purposes without authorization
- Not create fake profiles or impersonate others

Prohibited Activities

The following activities are strictly prohibited:
- Harassment or bullying of any kind
- Sharing sexually explicit content
- Spam or unsolicited advertising
- Attempting to collect user information without consent
- Using automated systems or bots
- Violating any applicable laws or regulations

Content Ownership

You retain ownership of content you post. By posting content, you grant AfroConnect a license to use, display, and distribute your content within the app.

Termination

We reserve the right to suspend or terminate accounts that violate these terms or for any reason at our discretion. You may also delete your account at any time through the app settings.

Disclaimers

AfroConnect is provided "as is" without warranties of any kind. We do not guarantee that you will find a match or partner through our service.

We are not responsible for:
- The behavior of other users
- Content posted by users
- Any damages resulting from your use of the app

Limitation of Liability

To the maximum extent permitted by law, AfroConnect shall not be liable for any indirect, incidental, or consequential damages arising from your use of the service.

Changes to Terms

We may update these Terms of Service from time to time. Continued use of the app after changes constitutes acceptance of the new terms.

Contact

For questions about these Terms of Service, contact us at legal@afroconnect.app

Last Updated: January 2026`;

type LegalScreenProps = NativeStackScreenProps<RootStackParamList, "Legal">;

export default function LegalScreen({ navigation, route }: LegalScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [lastUpdated, setLastUpdated] = useState("December 2024");
  
  const type = route.params?.type || "privacy";

  const SCREEN_TITLES: Record<string, string> = {
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    community: "Community Guidelines",
  };

  const ENDPOINTS: Record<string, string> = {
    privacy: "privacy-policy",
    terms: "terms-of-service",
    community: "community-guidelines",
  };

  const FALLBACK_CONTENT: Record<string, string> = {
    privacy: PRIVACY_POLICY_CONTENT,
    terms: TERMS_OF_SERVICE_CONTENT,
    community:
      "Community Guidelines could not be loaded. Please check your internet connection and try again.\n\nFor questions, contact safety@afroconnect.com",
  };

  useEffect(() => {
    loadContent();
  }, [type]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const endpoint = ENDPOINTS[type] || ENDPOINTS.privacy;
      const response = await fetch(`${getApiBaseUrl()}/api/legal/${endpoint}`);
      const data = await response.json();

      if (data.success && data.data && data.data.content) {
        setContent(data.data.content);
        if (data.data.lastUpdated) {
          setLastUpdated(data.data.lastUpdated);
        }
      } else {
        setContent(FALLBACK_CONTENT[type] || FALLBACK_CONTENT.privacy);
      }
    } catch {
      setContent(FALLBACK_CONTENT[type] || FALLBACK_CONTENT.privacy);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable 
          style={[styles.backButton, { backgroundColor: theme.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
          {SCREEN_TITLES[type] || "Legal"}
        </ThemedText>
        <View style={styles.placeholder} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.contentContainer, 
            { paddingBottom: insets.bottom + Spacing.xl }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {lastUpdated ? (
            <View style={[styles.updateBadge, { backgroundColor: theme.primaryLight }]}>
              <ThemedText style={[styles.updateText, { color: theme.primary }]}>
                Last updated: {lastUpdated}
              </ThemedText>
            </View>
          ) : null}
          
          {content ? (
            <ThemedText style={[styles.contentText, { color: theme.text }]}>
              {content.trim()}
            </ThemedText>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    ...Typography.h2,
    fontSize: 18,
  },
  placeholder: {
    width: 44,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  updateBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
  },
  updateText: {
    ...Typography.small,
    fontWeight: "600",
  },
  contentText: {
    ...Typography.body,
    lineHeight: 24,
  },
});

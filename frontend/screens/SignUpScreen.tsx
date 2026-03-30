
import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useThemedAlert } from "@/components/ThemedAlert";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius, Typography, Shadow } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

type SignUpScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "SignUp"
>;

interface SignUpScreenProps {
  navigation: SignUpScreenNavigationProp;
}

const SIGNUP_STORAGE_KEY = "afroconnect_signup_draft";

export default function SignUpScreen({ navigation }: SignUpScreenProps) {
  const { theme } = useTheme();
  const { signup } = useAuth();
  const { showAlert, AlertComponent } = useThemedAlert();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const draft = await AsyncStorage.getItem(SIGNUP_STORAGE_KEY);
        if (draft) {
          const { email: savedEmail, agreeToTerms: savedAgree } =
            JSON.parse(draft);
          setEmail(savedEmail || "");
          setAgreeToTerms(savedAgree || false);
        }
      } catch (error) {
        console.error("Failed to load signup draft:", error);
      }
    };
    loadDraft();
  }, []);

  useEffect(() => {
    const saveDraft = async () => {
      try {
        await AsyncStorage.setItem(
          SIGNUP_STORAGE_KEY,
          JSON.stringify({ email, agreeToTerms }),
        );
      } catch (error) {
        console.error("Failed to save signup draft:", error);
      }
    };
    saveDraft();
  }, [email, agreeToTerms]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      showAlert(
        "Error",
        "Please fill in all fields",
        [{ text: "OK", style: "default" }],
        "alert-circle",
      );
      return;
    }

    if (!validateEmail(email)) {
      showAlert(
        "Error",
        "Please enter a valid email address",
        [{ text: "OK", style: "default" }],
        "alert-circle",
      );
      return;
    }

    if (password !== confirmPassword) {
      showAlert(
        "Error",
        "Passwords do not match",
        [{ text: "OK", style: "default" }],
        "alert-circle",
      );
      return;
    }

    if (password.length < 6) {
      showAlert(
        "Error",
        "Password must be at least 6 characters",
        [{ text: "OK", style: "default" }],
        "alert-circle",
      );
      return;
    }

    if (!agreeToTerms) {
      showAlert(
        "Error",
        "Please agree to the Terms and Privacy Policy",
        [{ text: "OK", style: "default" }],
        "alert-circle",
      );
      return;
    }

    setLoading(true);
    try {
      const result = await signup(email.trim().toLowerCase(), password);
      await AsyncStorage.removeItem(SIGNUP_STORAGE_KEY);
      navigation.navigate("OTPVerification", {
        userId: result.userId,
        email: result.email,
      });
    } catch (error: any) {
      showAlert(
        "Error",
        error.message || "Failed to create account",
        [{ text: "OK", style: "default" }],
        "alert-circle",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenKeyboardAwareScrollView>
      <View style={styles.header}>
        <Pressable
          style={[styles.backButton, { backgroundColor: theme.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={20} color={theme.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.logoSection}>
          <Image
            source={require("@/assets/afroconnect-logo.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>

        <View style={styles.titleSection}>
          <ThemedText
            style={[styles.title, { color: theme.text, fontWeight: "800" }]}
          >
            Create an account
          </ThemedText>
          <ThemedText
            style={[
              styles.subtitle,
              { color: theme.textSecondary, fontWeight: "700" },
            ]}
          >
            Join AfroConnect and start connecting today
          </ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <ThemedText
              style={[styles.label, { color: theme.text, fontWeight: "700" }]}
            >
              Email
            </ThemedText>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.border,
                  borderWidth: 1.5,
                },
              ]}
            >
              <Feather
                name="mail"
                size={20}
                color={theme.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.text, fontWeight: "600" }]}
                placeholder="Enter your email"
                placeholderTextColor={theme.textSecondary}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              Password
            </ThemedText>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Feather
                name="lock"
                size={20}
                color={theme.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="At least 6 characters"
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.text }]}>
              Confirm Password
            </ThemedText>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <Feather
                name="lock"
                size={20}
                color={theme.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Re-enter your password"
                placeholderTextColor={theme.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password"
              />
            </View>
          </View>

          <Pressable
            style={styles.termsRow}
            onPress={() => setAgreeToTerms(!agreeToTerms)}
          >
            <View
              style={[
                styles.checkbox,
                { borderColor: agreeToTerms ? theme.primary : theme.border },
                agreeToTerms && { backgroundColor: theme.primary },
              ]}
            >
              {agreeToTerms && (
                <Feather name="check" size={14} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.termsTextContainer}>
              <ThemedText
                style={[styles.termsText, { color: theme.textSecondary }]}
              >
                I agree to the{" "}
                <ThemedText
                  style={{ color: theme.primary, fontWeight: "700" }}
                  onPress={() =>
                    navigation.navigate("Legal" as any, { type: "terms" })
                  }
                >
                  Terms of Service
                </ThemedText>{" "}
                and{" "}
                <ThemedText
                  style={{ color: theme.primary, fontWeight: "700" }}
                  onPress={() =>
                    navigation.navigate("Legal" as any, { type: "privacy" })
                  }
                >
                  Privacy Policy
                </ThemedText>
              </ThemedText>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.button,
              { backgroundColor: theme.primary },
              Shadow.button,
            ]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.buttonText} />
            ) : (
              <ThemedText
                style={[styles.buttonText, { color: theme.buttonText }]}
              >
                Create Account
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            style={styles.loginLink}
            onPress={() => navigation.navigate("Login")}
          >
            <ThemedText
              style={[styles.loginLinkText, { color: theme.textSecondary }]}
            >
              Already have an account?{" "}
              <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>
                Sign in
              </ThemedText>
            </ThemedText>
          </Pressable>
        </View>
      </View>
      <AlertComponent />
    </ScreenKeyboardAwareScrollView>
  );
}

const ACCENT_COLOR = "#10B981";

const styles = StyleSheet.create({
  header: {
    height: 60,
    paddingHorizontal: Spacing.lg,
    marginTop: Platform.OS === "ios" ? 50 : 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center", // Dating apps usually center titles
    zIndex: 10,
  },
  backButton: {
    position: "absolute",
    left: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.08)", // Light emerald tint
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50, // Circles feel friendlier for dating apps
  },
  titleSection: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  title: {
    ...Typography.h1,
    fontSize: 32,
    fontWeight: "800",
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  subtitle: {
    ...Typography.body,
    textAlign: "center",
    color: "rgba(0,0,0,0.5)",
    fontSize: 16,
  },
  form: {
    gap: Spacing.lg,
  },
  inputContainer: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.captionBold,
    fontSize: 13,
    color: "#4A4A4A",
    marginLeft: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  // FIX: Added missing inputWrapper to clear your error
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 58,
    borderRadius: BorderRadius.xl,
    backgroundColor: "#F7F8F9", // Soft modern background
    borderWidth: 1.5,
    borderColor: "#F0F0F0",
    paddingHorizontal: Spacing.lg,
  },
  inputIcon: {
    marginRight: Spacing.md,
    opacity: 0.5,
  },
  input: {
    flex: 1,
    ...Typography.body,
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  eyeButton: {
    padding: Spacing.sm,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  // FIX: Added missing termsTextContainer to clear your error
  termsTextContainer: {
    flex: 1,
    justifyContent: "center",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  termsText: {
    ...Typography.caption,
    fontSize: 13,
    lineHeight: 20,
    color: "#666",
  },
  button: {
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: ACCENT_COLOR,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.xl,
    // Soft glowing shadow for dating app aesthetic
    shadowColor: ACCENT_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    ...Typography.bodyBold,
    fontSize: 18,
    color: "#FFF",
    fontWeight: "700",
  },
  loginLink: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    marginTop: Spacing.lg,
  },
  loginLinkText: {
    ...Typography.body,
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
});


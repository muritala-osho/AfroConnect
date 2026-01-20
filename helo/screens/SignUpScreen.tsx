import React, { useState, useEffect } from "react";
import { View, StyleSheet, TextInput, Pressable, ActivityIndicator } from "react-native";
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

type SignUpScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "SignUp">;

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
          const { email: savedEmail, agreeToTerms: savedAgree } = JSON.parse(draft);
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
        await AsyncStorage.setItem(SIGNUP_STORAGE_KEY, JSON.stringify({ email, agreeToTerms }));
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
      showAlert("Error", "Please fill in all fields", [{ text: "OK", style: "default" }], "alert-circle");
      return;
    }

    if (!validateEmail(email)) {
      showAlert("Error", "Please enter a valid email address", [{ text: "OK", style: "default" }], "alert-circle");
      return;
    }

    if (password !== confirmPassword) {
      showAlert("Error", "Passwords do not match", [{ text: "OK", style: "default" }], "alert-circle");
      return;
    }

    if (password.length < 6) {
      showAlert("Error", "Password must be at least 6 characters", [{ text: "OK", style: "default" }], "alert-circle");
      return;
    }

    if (!agreeToTerms) {
      showAlert("Error", "Please agree to the Terms and Privacy Policy", [{ text: "OK", style: "default" }], "alert-circle");
      return;
    }

    setLoading(true);
    try {
      const result = await signup(email.trim().toLowerCase(), password);
      await AsyncStorage.removeItem(SIGNUP_STORAGE_KEY);
      navigation.navigate("OTPVerification", { 
        userId: result.userId, 
        email: result.email 
      });
    } catch (error: any) {
      showAlert("Error", error.message || "Failed to create account", [{ text: "OK", style: "default" }], "alert-circle");
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
          <ThemedText style={[styles.title, { color: theme.text, fontWeight: '800' }]}>
            Create an account
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary, fontWeight: '700' }]}>
            Join AfroConnect and start connecting today
          </ThemedText>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.text, fontWeight: '700' }]}>Email</ThemedText>
            <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1.5 }]}>
              <Feather name="mail" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text, fontWeight: '600' }]}
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
            <ThemedText style={[styles.label, { color: theme.text }]}>Password</ThemedText>
            <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Feather name="lock" size={20} color={theme.textSecondary} style={styles.inputIcon} />
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
                <Feather name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <ThemedText style={[styles.label, { color: theme.text }]}>Confirm Password</ThemedText>
            <View style={[styles.inputWrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Feather name="lock" size={20} color={theme.textSecondary} style={styles.inputIcon} />
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
            <View style={[
              styles.checkbox, 
              { borderColor: agreeToTerms ? theme.primary : theme.border },
              agreeToTerms && { backgroundColor: theme.primary }
            ]}>
              {agreeToTerms && (
                <Feather name="check" size={14} color="#FFFFFF" />
              )}
            </View>
            <View style={styles.termsTextContainer}>
              <ThemedText style={[styles.termsText, { color: theme.textSecondary }]}>
                I agree to the{" "}
                <ThemedText 
                  style={{ color: theme.primary, fontWeight: '700' }}
                  onPress={() => navigation.navigate("Legal" as any, { type: "terms" })}
                >
                  Terms of Service
                </ThemedText>
                {" "}and{" "}
                <ThemedText 
                  style={{ color: theme.primary, fontWeight: '700' }}
                  onPress={() => navigation.navigate("Legal" as any, { type: "privacy" })}
                >
                  Privacy Policy
                </ThemedText>
              </ThemedText>
            </View>
          </Pressable>

          <Pressable
            style={[styles.button, { backgroundColor: theme.primary }, Shadow.button]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.buttonText} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: theme.buttonText }]}>
                Create Account
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            style={styles.loginLink}
            onPress={() => navigation.navigate("Login")}
          >
            <ThemedText style={[styles.loginLinkText, { color: theme.textSecondary }]}>
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

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl + Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  logoSection: {
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.lg,
  },
  titleSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  form: {
    gap: Spacing.lg,
  },
  inputContainer: {
    gap: Spacing.sm,
  },
  label: {
    ...Typography.captionBold,
    fontWeight: '700',
    fontSize: 15,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    paddingHorizontal: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.body,
    height: "100%",
    fontSize: 16,
    fontWeight: "600",
  },
  eyeButton: {
    padding: Spacing.xs,
    paddingRight: Spacing.md,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.xs,
    paddingRight: Spacing.xl,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    ...Typography.caption,
    lineHeight: 22,
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xxl,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  buttonText: {
    ...Typography.bodyBold,
    fontSize: 17,
  },
  loginLink: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  loginLinkText: {
    ...Typography.body,
  },
});

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
import { Spacing, BorderRadius } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";

type SignUpScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "SignUp"
>;

interface SignUpScreenProps {
  navigation: SignUpScreenNavigationProp;
}

const SIGNUP_STORAGE_KEY = "afroconnect_signup_draft";
const ACCENT_COLOR = "#10B981";
const ACCENT_DARK = "#059669";

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
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);

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

  const getPasswordStrength = (password: string): number => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return Math.min(strength, 4);
  };

  const getPasswordStrengthText = (strength: number): string => {
    const labels = ["Weak", "Fair", "Good", "Strong"];
    return labels[strength] || "Weak";
  };

  const getPasswordStrengthColor = (strength: number): string => {
    const colors = ["#EF4444", "#F59E0B", "#10B981", "#059669"];
    return colors[strength] || "#E8EAED";
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

  const passwordStrength = getPasswordStrength(password);

  return (
    <ScreenKeyboardAwareScrollView>
      <View style={styles.container}>
        {/* GRADIENT HEADER */}
        <LinearGradient
          colors={[ACCENT_COLOR, ACCENT_DARK]}
          style={styles.gradientHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          {/* Decorative Blur Elements */}
          <View style={styles.decorBlur1} />
          <View style={styles.decorBlur2} />

          {/* Back Button */}
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <BlurView intensity={20} tint="light" style={styles.blurButton}>
                <Feather name="arrow-left" size={22} color="#FFFFFF" />
              </BlurView>
            </Pressable>
          </View>

          {/* Logo & Title Section */}
          <View style={styles.headerContent}>
            <View style={styles.logoContainer}>
              <BlurView intensity={30} tint="light" style={styles.logoBlur}>
                <ThemedText style={styles.logoText}>A</ThemedText>
              </BlurView>
            </View>
            <ThemedText style={styles.headerTitle}>AfroConnect</ThemedText>
            <ThemedText style={styles.headerSubtitle}>
              Join thousands finding meaningful{"\n"}connections today
            </ThemedText>
          </View>
        </LinearGradient>

        {/* WHITE FORM CARD */}
        <View style={styles.formCard}>
          <View style={styles.formContent}>
            {/* EMAIL INPUT */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Email address</ThemedText>
              <View
                style={[
                  styles.inputContainer,
                  emailFocused && styles.inputContainerFocused,
                ]}
              >
                <ThemedText style={styles.inputIcon}>📧</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
            </View>

            {/* PASSWORD INPUT */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>Password</ThemedText>
              <View
                style={[
                  styles.inputContainer,
                  passwordFocused && styles.inputContainerFocused,
                ]}
              >
                <ThemedText style={styles.inputIcon}>🔐</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
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
                    color="#999"
                  />
                </Pressable>
              </View>
            </View>

            {/* CONFIRM PASSWORD INPUT */}
            <View style={styles.inputGroup}>
              <ThemedText style={styles.inputLabel}>
                Confirm password
              </ThemedText>
              <View
                style={[
                  styles.inputContainer,
                  confirmFocused && styles.inputContainerFocused,
                ]}
              >
                <ThemedText style={styles.inputIcon}>✅</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                />
              </View>
            </View>

            {/* PASSWORD STRENGTH INDICATOR */}
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBars}>
                  {[0, 1, 2, 3].map((index) => (
                    <View
                      key={index}
                      style={[
                        styles.strengthBar,
                        {
                          backgroundColor:
                            index < passwordStrength
                              ? getPasswordStrengthColor(passwordStrength)
                              : "#E8EAED",
                        },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.strengthTextRow}>
                  <ThemedText
                    style={[
                      styles.strengthText,
                      { color: getPasswordStrengthColor(passwordStrength) },
                    ]}
                  >
                    {getPasswordStrengthText(passwordStrength)} password
                  </ThemedText>
                  <ThemedText style={styles.strengthHint}>
                    Use 8+ characters with symbols
                  </ThemedText>
                </View>
              </View>
            )}

            {/* TERMS CHECKBOX */}
            <Pressable
              style={styles.termsContainer}
              onPress={() => setAgreeToTerms(!agreeToTerms)}
            >
              <View
                style={[
                  styles.checkbox,
                  agreeToTerms && { backgroundColor: ACCENT_COLOR },
                ]}
              >
                {agreeToTerms && (
                  <ThemedText style={styles.checkmark}>✓</ThemedText>
                )}
              </View>
              <View style={styles.termsTextContainer}>
                <ThemedText style={styles.termsText}>
                  I'm 18+ and agree to the{" "}
                  <ThemedText
                    style={styles.termsLink}
                    onPress={() =>
                      navigation.navigate("Legal" as any, { type: "terms" })
                    }
                  >
                    Terms of Service
                  </ThemedText>{" "}
                  and{" "}
                  <ThemedText
                    style={styles.termsLink}
                    onPress={() =>
                      navigation.navigate("Legal" as any, { type: "privacy" })
                    }
                  >
                    Privacy Policy
                  </ThemedText>
                </ThemedText>
              </View>
            </Pressable>

            {/* CREATE ACCOUNT BUTTON */}
            <Pressable
              style={[
                styles.createButton,
                loading && styles.createButtonDisabled,
              ]}
              onPress={handleSignUp}
              disabled={loading}
            >
              <LinearGradient
                colors={[ACCENT_COLOR, ACCENT_DARK]}
                style={styles.createButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <ThemedText style={styles.createButtonText}>
                    Create Account
                  </ThemedText>
                )}
              </LinearGradient>
            </Pressable>

            {/* LOGIN LINK */}
            <Pressable
              style={styles.loginLink}
              onPress={() => navigation.navigate("Login")}
            >
              <ThemedText style={styles.loginLinkText}>
                Already have an account?{" "}
                <ThemedText style={styles.loginLinkHighlight}>
                  Sign in
                </ThemedText>
              </ThemedText>
            </Pressable>
          </View>
        </View>

        <AlertComponent />
      </View>
    </ScreenKeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // GRADIENT HEADER
  gradientHeader: {
    paddingBottom: 28,
    position: "relative",
    overflow: "hidden",
  },
  decorBlur1: {
    position: "absolute",
    top: 60,
    right: -30,
    width: 120,
    height: 120,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 60,
  },
  decorBlur2: {
    position: "absolute",
    top: 140,
    left: -40,
    width: 140,
    height: 140,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 70,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 16,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
  },
  blurButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  headerContent: {
    alignItems: "center",
    paddingHorizontal: 24,
    zIndex: 10,
  },
  logoContainer: {
    width: 80,
    height: 80,
    marginBottom: 14,
  },
  logoBlur: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    overflow: "hidden",
  },
  logoText: {
    fontSize: 42,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    lineHeight: 20,
  },

  // FORM CARD
  formCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 36,
    marginTop: -8,
  },
  formContent: {
    gap: 16,
  },

  // INPUTS
  inputGroup: {
    gap: 9,
  },
  inputLabel: {
    fontSize: 13,
    color: "#1A1A1A",
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    backgroundColor: "#F8F9FA",
    borderWidth: 2,
    borderColor: "#E8EAED",
    borderRadius: 14,
    paddingHorizontal: 16,
    position: "relative",
  },
  inputContainerFocused: {
    borderColor: ACCENT_COLOR,
    backgroundColor: "#F0FDF4",
  },
  inputIcon: {
    fontSize: 18,
    position: "absolute",
    left: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1A1A1A",
    paddingLeft: 32,
  },
  eyeButton: {
    padding: 4,
  },

  // PASSWORD STRENGTH
  strengthContainer: {
    marginTop: -4,
  },
  strengthBars: {
    flexDirection: "row",
    gap: 4,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E8EAED",
  },
  strengthTextRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "600",
  },
  strengthHint: {
    fontSize: 11,
    color: "#999",
  },

  // TERMS
  termsContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 6,
    padding: 14,
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
  },
  checkbox: {
    minWidth: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkmark: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  termsTextContainer: {
    flex: 1,
  },
  termsText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666",
  },
  termsLink: {
    color: ACCENT_COLOR,
    fontWeight: "600",
  },

  // BUTTON
  createButton: {
    height: 54,
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 10,
    shadowColor: ACCENT_COLOR,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonGradient: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  // LOGIN LINK
  loginLink: {
    alignItems: "center",
    paddingVertical: 18,
    paddingTop: 8,
  },
  loginLinkText: {
    fontSize: 14,
    color: "#666",
  },
  loginLinkHighlight: {
    color: ACCENT_COLOR,
    fontWeight: "600",
  },
});

import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { useThemedAlert } from "@/components/ThemedAlert";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootNavigator";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius, Typography, Shadow } from "@/constants/theme";
import { Feather } from "@expo/vector-icons";

type LoginScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "Login"
>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { theme, themeMode } = useTheme();
  const { login } = useAuth();
  const { showAlert, AlertComponent } = useThemedAlert();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert(
        "Error",
        "Please fill in all fields",
        [{ text: "OK", style: "default" }],
        "alert-circle",
      );
      return;
    }

    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (error: any) {
      console.log("Login error:", error);
      const errorMsg = error.message || "Invalid email or password";

      if (
        error.isBanned ||
        error.status === 403 ||
        errorMsg.toLowerCase().includes("banned") ||
        errorMsg.toLowerCase().includes("suspended")
      ) {
        setLoading(false);
        // Use native Alert for reliable navigation
        const banReason =
          error.banReason || "Violation of community guidelines";
        Alert.alert(
          "Account Suspended",
          `Your account has been suspended.\n\nReason: ${banReason}\n\nYou can submit an appeal to request reinstatement.`,
          [
            {
              text: "Appeal",
              onPress: () => {
                navigation.navigate("AppealBanned", {
                  appealToken: error.appealToken,
                  email: error.email || email,
                  banReason: error.banReason,
                  bannedAt: error.bannedAt,
                  appeal: error.appeal,
                });
              },
            },
            { text: "Cancel", style: "cancel" },
          ],
        );
        return; // Exit early to prevent any other error handling
      } else {
        showAlert(
          "Error",
          errorMsg,
          [{ text: "OK", style: "default" }],
          "alert-circle",
        );
      }
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
            resizeMode="contain"
          />
        </View>

        <View style={styles.titleSection}>
          <ThemedText style={[styles.welcomeEmoji]}>👋</ThemedText>
          <ThemedText
            style={[styles.title, { color: theme.text, fontWeight: "800" }]}
          >
            Welcome back
          </ThemedText>
          <ThemedText
            style={[
              styles.subtitle,
              { color: theme.textSecondary, fontWeight: "700" },
            ]}
          >
            Please enter your details to sign in
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
                keyboardAppearance={themeMode === "dark" ? "dark" : "light"}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <ThemedText
              style={[styles.label, { color: theme.text, fontWeight: "700" }]}
            >
              Password
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
                name="lock"
                size={20}
                color={theme.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.text, fontWeight: "600" }]}
                placeholder="Enter your password"
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

          <View style={styles.linksRow}>
            <Pressable
              onPress={() =>
                navigation.navigate("Legal" as any, { type: "terms" })
              }
            >
              <ThemedText
                style={[styles.forgotPasswordText, { color: theme.primary }]}
              >
                Terms of Service
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => navigation.navigate("ForgotPassword")}>
              <ThemedText
                style={[styles.forgotPasswordText, { color: theme.primary }]}
              >
                Forgot password?
              </ThemedText>
            </Pressable>
          </View>

          <Pressable
            style={[
              styles.button,
              { backgroundColor: theme.primary },
              Shadow.button,
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.buttonText} />
            ) : (
              <ThemedText
                style={[styles.buttonText, { color: theme.buttonText }]}
              >
                Sign In
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            style={styles.signupLink}
            onPress={() => navigation.navigate("SignUp")}
          >
            <ThemedText
              style={[styles.signupLinkText, { color: theme.textSecondary }]}
            >
              Don't have an account?{" "}
              <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>
                Sign up
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
    marginBottom: Spacing.lg,
  },
  logo: {
    width: 120,
    height: 140,
    borderRadius: BorderRadius.lg,
  },
  titleSection: {
    alignItems: "center",
    marginBottom: Spacing.xxl,
  },
  welcomeEmoji: {
    fontSize: 40,
    marginBottom: Spacing.sm,
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
  linksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  forgotPasswordText: {
    ...Typography.caption,
    fontWeight: "600",
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
  signupLink: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  signupLinkText: {
    ...Typography.body,
  },
});

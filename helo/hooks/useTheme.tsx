import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/theme";

export type ThemeMode = "light" | "dark" | "grey" | "system";

const THEME_STORAGE_KEY = "app_theme_preference";
const ACCENT_COLOR_KEY = "customize_accent_color";

export { Colors };

interface ThemeContextType {
  theme: typeof Colors.light;
  themeMode: ThemeMode;
  isDark: boolean;
  accentColor: string | null;
  setThemeMode: (mode: ThemeMode) => void;
  setAccentColor: (color: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyAccentColor(baseTheme: typeof Colors.light, accent: string | null): typeof Colors.light {
  if (!accent) return baseTheme;
  return {
    ...baseTheme,
    primary: accent,
    primaryLight: accent + 'CC',
    link: accent,
    tabIconSelected: accent,
    like: accent,
    accentGradientStart: accent,
    accentGradientEnd: accent + 'CC',
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [accentColor, setAccentColorState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const [storedTheme, storedAccent] = await AsyncStorage.multiGet([THEME_STORAGE_KEY, ACCENT_COLOR_KEY]);
      const themeVal = storedTheme[1];
      if (themeVal && (themeVal === "light" || themeVal === "dark" || themeVal === "grey" || themeVal === "system")) {
        setThemeModeState(themeVal as ThemeMode);
      }
      if (storedAccent[1]) {
        setAccentColorState(storedAccent[1]);
      }
    } catch (error) {
      console.error("Error loading theme preference:", error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error("Error saving theme preference:", error);
    }
  }, []);

  const setAccentColor = useCallback(async (color: string) => {
    try {
      await AsyncStorage.setItem(ACCENT_COLOR_KEY, color);
      setAccentColorState(color);
    } catch (error) {
      console.error("Error saving accent color:", error);
    }
  }, []);

  const effectiveTheme = themeMode === "system" ? systemColorScheme : themeMode;
  const isDark = effectiveTheme === "dark";
  const themeKey = themeMode === "grey" ? "grey" : (isDark ? "dark" : "light");
  const baseTheme = Colors[themeKey];
  const theme = applyAccentColor(baseTheme, accentColor);

  return (
    <ThemeContext.Provider value={{ theme, themeMode, isDark, accentColor, setThemeMode, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    return {
      theme: Colors.light,
      themeMode: "system" as ThemeMode,
      isDark: false,
      accentColor: null as string | null,
      setThemeMode: (_mode: ThemeMode) => {},
      setAccentColor: (_color: string) => {},
    };
  }
  return context;
}

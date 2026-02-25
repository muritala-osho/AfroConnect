import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useColorScheme as useSystemColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Colors } from "@/constants/theme";

export type ThemeMode = "light" | "dark" | "grey" | "system";

const THEME_STORAGE_KEY = "app_theme_preference";

export { Colors };

interface ThemeContextType {
  theme: typeof Colors.light;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useSystemColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (stored && (stored === "light" || stored === "dark" || stored === "grey" || stored === "system")) {
        setThemeModeState(stored as ThemeMode);
      }
    } catch (error) {
      console.error("Error loading theme preference:", error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error("Error saving theme preference:", error);
    }
  };

  const effectiveTheme = themeMode === "system" ? systemColorScheme : themeMode;
  const isDark = effectiveTheme === "dark";
  const themeKey = themeMode === "grey" ? "grey" : (isDark ? "dark" : "light");
  const theme = Colors[themeKey];

  return (
    <ThemeContext.Provider value={{ theme, themeMode, isDark, setThemeMode }}>
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
      setThemeMode: () => {},
    };
  }
  return context;
}

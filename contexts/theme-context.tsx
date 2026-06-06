import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance } from "react-native";
import { AppStorage } from "@/lib/storage";
import type { ThemePreference } from "@/lib/types/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  isThemeLoaded: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// RN does not persist Appearance.setColorScheme across launches, so we always
// re-apply the stored preference on mount. "unspecified" hands control back to
// the OS.
function applyColorScheme(preference: ThemePreference) {
  Appearance.setColorScheme(
    preference === "system" ? "unspecified" : preference,
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await AppStorage.getThemePreference();
      const resolved = stored ?? "system";
      applyColorScheme(resolved);
      if (active) {
        setPreferenceState(resolved);
        setIsThemeLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next);
    applyColorScheme(next);
    await AppStorage.setThemePreference(next);
  }, []);

  const value = useMemo(
    () => ({ preference, isThemeLoaded, setPreference }),
    [preference, isThemeLoaded, setPreference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useThemePreference(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemePreference must be used within a ThemeProvider");
  }
  return context;
}

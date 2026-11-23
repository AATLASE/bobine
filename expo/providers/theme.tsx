import createContextHook from "@nkzw/create-context-hook";
import { storage, storageKey } from "@/lib/storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { useColorScheme } from "react-native";
import { applyPalette, ThemeScheme } from "@/constants/theme";

/** User preference: follow the phone, or force light/dark. */
export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = storageKey("themeMode.v1");

export const [ThemeProvider, useThemeMode] = createContextHook(() => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    storage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === "light" || value === "dark" || value === "system") {
          setModeState(value);
        }
      })
      .catch(() => {
        // Non-fatal — falls back to following the phone.
      });
  }, []);

  const resolved: ThemeScheme =
    mode === "system" ? (systemScheme === "light" ? "light" : "dark") : mode;

  // Swap the palette during render so every child reads fresh colors.
  const appliedRef = useRef<ThemeScheme | null>(null);
  if (appliedRef.current !== resolved) {
    applyPalette(resolved);
    appliedRef.current = resolved;
  }

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    storage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  return { mode, setMode, resolved };
});

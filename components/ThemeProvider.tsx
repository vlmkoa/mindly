"use client";

/**
 * Theme context: single source of truth for the active theme, the custom-theme
 * config, and the current pixel-scene state. Mounted high in AppShell so both
 * the nav picker and the home-page scene read the same state.
 *
 * Keeps the theme live: re-applies the day-cycle every minute, follows the OS
 * setting for `system`, and requests geolocation once when day-cycle is picked.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CustomTheme,
  SceneState,
  ThemeId,
  applyTheme,
  getCustom,
  getStoredTheme,
  requestCoords,
  setCustom as persistCustom,
  setStoredTheme,
} from "@/lib/theme";

type ThemeCtx = {
  theme: ThemeId;
  setTheme: (id: ThemeId) => void;
  custom: CustomTheme;
  setCustomTheme: (c: CustomTheme) => void;
  scene: SceneState;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

// Both of these follow the local sun/moon: they need geolocation once and a
// minute tick to re-tint the sky.
function isSkyTheme(id: ThemeId): boolean {
  return id === "daycycle" || id === "immersive";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>("dark");
  const [custom, setCustomState] = useState<CustomTheme>(() => getCustom());
  const [scene, setScene] = useState<SceneState>({
    hasScene: false,
    fullBleed: false,
    celestial: "sun",
    x: 0.5,
    y: 0.3,
    stars: false,
  });
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Apply the stored theme on mount (the inline script set colors already;
  // this recomputes the scene state and starts any live updates).
  useEffect(() => {
    const stored = getStoredTheme();
    setThemeState(stored);
    setScene(applyTheme(stored, getCustom()));
    if (isSkyTheme(stored)) void requestCoords().then(() => setScene(applyTheme(stored)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Day-cycle / immersive minute tick — re-tint as the local sun/moon moves.
  useEffect(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (isSkyTheme(theme)) {
      tickRef.current = setInterval(() => setScene(applyTheme(theme)), 60_000);
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [theme]);

  // Follow the OS setting while on `system`.
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setScene(applyTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeState(id);
    setStoredTheme(id);
    setScene(applyTheme(id, getCustom()));
    if (isSkyTheme(id)) void requestCoords().then(() => setScene(applyTheme(id)));
  }, []);

  const setCustomTheme = useCallback(
    (c: CustomTheme) => {
      setCustomState(c);
      persistCustom(c);
      if (theme === "custom") setScene(applyTheme("custom", c));
    },
    [theme]
  );

  return (
    <Ctx.Provider value={{ theme, setTheme, custom, setCustomTheme, scene }}>
      {children}
    </Ctx.Provider>
  );
}

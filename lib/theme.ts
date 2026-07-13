/**
 * Theme engine.
 *
 * Seven themes, applied by setting `data-theme` on <html> and (for the
 * day-cycle and custom themes) by writing CSS-variable overrides inline.
 * All palette tokens live in globals.css; this module only decides values.
 *
 * Persistence is per-device via localStorage (no backend). A tiny inline
 * script in app/layout.tsx applies the stored theme before first paint to
 * avoid a flash; this module keeps it live afterward (system changes, the
 * day-cycle minute tick, custom edits).
 */

export type ThemeId =
  | "light"
  | "dark"
  | "light-scene"
  | "dark-scene"
  | "daycycle"
  | "system"
  | "custom";

export const THEME_KEY = "koan_theme";
export const CUSTOM_KEY = "koan_theme_custom";

export const THEMES: { id: ThemeId; label: string; hint: string }[] = [
  { id: "light", label: "Light", hint: "paper, ink text" },
  { id: "dark", label: "Dark", hint: "the original night" },
  { id: "light-scene", label: "Light + sun", hint: "daylit valley" },
  { id: "dark-scene", label: "Dark + moon", hint: "moonlit valley" },
  { id: "daycycle", label: "Follow the sky", hint: "your local sun & moon" },
  { id: "system", label: "Follow system", hint: "match your device" },
  { id: "custom", label: "Custom", hint: "your own colors" },
];

export type CustomTheme = {
  celestial: "sun" | "moon";
  celestialColor: string;
  bg: string;
  text: string;
};

export const DEFAULT_CUSTOM: CustomTheme = {
  celestial: "sun",
  celestialColor: "#e8b04c",
  bg: "#101418",
  text: "#d8d4c4",
};

/** What the pixel scene needs to draw itself for the current theme. */
export type SceneState = {
  hasScene: boolean;
  celestial: "sun" | "moon";
  x: number; // 0 (left) .. 1 (right)
  y: number; // 0 (top of sky) .. 1 (horizon)
  stars: boolean;
};

const NO_SCENE: SceneState = {
  hasScene: false,
  celestial: "sun",
  x: 0.5,
  y: 0.3,
  stars: false,
};

// ─── Color helpers ───────────────────────────────────────────────────────────

function clamp(n: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, n));
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Linear blend of two hex colors; t=0 → a, t=1 → b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const k = clamp(t);
  return rgbToHex(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k);
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── NOAA sunrise / sunset (no dependency) ───────────────────────────────────

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}
function toDeg(r: number): number {
  return (r * 180) / Math.PI;
}

/**
 * Returns local sunrise/sunset as fractional hours (0..24) for the given date
 * and coordinates. Simplified NOAA algorithm — accurate to a couple minutes,
 * which is plenty for tinting a background.
 */
export function sunTimes(
  date: Date,
  lat: number,
  lng: number
): { sunrise: number; sunset: number } {
  const start = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start.getTime()) / 86400000);

  const lngHour = lng / 15;

  function calc(isSunrise: boolean): number {
    const t = dayOfYear + ((isSunrise ? 6 : 18) - lngHour) / 24;
    const M = 0.9856 * t - 3.289;
    let L =
      M + 1.916 * Math.sin(toRad(M)) + 0.02 * Math.sin(toRad(2 * M)) + 282.634;
    L = ((L % 360) + 360) % 360;
    let RA = toDeg(Math.atan(0.91764 * Math.tan(toRad(L))));
    RA = ((RA % 360) + 360) % 360;
    RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
    RA /= 15;
    const sinDec = 0.39782 * Math.sin(toRad(L));
    const cosDec = Math.cos(Math.asin(sinDec));
    const zenith = 90.833;
    const cosH =
      (Math.cos(toRad(zenith)) - sinDec * Math.sin(toRad(lat))) /
      (cosDec * Math.cos(toRad(lat)));
    if (cosH > 1) return isSunrise ? 0 : 0; // sun never rises (polar)
    if (cosH < -1) return isSunrise ? 0 : 24; // sun never sets
    let H = isSunrise ? 360 - toDeg(Math.acos(cosH)) : toDeg(Math.acos(cosH));
    H /= 15;
    const T = H + RA - 0.06571 * t - 6.622;
    let UT = T - lngHour;
    UT = ((UT % 24) + 24) % 24;
    const tzOffset = -date.getTimezoneOffset() / 60;
    return ((UT + tzOffset) % 24 + 24) % 24;
  }

  return { sunrise: calc(true), sunset: calc(false) };
}

// ─── Day-cycle palette ───────────────────────────────────────────────────────

// Base palettes for daytime and nighttime, mirroring the scene themes.
const DAY_BASE: Record<string, string> = {
  "--bg": "#e6e0cd",
  "--panel": "#dcd5bf",
  "--border": "#cbc2a8",
  "--border-strong": "#b2a88c",
  "--text": "#2e2a1e",
  "--text-muted": "#5a5442",
  "--text-faint": "#7a725c",
  "--text-ghost": "#a89e84",
  "--text-whisper": "#c2b8a0",
  "--accent": "#9a6a20",
  "--accent-bright": "#b8853a",
  "--accent-dim": "#b89a5a",
  "--grain-opacity": "0.12",
  "--hill-far": "#b6cba0",
  "--hill-near": "#93b074",
  "--tree": "#5e7a44",
  "--creek": "#8fbccb",
  "--creek-hi": "#d4ecf2",
  "--star": "transparent",
};

const NIGHT_BASE: Record<string, string> = {
  "--bg": "#0a0a08",
  "--panel": "#121210",
  "--border": "#1e1e1a",
  "--border-strong": "#2e2e28",
  "--text": "#c8c4b0",
  "--text-muted": "#7a7a68",
  "--text-faint": "#5a5a4e",
  "--text-ghost": "#3a3a30",
  "--text-whisper": "#2a2a24",
  "--accent": "#c8a060",
  "--accent-bright": "#e0c080",
  "--accent-dim": "#5a5040",
  "--grain-opacity": "0.35",
  "--hill-far": "#141c26",
  "--hill-near": "#0d1319",
  "--tree": "#0a0f12",
  "--creek": "#22333f",
  "--creek-hi": "#3d5866",
  "--star": "#d8d4c0",
};

type Phase = {
  skyTop: string;
  skyBottom: string;
  celestial: string;
  glow: string;
};

// Sky color stops keyed by "sun altitude" proxy — from deep night to noon and
// back, including the warm dawn/dusk bands the user asked for.
function skyForDay(p: number): Phase {
  // p is 0..1 across the daylight span.
  if (p < 0.08) {
    // sunrise — light yellow / orange
    return { skyTop: "#e9a86a", skyBottom: "#f6d9a0", celestial: "#ff9e4a", glow: "#ffb055" };
  }
  if (p < 0.2) {
    // early morning — soft gold lifting to blue
    return { skyTop: "#a9c6e0", skyBottom: "#f2e6c4", celestial: "#f4c04e", glow: "#f6cf6a" };
  }
  if (p < 0.8) {
    // midday — bright blue
    return { skyTop: "#8ec2ea", skyBottom: "#d7ecf4", celestial: "#fff2c4", glow: "#fff2c4" };
  }
  if (p < 0.92) {
    // late afternoon warming
    return { skyTop: "#9db8d0", skyBottom: "#f0d3a0", celestial: "#f6b04a", glow: "#f8c060" };
  }
  // sunset — pink / orange
  return { skyTop: "#e08a86", skyBottom: "#f6c98e", celestial: "#ff7e50", glow: "#ff9060" };
}

function skyForNight(p: number): Phase {
  // Deep, star-ready night; slightly lighter around dusk/dawn edges.
  const edge = p < 0.12 || p > 0.88;
  return {
    skyTop: edge ? "#1a2340" : "#0a1024",
    skyBottom: edge ? "#241a30" : "#0a0a10",
    celestial: "#e8e6d6",
    glow: "#cfd6e6",
  };
}

/** Position of sun/moon along its arc for a given progress 0..1. */
function arc(p: number): { x: number; y: number } {
  const x = clamp(p);
  // y: 0 = top of sky, 1 = horizon. Peak (lowest y) at the middle.
  const y = 1 - Math.sin(clamp(p) * Math.PI) * 0.9 - 0.05;
  return { x, y: clamp(y, 0.02, 1) };
}

/**
 * Computes the full inline variable set + scene state for the day-cycle theme
 * at the given moment and location.
 */
export function dayCycleState(
  now: Date,
  lat: number,
  lng: number
): { vars: Record<string, string>; scene: SceneState } {
  const { sunrise, sunset } = sunTimes(now, lat, lng);
  const hours = now.getHours() + now.getMinutes() / 60;
  const isDay = hours >= sunrise && hours <= sunset && sunset > sunrise;

  let progress: number;
  let phase: Phase;
  let base: Record<string, string>;
  let celestial: "sun" | "moon";
  let stars: boolean;

  if (isDay) {
    progress = clamp((hours - sunrise) / Math.max(0.01, sunset - sunrise));
    phase = skyForDay(progress);
    base = DAY_BASE;
    celestial = "sun";
    stars = false;
  } else {
    // Night: from sunset to the next sunrise (wrap past midnight).
    const nightLen = 24 - (sunset - sunrise);
    let since = hours - sunset;
    if (since < 0) since += 24;
    progress = clamp(since / Math.max(0.01, nightLen));
    phase = skyForNight(progress);
    base = NIGHT_BASE;
    celestial = "moon";
    stars = true;
  }

  const pos = arc(progress);
  const vars: Record<string, string> = {
    ...base,
    "--sky": `linear-gradient(${phase.skyTop}, ${phase.skyBottom} 78%)`,
    "--celestial": phase.celestial,
    "--celestial-glow": rgba(phase.glow, isDay ? 0.5 : 0.3),
    "--error": base === DAY_BASE ? "#a0442a" : "#a06040",
  };

  return {
    vars,
    scene: { hasScene: true, celestial, x: pos.x, y: pos.y, stars },
  };
}

// ─── Custom theme derivation ─────────────────────────────────────────────────

/** Derives a full coherent palette from the 4 user-chosen custom values. */
export function customState(c: CustomTheme): {
  vars: Record<string, string>;
  scene: SceneState;
} {
  const { bg, text, celestialColor, celestial } = c;
  const white = "#ffffff";
  const vars: Record<string, string> = {
    "--bg": bg,
    "--panel": mix(bg, text, 0.08),
    "--border": mix(bg, text, 0.16),
    "--border-strong": mix(bg, text, 0.3),
    "--text": text,
    "--text-muted": mix(text, bg, 0.3),
    "--text-faint": mix(text, bg, 0.5),
    "--text-ghost": mix(text, bg, 0.66),
    "--text-whisper": mix(text, bg, 0.8),
    "--accent": celestialColor,
    "--accent-bright": mix(celestialColor, white, 0.25),
    "--accent-dim": mix(celestialColor, bg, 0.45),
    "--error": "#a0552f",
    "--grain-opacity": "0.2",
    "--sky": `linear-gradient(${mix(bg, celestialColor, 0.28)}, ${bg} 80%)`,
    "--hill-far": mix(bg, text, 0.22),
    "--hill-near": mix(bg, text, 0.12),
    "--tree": mix(bg, text, 0.34),
    "--creek": mix(bg, celestialColor, 0.18),
    "--creek-hi": mix(bg, celestialColor, 0.4),
    "--celestial": celestialColor,
    "--celestial-glow": rgba(celestialColor, 0.4),
    "--star": celestial === "moon" ? mix(text, bg, 0.1) : "transparent",
  };
  return {
    vars,
    scene: {
      hasScene: true,
      celestial,
      x: 0.5,
      y: 0.24,
      stars: celestial === "moon",
    },
  };
}

// ─── Applying a theme ────────────────────────────────────────────────────────

const INLINE_VARS = [
  "--bg", "--panel", "--border", "--border-strong", "--text", "--text-muted",
  "--text-faint", "--text-ghost", "--text-whisper", "--accent", "--accent-bright",
  "--accent-dim", "--error", "--grain-opacity", "--sky", "--hill-far",
  "--hill-near", "--tree", "--creek", "--creek-hi", "--celestial",
  "--celestial-glow", "--star",
];

function clearInlineVars(el: HTMLElement) {
  for (const v of INLINE_VARS) el.style.removeProperty(v);
}

function applyInlineVars(el: HTMLElement, vars: Record<string, string>) {
  for (const [k, val] of Object.entries(vars)) el.style.setProperty(k, val);
}

/** Resolves `system` to the concrete light/dark data-theme value. */
function systemPref(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/**
 * Applies a theme to <html> and returns the scene state (so the caller can
 * render/skip the pixel scene). Static themes just set data-theme; the
 * day-cycle and custom themes also write inline variable overrides.
 */
export function applyTheme(id: ThemeId, custom?: CustomTheme): SceneState {
  if (typeof document === "undefined") return NO_SCENE;
  const el = document.documentElement;
  clearInlineVars(el);

  switch (id) {
    case "light":
    case "dark":
    case "light-scene":
    case "dark-scene":
      el.setAttribute("data-theme", id);
      return id === "light-scene"
        ? { hasScene: true, celestial: "sun", x: 0.5, y: 0.22, stars: false }
        : id === "dark-scene"
          ? { hasScene: true, celestial: "moon", x: 0.5, y: 0.22, stars: true }
          : NO_SCENE;

    case "system":
      el.setAttribute("data-theme", systemPref());
      return NO_SCENE;

    case "daycycle": {
      el.setAttribute("data-theme", "daycycle");
      const coords = getStoredCoords();
      const { vars, scene } = dayCycleState(new Date(), coords.lat, coords.lng);
      applyInlineVars(el, vars);
      return scene;
    }

    case "custom": {
      el.setAttribute("data-theme", "custom");
      const { vars, scene } = customState(custom ?? getCustom());
      applyInlineVars(el, vars);
      return scene;
    }
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export function getStoredTheme(): ThemeId {
  if (typeof localStorage === "undefined") return "dark";
  const v = localStorage.getItem(THEME_KEY);
  return (v as ThemeId) || "dark";
}

export function setStoredTheme(id: ThemeId) {
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    /* storage blocked — theme just won't persist */
  }
}

export function getCustom(): CustomTheme {
  if (typeof localStorage === "undefined") return DEFAULT_CUSTOM;
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return DEFAULT_CUSTOM;
    return { ...DEFAULT_CUSTOM, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CUSTOM;
  }
}

export function setCustom(c: CustomTheme) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(c));
  } catch {
    /* */
  }
}

// Cached geolocation so we don't reprompt every minute.
const COORDS_KEY = "koan_coords";

function getStoredCoords(): { lat: number; lng: number } {
  if (typeof localStorage === "undefined") return { lat: 40, lng: -74 };
  try {
    const raw = localStorage.getItem(COORDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* */
  }
  return { lat: 40, lng: -74 }; // fallback; sunrise/sunset ~06:00/18:00-ish
}

/** Asks the browser for location once and caches it for the day-cycle theme. */
export function requestCoords(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        try {
          localStorage.setItem(
            COORDS_KEY,
            JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude })
          );
        } catch {
          /* */
        }
        resolve();
      },
      () => resolve(),
      { timeout: 8000, maximumAge: 3600000 }
    );
  });
}

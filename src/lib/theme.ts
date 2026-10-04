import { Platform } from "react-native";

// Single source of truth for colors/spacing/typography. The sage palette comes
// from the "PaceTasks Sage" Claude Design: a calm light sage base with a dark
// counterpart, plus a user-picked accent. Screens never import a palette
// directly — they read the active theme through useTheme()/makeStyles().

export type ColorScheme = "light" | "dark";
export const ACCENT_IDS = ["sage", "ocean", "clay", "plum", "ink"] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

interface AccentColors {
  accent: string; // buttons, links, progress fill
  accentDark: string; // filled cards, toggles-on, selected pills
  accentLight: string; // partial/in-progress states
  onAccent: string; // text/icons drawn on accent or accentDark fills
  quickFill: string; // background of "quick win" time pills
  quickText: string; // text of "quick win" time pills
}

const BASE_COLORS: Record<ColorScheme, {
  background: string;
  backgroundEnd: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  danger: string;
  warning: string;
  pink: string;
  purple: string;
  teal: string;
  indigo: string;
  overlay: string;
  shadow: string;
}> = {
  light: {
    background: "#E7EFE1", // page background, gradient start (see backgroundEnd)
    backgroundEnd: "#D7E4D0", // page background, gradient end
    surface: "#F6F8F1", // cards
    surfaceAlt: "#EDF1E7", // nested fill: input backgrounds, unselected pills
    border: "#D6E0CF",
    textPrimary: "#26332A", // near-black, warm dark green-gray
    textSecondary: "#56634F", // secondary copy; 4.5:1+ on background
    textTertiary: "#8A9585", // placeholders and decorative text only
    danger: "#B3443F",
    warning: "#B8712A", // category accent: Shopping; review flags
    pink: "#B94770", // category accent: Health
    purple: "#7D5AA8", // category accent: Personal
    teal: "#3E8C89",
    indigo: "#4A5FB0", // category accent: Work
    overlay: "rgba(38,51,42,0.45)", // scrim behind sheets and dialogs
    shadow: "rgba(38,51,42,0.12)",
  },
  dark: {
    background: "#141A16",
    backgroundEnd: "#101512",
    surface: "#1D2520",
    surfaceAlt: "#242E27",
    border: "#2E3931",
    textPrimary: "#E4ECDF",
    textSecondary: "#A3B09E",
    textTertiary: "#76826F",
    danger: "#E58A84",
    warning: "#E6B070",
    pink: "#E79BB6",
    purple: "#C0A3E0",
    teal: "#7FC7C3",
    indigo: "#9AA8E8",
    overlay: "rgba(0,0,0,0.6)",
    shadow: "rgba(0,0,0,0.35)",
  },
};

const ACCENTS: Record<AccentId, Record<ColorScheme, AccentColors>> = {
  sage: {
    light: { accent: "#4E8552", accentDark: "#3F7446", accentLight: "#9FC89D", onAccent: "#FFFFFF", quickFill: "#D3E6CF", quickText: "#2C5733" },
    dark: { accent: "#8DC495", accentDark: "#7DB886", accentLight: "#4F7A56", onAccent: "#10180F", quickFill: "#253A29", quickText: "#B5DDB5" },
  },
  ocean: {
    light: { accent: "#3B7197", accentDark: "#2F6283", accentLight: "#9CC0DA", onAccent: "#FFFFFF", quickFill: "#D5E4EF", quickText: "#234B66" },
    dark: { accent: "#8EBBDA", accentDark: "#7EADCE", accentLight: "#3F6480", onAccent: "#0E1720", quickFill: "#1F3342", quickText: "#B8D6EA" },
  },
  clay: {
    light: { accent: "#B0603C", accentDark: "#9A4E2E", accentLight: "#E2B29A", onAccent: "#FFFFFF", quickFill: "#F2DDD2", quickText: "#6F3620" },
    dark: { accent: "#E3A385", accentDark: "#D99474", accentLight: "#7A4A34", onAccent: "#1E120C", quickFill: "#3D2A20", quickText: "#F0C7B2" },
  },
  plum: {
    light: { accent: "#815A9C", accentDark: "#6E4A86", accentLight: "#C7AED9", onAccent: "#FFFFFF", quickFill: "#E8DDF0", quickText: "#4E3263" },
    dark: { accent: "#C3A5DA", accentDark: "#B696CF", accentLight: "#5E4775", onAccent: "#1A1122", quickFill: "#33283D", quickText: "#DCC8EA" },
  },
  ink: {
    light: { accent: "#3F4B3C", accentDark: "#26332A", accentLight: "#A8B2A2", onAccent: "#FFFFFF", quickFill: "#DCE3D6", quickText: "#26332A" },
    dark: { accent: "#E4ECDF", accentDark: "#D2DCCB", accentLight: "#6B7866", onAccent: "#141A16", quickFill: "#2A332C", quickText: "#E4ECDF" },
  },
};

// Brand palette for expressive surfaces (the Today hero card, the week strip's
// today pill). Fixed colors that read the same in light and dark mode,
// unlike the scheme-aware tokens above.
export const PALETTE = {
  babyLavender: "#DBC0E8",
  blueSkies: "#A3C1E2",
  daffodil: "#F7E289",
  nightTime: "#252D45",
  peaches: "#FBB28B",
  poppyFields: "#F76F54",
  fuchsiaFlowers: "#EA5E86",
  poolTime: "#47B5A8",
  cottonCandy: "#F9A2C5",
  mutedEggplant: "#6B515E",
  hayFields: "#B79A65",
  cream: "#FBF6EE",
} as const;

// Human labels + per-scheme swatch colors for the Settings accent picker.
export const ACCENT_OPTIONS: { id: AccentId; label: string; swatch: Record<ColorScheme, string> }[] = ACCENT_IDS.map(
  (id) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    swatch: { light: ACCENTS[id].light.accentDark, dark: ACCENTS[id].dark.accent },
  })
);

const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

// Three corner sizes by role: sm for small tags and previews, md for tiles and
// rows inside a card, lg for cards and sheets. Buttons and chips use pill.
// `xl` is kept as an alias of lg so every card shares one radius.
const radius = { sm: 10, md: 16, lg: 20, xl: 20, pill: 999 };

// No bundled font files: one modern system sans (SF Pro / Roboto / Segoe UI)
// everywhere, so titles, body and numbers read as a single family. Hierarchy
// comes from weight and size; `mono` keeps its name for the minute/timer
// styles, which line digits up with tabular figures instead of a mono face.
const systemSans = Platform.select({
  ios: "System",
  android: "sans-serif",
  default: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
});
const fonts = {
  display: systemSans,
  mono: systemSans,
};

const typography = {
  largeTitle: { fontSize: 28, fontWeight: "700" as const, fontFamily: fonts.display, letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: "700" as const, fontFamily: fonts.display, letterSpacing: -0.4 },
  headline: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 16, fontWeight: "400" as const },
  subhead: { fontSize: 14, fontWeight: "400" as const },
  footnote: { fontSize: 13, fontWeight: "600" as const },
  caption: { fontSize: 11, fontWeight: "600" as const },
  // Small uppercase letter-spaced label, e.g. "SUNDAY · GOOD MORNING".
  eyebrow: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 1.2 },
};

export function buildTheme(scheme: ColorScheme, accentId: AccentId) {
  const accent = ACCENTS[accentId] ?? ACCENTS.sage;
  return {
    scheme,
    isDark: scheme === "dark",
    colors: {
      ...BASE_COLORS[scheme],
      ...accent[scheme],
      success: accent[scheme].accentDark, // completed checkmark
    },
    spacing,
    radius,
    fonts,
    typography,
  };
}

export type AppTheme = ReturnType<typeof buildTheme>;

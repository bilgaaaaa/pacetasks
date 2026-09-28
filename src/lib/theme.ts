// Single source of truth for colors/spacing/typography. Palette matches the
// "PaceTasks Film" Claude Design: a calm light sage/cream base with a forest
// green accent, replacing the earlier dark iOS theme. Category tags (see
// categories.ts) borrow a few extra hues for variety, but every screen's
// chrome — cards, buttons, text — comes from this single green-based palette.
export const theme = {
  colors: {
    background: "#E7EFE1", // page background, gradient start (see backgroundEnd)
    backgroundEnd: "#D7E4D0", // page background, gradient end
    surface: "#F6F8F1", // white/cream cards
    surfaceAlt: "#EDF1E7", // nested fill: input backgrounds, unselected pills
    border: "#DCE5D5",
    textPrimary: "#26332A", // near-black, warm dark green-gray
    textSecondary: "#7C8779",
    textTertiary: "#A8B2A2",
    accent: "#6B9E70", // medium green — buttons, links, progress fill
    accentDark: "#4E8552", // deep green — filled cards, toggles-on, selected pills
    accentLight: "#9FC89D", // light green — partial/in-progress states
    success: "#4E8552", // completed checkmark (alias of accentDark)
    danger: "#C0504D", // destructive actions (delete) — not shown in the design, kept for existing confirm dialogs
    warning: "#D98A3D", // category accent: Shopping
    pink: "#D9678A", // category accent: Health
    purple: "#8B6BB5", // category accent: Personal
    teal: "#4FA3A0",
    indigo: "#5C6FBF", // category accent: Work
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 12,
    md: 18,
    lg: 24,
    xl: 28,
    pill: 999,
  },
  typography: {
    largeTitle: { fontSize: 34, fontWeight: "800" as const },
    title: { fontSize: 22, fontWeight: "800" as const },
    headline: { fontSize: 17, fontWeight: "700" as const },
    body: { fontSize: 16, fontWeight: "400" as const },
    subhead: { fontSize: 14, fontWeight: "400" as const },
    footnote: { fontSize: 13, fontWeight: "600" as const },
    caption: { fontSize: 11, fontWeight: "600" as const },
    // Small uppercase letter-spaced label, e.g. "SUNDAY · GOOD MORNING".
    eyebrow: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 1.2 },
  },
};

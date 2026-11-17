// The DeskFocus widget's own settings, which live in the App Group the widget reads, not in user_settings.
// PaceTasks reads and changes them through the bridge (src/lib/deskfocusBridge.ts); field names match
// WidgetSettingsPayload and WidgetSettingsPatch in targets/deskfocus/_shared/WidgetSettingsBridge.swift.
import { localized, msg } from "../i18n";

export const GLASS_TINTS = ["purple", "indigo", "blue", "teal", "green", "orange", "rose", "graphite", "clear"] as const;
export type GlassTint = (typeof GLASS_TINTS)[number];

export const WIDGET_ACCENTS = ["amber", "coral", "pink", "violet", "sky", "mint", "lime", "white"] as const;
export type WidgetAccent = (typeof WIDGET_ACCENTS)[number];

export type WidgetCalendarKind = "calendar" | "reminders";

export interface WidgetCalendar {
  key: string; // what the widget stores to hide it
  kind: WidgetCalendarKind;
  title: string;
  account: string; // "iCloud", a Gmail address, "On My iPhone"…
  colorHex: string;
  visible: boolean;
}

export interface WidgetSettings {
  glassTint: GlassTint;
  accentColor: WidgetAccent;
  focusMinutes: number; // what ▶ uses for a task without its own length
  includeUndatedTasks: boolean; // reminders without a date
  calendars: WidgetCalendar[];
}

// One change at a time from the settings sheet; a calendar switch names the calendar and its new state.
export interface WidgetSettingsPatch {
  glassTint?: GlassTint;
  accentColor?: WidgetAccent;
  focusMinutes?: number;
  includeUndatedTasks?: boolean;
  calendarKey?: string;
  calendarVisible?: boolean;
}

// The widget's colors as its swatches show them: the glass's top color, the accent's light shade
// (GlassTint+Colors.swift and AccentChoice+Colors.swift).
export const GLASS_TINT_OPTIONS: { id: GlassTint; label: string; swatch: string }[] = localized([
  { id: "purple", label: msg("Purple"), swatch: "#5B50F0" },
  { id: "indigo", label: msg("Indigo"), swatch: "#3F51B5" },
  { id: "blue", label: msg("Blue"), swatch: "#2F80ED" },
  { id: "teal", label: msg("Teal"), swatch: "#1FA2A6" },
  { id: "green", label: msg("Green"), swatch: "#34A853" },
  { id: "orange", label: msg("Orange"), swatch: "#F2994A" },
  { id: "rose", label: msg("Rose"), swatch: "#E0577F" },
  { id: "graphite", label: msg("Graphite"), swatch: "#5A5F6B" },
  { id: "clear", label: msg("Clear glass"), swatch: "#C9CCD3" },
]);

export const WIDGET_ACCENT_OPTIONS: { id: WidgetAccent; label: string; swatch: string }[] = localized([
  { id: "amber", label: msg("Amber"), swatch: "#FFC857" },
  { id: "coral", label: msg("Coral"), swatch: "#FF9A8B" },
  { id: "pink", label: msg("Pink"), swatch: "#FFA8D5" },
  { id: "violet", label: msg("Violet"), swatch: "#C3B5FF" },
  { id: "sky", label: msg("Sky"), swatch: "#9FDBFF" },
  { id: "mint", label: msg("Mint"), swatch: "#A6F4D8" },
  { id: "lime", label: msg("Lime"), swatch: "#E4F77A" },
  { id: "white", label: msg("White"), swatch: "#FFFFFF" },
]);

// Focus lengths offered for ▶, the same as the Mac's presets (DeskfocusSettings.focusPresets).
export const WIDGET_FOCUS_PRESETS = [15, 25, 45, 60, 90] as const;

// The link the widget's gear opens (DeskfocusConstants.settingsURL); the scheme is `scheme` in app.json.
export const DESKFOCUS_SETTINGS_URL = "pacetasks://deskfocus-settings";

export function isDeskfocusSettingsUrl(url: string): boolean {
  return url.split("?")[0].replace(/\/+$/, "") === DESKFOCUS_SETTINGS_URL;
}

function pick<T extends string>(options: readonly T[], value: unknown): T | null {
  return typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : null;
}

function parseCalendar(value: unknown): WidgetCalendar | null {
  if (!value || typeof value !== "object") return null;
  const calendar = value as Record<string, unknown>;
  const kind = pick(["calendar", "reminders"] as const, calendar.kind);
  if (
    !kind ||
    typeof calendar.key !== "string" ||
    typeof calendar.title !== "string" ||
    typeof calendar.account !== "string" ||
    typeof calendar.colorHex !== "string" ||
    typeof calendar.visible !== "boolean"
  ) {
    return null;
  }
  return {
    key: calendar.key,
    kind,
    title: calendar.title,
    account: calendar.account,
    colorHex: calendar.colorHex,
    visible: calendar.visible,
  };
}

// Reads the handler's `widget` field; null when it is missing or unreadable, so a bad reply never shows wrong switches.
export function parseWidgetSettings(value: unknown): WidgetSettings | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const glassTint = pick(GLASS_TINTS, raw.glassTint);
  const accentColor = pick(WIDGET_ACCENTS, raw.accentColor);
  if (
    !glassTint ||
    !accentColor ||
    typeof raw.focusMinutes !== "number" ||
    typeof raw.includeUndatedTasks !== "boolean" ||
    !Array.isArray(raw.calendars)
  ) {
    return null;
  }
  return {
    glassTint,
    accentColor,
    focusMinutes: raw.focusMinutes,
    includeUndatedTasks: raw.includeUndatedTasks,
    calendars: raw.calendars.map(parseCalendar).filter((calendar): calendar is WidgetCalendar => calendar !== null),
  };
}

// The settings as they will be once the change is saved, so a switch moves at once.
export function applyWidgetSettingsPatch(settings: WidgetSettings, patch: WidgetSettingsPatch): WidgetSettings {
  const { calendarKey, calendarVisible, ...fields } = patch;
  const calendars =
    calendarKey !== undefined && calendarVisible !== undefined
      ? settings.calendars.map((calendar) =>
          calendar.key === calendarKey ? { ...calendar, visible: calendarVisible } : calendar
        )
      : settings.calendars;
  return { ...settings, ...fields, calendars };
}

export interface CalendarAccount {
  account: string;
  calendars: WidgetCalendar[];
}

// One kind of calendar grouped by account, in the order the widget sent them (account, then title).
export function groupCalendarsByAccount(calendars: WidgetCalendar[], kind: WidgetCalendarKind): CalendarAccount[] {
  const accounts: CalendarAccount[] = [];
  for (const calendar of calendars) {
    if (calendar.kind !== kind) continue;
    const last = accounts[accounts.length - 1];
    if (last?.account === calendar.account) last.calendars.push(calendar);
    else accounts.push({ account: calendar.account, calendars: [calendar] });
  }
  return accounts;
}

import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Session } from "@supabase/supabase-js";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { useSettings } from "../hooks/useSettings";
import { useAccount } from "../hooks/useAccount";
import { AccountCard } from "../components/AccountCard";
import { AccountSheet } from "../components/AccountSheet";
import { DataCard } from "../components/DataCard";
import { DeleteAccountSheet } from "../components/DeleteAccountSheet";
import { Stepper } from "../components/Stepper";
import { DATA_SECTION_LABEL } from "../lib/accountCopy";
import { openExternalLink, PRIVACY_POLICY_URL, SUPPORT_URL } from "../lib/links";
import { syncDailyReminder } from "../lib/notifications";
import { ACCENT_OPTIONS, buildTheme, PALETTE_OPTIONS, PaletteId, paletteUsesAccent } from "../lib/theme";
import {
  GROUP_BY_LABELS,
  GROUP_BY_OPTIONS,
  QUICK_WIN_LIMITS,
  THEME_MODES,
  THEME_MODE_LABELS,
  ThemeMode,
} from "../lib/appearance";

interface Props {
  userId: string | undefined;
  session: Session | null; // who is using the app: an anonymous user or a signed-up account
}

const POMODORO_PRESETS: { work: number; break: number; label: string }[] = [
  { work: 15, break: 3, label: "15 + 3" },
  { work: 25, break: 5, label: "25 + 5" },
  { work: 50, break: 10, label: "50 + 10" },
];

type PreviewColors = ReturnType<typeof buildTheme>["colors"];

// Preview colors for the light/dark cards, in the chosen color theme;
// "Match phone" shows half light, half dark.
function themePreviews(palette: PaletteId): Record<ThemeMode, [PreviewColors, PreviewColors]> {
  const light = buildTheme("light", "sage", palette).colors;
  const dark = buildTheme("dark", "sage", palette).colors;
  return { system: [light, dark], light: [light, light], dark: [dark, dark] };
}

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour} ${period}`;
}

function parseTime(time: string): { hour: number; minute: number } {
  const [hourStr, minuteStr] = time.split(":");
  return { hour: Number(hourStr) || 0, minute: Number(minuteStr) || 0 };
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// The account (create one, sign in, email consent, sign out), then "Make it
// yours" (theme, accent, Today's sections, quick-win size — saved on this
// phone), the work schedule (feeds the before/after-work labels), the evening
// reminder, Brain Dump auto-create, the settings the Focus timer + range
// timer read (chime + Pomodoro length), and "Your data" (privacy policy, help,
// delete the account).
export function SettingsScreen({ userId, session }: Props) {
  const { theme, appearance, updateAppearance } = useTheme();
  const styles = useStyles();
  const { settings, loading, error, save } = useSettings(userId);
  const account = useAccount(session);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [reminderHour, setReminderHour] = useState(18);
  const [reminderMinute, setReminderMinute] = useState(30);

  useEffect(() => {
    if (settings) {
      const { hour, minute } = parseTime(settings.reminder_time);
      setReminderHour(hour);
      setReminderMinute(minute);
    }
  }, [settings?.reminder_time]);

  // A different user (sign-in, sign-out, account deletion) brings different reminder
  // settings: the phone's scheduled reminder follows them, without a permission prompt.
  const reminderUserIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!settings) return;
    const userChanged = reminderUserIdRef.current !== undefined && reminderUserIdRef.current !== settings.user_id;
    reminderUserIdRef.current = settings.user_id;
    if (userChanged) {
      syncDailyReminder(settings.reminder_enabled, settings.reminder_time, { askPermission: false }).catch((e) =>
        console.warn("[SettingsScreen] reminder re-sync failed", e)
      );
    }
  }, [settings?.user_id]);

  const switchColors = {
    trackColor: { false: theme.colors.border, true: theme.colors.accentDark },
    thumbColor: theme.colors.surface,
  };

  // The sheets are rendered in both branches below, in the same position, so a
  // user change (which reloads the settings) never closes a sheet showing its result.
  const sheets = (
    <>
      <AccountSheet
        visible={accountSheetOpen}
        state={account.state}
        profileFirstName={account.profile?.first_name ?? null}
        resending={account.busy}
        onChangeField={account.setField}
        onChangeMarketingOptIn={account.setMarketingOptIn}
        onChangeCode={account.setCode}
        onChangeMode={account.setMode}
        onSubmit={account.submit}
        onVerify={account.verify}
        onResendCode={account.resendCode}
        onEditEmail={account.editEmail}
        onOpenPrivacyPolicy={() => openExternalLink(PRIVACY_POLICY_URL)}
        onClose={() => setAccountSheetOpen(false)}
      />
      <DeleteAccountSheet
        state={account.deletion}
        onConfirm={account.confirmDeletion}
        onClose={account.closeDeletion}
      />
    </>
  );

  if (loading || !settings) {
    return (
      <LinearGradient
        colors={[theme.colors.background, theme.colors.backgroundEnd]}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
          {sheets}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const applyReminderTime = async (hour: number, minute: number) => {
    const time = formatTime(hour, minute);
    await save({ reminder_time: time });
    await syncDailyReminder(settings.reminder_enabled, time);
  };

  return (
    <LinearGradient
      colors={[theme.colors.background, theme.colors.backgroundEnd]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.headerTitle} accessibilityRole="header">Settings</Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={styles.sectionLabel}>ACCOUNT</Text>
          <AccountCard
            isSignedUp={account.isSignedUp}
            email={account.email}
            profile={account.profile}
            busy={account.busy}
            errorMessage={account.cardError}
            onOpen={(mode) => {
              account.open(mode);
              setAccountSheetOpen(true);
            }}
            onChangeMarketingOptIn={account.changeMarketingOptIn}
            onSignOut={account.signOut}
          />

          <Text style={styles.sectionLabel}>THEME</Text>
          <View style={styles.themeRow} accessibilityRole="radiogroup" accessibilityLabel="Theme">
            {THEME_MODES.map((mode) => {
              const isActive = appearance.themeMode === mode;
              const [left, right] = themePreviews(appearance.palette)[mode];
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.themeCard, isActive && styles.themeCardActive]}
                  onPress={() => updateAppearance({ themeMode: mode })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={THEME_MODE_LABELS[mode]}
                >
                  <View style={styles.themePreview}>
                    {[left, right].map((colors, i) => (
                      <View key={i} style={[styles.themePreviewHalf, { backgroundColor: colors.background }]}>
                        <View style={[styles.themePreviewLine, { backgroundColor: colors.textPrimary }]} />
                        <View style={[styles.themePreviewCard, { backgroundColor: colors.surface }]} />
                        <View style={[styles.themePreviewCard, { backgroundColor: colors.surface }]} />
                      </View>
                    ))}
                  </View>
                  <Text style={styles.themeLabel}>{THEME_MODE_LABELS[mode]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>Color theme</Text>
              <Text style={styles.cardValue}>
                {PALETTE_OPTIONS.find((p) => p.id === appearance.palette)?.label}
              </Text>
            </View>
            <View style={styles.paletteList} accessibilityRole="radiogroup" accessibilityLabel="Color theme">
              {PALETTE_OPTIONS.map((option) => {
                const isActive = appearance.palette === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.paletteRow, isActive && styles.paletteRowActive]}
                    onPress={() => updateAppearance({ palette: option.id })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={option.label}
                  >
                    <View style={styles.paletteSwatches}>
                      {option.swatches.map((color, i) => (
                        <View
                          key={color + i}
                          style={[styles.paletteSwatch, { backgroundColor: color }, i > 0 && styles.paletteSwatchOverlap]}
                        />
                      ))}
                    </View>
                    <Text style={styles.paletteLabel}>{option.label}</Text>
                    {isActive && <Ionicons name="checkmark-circle" size={22} color={theme.colors.accentDark} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Sage takes an accent pick; the other themes bring their own accent. */}
          {paletteUsesAccent(appearance.palette) && (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Accent color</Text>
                <Text style={styles.cardValue}>
                  {ACCENT_OPTIONS.find((a) => a.id === appearance.accent)?.label}
                </Text>
              </View>
              <View style={styles.swatchRow} accessibilityRole="radiogroup" accessibilityLabel="Accent color">
                {ACCENT_OPTIONS.map((option) => {
                  const isActive = appearance.accent === option.id;
                  const swatch = option.swatch[theme.scheme];
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.swatchRing, isActive && { borderColor: swatch }]}
                      onPress={() => updateAppearance({ accent: option.id })}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={option.label}
                    >
                      <View style={[styles.swatch, { backgroundColor: swatch }]} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sections on Today</Text>
            <Text style={styles.cardSubtitle}>You can also switch this right on the Today screen.</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Group Today by">
              {GROUP_BY_OPTIONS.map((option) => {
                const isActive = appearance.groupBy === option;
                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.radioRow, isActive && styles.radioRowActive]}
                    onPress={() => updateAppearance({ groupBy: option })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isActive }}
                  >
                    <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                      {isActive && <View style={styles.radioInner} />}
                    </View>
                    <View style={styles.radioText}>
                      <Text style={styles.radioTitle}>{GROUP_BY_LABELS[option].label}</Text>
                      <Text style={styles.radioHint}>{GROUP_BY_LABELS[option].hint}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Stepper
              label="A quick win is up to"
              value={appearance.quickWinMinutes}
              min={QUICK_WIN_LIMITS.min}
              max={QUICK_WIN_LIMITS.max}
              format={(m) => `${m} min`}
              onChange={(minutes) => updateAppearance({ quickWinMinutes: minutes })}
            />
          </View>

          <Text style={styles.sectionLabel}>YOUR DAY</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Work schedule</Text>
            <Text style={styles.cardSubtitle}>
              Tasks get tagged "before work" or "after work" relative to this window.
            </Text>
            <Stepper
              label="Starts at"
              value={settings.work_start_hour}
              min={0}
              max={23}
              format={formatHour}
              onChange={(hour) => save({ work_start_hour: hour })}
            />
            <Stepper
              label="Ends at"
              value={settings.work_end_hour}
              min={0}
              max={23}
              format={formatHour}
              onChange={(hour) => save({ work_end_hour: hour })}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Evening review</Text>
              <Text style={styles.toggleSubtitle}>
                A gentle summary at {formatTime(reminderHour, reminderMinute)}
              </Text>
            </View>
            <Switch
              value={settings.reminder_enabled}
              onValueChange={async (enabled) => {
                await save({ reminder_enabled: enabled });
                await syncDailyReminder(enabled, settings.reminder_time);
              }}
              {...switchColors}
            />
          </View>
          <View style={styles.card}>
            <Stepper
              label="Hour"
              value={reminderHour}
              min={0}
              max={23}
              format={formatHour}
              onChange={(hour) => {
                setReminderHour(hour);
                applyReminderTime(hour, reminderMinute);
              }}
            />
            <Stepper
              label="Minute"
              value={reminderMinute}
              min={0}
              max={55}
              step={5}
              format={(m) => String(m).padStart(2, "0")}
              onChange={(minute) => {
                setReminderMinute(minute);
                applyReminderTime(reminderHour, minute);
              }}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Timer chime</Text>
              <Text style={styles.toggleSubtitle}>
                Soft tone when a Focus session or range timer ends
              </Text>
            </View>
            <Switch
              value={settings.timer_chime_enabled}
              onValueChange={(enabled) => save({ timer_chime_enabled: enabled })}
              {...switchColors}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Haptics</Text>
              <Text style={styles.toggleSubtitle}>A tap when a task is completed</Text>
            </View>
            <Switch
              value={settings.haptics_enabled}
              onValueChange={(enabled) => save({ haptics_enabled: enabled })}
              {...switchColors}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>Add clear brain dumps directly</Text>
              <Text style={styles.toggleSubtitle}>
                Skip the review when every task is clear. Anything unclear still asks first.
              </Text>
            </View>
            <Switch
              value={settings.brain_dump_auto_create}
              onValueChange={(enabled) => save({ brain_dump_auto_create: enabled })}
              {...switchColors}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pomodoro length</Text>
            <View style={styles.segmentedRow}>
              {POMODORO_PRESETS.map((preset) => {
                const isActive =
                  settings.pomodoro_work_minutes === preset.work &&
                  settings.pomodoro_break_minutes === preset.break;
                return (
                  <TouchableOpacity
                    key={preset.label}
                    style={[styles.segment, isActive && styles.segmentActive]}
                    onPress={() =>
                      save({
                        pomodoro_work_minutes: preset.work,
                        pomodoro_break_minutes: preset.break,
                      })
                    }
                  >
                    <Text
                      style={[styles.segmentText, isActive && styles.segmentTextActive]}
                    >
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Text style={styles.sectionLabel}>{DATA_SECTION_LABEL}</Text>
          <DataCard
            hasAccount={account.isSignedUp}
            busy={account.busy}
            onOpenPrivacyPolicy={() => openExternalLink(PRIVACY_POLICY_URL)}
            onOpenSupport={() => openExternalLink(SUPPORT_URL)}
            onDelete={account.openDeletion}
          />
        </ScrollView>

        {sheets}
      </SafeAreaView>
    </LinearGradient>
  );
}

const useStyles = makeStyles((theme) => ({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loader: {
    marginTop: theme.spacing.xl,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.largeTitle.fontSize,
    fontWeight: theme.typography.largeTitle.fontWeight,
    fontFamily: theme.typography.largeTitle.fontFamily,
    letterSpacing: theme.typography.largeTitle.letterSpacing,
  },
  sectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
    marginTop: theme.spacing.sm,
    marginBottom: -theme.spacing.xs,
  },
  errorText: {
    color: theme.colors.danger,
  },
  themeRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  themeCard: {
    flex: 1,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: theme.colors.surface,
  },
  themeCardActive: {
    borderColor: theme.colors.accentDark,
  },
  themePreview: {
    height: 72,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
    flexDirection: "row",
  },
  themePreviewHalf: {
    flex: 1,
    padding: theme.spacing.sm,
    gap: 5,
  },
  themePreviewLine: {
    height: 6,
    width: "60%",
    borderRadius: 3,
  },
  themePreviewCard: {
    height: 12,
    borderRadius: 4,
  },
  themeLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "600",
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
  },
  cardValue: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
  },
  cardSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "400",
    marginTop: 2,
    marginBottom: theme.spacing.sm,
  },
  paletteList: {
    gap: theme.spacing.sm,
  },
  paletteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: theme.colors.surfaceAlt,
  },
  paletteRowActive: {
    borderColor: theme.colors.accentDark,
  },
  paletteSwatches: {
    flexDirection: "row",
  },
  paletteSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  paletteSwatchOverlap: {
    marginLeft: -8,
  },
  paletteLabel: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "600",
  },
  swatchRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: theme.spacing.md,
  },
  swatchRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: "transparent",
    padding: 3,
  },
  swatch: {
    flex: 1,
    borderRadius: 20,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  radioRowActive: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.textTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    borderColor: theme.colors.accentDark,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.accentDark,
  },
  radioText: {
    flex: 1,
    gap: 2,
  },
  radioTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  radioHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "400",
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  toggleText: {
    flex: 1,
    marginRight: theme.spacing.sm,
    gap: 2,
  },
  toggleTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
  },
  toggleSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "400",
  },
  segmentedRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    minHeight: 44,
  },
  segmentActive: {
    backgroundColor: theme.colors.accentDark,
  },
  segmentText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: theme.typography.footnote.fontSize,
    fontFamily: theme.fonts.mono,
    fontVariant: ["tabular-nums"],
  },
  segmentTextActive: {
    color: theme.colors.onAccent,
  },
}));

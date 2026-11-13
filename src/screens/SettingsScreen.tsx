import React, { useCallback, useEffect, useState } from "react";
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
import { useNotificationPermission } from "../hooks/useNotificationPermission";
import { useCalendarAccess } from "../hooks/useCalendarAccess";
import { AccountCard } from "../components/AccountCard";
import { ProCard } from "../components/ProCard";
import { PRO_SECTION_LABEL } from "../lib/proCopy";
import { usePro } from "../hooks/usePro";
import { AccountSheet } from "../components/AccountSheet";
import { DataCard } from "../components/DataCard";
import { DeleteAccountSheet } from "../components/DeleteAccountSheet";
import { Button } from "../components/Button";
import { ChoiceChips } from "../components/ChoiceChips";
import { ErrorBanner } from "../components/ErrorBanner";
import { Stepper } from "../components/Stepper";
import { DATA_SECTION_LABEL } from "../lib/accountCopy";
import { openAppSettings, openExternalLink, PRIVACY_POLICY_URL, SUPPORT_URL } from "../lib/links";
import { requestNotificationPermission } from "../lib/notifications";
import {
  CHECK_IN_TITLE,
  checkInSubtitle,
  REMINDERS_BLOCKED_ACTION,
  REMINDERS_BLOCKED_MESSAGE,
  REMINDERS_SECTION_LABEL,
  TASK_REMINDER_TITLE,
  TASK_REMINDER_SUBTITLE,
} from "../lib/reminderCopy";
import { REMINDER_POLICY } from "../lib/reminderPlan";
import {
  BRAIN_DUMP_AUTO_CREATE_TITLE,
  COMPLETION_TAP_SUBTITLE,
  COMPLETION_TAP_TITLE,
  DESKFOCUS_ALLOW_ACTION,
  DESKFOCUS_CARD_SUBTITLE,
  DESKFOCUS_CARD_TITLE,
  DESKFOCUS_DENIED_ACTION,
  DESKFOCUS_DENIED_MESSAGE,
  DESKFOCUS_GRANTED_MESSAGE,
  DESKFOCUS_SECTION_LABEL,
  TIMER_SOUND_SUBTITLE,
  TIMER_SOUND_TITLE,
} from "../lib/settingsCopy";
import { reviveSession } from "../lib/supabase";
import { formatTimeOfDay, parseTimeOfDay } from "../lib/timeFormat";
import { ACCENT_OPTIONS, buildTheme, PALETTE_OPTIONS, PaletteId, paletteUsesAccent } from "../lib/theme";
import {
  GROUP_BY_LABELS,
  GROUP_BY_OPTIONS,
  QUICK_WIN_LIMITS,
  THEME_MODES,
  THEME_MODE_LABELS,
  ThemeMode,
  languageChoiceOptions,
} from "../lib/appearance";
import { t } from "../i18n";

interface Props {
  userId: string | undefined;
  session: Session | null; // who is using the app: an anonymous user or a signed-up account
}

const STALLED_AFTER_MS = 4000; // how long Settings waits for a session before offering a retry

// Focus session lengths: minutes of focus + minutes of break.
const FOCUS_PRESETS: { work: number; break: number; label: string }[] = [
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

// The account (create one, sign in, email consent, sign out), then "Make it
// yours" (theme, accent, Today's sections, quick-win size — saved on this
// phone), the work schedule (feeds the before/after-work labels), the
// reminders, the timer sound and the completion tap (see src/lib/haptics.ts and
// src/hooks/useTimerAlert.ts), Brain Dump auto-create, the Focus timer length, and "Your data" (privacy policy, help,
// delete the account).
export function SettingsScreen({ userId, session }: Props) {
  const { theme, appearance, updateAppearance } = useTheme();
  const styles = useStyles();
  const pro = usePro();
  const { settings, loading, error, refresh, save } = useSettings();
  const account = useAccount(session);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [reminderHour, setReminderHour] = useState(18);
  const [reminderMinute, setReminderMinute] = useState(30);

  useEffect(() => {
    if (settings) {
      const { hour, minute } = parseTimeOfDay(settings.reminder_time);
      setReminderHour(hour);
      setReminderMinute(minute);
    }
  }, [settings?.reminder_time]);

  // Turning a reminder on is the moment to ask iOS for permission; the phone's
  // schedule itself follows the saved settings through useReminders.
  const notifications = useNotificationPermission();
  const calendarAccess = useCalendarAccess();
  // The widget's focus timer alerts through notifications, so the card asks for them with the calendar.
  const deskfocusNeedsAccess = calendarAccess.access === "undetermined" || notifications.permission === "undetermined";
  const allowDeskfocusAccess = useCallback(async () => {
    await calendarAccess.request();
    await requestNotificationPermission().catch((e) => console.warn("[SettingsScreen] permission request failed", e));
    notifications.refresh();
  }, [calendarAccess.request, notifications.refresh]);
  const saveReminderSwitch = async (patch: { reminder_enabled?: boolean; task_reminder_enabled?: boolean }) => {
    const saved = await save(patch);
    if (!saved || !(patch.reminder_enabled || patch.task_reminder_enabled)) return;
    await requestNotificationPermission().catch((e) => console.warn("[SettingsScreen] permission request failed", e));
    notifications.refresh();
  };

  // Without a session (it could not be started) there is nothing to load yet: start one first.
  const retryLoading = () => (userId ? refresh() : reviveSession());

  // Settings missing with nothing in flight and no error means no session could
  // be started: after a short wait the screen offers a retry instead of spinning on.
  const [stalled, setStalled] = useState(false);
  const waitingWithoutCause = !settings && !loading && !error;
  useEffect(() => {
    if (!waitingWithoutCause) {
      setStalled(false);
      return;
    }
    const timer = setTimeout(() => setStalled(true), STALLED_AFTER_MS);
    return () => clearTimeout(timer);
  }, [waitingWithoutCause]);

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
        appleAvailable={account.appleAvailable}
        onChangeField={account.setField}
        onChangeMarketingOptIn={account.setMarketingOptIn}
        onChangeCode={account.setCode}
        onChangeMode={account.setMode}
        onSubmit={account.submit}
        onVerify={account.verify}
        onContinueWithApple={account.continueWithApple}
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

  if (!settings) {
    // Still loading shows the spinner; a failed load says so and offers another try.
    const loadError = loading ? null : error ?? account.cardError ?? (stalled ? t("Check your connection.") : null);
    return (
      <LinearGradient
        colors={[theme.colors.background, theme.colors.backgroundEnd]}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          {loadError ? (
            <View style={styles.loadFailed}>
              <ErrorBanner message={t("Your settings could not be loaded. {0}", loadError)} />
              <Button label={t("Try again")} variant="secondary" onPress={retryLoading} />
            </View>
          ) : (
            <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
          )}
          {sheets}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const applyReminderTime = (hour: number, minute: number) => save({ reminder_time: formatTimeOfDay(hour, minute) });

  return (
    <LinearGradient
      colors={[theme.colors.background, theme.colors.backgroundEnd]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.headerTitle} accessibilityRole="header">{t("Settings")}</Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={styles.sectionLabel}>{t("ACCOUNT")}</Text>
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

          {pro.storeAvailable && (
            <>
              <Text style={styles.sectionLabel}>{PRO_SECTION_LABEL}</Text>
              <ProCard
                status={pro.status}
                restoring={pro.paywall.restoring}
                message={pro.paywall.visible ? null : pro.paywall.message}
                onSeePlans={() => pro.openPaywall()}
                onRestore={() => void pro.restore()}
                onManage={pro.manageSubscription}
              />
            </>
          )}

          <Text style={styles.sectionLabel}>{t("LANGUAGE")}</Text>
          <View style={styles.card}>
            <ChoiceChips
              options={languageChoiceOptions()}
              value={appearance.language}
              onChange={(language) => updateAppearance({ language })}
              accessibilityLabel={t("Language")}
            />
          </View>

          <Text style={styles.sectionLabel}>{t("THEME")}</Text>
          <View style={styles.themeRow} accessibilityRole="radiogroup" accessibilityLabel={t("Theme")}>
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
              <Text style={styles.cardTitle}>{t("Color theme")}</Text>
              <Text style={styles.cardValue}>
                {PALETTE_OPTIONS.find((p) => p.id === appearance.palette)?.label}
              </Text>
            </View>
            <View style={styles.paletteList} accessibilityRole="radiogroup" accessibilityLabel={t("Color theme")}>
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
                <Text style={styles.cardTitle}>{t("Accent color")}</Text>
                <Text style={styles.cardValue}>
                  {ACCENT_OPTIONS.find((a) => a.id === appearance.accent)?.label}
                </Text>
              </View>
              <View style={styles.swatchRow} accessibilityRole="radiogroup" accessibilityLabel={t("Accent color")}>
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
            <Text style={styles.cardTitle}>{t("Sections on Today")}</Text>
            <Text style={styles.cardSubtitle}>{t("You can also switch this right on the Today screen.")}</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel={t("Group Today by")}>
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
              label={t("A quick win is up to")}
              value={appearance.quickWinMinutes}
              min={QUICK_WIN_LIMITS.min}
              max={QUICK_WIN_LIMITS.max}
              format={(m) => t("{0} min", m)}
              onChange={(minutes) => updateAppearance({ quickWinMinutes: minutes })}
            />
          </View>

          <Text style={styles.sectionLabel}>{t("YOUR DAY")}</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("Work schedule")}</Text>
            <Text style={styles.cardSubtitle}>
              {t("Tasks get tagged \"before work\" or \"after work\" relative to this window.")}
            </Text>
            <Stepper
              label={t("Starts at")}
              value={settings.work_start_hour}
              min={0}
              max={23}
              format={formatTimeOfDay}
              onChange={(hour) => save({ work_start_hour: hour })}
            />
            <Stepper
              label={t("Ends at")}
              value={settings.work_end_hour}
              min={0}
              max={23}
              format={formatTimeOfDay}
              onChange={(hour) => save({ work_end_hour: hour })}
            />
          </View>

          <Text style={styles.sectionLabel}>{REMINDERS_SECTION_LABEL}</Text>
          {notifications.permission === "denied" && (settings.reminder_enabled || (settings.task_reminder_enabled ?? true)) && (
            <View style={styles.card}>
              <Text style={styles.cardSubtitle}>{t(REMINDERS_BLOCKED_MESSAGE)}</Text>
              <Button label={t(REMINDERS_BLOCKED_ACTION)} variant="secondary" onPress={openAppSettings} />
            </View>
          )}
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>{t(CHECK_IN_TITLE)}</Text>
              <Text style={styles.toggleSubtitle}>{checkInSubtitle(formatTimeOfDay(reminderHour, reminderMinute))}</Text>
            </View>
            <Switch
              value={settings.reminder_enabled}
              onValueChange={(enabled) => saveReminderSwitch({ reminder_enabled: enabled })}
              accessibilityLabel={t(CHECK_IN_TITLE)}
              {...switchColors}
            />
          </View>
          <View style={styles.card}>
            <Stepper
              label={t("Hour")}
              value={reminderHour}
              min={0}
              max={23}
              format={(hour) => String(hour).padStart(2, "0")}
              onChange={(hour) => {
                setReminderHour(hour);
                applyReminderTime(hour, reminderMinute);
              }}
            />
            <Stepper
              label={t("Minute")}
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
              <Text style={styles.toggleTitle}>{t(TASK_REMINDER_TITLE)}</Text>
              <Text style={styles.toggleSubtitle}>{t(TASK_REMINDER_SUBTITLE)}</Text>
            </View>
            <Switch
              value={settings.task_reminder_enabled ?? true}
              onValueChange={(enabled) => saveReminderSwitch({ task_reminder_enabled: enabled })}
              accessibilityLabel={t(TASK_REMINDER_TITLE)}
              {...switchColors}
            />
          </View>

          {calendarAccess.access !== "unavailable" && (
            <>
              <Text style={styles.sectionLabel}>{t(DESKFOCUS_SECTION_LABEL)}</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t(DESKFOCUS_CARD_TITLE)}</Text>
                <Text style={styles.cardSubtitle}>{t(DESKFOCUS_CARD_SUBTITLE)}</Text>
                {calendarAccess.access === "granted" && <Text style={styles.cardSubtitle}>{t(DESKFOCUS_GRANTED_MESSAGE)}</Text>}
                {deskfocusNeedsAccess && calendarAccess.access !== "denied" && (
                  <Button label={t(DESKFOCUS_ALLOW_ACTION)} variant="secondary" onPress={allowDeskfocusAccess} />
                )}
                {calendarAccess.access === "denied" && (
                  <>
                    <Text style={styles.cardSubtitle}>{t(DESKFOCUS_DENIED_MESSAGE)}</Text>
                    <Button label={t(DESKFOCUS_DENIED_ACTION)} variant="secondary" onPress={openAppSettings} />
                  </>
                )}
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>{t("WHILE YOU WORK")}</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>{t(TIMER_SOUND_TITLE)}</Text>
              <Text style={styles.toggleSubtitle}>{t(TIMER_SOUND_SUBTITLE)}</Text>
            </View>
            <Switch
              value={settings.timer_chime_enabled}
              onValueChange={(enabled) => void save({ timer_chime_enabled: enabled })}
              accessibilityLabel={t(TIMER_SOUND_TITLE)}
              {...switchColors}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>{t(COMPLETION_TAP_TITLE)}</Text>
              <Text style={styles.toggleSubtitle}>{t(COMPLETION_TAP_SUBTITLE)}</Text>
            </View>
            <Switch
              value={settings.haptics_enabled}
              onValueChange={(enabled) => void save({ haptics_enabled: enabled })}
              accessibilityLabel={t(COMPLETION_TAP_TITLE)}
              {...switchColors}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <Text style={styles.toggleTitle}>{t(BRAIN_DUMP_AUTO_CREATE_TITLE)}</Text>
              <Text style={styles.toggleSubtitle}>
                {t("Skip the review when every task is clear. Anything unclear still asks first.")}
              </Text>
            </View>
            <Switch
              value={settings.brain_dump_auto_create}
              onValueChange={(enabled) => void save({ brain_dump_auto_create: enabled })}
              accessibilityLabel={t(BRAIN_DUMP_AUTO_CREATE_TITLE)}
              {...switchColors}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t("Focus timer")}</Text>
            <Text style={styles.cardSubtitle}>{t("Minutes of focus, then minutes of break.")}</Text>
            <View style={styles.segmentedRow}>
              {FOCUS_PRESETS.map((preset) => {
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

          <Text style={styles.sectionLabel}>{t(DATA_SECTION_LABEL)}</Text>
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
  loadFailed: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.md,
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
    marginTop: theme.spacing.md,
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

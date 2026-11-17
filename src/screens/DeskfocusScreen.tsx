import React from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "@react-navigation/native";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { useDeskfocusAccess } from "../hooks/useDeskfocusAccess";
import { useWidgetSettings } from "../hooks/useWidgetSettings";
import { openAppSettings } from "../lib/links";
import {
  AccountKind,
  GLASS_TINT_OPTIONS,
  googleAccounts,
  groupCalendarsByAccount,
  WIDGET_ACCENT_OPTIONS,
  WIDGET_FOCUS_PRESETS,
  WidgetCalendar,
  WidgetCalendarKind,
  WidgetSettings,
} from "../lib/widgetSettings";
import { Button } from "../components/Button";
import { ChoiceChips } from "../components/ChoiceChips";
import { ErrorBanner } from "../components/ErrorBanner";
import { t } from "../i18n";

interface SwatchOption {
  id: string;
  label: string;
  swatch: string;
}

// The icon an account's heading carries.
const ACCOUNT_ICONS: Record<AccountKind, keyof typeof Ionicons.glyphMap> = {
  icloud: "cloud-outline",
  google: "logo-google",
  exchange: "mail-outline",
  local: "phone-portrait-outline",
  subscribed: "link-outline",
  other: "calendar-outline",
};

// The DeskFocus tab (iPhone): connecting Apple Calendar and Google Calendar, which calendars and reminder lists the
// widget and Today show (every account on the iPhone), the widget's colors and the focus length for ▶.
// The widget's gear opens this tab.
export function DeskfocusScreen() {
  const { theme } = useTheme();
  const styles = useStyles();
  const isFocused = useIsFocused();
  const access = useDeskfocusAccess();
  const widget = useWidgetSettings(isFocused);
  const settings = widget.settings;
  const connected = access.access === "granted";
  const google = settings ? googleAccounts(settings.calendars) : [];
  const switchColors = {
    trackColor: { false: theme.colors.border, true: theme.colors.accentDark },
    thumbColor: theme.colors.surface,
  };

  // Asking also brings the calendars in, so the list fills as soon as access is given.
  const connect = async () => {
    await access.allow();
    await widget.reload();
  };

  const calendarRows = (calendars: WidgetCalendar[], kind: WidgetCalendarKind) => {
    const accounts = groupCalendarsByAccount(calendars, kind);
    if (accounts.length === 0) {
      return (
        <Text style={styles.cardSubtitle}>
          {kind === "calendar" ? t("No calendars on this iPhone yet.") : t("No reminder lists on this iPhone yet.")}
        </Text>
      );
    }
    return accounts.map(({ account, accountKind, calendars: accountCalendars }) => (
      <View key={account} style={styles.account}>
        <View style={styles.accountHeader}>
          <Ionicons name={ACCOUNT_ICONS[accountKind]} size={14} color={theme.colors.textSecondary} />
          <Text style={styles.accountTitle}>{account || t("On this iPhone")}</Text>
        </View>
        {accountCalendars.map((calendar) => (
          <View key={calendar.key} style={styles.calendarRow}>
            <View style={[styles.calendarDot, { backgroundColor: calendar.colorHex }]} />
            <Text style={styles.calendarTitle} numberOfLines={1}>
              {calendar.title}
            </Text>
            <Switch
              value={calendar.visible}
              onValueChange={(visible) => void widget.update({ calendarKey: calendar.key, calendarVisible: visible })}
              accessibilityLabel={t("Show {0}", calendar.title)}
              {...switchColors}
            />
          </View>
        ))}
      </View>
    ));
  };

  const swatches = (options: SwatchOption[], selected: string, onSelect: (id: string) => void, label: string) => (
    <View style={styles.swatchRow} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {options.map((option) => {
        const isActive = option.id === selected;
        return (
          <TouchableOpacity
            key={option.id}
            style={[styles.swatchRing, isActive && { borderColor: theme.colors.accentDark }]}
            onPress={() => onSelect(option.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={option.label}
          >
            <View style={[styles.swatch, { backgroundColor: option.swatch }]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <LinearGradient colors={[theme.colors.background, theme.colors.backgroundEnd]} style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.headerTitle} accessibilityRole="header">
            DeskFocus
          </Text>
          <Text style={styles.subtitle}>
            {t("Connect your calendars, then pick what the DeskFocus widget and Today show next to your PaceTasks tasks.")}
          </Text>

          <Text style={styles.sectionLabel}>{t("ACCOUNTS")}</Text>
          <View style={styles.card}>
            <View style={styles.accountRow}>
              <Ionicons name="logo-apple" size={22} color={theme.colors.textPrimary} />
              <View style={styles.accountText}>
                <Text style={styles.cardTitle}>{t("Apple Calendar and Reminders")}</Text>
                <Text style={styles.cardSubtitleTight}>
                  {connected
                    ? t("Connected: iCloud and every account on this iPhone.")
                    : access.access === "denied"
                    ? t("Turned off. Turn on Calendars and Reminders for PaceTasks in the iPhone's Settings.")
                    : t("iCloud and every calendar account on this iPhone.")}
                </Text>
              </View>
              {connected && <Ionicons name="checkmark-circle" size={22} color={theme.colors.accentDark} />}
            </View>
            {access.access === "undetermined" && (
              <Button label={t("Connect")} onPress={() => void connect()} style={styles.accountButton} />
            )}
            {access.access === "denied" && (
              <Button label={t("Open Settings")} variant="secondary" onPress={openAppSettings} style={styles.accountButton} />
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.accountRow}>
              <Ionicons name="logo-google" size={22} color={theme.colors.textPrimary} />
              <View style={styles.accountText}>
                <Text style={styles.cardTitle}>{t("Google Calendar")}</Text>
                <Text style={styles.cardSubtitleTight}>
                  {google.length > 0
                    ? t("Connected: {0}", google.join(", "))
                    : t("In the iPhone's Settings, open Calendar › Accounts and add your Google account. Its calendars then show up here, in the widget and on Today.")}
                </Text>
              </View>
              {google.length > 0 && <Ionicons name="checkmark-circle" size={22} color={theme.colors.accentDark} />}
            </View>
            {google.length === 0 &&
              (connected ? (
                <Button label={t("Open Settings")} variant="secondary" onPress={openAppSettings} style={styles.accountButton} />
              ) : (
                <Text style={styles.cardSubtitle}>{t("Connect Apple Calendar first: Google calendars come in through it.")}</Text>
              ))}
          </View>

          {widget.failed && (
            <View style={styles.card}>
              <ErrorBanner message={t("The widget's settings could not be loaded.")} />
              <Button label={t("Try again")} variant="secondary" onPress={() => void widget.reload()} style={styles.retry} />
            </View>
          )}

          {!settings && !widget.failed && <ActivityIndicator color={theme.colors.accent} style={styles.loader} />}

          {settings && (
            <>
              {connected && (
                <>
                  <Text style={styles.sectionLabel}>{t("CALENDARS")}</Text>
                  <View style={styles.card}>
                    <Text style={styles.cardSubtitle}>{t("Switch on what the widget and Today show.")}</Text>
                    {calendarRows(settings.calendars, "calendar")}
                  </View>

                  <Text style={styles.sectionLabel}>{t("REMINDER LISTS")}</Text>
                  <View style={styles.card}>
                    {calendarRows(settings.calendars, "reminders")}
                    <View style={[styles.calendarRow, styles.undatedRow]}>
                      <Text style={styles.calendarTitle}>{t("Reminders without a date")}</Text>
                      <Switch
                        value={settings.includeUndatedTasks}
                        onValueChange={(include) => void widget.update({ includeUndatedTasks: include })}
                        accessibilityLabel={t("Reminders without a date")}
                        {...switchColors}
                      />
                    </View>
                  </View>
                </>
              )}

              <Text style={styles.sectionLabel}>{t("WIDGET LOOK")}</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t("Glass color")}</Text>
                {swatches(
                  GLASS_TINT_OPTIONS,
                  settings.glassTint,
                  (id) => void widget.update({ glassTint: id as WidgetSettings["glassTint"] }),
                  t("Glass color")
                )}
                <Text style={[styles.cardTitle, styles.secondTitle]}>{t("Accent color")}</Text>
                {swatches(
                  WIDGET_ACCENT_OPTIONS,
                  settings.accentColor,
                  (id) => void widget.update({ accentColor: id as WidgetSettings["accentColor"] }),
                  t("Accent color")
                )}
              </View>

              <Text style={styles.sectionLabel}>{t("FOCUS")}</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t("Focus length for ▶")}</Text>
                <Text style={styles.cardSubtitle}>{t("For a task or event without its own length.")}</Text>
                <ChoiceChips
                  options={WIDGET_FOCUS_PRESETS.map((minutes) => ({ value: minutes as number, label: t("{0} min", minutes) }))}
                  value={settings.focusMinutes}
                  onChange={(minutes) => void widget.update({ focusMinutes: minutes })}
                  accessibilityLabel={t("Focus length for ▶")}
                />
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const useStyles = makeStyles((theme) => ({
  flex: {
    flex: 1,
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
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    marginTop: -theme.spacing.sm,
  },
  loader: {
    marginTop: theme.spacing.xl,
  },
  sectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
    marginTop: theme.spacing.sm,
    marginBottom: -theme.spacing.xs,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
  },
  secondTitle: {
    marginTop: theme.spacing.md,
  },
  cardSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "400",
    marginTop: 2,
    marginBottom: theme.spacing.sm,
  },
  cardSubtitleTight: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "400",
    marginTop: 2,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  accountText: {
    flex: 1,
  },
  accountButton: {
    marginTop: theme.spacing.md,
  },
  retry: {
    marginTop: theme.spacing.sm,
  },
  account: {
    marginTop: theme.spacing.sm,
  },
  accountHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  accountTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "700",
  },
  calendarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
  },
  undatedRow: {
    marginTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  calendarDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  calendarTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: theme.spacing.sm,
  },
  swatchRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "transparent",
    padding: 3,
  },
  swatch: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
}));

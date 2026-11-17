import React from "react";
import { ActivityIndicator, Modal, SafeAreaView, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { CalendarAccess } from "../lib/calendarAccess";
import {
  DESKFOCUS_ALLOW_ACTION,
  DESKFOCUS_CARD_TITLE,
  DESKFOCUS_DENIED_ACTION,
  DESKFOCUS_DENIED_MESSAGE,
  DESKFOCUS_SECTION_LABEL,
  DESKFOCUS_SETTINGS_TITLE,
} from "../lib/settingsCopy";
import {
  GLASS_TINT_OPTIONS,
  groupCalendarsByAccount,
  WIDGET_ACCENT_OPTIONS,
  WIDGET_FOCUS_PRESETS,
  WidgetCalendar,
  WidgetCalendarKind,
  WidgetSettings,
  WidgetSettingsPatch,
} from "../lib/widgetSettings";
import { Button } from "./Button";
import { ChoiceChips } from "./ChoiceChips";
import { ErrorBanner } from "./ErrorBanner";
import { t } from "../i18n";

interface Props {
  visible: boolean;
  settings: WidgetSettings | null; // null while loading or after a failed load
  failed: boolean;
  access: CalendarAccess;
  needsAccess: boolean; // calendar or notifications not asked yet
  onAllowAccess: () => void;
  onOpenPhoneSettings: () => void;
  onChange: (patch: WidgetSettingsPatch) => void;
  onRetry: () => void;
  onClose: () => void;
}

interface SwatchOption {
  id: string;
  label: string;
  swatch: string;
}

// The DeskFocus widget's settings inside PaceTasks, opened from Settings or the gear on the widget: which
// calendars and reminder lists it shows (every account on the iPhone), its colors and the focus length for ▶.
// The same calendars show on Today when its calendar button is on. Purely presentational.
export function DeskfocusSettingsSheet({
  visible,
  settings,
  failed,
  access,
  needsAccess,
  onAllowAccess,
  onOpenPhoneSettings,
  onChange,
  onRetry,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const switchColors = {
    trackColor: { false: theme.colors.border, true: theme.colors.accentDark },
    thumbColor: theme.colors.surface,
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
    return accounts.map(({ account, calendars: accountCalendars }) => (
      <View key={account} style={styles.account}>
        <Text style={styles.accountTitle}>{account || t("On this iPhone")}</Text>
        {accountCalendars.map((calendar) => (
          <View key={calendar.key} style={styles.calendarRow}>
            <View style={[styles.calendarDot, { backgroundColor: calendar.colorHex }]} />
            <Text style={styles.calendarTitle} numberOfLines={1}>
              {calendar.title}
            </Text>
            <Switch
              value={calendar.visible}
              onValueChange={(visible) => onChange({ calendarKey: calendar.key, calendarVisible: visible })}
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>{t(DESKFOCUS_SECTION_LABEL)}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {t(DESKFOCUS_SETTINGS_TITLE)}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeButton} accessibilityLabel={t("Close")}>
            <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            {t("What the DeskFocus widget shows next to your PaceTasks tasks, and how it looks.")}
          </Text>

          {access !== "granted" && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t(DESKFOCUS_CARD_TITLE)}</Text>
              {access === "denied" ? (
                <>
                  <Text style={styles.cardSubtitle}>{t(DESKFOCUS_DENIED_MESSAGE)}</Text>
                  <Button label={t(DESKFOCUS_DENIED_ACTION)} variant="secondary" onPress={onOpenPhoneSettings} />
                </>
              ) : (
                <>
                  <Text style={styles.cardSubtitle}>{t("Allow access to pick the calendars and lists the widget shows.")}</Text>
                  {needsAccess && <Button label={t(DESKFOCUS_ALLOW_ACTION)} variant="secondary" onPress={onAllowAccess} />}
                </>
              )}
            </View>
          )}

          {failed && (
            <View style={styles.card}>
              <ErrorBanner message={t("The widget's settings could not be loaded.")} />
              <Button label={t("Try again")} variant="secondary" onPress={onRetry} style={styles.retry} />
            </View>
          )}

          {!settings && !failed && <ActivityIndicator color={theme.colors.accent} style={styles.loader} />}

          {settings && (
            <>
              {access === "granted" && (
                <>
                  <Text style={styles.sectionLabel}>{t("CALENDARS")}</Text>
                  <View style={styles.card}>
                    <Text style={styles.cardSubtitle}>
                      {t("Every account on this iPhone is here, Google and Outlook included. Switch on what the widget and Today show.")}
                    </Text>
                    {calendarRows(settings.calendars, "calendar")}
                  </View>

                  <Text style={styles.sectionLabel}>{t("REMINDER LISTS")}</Text>
                  <View style={styles.card}>
                    {calendarRows(settings.calendars, "reminders")}
                    <View style={[styles.calendarRow, styles.undatedRow]}>
                      <Text style={styles.calendarTitle}>{t("Reminders without a date")}</Text>
                      <Switch
                        value={settings.includeUndatedTasks}
                        onValueChange={(include) => onChange({ includeUndatedTasks: include })}
                        accessibilityLabel={t("Reminders without a date")}
                        {...switchColors}
                      />
                    </View>
                  </View>
                </>
              )}

              <Text style={styles.sectionLabel}>{t("LOOK")}</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t("Glass color")}</Text>
                {swatches(GLASS_TINT_OPTIONS, settings.glassTint, (id) => onChange({ glassTint: id as WidgetSettings["glassTint"] }), t("Glass color"))}
                <Text style={[styles.cardTitle, styles.secondTitle]}>{t("Accent color")}</Text>
                {swatches(WIDGET_ACCENT_OPTIONS, settings.accentColor, (id) => onChange({ accentColor: id as WidgetSettings["accentColor"] }), t("Accent color"))}
              </View>

              <Text style={styles.sectionLabel}>{t("FOCUS")}</Text>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{t("Focus length for ▶")}</Text>
                <Text style={styles.cardSubtitle}>{t("For a task or event without its own length.")}</Text>
                <ChoiceChips
                  options={WIDGET_FOCUS_PRESETS.map((minutes) => ({ value: minutes as number, label: t("{0} min", minutes) }))}
                  value={settings.focusMinutes}
                  onChange={(minutes) => onChange({ focusMinutes: minutes })}
                  accessibilityLabel={t("Focus length for ▶")}
                />
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  eyebrow: {
    color: theme.colors.accentDark,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title.fontSize,
    fontWeight: theme.typography.title.fontWeight,
    fontFamily: theme.typography.title.fontFamily,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
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
  retry: {
    marginTop: theme.spacing.sm,
  },
  account: {
    marginTop: theme.spacing.sm,
  },
  accountTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "700",
    marginBottom: 2,
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

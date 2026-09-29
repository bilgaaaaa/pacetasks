import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../lib/theme";
import { useSettings } from "../hooks/useSettings";
import { Stepper } from "../components/Stepper";
import { syncDailyReminder } from "../lib/notifications";

interface Props {
  userId: string | undefined;
}

const POMODORO_PRESETS: { work: number; break: number; label: string }[] = [
  { work: 15, break: 3, label: "15 + 3" },
  { work: 25, break: 5, label: "25 + 5" },
  { work: 50, break: 10, label: "50 + 10" },
];

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

// Work schedule (feeds the before/after-work task labels), the evening
// reminder, Brain Dump auto-create, and the two settings the Focus timer +
// range timer read (chime + Pomodoro length). "Keep it calm and out of the way" — plain white cards,
// no icons.
export function SettingsScreen({ userId }: Props) {
  const { settings, loading, error, save } = useSettings(userId);
  const [reminderHour, setReminderHour] = useState(18);
  const [reminderMinute, setReminderMinute] = useState(30);

  useEffect(() => {
    if (settings) {
      const { hour, minute } = parseTime(settings.reminder_time);
      setReminderHour(hour);
      setReminderMinute(minute);
    }
  }, [settings?.reminder_time]);

  if (loading || !settings) {
    return (
      <LinearGradient
        colors={[theme.colors.background, theme.colors.backgroundEnd]}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeArea}>
          <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
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
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Keep it calm and out of the way.</Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

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
              trackColor={{ false: theme.colors.border, true: theme.colors.accentDark }}
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
              trackColor={{ false: theme.colors.border, true: theme.colors.accentDark }}
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
              trackColor={{ false: theme.colors.border, true: theme.colors.accentDark }}
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
              trackColor={{ false: theme.colors.border, true: theme.colors.accentDark }}
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
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
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
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.largeTitle.fontSize,
    fontWeight: theme.typography.largeTitle.fontWeight,
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    marginTop: 2,
    marginBottom: theme.spacing.xs,
  },
  errorText: {
    color: theme.colors.danger,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    marginTop: 2,
    marginBottom: theme.spacing.sm,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
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
    fontWeight: "700",
  },
  toggleSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
  },
  segmentedRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingVertical: 10,
  },
  segmentActive: {
    backgroundColor: theme.colors.accentDark,
  },
  segmentText: {
    color: theme.colors.textSecondary,
    fontWeight: "700",
    fontSize: theme.typography.footnote.fontSize,
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
});

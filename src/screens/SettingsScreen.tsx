import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { theme } from "../lib/theme";
import { useSettings } from "../hooks/useSettings";
import { Stepper } from "../components/Stepper";
import { syncDailyReminder } from "../lib/notifications";

interface Props {
  userId: string | undefined;
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

// Two things live here: the work-hours window (so tasks can be tagged
// before/after work) and the single daily reminder notification.
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
      <SafeAreaView style={styles.safeArea}>
        <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
      </SafeAreaView>
    );
  }

  const applyReminderTime = async (hour: number, minute: number) => {
    const time = formatTime(hour, minute);
    await save({ reminder_time: time });
    await syncDailyReminder(settings.reminder_enabled, time);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.headerTitle}>Settings</Text>

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

        <View style={styles.card}>
          <View style={styles.reminderHeader}>
            <Text style={styles.cardTitle}>Daily reminder</Text>
            <Switch
              value={settings.reminder_enabled}
              onValueChange={async (enabled) => {
                await save({ reminder_enabled: enabled });
                await syncDailyReminder(enabled, settings.reminder_time);
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.accent }}
            />
          </View>
          <Text style={styles.cardSubtitle}>
            One nudge a day to check your list — no configuring needed beyond this.
          </Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
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
    fontSize: 26,
    fontWeight: "800",
    marginBottom: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.danger,
    marginBottom: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: "700",
  },
  cardSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    marginBottom: theme.spacing.sm,
  },
  reminderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});

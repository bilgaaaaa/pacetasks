import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../lib/theme";

interface Props {
  tasksToday: number;
  minutesToday: number;
  streakDays: number;
}

// Green completion card appended to the bottom of the task list once every
// task for the day is done. Purely presentational — the numbers come from
// lib/stats.ts's computeStats, same source the Stats tab uses.
export function EndOfDayCard({ tasksToday, minutesToday, streakDays }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>END OF DAY</Text>
      <Text style={styles.title}>Day cleared.{"\n"}Quietly proud.</Text>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{tasksToday}</Text>
          <Text style={styles.statLabel}>tasks</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{minutesToday}</Text>
          <Text style={styles.statLabel}>minutes</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{streakDays}d</Text>
          <Text style={styles.statLabel}>streak</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.accentDark,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  eyebrow: {
    color: "rgba(255,255,255,0.75)",
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
    marginBottom: theme.spacing.xs,
  },
  title: {
    color: "#FFFFFF",
    fontSize: theme.typography.title.fontSize,
    fontWeight: theme.typography.title.fontWeight,
    marginBottom: theme.spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: theme.spacing.lg,
  },
  stat: {
    gap: 2,
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: theme.typography.headline.fontSize,
    fontWeight: "800",
  },
  statLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: theme.typography.footnote.fontSize,
  },
});

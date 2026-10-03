import React from "react";
import { Text, View } from "react-native";
import { makeStyles } from "../hooks/useTheme";

interface Props {
  tasksToday: number;
  minutesToday: number;
  streakDays: number;
}

// Accent completion card appended to the bottom of the task list once every
// task for the day is done. Purely presentational — the numbers come from
// lib/stats.ts's computeStats, same source the Stats tab uses.
export function EndOfDayCard({ tasksToday, minutesToday, streakDays }: Props) {
  const styles = useStyles();
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

const useStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.accentDark,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  eyebrow: {
    color: theme.colors.onAccent,
    opacity: 0.75,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
    marginBottom: theme.spacing.xs,
  },
  title: {
    color: theme.colors.onAccent,
    fontSize: theme.typography.title.fontSize,
    fontWeight: theme.typography.title.fontWeight,
    fontFamily: theme.typography.title.fontFamily,
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
    color: theme.colors.onAccent,
    fontSize: theme.typography.headline.fontSize,
    fontFamily: theme.fonts.mono,
  },
  statLabel: {
    color: theme.colors.onAccent,
    opacity: 0.75,
    fontSize: theme.typography.footnote.fontSize,
  },
}));

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import { ProgressRing } from "./ProgressRing";

interface Props {
  total: number;
  completed: number;
  remaining: number;
}

// Four-pill summary row shown above the quick-add bar: total/completed/
// remaining counts plus a "done %" ring, so the day's progress is visible
// without opening the Stats tab.
export function TaskStatsBar({ total, completed, remaining }: Props) {
  const donePercent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <View style={styles.row}>
      <View style={styles.pill}>
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Ionicons name="list-outline" size={16} color={theme.colors.textSecondary} />
        </View>
        <Text style={styles.value}>{total}</Text>
        <Text style={styles.label}>Tasks today</Text>
      </View>

      <View style={styles.pill}>
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Ionicons name="checkmark" size={16} color={theme.colors.success} />
        </View>
        <Text style={styles.value}>{completed}</Text>
        <Text style={styles.label}>Completed</Text>
      </View>

      <View style={styles.pill}>
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Ionicons name="time-outline" size={16} color={theme.colors.warning} />
        </View>
        <Text style={styles.value}>{remaining}</Text>
        <Text style={styles.label}>Remaining</Text>
      </View>

      <View style={styles.pill}>
        <ProgressRing
          percent={donePercent}
          color={theme.colors.accent}
          trackColor={theme.colors.surfaceAlt}
        />
        <Text style={styles.value}>{donePercent}%</Text>
        <Text style={styles.label}>Done</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  pill: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: "700",
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    textAlign: "center",
  },
});

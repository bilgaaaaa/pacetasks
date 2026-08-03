import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../lib/theme";

interface Props {
  label: string;
  value: string;
  hint?: string;
}

// One tile in the stats grid. Kept dumb on purpose — all the math happens
// in lib/stats.ts, this just renders whatever number it's given.
export function StatCard({ label, value, hint }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: "48%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  value: {
    color: theme.colors.accent,
    fontSize: 28,
    fontWeight: "800",
  },
  label: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    marginTop: 2,
  },
  hint: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
});

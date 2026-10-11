import React from "react";
import { Text, View } from "react-native";
import { makeStyles } from "../hooks/useTheme";

interface Props {
  valueColor?: string;
  label: string;
  value: string;
  hint?: string;
}

// One tile in the stats grid. Kept dumb on purpose — all the math happens
// in lib/stats.ts, this just renders the label and number it's given.
export function StatCard({ valueColor, label, value, hint }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    flexBasis: "48%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 2,
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontFamily: theme.fonts.mono,
    fontVariant: ["tabular-nums"],
    marginTop: theme.spacing.xs,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  hint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "400",
  },
}));

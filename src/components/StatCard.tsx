import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../lib/theme";

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  valueColor?: string;
  label: string;
  value: string;
  hint?: string;
}

// One tile in the stats grid. Kept dumb on purpose — all the math happens
// in lib/stats.ts, this just renders whatever number/icon/color it's given.
// `icon`/`color` are optional so plain uppercase-label cards (no icon, no
// colored border) can reuse this same component.
export function StatCard({ icon, color, valueColor, label, value, hint }: Props) {
  return (
    <View style={[styles.card, color ? { borderTopColor: color, borderTopWidth: 3 } : null]}>
      {icon && color && <Ionicons name={icon} size={20} color={color} />}
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontWeight: "800",
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
    color: theme.colors.textTertiary,
    fontSize: theme.typography.caption.fontSize,
  },
});

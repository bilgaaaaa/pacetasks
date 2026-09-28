import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../lib/theme";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

// Reusable +/- numeric control used for work-hour pickers and reminder time,
// styled with filled Ionicons circles like native iOS stepper affordances.
export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: Props) {
  const displayValue = format ? format(value) : String(value);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => onChange(Math.max(min, value - step))}>
          <Ionicons
            name="remove-circle"
            size={28}
            color={theme.colors.accent}
          />
        </TouchableOpacity>
        <Text style={styles.value}>{displayValue}</Text>
        <TouchableOpacity onPress={() => onChange(Math.min(max, value + step))}>
          <Ionicons name="add-circle" size={28} color={theme.colors.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  label: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    minWidth: 56,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
});

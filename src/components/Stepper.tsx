import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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

// Reusable +/- numeric control used for work-hour pickers and reminder time.
// Kept generic so every "pick a number" input in the app looks identical.
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
        <TouchableOpacity
          style={styles.button}
          onPress={() => onChange(Math.max(min, value - step))}
        >
          <Text style={styles.buttonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.value}>{displayValue}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => onChange(Math.min(max, value + step))}
        >
          <Text style={styles.buttonText}>+</Text>
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
    fontSize: 15,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  value: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    minWidth: 56,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
});

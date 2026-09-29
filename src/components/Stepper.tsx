import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
}

// Reusable +/- numeric control used for work-hour pickers, reminder time and
// the quick-win limit, styled with filled Ionicons circles like native iOS
// stepper affordances.
export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  format,
  onChange,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const displayValue = format ? format(value) : String(value);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          accessibilityLabel={`Decrease ${label}`}
          hitSlop={8}
        >
          <Ionicons
            name="remove-circle"
            size={28}
            color={value <= min ? theme.colors.textTertiary : theme.colors.accent}
          />
        </TouchableOpacity>
        <Text style={styles.value}>{displayValue}</Text>
        <TouchableOpacity
          onPress={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          accessibilityLabel={`Increase ${label}`}
          hitSlop={8}
        >
          <Ionicons
            name="add-circle"
            size={28}
            color={value >= max ? theme.colors.textTertiary : theme.colors.accent}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: theme.spacing.sm,
  },
  label: {
    flex: 1,
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
    fontSize: 15,
    fontFamily: theme.fonts.mono,
    minWidth: 64,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
}));

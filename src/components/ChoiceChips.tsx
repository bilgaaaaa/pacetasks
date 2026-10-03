import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { makeStyles } from "../hooks/useTheme";

interface Option<T> {
  value: T;
  label: string;
}

interface Props<T> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
}

// A row of always-visible chips for picking one option in a single tap. Use it
// where the choice is the screen's main question (time and energy in "What can
// I do now?"); DropdownPill is the control for compact, secondary pickers.
export function ChoiceChips<T>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const styles = useStyles();
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <TouchableOpacity
            key={String(option.value)}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  chip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
  },
  chipSelected: {
    backgroundColor: theme.colors.accentDark,
  },
  chipText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: theme.typography.footnote.fontWeight,
  },
  chipTextSelected: {
    color: theme.colors.onAccent,
    fontWeight: "700",
  },
}));

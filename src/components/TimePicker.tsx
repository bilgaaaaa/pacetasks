import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { quickTimeChoices, shiftMinutes, shiftTime, TIME_MINUTE_STEP } from "../lib/timeOptions";

interface Props {
  value: string; // "HH:MM", 24h
  now: Date; // the phone's clock, for "In 1 hour"
  onChange: (time: string) => void;
}

// A start-time picker that works the same on iPhone and in the web demo: hour
// and minute columns with up/down arrows (minutes in 5-minute steps), plus
// one-tap shortcuts. Purely presentational.
export function TimePicker({ value, now, onChange }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [hour, minute] = value.split(":");

  const column = (label: string, digits: string, onUp: () => void, onDown: () => void) => (
    <View style={styles.column}>
      <TouchableOpacity style={styles.arrow} onPress={onUp} accessibilityRole="button" accessibilityLabel={`Later ${label}`}>
        <Ionicons name="chevron-up" size={22} color={theme.colors.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.digits} accessibilityLabel={`${label} ${digits}`}>
        {digits}
      </Text>
      <TouchableOpacity style={styles.arrow} onPress={onDown} accessibilityRole="button" accessibilityLabel={`Earlier ${label}`}>
        <Ionicons name="chevron-down" size={22} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.clock} accessibilityLabel={`Start time ${value}`}>
        {column("hour", hour, () => onChange(shiftTime(value, 60)), () => onChange(shiftTime(value, -60)))}
        <Text style={styles.colon}>:</Text>
        {column(
          "minutes",
          minute,
          () => onChange(shiftMinutes(value, TIME_MINUTE_STEP)),
          () => onChange(shiftMinutes(value, -TIME_MINUTE_STEP))
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickRow}
        keyboardShouldPersistTaps="handled"
      >
        {quickTimeChoices(now).map((choice) => {
          const selected = choice.time === value;
          return (
            <TouchableOpacity
              key={choice.label}
              style={[styles.quickChip, selected && styles.quickChipSelected]}
              onPress={() => onChange(choice.time)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={choice.label === choice.time ? `At ${choice.time}` : `${choice.label}, ${choice.time}`}
            >
              <Text style={[styles.quickText, selected && styles.quickTextSelected]}>{choice.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  container: {
    gap: theme.spacing.md,
  },
  clock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  column: {
    alignItems: "center",
  },
  arrow: {
    width: 64,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  digits: {
    color: theme.colors.textPrimary,
    fontSize: 44,
    fontFamily: theme.fonts.mono,
    fontVariant: ["tabular-nums"],
    minWidth: 80,
    textAlign: "center",
    paddingVertical: 2,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: "hidden",
  },
  colon: {
    color: theme.colors.textSecondary,
    fontSize: 40,
    fontFamily: theme.fonts.mono,
  },
  quickRow: {
    gap: 6,
  },
  quickChip: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  quickChipSelected: {
    borderColor: theme.colors.accentDark,
    backgroundColor: theme.colors.accentDark,
  },
  quickText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  quickTextSelected: {
    color: theme.colors.onAccent,
  },
}));

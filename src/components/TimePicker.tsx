import React, { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import {
  quickTimeChoices,
  shiftMinutes,
  shiftTime,
  TIME_MINUTE_STEP,
  TimePart,
  withTimePart,
  WorkHours,
} from "../lib/timeOptions";
import { t } from "../i18n";

interface Props extends WorkHours {
  value: string; // "HH:MM", 24h
  now: Date; // the phone's clock, for "In 1 hour"
  onChange: (time: string) => void;
}

// A start-time picker that works the same on iPhone and in the web demo: hour
// and minute fields that can be typed in (any minute) or moved with the arrows
// (minutes in 5-minute steps), plus one-tap shortcuts around the work day.
export function TimePicker({ value, now, workStartHour, workEndHour, onChange }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [hour, minute] = value.split(":");
  // What is being typed; follows the value again as soon as it changes.
  const [typed, setTyped] = useState<Record<TimePart, string>>({ hour, minute });

  useEffect(() => {
    setTyped({ hour, minute });
  }, [hour, minute]);

  // Two digits complete a field; fewer are taken when the field is left.
  const type = (part: TimePart, text: string) => {
    const digits = text.replace(/[^0-9]/g, "");
    setTyped((current) => ({ ...current, [part]: digits }));
    if (digits.length === 2) commit(part, digits);
  };

  const commit = (part: TimePart, text: string) => {
    const next = withTimePart(value, part, text);
    if (next && next !== value) onChange(next);
    else setTyped({ hour, minute });
  };

  const column = (part: TimePart, label: string, onUp: () => void, onDown: () => void) => (
    <View style={styles.column}>
      <TouchableOpacity style={styles.arrow} onPress={onUp} accessibilityRole="button" accessibilityLabel={t("Later {0}", label)}>
        <Ionicons name="chevron-up" size={22} color={theme.colors.textSecondary} />
      </TouchableOpacity>
      <TextInput
        style={styles.digits}
        value={typed[part]}
        onChangeText={(text) => type(part, text)}
        onBlur={() => commit(part, typed[part])}
        onSubmitEditing={() => commit(part, typed[part])}
        keyboardType="number-pad"
        returnKeyType="done"
        maxLength={2}
        selectTextOnFocus
        accessibilityLabel={t("{0}, {1}. Type to change", label, typed[part])}
      />
      <TouchableOpacity style={styles.arrow} onPress={onDown} accessibilityRole="button" accessibilityLabel={t("Earlier {0}", label)}>
        <Ionicons name="chevron-down" size={22} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.clock} accessibilityLabel={t("Start time {0}", value)}>
        {column("hour", t("hour"), () => onChange(shiftTime(value, 60)), () => onChange(shiftTime(value, -60)))}
        <Text style={styles.colon}>:</Text>
        {column(
          "minute",
          t("minutes"),
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
        {quickTimeChoices(now, { workStartHour, workEndHour }).map((choice) => {
          const selected = choice.time === value;
          return (
            <TouchableOpacity
              key={choice.label}
              style={[styles.quickChip, selected && styles.quickChipSelected]}
              onPress={() => onChange(choice.time)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={choice.label === choice.time ? t("At {0}", choice.time) : `${choice.label}, ${choice.time}`}
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

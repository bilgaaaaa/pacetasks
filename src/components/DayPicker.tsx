import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import {
  buildDayStrip,
  buildMonthGrid,
  canShowMonth,
  GRID_WEEKDAYS,
  monthKeyOf,
  monthLabel,
  PickerDay,
  shiftMonth,
} from "../lib/dayPicker";
import { DueChoice, FLEXIBLE_DUE_IDS, FLEXIBLE_DUE_LABELS, isSameDueChoice } from "../lib/dueOptions";

interface Props {
  todayKey: string; // the phone's local day, "YYYY-MM-DD"
  value: DueChoice;
  onChange: (choice: DueChoice) => void;
}

// The "When?" control of the add sheet: the next seven days in one row, a
// button that opens the whole month, and the choices without an exact day
// (any day, this week, next week). Purely presentational.
export function DayPicker({ todayKey, value, onChange }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [monthOpen, setMonthOpen] = useState(false);
  const [shownMonth, setShownMonth] = useState(monthKeyOf(todayKey));

  const selectedDay = value.kind === "day" ? value.dateKey : null;
  const strip = buildDayStrip(todayKey);
  const previousMonth = shiftMonth(shownMonth, -1);
  const nextMonth = shiftMonth(shownMonth, 1);

  // Opening the month starts on the month of the picked day, so the selection is in view.
  const toggleMonth = () => {
    if (!monthOpen) setShownMonth(monthKeyOf(selectedDay ?? todayKey));
    setMonthOpen((open) => !open);
  };

  const dayLabel = (day: PickerDay) => `${day.weekday} ${day.dayOfMonth} ${monthLabel(monthKeyOf(day.key))}`;

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.caption}>{monthOpen ? monthLabel(shownMonth) : "Pick a day"}</Text>
        <View style={styles.toolbarActions}>
          {monthOpen && (
            <>
              <TouchableOpacity
                style={[styles.iconButton, !canShowMonth(previousMonth, todayKey) && styles.disabled]}
                onPress={() => setShownMonth(previousMonth)}
                disabled={!canShowMonth(previousMonth, todayKey)}
                accessibilityRole="button"
                accessibilityLabel="Previous month"
              >
                <Ionicons name="chevron-back" size={18} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.iconButton, !canShowMonth(nextMonth, todayKey) && styles.disabled]}
                onPress={() => setShownMonth(nextMonth)}
                disabled={!canShowMonth(nextMonth, todayKey)}
                accessibilityRole="button"
                accessibilityLabel="Next month"
              >
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={styles.monthToggle}
            onPress={toggleMonth}
            accessibilityRole="button"
            accessibilityState={{ expanded: monthOpen }}
          >
            <Ionicons name="calendar-outline" size={16} color={theme.colors.accentDark} />
            <Text style={styles.monthToggleText}>{monthOpen ? "Show week" : "Whole month"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {monthOpen ? (
        <View style={styles.month} accessibilityRole="radiogroup" accessibilityLabel={monthLabel(shownMonth)}>
          <View style={styles.gridRow}>
            {GRID_WEEKDAYS.map((weekday) => (
              <Text key={weekday} style={styles.gridWeekday}>
                {weekday}
              </Text>
            ))}
          </View>
          {buildMonthGrid(shownMonth, todayKey).map((week, row) => (
            <View key={row} style={styles.gridRow}>
              {week.map((day, column) => {
                if (!day) return <View key={column} style={styles.gridCell} />;
                const isSelected = day.key === selectedDay;
                return (
                  <TouchableOpacity
                    key={day.key}
                    style={styles.gridCell}
                    onPress={() => onChange({ kind: "day", dateKey: day.key })}
                    disabled={day.isPast}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected, disabled: day.isPast }}
                    accessibilityLabel={dayLabel(day)}
                  >
                    <View style={[styles.gridDay, day.isToday && styles.gridDayToday, isSelected && styles.selected]}>
                      <Text
                        style={[styles.gridDayText, day.isPast && styles.gridDayPast, isSelected && styles.textOnAccent]}
                      >
                        {day.dayOfMonth}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.strip} accessibilityRole="radiogroup" accessibilityLabel="The next seven days">
          {strip.map((day) => {
            const isSelected = day.key === selectedDay;
            return (
              <TouchableOpacity
                key={day.key}
                style={[styles.stripDay, isSelected && styles.selected]}
                onPress={() => onChange({ kind: "day", dateKey: day.key })}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={day.isToday ? `Today, ${dayLabel(day)}` : dayLabel(day)}
              >
                <Text style={[styles.stripWeekday, isSelected && styles.textOnAccent]} maxFontSizeMultiplier={1.3}>
                  {day.isToday ? "Today" : day.weekday}
                </Text>
                <Text style={[styles.stripDate, isSelected && styles.textOnAccent]} maxFontSizeMultiplier={1.3}>
                  {day.dayOfMonth}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={styles.caption}>Or no exact day</Text>
      <View style={styles.flexibleRow} accessibilityRole="radiogroup" accessibilityLabel="No exact day">
        {FLEXIBLE_DUE_IDS.map((when) => {
          const isSelected = isSameDueChoice(value, { kind: "flexible", when });
          return (
            <TouchableOpacity
              key={when}
              style={[styles.flexibleChip, isSelected && styles.selected]}
              onPress={() => onChange({ kind: "flexible", when })}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityHint={FLEXIBLE_DUE_LABELS[when].hint}
            >
              <Text style={[styles.flexibleText, isSelected && styles.textOnAccent]}>
                {FLEXIBLE_DUE_LABELS[when].label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {value.kind === "flexible" && <Text style={styles.hint}>{FLEXIBLE_DUE_LABELS[value.when].hint}</Text>}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  container: {
    gap: theme.spacing.sm,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  caption: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.35,
  },
  monthToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: theme.spacing.sm,
  },
  monthToggleText: {
    color: theme.colors.accentDark,
    fontSize: 15,
    fontWeight: "600",
  },
  strip: {
    flexDirection: "row",
    gap: 6,
  },
  stripDay: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  stripWeekday: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "600",
  },
  stripDate: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  selected: {
    borderColor: theme.colors.accentDark,
    backgroundColor: theme.colors.accentDark,
  },
  textOnAccent: {
    color: theme.colors.onAccent,
  },
  month: {
    padding: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  gridRow: {
    flexDirection: "row",
  },
  gridWeekday: {
    flex: 1,
    textAlign: "center",
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "600",
    paddingVertical: 6,
  },
  gridCell: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  gridDay: {
    width: 38,
    height: 38,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  gridDayToday: {
    borderColor: theme.colors.accentDark,
  },
  gridDayText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    fontVariant: ["tabular-nums"],
  },
  gridDayPast: {
    color: theme.colors.textTertiary,
  },
  flexibleRow: {
    flexDirection: "row",
    gap: 6,
  },
  flexibleChip: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  flexibleText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "600",
  },
  hint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "400",
  },
}));

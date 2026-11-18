import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { WeekDay } from "../lib/weekStrip";
import { t } from "../i18n";

interface Props {
  days: WeekDay[];
  onSelectDay: (dayKey: string) => void; // shows that day on the Today screen
  onPreviousWeek: () => void;
  onNextWeek: () => void;
}

function dayLabel(day: WeekDay): string {
  return `${day.weekday} ${day.dayOfMonth}${day.isToday ? t(", today") : ""}${day.dueCount > 0 ? t(", {0} due", day.dueCount) : ""}`;
}

// The shown day's week under the Today hero: today as a filled ink pill, the day on screen outlined, and a dot
// under any day with pending tasks dated there. Every day is a button that shows it; the arrows move a week.
export function WeekStrip({ days, onSelectDay, onPreviousWeek, onNextWeek }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row} accessibilityLabel={t("This week")}>
      <TouchableOpacity
        style={styles.arrow}
        onPress={onPreviousWeek}
        accessibilityRole="button"
        accessibilityLabel={t("Previous week")}
        hitSlop={{ top: 8, bottom: 8 }}
      >
        <Ionicons name="chevron-back" size={18} color={theme.colors.textSecondary} />
      </TouchableOpacity>
      {days.map((day) => (
        <TouchableOpacity
          key={day.key}
          style={[styles.day, day.isSelected && styles.daySelected, day.isToday && styles.dayToday]}
          onPress={() => onSelectDay(day.key)}
          accessibilityRole="button"
          accessibilityState={{ selected: day.isSelected }}
          accessibilityLabel={dayLabel(day)}
          accessibilityHint={t("Shows this day")}
        >
          <Text style={[styles.weekday, day.isToday && styles.textToday]} maxFontSizeMultiplier={1.3}>
            {day.weekday}
          </Text>
          <Text style={[styles.date, day.isToday && styles.textToday]} maxFontSizeMultiplier={1.3}>
            {day.dayOfMonth}
          </Text>
          <View
            style={[styles.dot, day.dueCount > 0 && styles.dotOn, day.isToday && day.dueCount > 0 && styles.dotToday]}
          />
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={styles.arrow}
        onPress={onNextWeek}
        accessibilityRole="button"
        accessibilityLabel={t("Next week")}
        hitSlop={{ top: 8, bottom: 8 }}
      >
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: theme.spacing.md,
  },
  arrow: {
    width: 22,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  day: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  // The day on screen, when it is not today: an accent ring around the plain pill.
  daySelected: {
    borderWidth: 2,
    borderColor: theme.colors.accentDark,
  },
  // Today's pill takes the color theme's hero colors, like the card above.
  dayToday: {
    backgroundColor: theme.hero.todayFill,
    borderColor: theme.hero.todayFill,
  },
  weekday: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  date: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  textToday: {
    color: theme.hero.todayText,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 2,
    backgroundColor: "transparent",
  },
  dotOn: {
    backgroundColor: theme.hero.dot,
  },
  dotToday: {
    backgroundColor: theme.hero.todayDot,
  },
}));

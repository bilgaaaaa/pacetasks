import React from "react";
import { Text, View } from "react-native";
import { makeStyles } from "../hooks/useTheme";
import { WeekDay } from "../lib/weekStrip";

interface Props {
  days: WeekDay[];
}

// This week at a glance under the Today hero: today as a filled ink pill,
// and a dot under any day with pending tasks due. Read-only.
export function WeekStrip({ days }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.row} accessibilityRole="summary" accessibilityLabel="This week">
      {days.map((day) => (
        <View
          key={day.key}
          style={[styles.day, day.isToday && styles.dayToday]}
          accessible
          accessibilityLabel={`${day.weekday} ${day.dayOfMonth}${day.isToday ? ", today" : ""}${
            day.dueCount > 0 ? `, ${day.dueCount} due` : ""
          }`}
        >
          <Text style={[styles.weekday, day.isToday && styles.textToday]} maxFontSizeMultiplier={1.3}>
            {day.weekday}
          </Text>
          <Text style={[styles.date, day.isToday && styles.textToday]} maxFontSizeMultiplier={1.3}>
            {day.dayOfMonth}
          </Text>
          <View style={[styles.dot, day.dueCount > 0 && styles.dotOn, day.isToday && day.dueCount > 0 && styles.dotToday]} />
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: "row",
    gap: 6,
    marginBottom: theme.spacing.md,
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

import React from "react";
import { Text, View } from "react-native";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { AppTheme } from "../lib/theme";
import { Heatmap } from "../lib/stats";

interface Props {
  heatmap: Heatmap;
}

// Level 0-4 -> color, from empty (theme border) to most productive. In dark
// mode the bright accent reads as "more", so the two strongest steps swap.
function levelColors(theme: AppTheme): string[] {
  const { border, accentLight, accent, accentDark } = theme.colors;
  return theme.isDark
    ? [border, accentLight, accentDark, accent, accent]
    : [border, accentLight, accent, accentDark, accentDark];
}

// Weekday-only (Mon-Fri) contribution grid, rendered one row per weekday
// so it reads left-to-right as "oldest week -> this week", matching the
// design's "LAST 13 WEEKS" card.
export function WeekHeatmap({ heatmap }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const colors = levelColors(theme);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>LAST {heatmap.weeks.length} WEEKS</Text>
        <Text style={styles.rangeLabel}>{heatmap.rangeLabel}</Text>
      </View>
      <View style={styles.grid}>
        {[0, 1, 2, 3, 4].map((weekdayIndex) => (
          <View key={weekdayIndex} style={styles.row}>
            {heatmap.weeks.map((week) => {
              const cell = week[weekdayIndex];
              return (
                <View
                  key={cell.date}
                  style={[styles.cell, { backgroundColor: colors[cell.level] }]}
                />
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.sm,
  },
  cardTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  rangeLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "400",
  },
  grid: {
    gap: 4,
  },
  row: {
    flexDirection: "row",
    gap: 4,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 3,
  },
}));

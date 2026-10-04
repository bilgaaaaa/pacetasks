import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { quickWinsMessage, totalsLine } from "../lib/todayCopy";

interface Props {
  count: number;
  totalMinutes: number;
  quickWinCount: number;
  allDone: boolean;
  onPick: () => void;
}

function heroTitle(count: number, quickWinCount: number, allDone: boolean): string {
  if (count === 0) return allDone ? "All done for today" : "A fresh start";
  return quickWinCount > 0 ? "Start with a quick win" : "Ready when you are";
}

// The pastel card at the top of Today: one line on how the day looks, the
// real counts (quick wins first, totals second) and the main action. The
// soft circles are decoration only.
export function TodayHero({ count, totalMinutes, quickWinCount, allDone, onPick }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const quickWins = quickWinsMessage(quickWinCount);
  const totals =
    count === 0
      ? allDone
        ? "Everything's done. Enjoy the rest of your day."
        : "Nothing yet. Add whatever's on your mind."
      : totalsLine(count, totalMinutes);

  return (
    <View style={styles.card}>
      <View style={styles.decorLarge} pointerEvents="none" />
      <View style={styles.decorSmall} pointerEvents="none" />

      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {heroTitle(count, quickWinCount, allDone)}
        </Text>
        <View style={styles.meta}>
          {quickWins && (
            <View style={styles.badge}>
              <Ionicons name="flash" size={13} color={theme.colors.quickText} />
              <Text style={styles.badgeText}>{quickWins}</Text>
            </View>
          )}
          <Text style={styles.totals}>{totals}</Text>
        </View>

        {count > 0 && (
          <TouchableOpacity style={styles.cta} onPress={onPick} accessibilityRole="button">
            <Text style={styles.ctaText}>Pick my next task</Text>
            <View style={styles.ctaIcon}>
              <Ionicons name="arrow-forward" size={16} color={theme.colors.textPrimary} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.quickFill,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: theme.spacing.md,
  },
  decorLarge: {
    position: "absolute",
    width: 168,
    height: 168,
    borderRadius: 84,
    right: -48,
    top: -56,
    backgroundColor: theme.colors.accentLight,
    opacity: 0.45,
  },
  decorSmall: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    right: 52,
    top: 64,
    borderWidth: 10,
    borderColor: theme.colors.accentLight,
    opacity: 0.35,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 10,
  },
  title: {
    color: theme.colors.quickText,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    fontFamily: theme.fonts.display,
    letterSpacing: -0.6,
    maxWidth: "80%",
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: theme.spacing.sm,
    rowGap: 6,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
  },
  badgeText: {
    color: theme.colors.quickText,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "700",
  },
  totals: {
    color: theme.colors.quickText,
    opacity: 0.8,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  // Ink pill like the active tab, so the main action reads as the same family.
  cta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
    paddingLeft: 18,
    paddingRight: 5,
    paddingVertical: 5,
    marginTop: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.textPrimary,
  },
  ctaText: {
    color: theme.colors.surface,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
  },
  ctaIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
}));

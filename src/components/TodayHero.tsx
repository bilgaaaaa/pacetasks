import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { quickWinsMessage, totalsLine } from "../lib/todayCopy";

interface Props {
  greeting: string; // "Good morning", the card's headline
  count: number;
  totalMinutes: number;
  quickWinCount: number;
  allDone: boolean;
  onPick: () => void;
}

// The pastel card at the top of Today: the greeting, the real counts (quick
// wins first, totals second) and the main action. The soft circles are
// decoration only.
export function TodayHero({ greeting, count, totalMinutes, quickWinCount, allDone, onPick }: Props) {
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
          {greeting}
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
          <TouchableOpacity
            style={styles.cta}
            onPress={onPick}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Pick my next task"
          >
            <Ionicons name="sparkles" size={16} color={theme.colors.accentDark} />
            <Text style={styles.ctaText}>Pick my next task</Text>
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
  // A light, full-width pill on the pastel card: the card's own green for
  // the label and icon, a hairline edge and a soft shadow instead of a
  // heavy dark fill.
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  ctaText: {
    color: theme.colors.accentDark,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
}));

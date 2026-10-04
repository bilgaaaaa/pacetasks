import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { makeStyles } from "../hooks/useTheme";
import { totalsLine } from "../lib/todayCopy";

interface Props {
  greeting: string; // "Good morning", the card's headline
  count: number;
  totalMinutes: number;
  allDone: boolean;
  onPick: () => void;
}

// The pastel card at the top of Today: the greeting in capitals, the day's
// totals and the main action. The soft circles are decoration only.
export function TodayHero({ greeting, count, totalMinutes, allDone, onPick }: Props) {
  const styles = useStyles();
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
        <Text style={styles.totals}>{totals}</Text>

        {count > 0 && (
          <TouchableOpacity
            style={styles.cta}
            onPress={onPick}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Pick my next task"
          >
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
    letterSpacing: 0.4,
    textTransform: "uppercase",
    maxWidth: "80%",
  },
  totals: {
    color: theme.colors.quickText,
    opacity: 0.8,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  // One plain, solid pill: no icon, no border, no shadow.
  cta: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentDark,
  },
  ctaText: {
    color: theme.colors.onAccent,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "600",
  },
}));

import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Image, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { HeroMessage } from "../lib/heroCopy";

const GRAIN = require("../assets/grain.png");
// The 128px grain tile, laid out by hand: resizeMode "repeat" isn't honoured
// on web. 4 x 3 tiles cover the card on any phone width.
const GRAIN_TILE = 128;
const GRAIN_TILES = Array.from({ length: 12 }, (_, i) => i);

interface Props {
  message: HeroMessage; // encouraging headline + line, from heroMessage()
  totals: string; // "13 tasks · about 343 min", or "" to hide
  showAction: boolean;
  onPick: () => void;
}

// One slow back-and-forth drift (0 → 1 → 0), forever. Stays still when the
// phone asks for reduced motion.
function useDrift(durationMs: number) {
  const value = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => active && setReduceMotion(enabled))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const half = { duration: durationMs / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true };
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, ...half }),
        Animated.timing(value, { toValue: 0, ...half }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [value, durationMs, reduceMotion]);

  return value;
}

// The Today hero: a deep card with an encouraging line drawn from the real
// state of the day, the totals, and a compact "Pick my next task" button.
// Behind the text, two blobs in two-colour gradients from the active color
// theme (theme.hero) drift slowly under a fine grain. All decoration is non-interactive.
export function TodayHero({ message, totals, showAction, onPick }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const driftA = useDrift(9000);
  const driftB = useDrift(12000);

  const blobAStyle = {
    transform: [
      { translateX: driftA.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
      { translateY: driftA.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) },
      { scale: driftA.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
    ],
  };
  const blobBStyle = {
    transform: [
      { translateX: driftB.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) },
      { translateY: driftB.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) },
    ],
  };

  return (
    <View style={styles.card}>
      <View style={styles.decor} pointerEvents="none">
        <Animated.View style={[styles.blobA, blobAStyle]}>
          <LinearGradient
            colors={theme.hero.blobA}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fill}
          />
        </Animated.View>
        <Animated.View style={[styles.blobB, blobBStyle]}>
          <LinearGradient
            colors={theme.hero.blobB}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fill}
          />
        </Animated.View>
        <View style={styles.grain}>
          {GRAIN_TILES.map((i) => (
            <Image key={i} source={GRAIN} style={styles.grainTile} />
          ))}
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {message.title}
        </Text>
        <Text style={styles.body}>{message.body}</Text>
        {totals !== "" && <Text style={styles.totals}>{totals}</Text>}

        {showAction && (
          <TouchableOpacity
            style={styles.cta}
            onPress={onPick}
            activeOpacity={0.85}
            accessibilityRole="button"
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
    backgroundColor: theme.hero.card,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: theme.spacing.md,
  },
  decor: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  fill: {
    flex: 1,
  },
  // Both blobs sit mostly off the card's right edge so they frame the text
  // instead of running under it.
  blobA: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    overflow: "hidden",
    right: -78,
    top: -64,
    opacity: 0.6,
  },
  blobB: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 56,
    overflow: "hidden",
    right: -24,
    bottom: -52,
    opacity: 0.55,
  },
  grain: {
    position: "absolute",
    top: 0,
    left: 0,
    width: GRAIN_TILE * 4,
    flexDirection: "row",
    flexWrap: "wrap",
    opacity: 0.3,
  },
  grainTile: {
    width: GRAIN_TILE,
    height: GRAIN_TILE,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    gap: 6,
  },
  title: {
    color: theme.hero.title,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "800",
    fontFamily: theme.fonts.display,
    letterSpacing: -0.4,
    maxWidth: "72%",
  },
  body: {
    color: theme.hero.body,
    fontSize: theme.typography.subhead.fontSize,
    lineHeight: 20,
    maxWidth: "76%",
  },
  totals: {
    color: theme.hero.body,
    opacity: 0.6,
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  // A compact pill that hugs its label.
  cta: {
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginTop: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.hero.ctaFill,
  },
  ctaText: {
    color: theme.hero.ctaText,
    fontSize: 14,
    fontWeight: "700",
  },
}));

import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { makeStyles } from "../hooks/useTheme";

interface Props {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
}

const TRACK_WIDTH = 58;
const TRACK_HEIGHT = 34;
const KNOB_SIZE = 28;
const KNOB_INSET = (TRACK_HEIGHT - KNOB_SIZE) / 2;
const KNOB_TRAVEL = TRACK_WIDTH - KNOB_SIZE - KNOB_INSET * 2;
// Mint to blue, the open state of the calendars switch.
const ON_COLORS = ["#7DE8B4", "#5B8DEF"] as const;

// A large on/off switch: a mint-to-blue gradient track when on, a plain track when off, and a white knob that slides.
export function GradientSwitch({ value, onValueChange, accessibilityLabel }: Props) {
  const styles = useStyles();
  const position = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(position, {
      toValue: value ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value, position]);

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { opacity: position }]}>
          <LinearGradient colors={ON_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill} />
        </Animated.View>
        <Animated.View
          style={[
            styles.knob,
            { transform: [{ translateX: position.interpolate({ inputRange: [0, 1], outputRange: [0, KNOB_TRAVEL] }) }] },
          ]}
        />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((theme) => ({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: theme.colors.border,
  },
  // Rounded itself rather than clipped by the track, so the knob's shadow stays visible.
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
  },
  knob: {
    position: "absolute",
    top: KNOB_INSET,
    left: KNOB_INSET,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
}));

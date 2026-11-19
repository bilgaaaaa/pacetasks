import React from "react";
import { Animated, StyleProp, ViewStyle } from "react-native";
import { DaySwipe } from "../hooks/useDaySwipe";

interface Props {
  swipe: DaySwipe;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

// One piece of the shown day's content (a task row, a section heading, the list's foot) that answers a sideways
// swipe. Every piece shares the same gesture and slide, so the day's list moves as one while the hero and the
// week strip above it stay put.
export function DaySwipeArea({ swipe, style, children }: Props) {
  return (
    <Animated.View {...swipe.panHandlers} style={[style, swipe.slideStyle]}>
      {children}
    </Animated.View>
  );
}

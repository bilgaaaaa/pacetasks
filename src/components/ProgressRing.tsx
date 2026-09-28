import React from "react";
import { View } from "react-native";

// NOTE: unused since the "PaceTasks Film" redesign (its stats bar didn't
// carry over). Left in place — and de-dependencied from react-native-svg,
// which was removed — only because files under this project's delivery
// folder can't be deleted from here; safe to delete this file yourself.
interface Props {
  percent: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
}

export function ProgressRing({ percent, size = 36, strokeWidth = 4, color, trackColor }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: clamped > 0 ? color : trackColor,
      }}
    />
  );
}

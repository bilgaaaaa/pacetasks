import React from "react";
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";
import { theme } from "../lib/theme";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary"; // primary = the one main action of a sheet; secondary = the calmer alternatives
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>; // outer layout; the look comes from the variant (a card may swap the secondary fill so it stays visible)
}

// The app's full-width pill button, shared by every sheet so main and secondary
// actions look the same everywhere. Shows a spinner and ignores taps while loading.
export function Button({ label, onPress, variant = "primary", loading = false, disabled = false, style }: Props) {
  const inactive = disabled || loading;
  const isPrimary = variant === "primary";
  return (
    <TouchableOpacity
      style={[styles.button, isPrimary ? styles.primary : styles.secondary, isPrimary && inactive && styles.primaryInactive, style]}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading && <ActivityIndicator color={isPrimary ? theme.colors.onAccent : theme.colors.accentDark} />}
      <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel, !isPrimary && inactive && styles.secondaryLabelInactive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "stretch", // full width even inside a centered layout
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    paddingVertical: theme.spacing.md,
  },
  primary: {
    backgroundColor: theme.colors.accentDark,
  },
  primaryInactive: {
    backgroundColor: theme.colors.textTertiary,
  },
  secondary: {
    backgroundColor: theme.colors.surface,
  },
  label: {
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
  },
  primaryLabel: {
    color: theme.colors.onAccent,
  },
  secondaryLabel: {
    color: theme.colors.textPrimary,
  },
  secondaryLabelInactive: {
    color: theme.colors.textTertiary,
  },
});

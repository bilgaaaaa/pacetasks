import React from "react";
import { ActivityIndicator, StyleProp, Text, TouchableOpacity, ViewStyle } from "react-native";
import { makeStyles, useTheme } from "../hooks/useTheme";

interface Props {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "destructive"; // primary = the one main action; secondary = calmer alternatives; destructive = deletes something
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>; // outer layout; the look comes from the variant (a card may swap the secondary fill so it stays visible)
}

// The app's full-width pill button, shared by every sheet so main, secondary and
// destructive actions look the same everywhere. Shows a spinner and ignores taps while loading.
export function Button({ label, onPress, variant = "primary", loading = false, disabled = false, style }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const inactive = disabled || loading;
  const isPrimary = variant === "primary";
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isPrimary ? styles.primary : styles.secondary,
        isPrimary && inactive && styles.primaryInactive,
        style,
      ]}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
    >
      {loading && <ActivityIndicator color={isPrimary ? theme.colors.onAccent : theme.colors.accentDark} />}
      <Text
        style={[
          styles.label,
          isPrimary ? styles.primaryLabel : styles.secondaryLabel,
          variant === "destructive" && styles.destructiveLabel,
          !isPrimary && inactive && styles.secondaryLabelInactive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const useStyles = makeStyles((theme) => ({
  button: {
    alignSelf: "stretch", // full width even inside a centered layout
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
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
  destructiveLabel: {
    color: theme.colors.danger,
  },
  secondaryLabelInactive: {
    color: theme.colors.textTertiary,
  },
}));

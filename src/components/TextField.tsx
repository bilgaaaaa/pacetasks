import React from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";
import { makeStyles, useTheme } from "../hooks/useTheme";

interface Props extends Omit<TextInputProps, "style" | "placeholderTextColor"> {
  label: string;
  error?: string | null; // one line under the field saying what to fix
}

// A labelled single-line input with room for its error, for forms. The label
// is also the accessibility label, so screen readers announce what the field is.
export function TextField({ label, error, ...inputProps }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputInvalid : null]}
        placeholderTextColor={theme.colors.textTertiary}
        accessibilityLabel={label}
        {...inputProps}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  field: {
    gap: theme.spacing.xs,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: theme.typography.footnote.fontWeight,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
  },
  inputInvalid: {
    borderColor: theme.colors.danger,
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.typography.footnote.fontSize,
  },
}));

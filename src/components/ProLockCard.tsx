import React from "react";
import { Text, View } from "react-native";
import { makeStyles } from "../hooks/useTheme";
import { PRO_SEE_PLANS_LABEL } from "../lib/proCopy";
import { Button } from "./Button";
import { t } from "../i18n";

interface Props {
  eyebrow: string;
  title: string;
  body: string;
  onSeePlans: () => void;
}

// Stands where a Pro feature would be for a free user: what it gives, and a way to the plans. Purely presentational.
export function ProLockCard({ eyebrow, title, body, onSeePlans }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Button label={t(PRO_SEE_PLANS_LABEL)} onPress={onSeePlans} style={styles.button} />
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  eyebrow: {
    color: theme.colors.accentDark,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
  },
  body: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
  },
  button: {
    marginTop: theme.spacing.xs,
  },
}));

import React from "react";
import { Text, View } from "react-native";
import { makeStyles } from "../hooks/useTheme";

interface Props {
  lines: string[]; // one sentence per insight, from paceInsightLines
}

// "My Pace" card on the Stats tab: what the user's own history says about how
// they work, in plain sentences. Purely presentational.
export function PaceInsightsCard({ lines }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>MY PACE</Text>
      {lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
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
  line: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
  },
}));

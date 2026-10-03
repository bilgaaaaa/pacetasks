import React from "react";
import { Text, View } from "react-native";
import { deletionEntryHint, deletionEntryLabel } from "../lib/accountCopy";
import { makeStyles } from "../hooks/useTheme";
import { Button } from "./Button";

interface Props {
  hasAccount: boolean; // a signed-up account, or only this phone's anonymous data
  onDelete: () => void;
}

// Settings card about the user's own data: the way to delete the account (or,
// before sign-up, everything this phone has stored). Purely presentational.
export function DataCard({ hasAccount, onDelete }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Button
        style={styles.secondaryOnCard}
        label={deletionEntryLabel(hasAccount)}
        variant="destructive"
        onPress={onDelete}
      />
      <Text style={styles.hint}>{deletionEntryHint(hasAccount)}</Text>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  // The secondary button's own fill is the card's color, so on a card it uses the nested fill.
  secondaryOnCard: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  hint: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.caption.fontSize,
    textAlign: "center",
  },
}));

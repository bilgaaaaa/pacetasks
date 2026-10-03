import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { deletionEntryHint, deletionEntryLabel, PRIVACY_POLICY_LABEL, SUPPORT_LABEL } from "../lib/accountCopy";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { Button } from "./Button";

interface Props {
  hasAccount: boolean; // a signed-up account, or only this phone's anonymous data
  busy: boolean; // an account change (sign-out, consent) is in flight, so deleting must wait
  onOpenPrivacyPolicy: () => void;
  onOpenSupport: () => void;
  onDelete: () => void;
}

// Settings card about the user's own data: the privacy policy, where to get help,
// and the way to delete the account (or, before sign-up, this phone's data).
export function DataCard({ hasAccount, busy, onOpenPrivacyPolicy, onOpenSupport, onDelete }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const links = [
    { label: PRIVACY_POLICY_LABEL, onPress: onOpenPrivacyPolicy },
    { label: SUPPORT_LABEL, onPress: onOpenSupport },
  ];
  return (
    <View style={styles.card}>
      {links.map((link) => (
        <TouchableOpacity key={link.label} style={styles.linkRow} onPress={link.onPress} accessibilityRole="link">
          <Text style={styles.linkLabel}>{link.label}</Text>
          <Ionicons name="open-outline" size={16} color={theme.colors.textTertiary} />
        </TouchableOpacity>
      ))}
      <Button
        style={styles.buttonOnCard}
        label={deletionEntryLabel(hasAccount)}
        variant="destructive"
        disabled={busy}
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
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  linkLabel: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
  },
  // The button's own fill is the card's color, so on a card it uses the nested fill.
  buttonOnCard: {
    backgroundColor: theme.colors.surfaceAlt,
    marginTop: theme.spacing.xs,
  },
  hint: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.caption.fontSize,
    textAlign: "center",
  },
}));

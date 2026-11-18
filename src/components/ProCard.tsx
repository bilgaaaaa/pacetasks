import React from "react";
import { Text, View } from "react-native";
import { makeStyles } from "../hooks/useTheme";
import { ProStatus } from "../lib/pro";
import { PRO_MANAGE_LABEL, PRO_RESTORE_LABEL, PRO_SEE_PLANS_LABEL, proStatusLine } from "../lib/proCopy";
import { Button } from "./Button";
import { t } from "../i18n";

interface Props {
  status: ProStatus;
  restoring: boolean;
  message: string | null; // a restore that found nothing or failed
  onSeePlans: () => void;
  onRestore: () => void;
  onManage: () => void;
}

// Settings card for Pro: what the user has, then the plans and restore for a free user, or managing a subscription.
export function ProCard({ status, restoring, message, onSeePlans, onRestore, onManage }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Text style={styles.status}>{proStatusLine(status)}</Text>
      {!status.active && (
        <>
          <Button label={t(PRO_SEE_PLANS_LABEL)} onPress={onSeePlans} />
          <Button
            label={t(PRO_RESTORE_LABEL)}
            variant="secondary"
            loading={restoring}
            onPress={onRestore}
            style={styles.onCard}
          />
        </>
      )}
      {message && <Text style={styles.message}>{message}</Text>}
      {status.active && !status.lifetime && (
        <Button label={t(PRO_MANAGE_LABEL)} variant="secondary" onPress={onManage} style={styles.onCard} />
      )}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  status: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
  },
  message: {
    color: theme.colors.danger,
    fontSize: theme.typography.subhead.fontSize,
  },
  // The button's own fill is the card's color, so on a card it uses the nested fill.
  onCard: {
    backgroundColor: theme.colors.surfaceAlt,
  },
}));

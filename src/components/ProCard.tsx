import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ProEntitlement } from "@domain/pro";
import { makeStyles, useTheme } from "../hooks/useTheme";
import {
  MANAGE_LABEL,
  PRO_FREE_CARD_ACTION,
  PRO_FREE_CARD_TITLE,
  PRO_SIRI_HINT,
  proFreeCardSubtitle,
  proStatusLine,
} from "../lib/proCopy";
import { Button } from "./Button";

interface Props {
  isPro: boolean;
  entitlement: ProEntitlement | null;
  trialDays: number | null; // the free trial this user can still take, from the default plan
  onOpenPaywall: () => void;
  onManage: () => void;
}

// Settings card for PaceTasks Pro. Free users see what Pro adds and open the
// paywall; subscribers see their plan, how to use Siri and where to manage it.
// Purely presentational — state comes from usePro.
export function ProCard({ isPro, entitlement, trialDays, onOpenPaywall, onManage }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();

  if (!isPro) {
    return (
      <View style={styles.card}>
        <View style={styles.titleRow}>
          <Ionicons name="mic-outline" size={20} color={theme.colors.accentDark} />
          <Text style={styles.title}>{PRO_FREE_CARD_TITLE}</Text>
        </View>
        <Text style={styles.subtitle}>{proFreeCardSubtitle(trialDays)}</Text>
        <Button label={PRO_FREE_CARD_ACTION} onPress={onOpenPaywall} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Ionicons name="checkmark-circle" size={20} color={theme.colors.accentDark} />
        <Text style={styles.title}>PaceTasks Pro</Text>
      </View>
      <Text style={styles.subtitle}>{proStatusLine(entitlement, new Date())}</Text>
      <Text style={styles.hint}>{PRO_SIRI_HINT}</Text>
      <Button style={styles.secondaryOnCard} label={MANAGE_LABEL} variant="secondary" onPress={onManage} />
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
  },
  hint: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.caption.fontSize,
  },
  // The secondary button's own fill is the card's color, so on a card it uses the nested fill.
  secondaryOnCard: {
    backgroundColor: theme.colors.surfaceAlt,
  },
}));

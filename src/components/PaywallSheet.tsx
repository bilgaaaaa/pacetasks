import React from "react";
import { ActivityIndicator, Modal, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { PaywallState } from "../hooks/usePro";
import { openExternalLink, PRIVACY_POLICY_URL } from "../lib/links";
import { Plan, ProStatus } from "../lib/pro";
import {
  PLAN_BADGES,
  PLAN_NAMES,
  planButtonLabel,
  planPriceLine,
  PRO_ACTIVE_TITLE,
  PRO_FEATURE_REASONS,
  PRO_INCLUDES,
  PRO_LEGAL,
  PRO_MANAGE_LABEL,
  PRO_PLANS_LOADING,
  PRO_PRIVACY_LABEL,
  PRO_RESTORE_LABEL,
  PRO_SKIP_LABEL,
  PRO_SUBTITLE,
  PRO_TERMS_LABEL,
  PRO_TITLE,
  proStatusLine,
} from "../lib/proCopy";
import { Button } from "./Button";

// Apple's standard licence, the Terms of Use App Review expects next to subscriptions.
const TERMS_OF_USE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

interface Props {
  paywall: PaywallState;
  status: ProStatus;
  onPurchase: (plan: Plan) => void;
  onRestore: () => void;
  onManage: () => void;
  onRetry: () => void;
  onClose: () => void;
}

// The plans screen in the Sapphire style: a card per plan with its checklist and button, "Not now" to skip.
// A Pro user sees what they have instead of buy buttons. Purely presentational; the flow lives in usePro.
export function PaywallSheet({ paywall, status, onPurchase, onRestore, onManage, onRetry, onClose }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const busy = paywall.busyPlanId !== null || paywall.restoring;

  return (
    <Modal visible={paywall.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} disabled={busy} accessibilityRole="button" style={styles.skip}>
            <Text style={styles.skipText}>{PRO_SKIP_LABEL}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.icon}>
            <Ionicons name="sparkles" size={26} color={theme.colors.onAccent} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {status.active ? PRO_ACTIVE_TITLE : PRO_TITLE}
          </Text>
          <Text style={styles.subtitle}>
            {status.active
              ? proStatusLine(status)
              : paywall.reason
                ? PRO_FEATURE_REASONS[paywall.reason]
                : PRO_SUBTITLE}
          </Text>

          {status.active ? (
            !status.lifetime && <Button label={PRO_MANAGE_LABEL} variant="secondary" onPress={onManage} />
          ) : (
            <>
              {paywall.plans === null && (
                <View style={styles.loading}>
                  <ActivityIndicator color={theme.colors.accent} />
                  <Text style={styles.muted}>{PRO_PLANS_LOADING}</Text>
                </View>
              )}

              {paywall.plans?.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  loading={paywall.busyPlanId === plan.id}
                  disabled={busy}
                  onPress={() => onPurchase(plan)}
                />
              ))}

              {paywall.message && (
                <View style={styles.message}>
                  <Text style={styles.messageText}>{paywall.message}</Text>
                  {paywall.plans?.length === 0 && <Button label="Try again" variant="secondary" onPress={onRetry} />}
                </View>
              )}

              <Button
                label={PRO_RESTORE_LABEL}
                variant="secondary"
                loading={paywall.restoring}
                disabled={busy}
                onPress={onRestore}
              />
              <Text style={styles.legal}>{PRO_LEGAL}</Text>
              <View style={styles.links}>
                <Text style={styles.link} onPress={() => openExternalLink(TERMS_OF_USE_URL)} accessibilityRole="link">
                  {PRO_TERMS_LABEL}
                </Text>
                <Text style={styles.muted}>·</Text>
                <Text style={styles.link} onPress={() => openExternalLink(PRIVACY_POLICY_URL)} accessibilityRole="link">
                  {PRO_PRIVACY_LABEL}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// One plan: name and badge, price line, what's included, and its own button; the yearly plan is highlighted.
function PlanCard({
  plan,
  loading,
  disabled,
  onPress,
}: {
  plan: Plan;
  loading: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = useStyles();
  const badge = PLAN_BADGES[plan.id];
  const highlighted = badge !== undefined;

  return (
    <View style={[styles.card, highlighted && styles.cardHighlighted]}>
      <View style={styles.cardHeader}>
        <Text style={styles.planName}>{PLAN_NAMES[plan.id]}</Text>
        {badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.planPrice}>{planPriceLine(plan)}</Text>
      <View style={styles.checklist}>
        {PRO_INCLUDES.map((item) => (
          <View key={item} style={styles.checkRow}>
            <Ionicons name="checkmark-circle" size={18} color={theme.colors.accentDark} />
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
      </View>
      <Button
        label={planButtonLabel(plan)}
        variant={highlighted ? "primary" : "secondary"}
        loading={loading}
        disabled={disabled}
        onPress={onPress}
      />
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  skip: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  },
  skipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "600",
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  icon: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...theme.typography.largeTitle,
    color: theme.colors.textPrimary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginBottom: theme.spacing.sm,
  },
  loading: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  cardHighlighted: {
    borderWidth: 2,
    borderColor: theme.colors.accent,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  planName: {
    ...theme.typography.title,
    color: theme.colors.textPrimary,
  },
  badge: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    ...theme.typography.caption,
    color: theme.colors.onAccent,
  },
  planPrice: {
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
    color: theme.colors.textPrimary,
  },
  checklist: {
    gap: theme.spacing.xs,
    marginVertical: theme.spacing.xs,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.sm,
  },
  checkText: {
    flex: 1,
    fontSize: theme.typography.subhead.fontSize,
    color: theme.colors.textSecondary,
  },
  message: {
    gap: theme.spacing.sm,
  },
  messageText: {
    fontSize: theme.typography.subhead.fontSize,
    color: theme.colors.danger,
    textAlign: "center",
  },
  legal: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.textTertiary,
    textAlign: "center",
  },
  links: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  link: {
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: theme.typography.footnote.fontWeight,
    color: theme.colors.accentDark,
  },
  muted: {
    fontSize: theme.typography.footnote.fontSize,
    color: theme.colors.textTertiary,
  },
}));

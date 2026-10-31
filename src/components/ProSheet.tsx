import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import {
  PRO_EYEBROW,
  PRO_LOAD_FAILED,
  PRO_PLAN_NAMES,
  PRO_SUBTITLE,
  PRO_TITLE,
  PRO_UNAVAILABLE_MESSAGE,
  PRO_WELCOME_HINT,
  PRO_WELCOME_TITLE,
  RESTORE_LABEL,
  planHint,
  planPriceLabel,
  proFeatures,
  purchaseButtonLabel,
  purchaseFinePrint,
  savingsBadge,
} from "../lib/proCopy";
import { DEFAULT_PRO_PLAN } from "../lib/proPlans";
import type { ProPlan, ProPlanId } from "../lib/proPlans";
import { Button } from "./Button";
import { ErrorBanner } from "./ErrorBanner";

interface Props {
  visible: boolean;
  available: boolean;
  isPro: boolean;
  aiBrainDump: boolean;
  plans: ProPlan[];
  plansState: "loading" | "ready" | "failed";
  busy: "purchase" | "restore" | null;
  errorMessage: string | null;
  notice: string | null;
  onPurchase: (planId: ProPlanId) => void;
  onRestore: () => void;
  onReloadPlans: () => void;
  onOpenTerms: () => void;
  onOpenPrivacyPolicy: () => void;
  onClose: () => void;
}

// The PaceTasks Pro paywall: what Pro adds, the two plans (yearly first), the
// trial and its terms next to the button, restore, and the legal links Apple
// requires. Once the user is Pro it turns into a short welcome. Purely presentational.
export function ProSheet({
  visible,
  available,
  isPro,
  aiBrainDump,
  plans,
  plansState,
  busy,
  errorMessage,
  notice,
  onPurchase,
  onRestore,
  onReloadPlans,
  onOpenTerms,
  onOpenPrivacyPolicy,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [selectedId, setSelectedId] = useState<ProPlanId>(DEFAULT_PRO_PLAN);

  // Falls back to the first plan the store returned when the default one is missing.
  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[0] ?? null;
  useEffect(() => {
    if (visible) setSelectedId(DEFAULT_PRO_PLAN);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>{PRO_EYEBROW}</Text>
            <Text style={styles.title} accessibilityRole="header">
              {isPro ? PRO_WELCOME_TITLE : PRO_TITLE}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeButton} accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>{isPro ? PRO_WELCOME_HINT : PRO_SUBTITLE}</Text>

          <View style={styles.features}>
            {proFeatures(aiBrainDump).map((feature) => (
              <View key={feature.title} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Ionicons name={feature.icon} size={20} color={theme.colors.accentDark} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDetail}>{feature.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          {isPro ? (
            <Button label="Done" onPress={onClose} />
          ) : !available ? (
            <View style={styles.messageCard}>
              <Text style={styles.messageText}>{PRO_UNAVAILABLE_MESSAGE}</Text>
            </View>
          ) : plansState === "loading" ? (
            <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
          ) : plansState === "failed" || plans.length === 0 ? (
            <View style={styles.messageCard}>
              <Text style={styles.messageText}>{PRO_LOAD_FAILED}</Text>
              <Button label="Try again" variant="secondary" style={styles.secondaryOnCard} onPress={onReloadPlans} />
            </View>
          ) : (
            <>
              <View style={styles.plans} accessibilityRole="radiogroup" accessibilityLabel="Plan">
                {plans.map((plan) => {
                  const isActive = plan.id === selected?.id;
                  const badge = savingsBadge(plan);
                  const hint = planHint(plan);
                  return (
                    <TouchableOpacity
                      key={plan.id}
                      style={[styles.planRow, isActive && styles.planRowActive]}
                      onPress={() => setSelectedId(plan.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`${PRO_PLAN_NAMES[plan.id]}, ${planPriceLabel(plan)}`}
                    >
                      <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                        {isActive && <View style={styles.radioInner} />}
                      </View>
                      <View style={styles.flex}>
                        <View style={styles.planNameRow}>
                          <Text style={styles.planName}>{PRO_PLAN_NAMES[plan.id]}</Text>
                          {badge && (
                            <View style={styles.badge}>
                              <Text style={styles.badgeText}>{badge}</Text>
                            </View>
                          )}
                        </View>
                        {hint && <Text style={styles.planHint}>{hint}</Text>}
                      </View>
                      <Text style={styles.planPrice}>{planPriceLabel(plan)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {errorMessage && <ErrorBanner message={errorMessage} />}

              <Button
                label={purchaseButtonLabel(selected)}
                loading={busy === "purchase"}
                disabled={!selected || busy !== null}
                onPress={() => selected && onPurchase(selected.id)}
              />
              <Text style={styles.finePrint}>{purchaseFinePrint(selected)}</Text>
            </>
          )}

          {!isPro && available && (
            <>
              {notice && <Text style={styles.notice}>{notice}</Text>}
              <TouchableOpacity
                onPress={onRestore}
                disabled={busy !== null}
                style={styles.restore}
                accessibilityRole="button"
              >
                {busy === "restore" ? (
                  <ActivityIndicator color={theme.colors.accentDark} />
                ) : (
                  <Text style={styles.linkText}>{RESTORE_LABEL}</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.legalRow}>
            <TouchableOpacity onPress={onOpenTerms} accessibilityRole="link">
              <Text style={styles.legalText}>Terms of Use</Text>
            </TouchableOpacity>
            <Text style={styles.legalText}>·</Text>
            <TouchableOpacity onPress={onOpenPrivacyPolicy} accessibilityRole="link">
              <Text style={styles.legalText}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  eyebrow: {
    color: theme.colors.accentDark,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title.fontSize,
    fontWeight: theme.typography.title.fontWeight,
    fontFamily: theme.typography.title.fontFamily,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
  },
  features: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
  },
  featureDetail: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    marginTop: 2,
  },
  loader: {
    marginVertical: theme.spacing.lg,
  },
  messageCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  messageText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
  },
  // The secondary button's own fill is the card's color, so on a card it uses the nested fill.
  secondaryOnCard: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  plans: {
    gap: theme.spacing.sm,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: theme.colors.surface,
  },
  planRowActive: {
    borderColor: theme.colors.accentDark,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.textTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterActive: {
    borderColor: theme.colors.accentDark,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.accentDark,
  },
  planNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  planName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
  },
  badge: {
    backgroundColor: theme.colors.quickFill,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: theme.colors.quickText,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "700",
  },
  planHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    marginTop: 2,
  },
  planPrice: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "700",
    fontFamily: theme.fonts.mono,
    fontVariant: ["tabular-nums"],
  },
  finePrint: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.caption.fontSize,
    textAlign: "center",
  },
  notice: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    textAlign: "center",
  },
  restore: {
    alignSelf: "center",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
  },
  linkText: {
    color: theme.colors.accentDark,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "600",
  },
  legalRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  legalText: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.caption.fontSize,
  },
}));

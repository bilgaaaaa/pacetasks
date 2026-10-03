import React from "react";
import { Modal, SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ResetAction, ResetItem, ResetOutcome, ResetReason } from "@domain/weeklyReset";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { actionLabel, introLines, itemReason, progressLabel, summaryLine } from "../lib/weeklyResetCopy";
import { WeeklyResetPhase } from "../lib/weeklyResetState";
import { Button } from "./Button";
import { ErrorBanner } from "./ErrorBanner";

// Move decisions, laid out two per row; delete and keep sit below them.
const MOVE_ACTION_ROWS: ResetAction[][] = [
  ["today", "tomorrow"],
  ["weekend", "someday"],
];

interface Props {
  visible: boolean;
  phase: WeeklyResetPhase;
  pendingCount: number;
  reasonCounts: Record<ResetReason, number>;
  item: ResetItem | null;
  index: number;
  total: number;
  tally: Record<ResetOutcome, number> | null;
  saving: boolean;
  todayKey: string;
  errorMessage: string | null; // a failed save from the task list, which this sheet covers
  onStart: () => void;
  onDecide: (action: ResetAction) => void;
  onClose: () => void;
}

// Full-screen sheet for Weekly Reset: says what it found, then shows one task at
// a time with the decisions for it, and closes with what was done. Purely
// presentational — the items and every transition come from useWeeklyReset.
export function WeeklyResetSheet({
  visible,
  phase,
  pendingCount,
  reasonCounts,
  item,
  index,
  total,
  tally,
  saving,
  todayKey,
  errorMessage,
  onStart,
  onDecide,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            {phase === "reviewing" ? `WEEKLY RESET · ${progressLabel(index, total).toUpperCase()}` : "WEEKLY RESET"}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeButton} accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {phase === "intro" && (
          <View style={styles.body}>
            <View style={styles.center}>
              {pendingCount > 0 ? (
                <>
                  <Text style={styles.title}>Let's clean up your brain.</Text>
                  {introLines(reasonCounts).map((line) => (
                    <Text key={line} style={styles.meta}>
                      {line}
                    </Text>
                  ))}
                </>
              ) : (
                <>
                  <Text style={styles.title}>Nothing to clean up.</Text>
                  <Text style={styles.meta}>Your list is in good shape.</Text>
                </>
              )}
            </View>
            <View style={styles.actions}>
              {pendingCount > 0 ? (
                <Button label="Start" onPress={onStart} />
              ) : (
                <Button label="Close" onPress={onClose} />
              )}
            </View>
          </View>
        )}

        {phase === "reviewing" && item && (
          <View style={styles.body}>
            <View style={styles.center}>
              <Text style={styles.title}>{item.task.title}</Text>
              <Text style={styles.meta}>{itemReason(item, todayKey)}</Text>
            </View>
            <View style={styles.actions}>
              {errorMessage && <ErrorBanner message={errorMessage} />}
              {MOVE_ACTION_ROWS.map((row) => (
                <View key={row.join("-")} style={styles.actionRow}>
                  {row.map((action) => (
                    <Button
                      key={action}
                      style={styles.action}
                      variant="secondary"
                      label={actionLabel(action)}
                      disabled={saving}
                      onPress={() => onDecide(action)}
                    />
                  ))}
                </View>
              ))}
              <View style={styles.actionRow}>
                <Button
                  style={styles.action}
                  variant="destructive"
                  label={actionLabel("delete")}
                  disabled={saving}
                  onPress={() => onDecide("delete")}
                />
                <Button
                  style={styles.action}
                  variant="secondary"
                  label={actionLabel("keep")}
                  disabled={saving}
                  onPress={() => onDecide("keep")}
                />
              </View>
            </View>
          </View>
        )}

        {phase === "summary" && tally && (
          <View style={styles.body}>
            <View style={styles.center}>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark" size={32} color={theme.colors.onAccent} />
              </View>
              <Text style={styles.title}>Reset done.</Text>
              <Text style={styles.meta}>{summaryLine(tally) || "Nothing needed changing."}</Text>
            </View>
            <View style={styles.actions}>
              <Button label="Close" onPress={onClose} />
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  eyebrow: {
    color: theme.colors.accentDark,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.largeTitle.fontSize,
    fontWeight: theme.typography.largeTitle.fontWeight,
    fontFamily: theme.typography.largeTitle.fontFamily,
    textAlign: "center",
  },
  meta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    textAlign: "center",
  },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentDark,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.sm,
  },
  actions: {
    gap: theme.spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  action: {
    flex: 1,
  },
}));

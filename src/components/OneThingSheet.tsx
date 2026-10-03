import React from "react";
import { Modal, SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TASK_LIMITS } from "@domain/task";
import { OneThingPhase } from "../hooks/useOneThing";
import { oneThingEmptyMessage, oneThingMeta, remainingLabel } from "../lib/oneThingCopy";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { Task } from "../lib/types";
import { Button } from "./Button";
import { ErrorBanner } from "./ErrorBanner";
import { Stepper } from "./Stepper";

interface Props {
  visible: boolean;
  phase: OneThingPhase;
  task: Task | null;
  remainingCount: number;
  skippedCount: number;
  minutes: number;
  saving: boolean;
  completedTitle: string | null;
  todayKey: string;
  errorMessage: string | null; // a failed save from the task list, which this sheet covers
  onChangeMinutes: (minutes: number) => void;
  onSkip: () => void;
  onResetSkipped: () => void;
  onStartConfirm: () => void;
  onCancelConfirm: () => void;
  onConfirm: () => void;
  onNext: () => void;
  onClose: () => void;
}

// Full-screen sheet for One Thing mode: no list, just the single task to do now.
// "Done" asks how long it took, then offers the next one. Purely presentational —
// the task and every transition come from useOneThing.
export function OneThingSheet({
  visible,
  phase,
  task,
  remainingCount,
  skippedCount,
  minutes,
  saving,
  completedTitle,
  todayKey,
  errorMessage,
  onChangeMinutes,
  onSkip,
  onResetSkipped,
  onStartConfirm,
  onCancelConfirm,
  onConfirm,
  onNext,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ONE THING</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeButton} accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {phase === "completed" ? (
          <View style={styles.body}>
            <View style={styles.center}>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark" size={32} color={theme.colors.onAccent} />
              </View>
              <Text style={styles.title}>Done.</Text>
              <Text style={styles.meta}>{completedTitle}</Text>
            </View>
            <View style={styles.actions}>
              {task ? (
                <>
                  <Button label="Next one" onPress={onNext} />
                  <Button label="That's enough for now" variant="secondary" onPress={onClose} />
                </>
              ) : (
                <>
                  <Text style={styles.footnote}>{oneThingEmptyMessage(skippedCount)}</Text>
                  <Button label="Close" onPress={onClose} />
                </>
              )}
            </View>
          </View>
        ) : task ? (
          <View style={styles.body}>
            <View style={styles.center}>
              <Text style={styles.title}>{task.title}</Text>
              <Text style={styles.meta}>{oneThingMeta(task, todayKey)}</Text>
              {task.notes && <Text style={styles.notes}>{task.notes}</Text>}
            </View>
            {phase === "confirming" ? (
              <View style={styles.actions}>
                <View style={styles.card}>
                  <Stepper
                    label="It took"
                    value={minutes}
                    min={TASK_LIMITS.minEstimatedMinutes}
                    max={TASK_LIMITS.maxEstimatedMinutes}
                    format={(value) => `${value} min`}
                    onChange={onChangeMinutes}
                  />
                </View>
                {errorMessage && <ErrorBanner message={errorMessage} />}
                <Button label={saving ? "Saving…" : "Log it"} loading={saving} onPress={onConfirm} />
                <Button label="Not finished yet" variant="secondary" disabled={saving} onPress={onCancelConfirm} />
              </View>
            ) : (
              <View style={styles.actions}>
                <Text style={styles.footnote}>{remainingLabel(remainingCount)}</Text>
                <Button label="Done" onPress={onStartConfirm} />
                <Button label="Not now" variant="secondary" onPress={onSkip} />
              </View>
            )}
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.center}>
              <Text style={styles.meta}>{oneThingEmptyMessage(skippedCount)}</Text>
            </View>
            <View style={styles.actions}>
              {skippedCount > 0 && <Button label="Start over" onPress={onResetSkipped} />}
              <Button label="Close" variant={skippedCount > 0 ? "secondary" : "primary"} onPress={onClose} />
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
  notes: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    textAlign: "center",
    marginTop: theme.spacing.sm,
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
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  footnote: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: theme.typography.footnote.fontWeight,
    textAlign: "center",
    marginBottom: theme.spacing.xs,
  },
}));

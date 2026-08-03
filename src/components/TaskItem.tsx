import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../lib/theme";
import { Task } from "../lib/types";

const TIMING_LABELS: Record<Task["timing"], string> = {
  before_work: "Before work",
  after_work: "After work",
  anytime: "Anytime",
};

interface Props {
  task: Task;
  onComplete: (taskId: string, actualMinutes: number) => void;
  onDelete: (taskId: string) => void;
}

// A single row in the task list. Completing a task asks for the real time
// spent (defaulting to the original estimate) so the stats screen can show
// how well the user's estimates matched reality.
export function TaskItem({ task, onComplete, onDelete }: Props) {
  const [confirmingMinutes, setConfirmingMinutes] = useState(
    task.estimated_minutes
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const isDone = task.status === "done";

  if (isDone) {
    return (
      <View style={[styles.row, styles.rowDone]}>
        <Text style={styles.titleDone}>{task.title}</Text>
        <Text style={styles.metaDone}>
          est {task.estimated_minutes}m · actual {task.actual_minutes}m
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.mainLine}>
        <Text style={styles.title}>{task.title}</Text>
        <Text style={styles.meta}>
          {TIMING_LABELS[task.timing]} · {task.estimated_minutes}m
        </Text>
      </View>

      {isConfirming ? (
        <View style={styles.confirmRow}>
          <TouchableOpacity
            onPress={() =>
              setConfirmingMinutes((m) => Math.max(1, m - 1))
            }
            style={styles.stepperButton}
          >
            <Text style={styles.stepperText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{confirmingMinutes}m</Text>
          <TouchableOpacity
            onPress={() => setConfirmingMinutes((m) => m + 1)}
            style={styles.stepperButton}
          >
            <Text style={styles.stepperText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => onComplete(task.id, confirmingMinutes)}
          >
            <Text style={styles.confirmButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => setIsConfirming(true)}
          >
            <Text style={styles.completeButtonText}>Complete</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(task.id)}>
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  rowDone: {
    opacity: 0.5,
  },
  mainLine: {
    gap: 2,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  titleDone: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    textDecorationLine: "line-through",
  },
  meta: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  metaDone: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  completeButton: {
    backgroundColor: theme.colors.success,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
  },
  completeButtonText: {
    color: theme.colors.background,
    fontWeight: "700",
  },
  deleteText: {
    color: theme.colors.danger,
    fontSize: 13,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  stepperValue: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    minWidth: 36,
    textAlign: "center",
  },
  confirmButton: {
    marginLeft: "auto",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
  },
  confirmButtonText: {
    color: theme.colors.background,
    fontWeight: "700",
  },
});

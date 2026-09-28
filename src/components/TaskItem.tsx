import React, { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { theme } from "../lib/theme";
import { Task } from "../lib/types";
import { getCategory } from "../lib/categories";

const TIMING_LABELS: Record<Task["timing"], string> = {
  before_work: "Before work",
  after_work: "After work",
  anytime: "Anytime",
};

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface Props {
  task: Task;
  pomodoroWorkMinutes: number;
  pomodoroBreakMinutes: number;
  suggestedMin: number; // range-timer lower bound (from task history, falls back to estimated_minutes)
  suggestedMax: number; // range-timer upper bound
  chimeEnabled: boolean;
  onComplete: (taskId: string, actualMinutes: number) => void;
  onDelete: (taskId: string) => void;
  onStartFocus: (task: Task) => void;
}

// A single row in the task list. Three ways to log time on a task:
// 1) tap the circle any time to open the manual actual-minutes stepper,
// 2) tap the minutes pill to start a simple range timer (counts down from
//    the task's suggested max, turns green once past the suggested min),
// 3) tap FOCUS (only on tasks with a fixed scheduled_time) for the full
//    Pomodoro modal instead — the range timer is hidden for those, since
//    Focus mode already covers timing them.
export function TaskItem({
  task,
  pomodoroWorkMinutes,
  pomodoroBreakMinutes,
  suggestedMin,
  suggestedMax,
  chimeEnabled,
  onComplete,
  onDelete,
  onStartFocus,
}: Props) {
  const [confirmingMinutes, setConfirmingMinutes] = useState(
    task.estimated_minutes
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const [isTiming, setIsTiming] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDone = task.status === "done";
  const categoryLabel = task.category ? getCategory(task.category).label : null;
  const maxSeconds = Math.max(1, suggestedMax) * 60;
  const minSeconds = Math.max(0, suggestedMin) * 60;
  const inRange = maxSeconds - remainingSeconds >= minSeconds;

  const stopTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setIsTiming(false);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startTimer = () => {
    setRemainingSeconds(maxSeconds);
    setIsTiming(true);
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsTiming(false);
          if (chimeEnabled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
              () => {}
            );
          }
          setConfirmingMinutes(Math.round(maxSeconds / 60));
          setIsConfirming(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const openConfirm = () => {
    if (isTiming) {
      const elapsedMinutes = Math.max(1, Math.round((maxSeconds - remainingSeconds) / 60));
      stopTimer();
      setConfirmingMinutes(elapsedMinutes);
    }
    setIsConfirming(true);
  };

  const subtitle = task.scheduled_time
    ? `${task.scheduled_time} · Pomodoro ${pomodoroWorkMinutes}+${pomodoroBreakMinutes}`
    : categoryLabel
    ? `${TIMING_LABELS[task.timing]} · ${categoryLabel}`
    : TIMING_LABELS[task.timing];

  const showMenu = () => {
    Alert.alert(task.title, undefined, [
      { text: "Delete", style: "destructive", onPress: () => onDelete(task.id) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const menuButton = (
    <TouchableOpacity
      style={styles.menuChip}
      onPress={showMenu}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.textTertiary} />
    </TouchableOpacity>
  );

  if (isDone) {
    return (
      <View style={styles.row}>
        <View style={[styles.checkCircle, styles.checkCircleDone]}>
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        </View>
        <View style={styles.mainLine}>
          <Text style={styles.titleDone}>{task.title}</Text>
          <Text style={styles.metaDone}>{subtitle}</Text>
        </View>
        <Text style={styles.minutesDone}>{task.actual_minutes}m</Text>
        {menuButton}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <TouchableOpacity onPress={openConfirm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <View style={styles.checkCircle} />
      </TouchableOpacity>

      <View style={styles.mainLine}>
        <Text style={styles.title}>{task.title}</Text>
        <Text style={styles.meta}>{subtitle}</Text>
      </View>

      {isConfirming ? (
        <View style={styles.confirmRow}>
          <TouchableOpacity
            onPress={() => setConfirmingMinutes((m) => Math.max(1, m - 1))}
          >
            <Ionicons name="remove-circle" size={24} color={theme.colors.accent} />
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{confirmingMinutes}m</Text>
          <TouchableOpacity onPress={() => setConfirmingMinutes((m) => m + 1)}>
            <Ionicons name="add-circle" size={24} color={theme.colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => onComplete(task.id, confirmingMinutes)}
          >
            <Text style={styles.confirmButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {task.scheduled_time ? (
            <TouchableOpacity style={styles.focusBadge} onPress={() => onStartFocus(task)}>
              <Text style={styles.focusBadgeText}>FOCUS</Text>
            </TouchableOpacity>
          ) : isTiming ? (
            <TouchableOpacity onPress={stopTimer}>
              <Text
                style={[
                  styles.timerText,
                  { color: inRange ? theme.colors.accentDark : theme.colors.textSecondary },
                ]}
              >
                {formatClock(remainingSeconds)} left
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={startTimer}>
              <Text style={styles.minutes}>{task.estimated_minutes} min</Text>
            </TouchableOpacity>
          )}
          {menuButton}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  checkCircleDone: {
    borderWidth: 0,
    backgroundColor: theme.colors.accentDark,
    alignItems: "center",
    justifyContent: "center",
  },
  mainLine: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: "700",
  },
  titleDone: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  meta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "400",
  },
  metaDone: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.footnote.fontSize,
  },
  minutes: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "600",
  },
  minutesDone: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "600",
  },
  timerText: {
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  focusBadge: {
    backgroundColor: theme.colors.accentDark,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  focusBadgeText: {
    color: "#FFFFFF",
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  stepperValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.footnote.fontSize,
    minWidth: 32,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  confirmButton: {
    marginLeft: theme.spacing.xs,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: theme.typography.footnote.fontSize,
  },
  menuChip: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
});

import React, { useEffect, useRef, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { Task } from "../lib/types";
import { categoryColor, getCategory } from "../lib/categories";
import { formatDueLabel } from "../lib/dueLabel";
import { TIMING_LABELS, isQuickWin } from "../lib/taskSections";
import { toLocalDateKey } from "@domain/dates";

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
  quickWinMinutes: number; // tasks this short get the highlighted "quick win" pill
  chimeEnabled: boolean;
  onComplete: (taskId: string, actualMinutes: number) => void;
  onDelete: (taskId: string) => void;
  onPark: (taskId: string) => void; // "Move to Someday": parks the task out of the daily lists
  onStartFocus: (task: Task) => void;
}

// A single row in the task list. Three ways to log time on a task:
// 1) tap the circle any time to open the manual actual-minutes stepper,
// 2) tap the minutes pill to start a simple range timer (counts down from
//    the task's suggested max, turns green once past the suggested min),
// 3) tap the Focus pill (only on tasks with a fixed scheduled_time) for the
//    full Pomodoro modal instead — the range timer is hidden for those, since
//    Focus mode already covers timing them.
export function TaskItem({
  task,
  pomodoroWorkMinutes,
  pomodoroBreakMinutes,
  suggestedMin,
  suggestedMax,
  quickWinMinutes,
  chimeEnabled,
  onComplete,
  onDelete,
  onPark,
  onStartFocus,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [confirmingMinutes, setConfirmingMinutes] = useState(
    task.estimated_minutes
  );
  const [isConfirming, setIsConfirming] = useState(false);
  const [isTiming, setIsTiming] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isDone = task.status === "done";
  const category = task.category ? getCategory(task.category) : null;
  const quickWin = isQuickWin(task, quickWinMinutes);
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

  const baseSubtitle = task.scheduled_time
    ? `${task.scheduled_time} · Pomodoro ${pomodoroWorkMinutes}+${pomodoroBreakMinutes}`
    : category
    ? `${TIMING_LABELS[task.timing]} · ${category.label}`
    : TIMING_LABELS[task.timing];
  // Due day and "maybe" come first when set (e.g. from Brain Dump): "by Fri · maybe · Anytime · Work".
  const dueLabel =
    task.due_date && !isDone ? formatDueLabel(task.due_date, task.due_kind, toLocalDateKey(new Date())) : null;
  const restSubtitle = [task.flexible && !isDone ? "maybe" : null, baseSubtitle].filter(Boolean).join(" · ");

  const showMenu = () => {
    Alert.alert(task.title, undefined, [
      ...(isDone ? [] : [{ text: "Move to Someday", onPress: () => onPark(task.id) }]),
      { text: "Delete", style: "destructive" as const, onPress: () => onDelete(task.id) },
      { text: "Cancel", style: "cancel" as const },
    ]);
  };

  const categoryDot = category ? (
    <View style={[styles.categoryDot, { backgroundColor: categoryColor(category, theme) }]} />
  ) : null;

  if (isDone) {
    return (
      <View style={[styles.row, styles.rowDone]}>
        <View style={styles.checkTarget}>
          <View style={[styles.checkCircle, styles.checkCircleDone]}>
            <Ionicons name="checkmark" size={15} color={theme.colors.onAccent} />
          </View>
        </View>
        <View style={styles.mainLine}>
          <Text style={styles.titleDone} numberOfLines={2}>{task.title}</Text>
          <Text style={styles.metaDone} numberOfLines={1}>{restSubtitle}</Text>
        </View>
        <Text style={styles.minutesDone}>{task.actual_minutes ?? task.estimated_minutes} min</Text>
        <TouchableOpacity style={styles.menuButton} onPress={showMenu} accessibilityLabel={`Options for ${task.title}`}>
          <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.textTertiary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.checkTarget}
        onPress={openConfirm}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: false }}
        accessibilityLabel={`Complete ${task.title}`}
      >
        <View style={styles.checkCircle} />
      </TouchableOpacity>

      <View style={styles.mainLine}>
        <Text style={styles.title} numberOfLines={2}>{task.title}</Text>
        <View style={styles.metaRow}>
          {categoryDot}
          <Text style={styles.meta} numberOfLines={1}>
            {dueLabel && (
              <Text style={dueLabel === "Overdue" ? styles.metaOverdue : styles.metaDue}>
                {dueLabel}
                {restSubtitle ? " · " : ""}
              </Text>
            )}
            {restSubtitle}
          </Text>
        </View>
      </View>

      {isConfirming ? (
        <View style={styles.confirmRow}>
          <TouchableOpacity
            onPress={() => setConfirmingMinutes((m) => Math.max(1, m - 1))}
            accessibilityLabel="One minute less"
          >
            <Ionicons name="remove-circle" size={26} color={theme.colors.accent} />
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{confirmingMinutes}m</Text>
          <TouchableOpacity onPress={() => setConfirmingMinutes((m) => m + 1)} accessibilityLabel="One minute more">
            <Ionicons name="add-circle" size={26} color={theme.colors.accent} />
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
            <TouchableOpacity
              style={[styles.pill, styles.pillFocus]}
              onPress={() => onStartFocus(task)}
              accessibilityLabel={`Start focus session for ${task.title}`}
            >
              <Text style={[styles.pillText, styles.pillTextFocus]}>Focus {task.scheduled_time}</Text>
            </TouchableOpacity>
          ) : isTiming ? (
            <TouchableOpacity
              style={[styles.pill, inRange && styles.pillQuick]}
              onPress={stopTimer}
              accessibilityLabel="Stop timer"
            >
              <Text style={[styles.pillText, inRange && styles.pillTextQuick]}>
                {formatClock(remainingSeconds)}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.pill, quickWin && styles.pillQuick]}
              onPress={startTimer}
              accessibilityLabel={`Start ${task.estimated_minutes} minute timer`}
            >
              <Text style={[styles.pillText, quickWin && styles.pillTextQuick]}>{task.estimated_minutes} min</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.menuButton} onPress={showMenu} accessibilityLabel={`Options for ${task.title}`}>
            <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.textTertiary} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 60,
    paddingVertical: 6,
    paddingRight: 4,
    marginBottom: theme.spacing.sm,
    gap: 4,
  },
  rowDone: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  checkTarget: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.75,
    borderColor: theme.colors.textTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircleDone: {
    borderColor: theme.colors.accentDark,
    backgroundColor: theme.colors.accentDark,
  },
  mainLine: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
  },
  titleDone: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "500",
    textDecorationLine: "line-through",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  meta: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "400",
  },
  metaDue: {
    fontWeight: "600",
  },
  metaOverdue: {
    color: theme.colors.danger,
    fontWeight: "600",
  },
  metaDone: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.footnote.fontSize,
  },
  pill: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  pillQuick: {
    backgroundColor: theme.colors.quickFill,
  },
  pillFocus: {
    backgroundColor: theme.colors.textPrimary,
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontFamily: theme.fonts.mono,
    fontVariant: ["tabular-nums"],
  },
  pillTextQuick: {
    color: theme.colors.quickText,
  },
  pillTextFocus: {
    color: theme.colors.surface,
  },
  minutesDone: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.footnote.fontSize,
    fontFamily: theme.fonts.mono,
    fontVariant: ["tabular-nums"],
  },
  confirmRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
  },
  stepperValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.footnote.fontSize,
    fontFamily: theme.fonts.mono,
    minWidth: 32,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  confirmButton: {
    marginLeft: theme.spacing.xs,
    backgroundColor: theme.colors.accentDark,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    height: 32,
    justifyContent: "center",
  },
  confirmButtonText: {
    color: theme.colors.onAccent,
    fontWeight: "700",
    fontSize: theme.typography.footnote.fontSize,
  },
  menuButton: {
    width: 36,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
}));

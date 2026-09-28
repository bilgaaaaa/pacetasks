import React, { useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { theme } from "../lib/theme";
import { Task } from "../lib/types";

interface Props {
  task: Task | null;
  sessionIndex: number; // 1-based position of this task among today's Focus tasks
  sessionTotal: number; // how many Focus tasks are scheduled today
  workMinutes: number;
  breakMinutes: number;
  chimeEnabled: boolean; // "Timer chime" setting — played as a haptic pulse (no audio asset pipeline in this build)
  onClose: () => void;
  onComplete: (taskId: string, actualMinutes: number) => void;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// Full-screen Pomodoro countdown, opened by tapping a task's FOCUS badge.
// Counts down from `workMinutes`; reaching zero auto-completes the task
// (actual_minutes = workMinutes) so the "estimate accuracy" stat still gets
// a real data point for Focus tasks, same as manually confirmed ones.
export function FocusSessionModal({
  task,
  sessionIndex,
  sessionTotal,
  workMinutes,
  breakMinutes,
  chimeEnabled,
  onClose,
  onComplete,
}: Props) {
  const [remainingSeconds, setRemainingSeconds] = useState(workMinutes * 60);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset the countdown whenever a new task is opened into focus mode.
  useEffect(() => {
    if (task) setRemainingSeconds(workMinutes * 60);
  }, [task?.id, workMinutes]);

  useEffect(() => {
    if (!task) return;
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [task?.id]);

  useEffect(() => {
    if (task && remainingSeconds === 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (chimeEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
          () => {}
        );
      }
      onComplete(task.id, workMinutes);
    }
  }, [remainingSeconds, task, chimeEnabled, workMinutes, onComplete]);

  if (!task) return null;

  const totalSeconds = workMinutes * 60;
  const elapsedFraction = 1 - remainingSeconds / totalSeconds;

  const handleClose = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onClose();
  };

  return (
    <Modal visible={!!task} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            FOCUS · SESSION {sessionIndex} OF {sessionTotal}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fixedTime}>{task.scheduled_time} · fixed time</Text>
        <Text style={styles.taskTitle}>{task.title}</Text>

        <View style={styles.timerCard}>
          <Text style={styles.countdown}>{formatClock(remainingSeconds)}</Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { flex: elapsedFraction || 0.0001 }]} />
            <View style={{ flex: 1 - elapsedFraction || 0.0001 }} />
          </View>

          <View style={styles.segmentRow}>
            {Array.from({ length: sessionTotal }, (_, i) => {
              const segmentNumber = i + 1;
              if (segmentNumber < sessionIndex) {
                return <View key={i} style={[styles.segment, styles.segmentDone]} />;
              }
              if (segmentNumber === sessionIndex) {
                return (
                  <View key={i} style={[styles.segment, styles.segmentTrack]}>
                    <View
                      style={[styles.segmentFill, { flex: elapsedFraction || 0.0001 }]}
                    />
                    <View style={{ flex: 1 - elapsedFraction || 0.0001 }} />
                  </View>
                );
              }
              return <View key={i} style={[styles.segment, styles.segmentUpcoming]} />;
            })}
          </View>

          <Text style={styles.caption}>
            A {breakMinutes} minute break follows this session.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.lg,
  },
  eyebrow: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
  },
  closeButton: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
    fontSize: theme.typography.footnote.fontSize,
  },
  fixedTime: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    marginBottom: 4,
  },
  taskTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title.fontSize,
    fontWeight: theme.typography.title.fontWeight,
    marginBottom: theme.spacing.lg,
  },
  timerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
  },
  countdown: {
    color: theme.colors.textPrimary,
    fontSize: 64,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    marginBottom: theme.spacing.md,
  },
  progressTrack: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  progressFill: {
    backgroundColor: theme.colors.accent,
  },
  segmentRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  segment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    flexDirection: "row",
  },
  segmentDone: {
    backgroundColor: theme.colors.accentDark,
  },
  segmentUpcoming: {
    backgroundColor: theme.colors.border,
  },
  segmentTrack: {
    backgroundColor: theme.colors.border,
  },
  segmentFill: {
    backgroundColor: theme.colors.accentLight,
  },
  caption: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
  },
});

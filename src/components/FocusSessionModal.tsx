import React, { useEffect, useRef, useState } from "react";
import { Modal, SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { makeStyles, useTheme } from "../hooks/useTheme";
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

// Full-screen Pomodoro countdown, opened by tapping a task's Focus pill.
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
  const { theme } = useTheme();
  const styles = useStyles();
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
  const elapsedMinutes = Math.floor((totalSeconds - remainingSeconds) / 60);

  const handleClose = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    onClose();
  };

  return (
    <Modal visible={!!task} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose} accessibilityLabel="Close focus session">
              <Ionicons name="chevron-down" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.eyebrow}>
              FOCUS · SESSION {sessionIndex} OF {sessionTotal}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <Text style={styles.fixedTime}>{task.scheduled_time} · fixed time</Text>
          <Text style={styles.taskTitle}>{task.title}</Text>

          <View style={styles.clockArea}>
            <Text style={styles.countdown}>{formatClock(remainingSeconds)}</Text>
            <Text style={styles.caption}>
              {elapsedMinutes} min in · a {breakMinutes} minute break follows
            </Text>
          </View>

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

          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => onComplete(task.id, Math.max(1, Math.round((totalSeconds - remainingSeconds) / 60)))}
          >
            <Ionicons name="checkmark" size={20} color={theme.colors.onAccent} />
            <Text style={styles.doneButtonText}>Done early</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: theme.spacing.xl,
  },
  headerSpacer: {
    width: 44,
  },
  eyebrow: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  fixedTime: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    marginBottom: 4,
  },
  taskTitle: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    fontWeight: theme.typography.title.fontWeight,
    fontFamily: theme.typography.title.fontFamily,
  },
  clockArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
  },
  countdown: {
    color: theme.colors.textPrimary,
    fontSize: 88,
    fontFamily: theme.fonts.mono,
    fontVariant: ["tabular-nums"],
    letterSpacing: -2,
  },
  caption: {
    color: theme.colors.textSecondary,
    fontSize: 15,
  },
  progressTrack: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
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
    marginBottom: theme.spacing.lg,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
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
  doneButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    height: 56,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentDark,
  },
  doneButtonText: {
    color: theme.colors.onAccent,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: "600",
  },
}));

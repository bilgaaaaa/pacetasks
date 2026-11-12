import React from "react";
import { Modal, SafeAreaView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { FocusSessionView } from "../hooks/useFocusSession";
import { formatClock } from "../lib/countdown";
import { Task } from "../lib/types";
import { Button } from "./Button";

interface Props {
  task: Task | null;
  session: FocusSessionView | null; // null for the moment between tapping Focus and the session starting
  sessionIndex: number; // 1-based position of this task among today's Focus tasks; 0 for a task without a fixed time
  sessionTotal: number; // how many Focus tasks are scheduled today
  workMinutes: number; // shown until the session reports its own length
  breakMinutes: number;
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
  onDoneEarly: (taskId: string, actualMinutes: number) => void;
}

// A long title shrinks before it is cut off, so it never pushes the clock off the screen.
const LONG_TITLE_MIN_SCALE = 0.6;

// Full-screen Focus countdown (focus minutes, then a break), opened by tapping a task's Focus pill or by a session started in the widget.
// It only shows the session from useFocusSession, which keeps time while the phone is locked, schedules the
// "time is up" alert and, on iOS, shares the session with the DeskFocus widget and the Live Activity.
export function FocusSessionModal({
  task,
  session,
  sessionIndex,
  sessionTotal,
  workMinutes,
  breakMinutes,
  onClose,
  onPause,
  onResume,
  onDoneEarly,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles();

  if (!task) return null;

  const totalSeconds = session?.plannedSeconds ?? workMinutes * 60;
  const remainingSeconds = session?.remainingSeconds ?? totalSeconds;
  const elapsedSeconds = Math.max(0, totalSeconds - remainingSeconds);
  const elapsedFraction = totalSeconds > 0 ? elapsedSeconds / totalSeconds : 0;
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const isPaused = session?.phase === "paused";
  // A session started in the widget can be for a task without a fixed time, which is not one of today's Focus slots.
  const isScheduledSession = sessionIndex > 0;

  return (
    <Modal visible={!!task} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close focus session">
              <Ionicons name="chevron-down" size={20} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.eyebrow}>
              {isScheduledSession ? `FOCUS · SESSION ${sessionIndex} OF ${sessionTotal}` : "FOCUS"}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          {task.scheduled_time && <Text style={styles.fixedTime}>{task.scheduled_time} · fixed time</Text>}
          <Text style={styles.taskTitle} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={LONG_TITLE_MIN_SCALE}>
            {task.title}
          </Text>

          <View style={styles.clockArea}>
            <Text style={styles.countdown}>{formatClock(remainingSeconds)}</Text>
            <Text style={styles.caption}>
              {isPaused ? "Paused" : `${elapsedMinutes} min in`} · a {breakMinutes} minute break follows
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { flex: elapsedFraction || 0.0001 }]} />
            <View style={{ flex: 1 - elapsedFraction || 0.0001 }} />
          </View>

          <View style={styles.segmentRow}>
            {isScheduledSession && Array.from({ length: sessionTotal }, (_, i) => {
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

          <Button
            label={isPaused ? "Resume" : "Pause"}
            variant="secondary"
            onPress={isPaused ? onResume : onPause}
            disabled={!session}
            style={styles.pauseButton}
          />

          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => onDoneEarly(task.id, Math.max(1, Math.round(elapsedSeconds / 60)))}
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
  pauseButton: {
    marginBottom: theme.spacing.sm,
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

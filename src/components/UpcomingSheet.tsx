import React, { useRef } from "react";
import { Modal, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { UpcomingDay } from "@domain/todayTasks";
import { makeStyles, useTheme } from "../hooks/useTheme";
import {
  MOVE_TO_TODAY_LABEL,
  UPCOMING_EMPTY,
  UPCOMING_EYEBROW,
  UPCOMING_SUBTITLE,
  UPCOMING_TITLE,
  upcomingDayCount,
  upcomingDayHeading,
} from "../lib/upcomingCopy";
import { Task } from "../lib/types";
import { ErrorBanner } from "./ErrorBanner";
import { TaskActionRow } from "./TaskActionRow";

interface Props {
  visible: boolean;
  days: UpcomingDay[]; // from selectUpcomingTasks + groupUpcomingByDay, nearest day first
  todayKey: string;
  focusDayKey: string | null; // the day to open on (a tap in the week strip); null opens at the top
  errorMessage: string | null; // a failed save from the task list, which this sheet covers
  onMoveToToday: (task: Task) => void;
  onDelete: (taskId: string) => void; // already confirmed by the row
  onClose: () => void;
}

// Full-screen sheet listing the tasks set for a later day, grouped by that day.
// Today hides them until their day comes, so this is where they can be seen,
// pulled onto Today or deleted. Purely presentational — the list and the
// actions come from the screen.
export function UpcomingSheet({
  visible,
  days,
  todayKey,
  focusDayKey,
  errorMessage,
  onMoveToToday,
  onDelete,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const scrollView = useRef<ScrollView>(null);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>{UPCOMING_EYEBROW}</Text>
            <Text style={styles.title}>{UPCOMING_TITLE}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeButton} accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollView} style={styles.flex} contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>{UPCOMING_SUBTITLE}</Text>

          {errorMessage && <ErrorBanner style={styles.error} message={errorMessage} />}

          {days.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{UPCOMING_EMPTY}</Text>
            </View>
          ) : (
            days.map((day) => (
              <View
                key={day.dateKey}
                // The day asked for is brought to the top as soon as its position is known.
                onLayout={
                  day.dateKey === focusDayKey
                    ? (event) => scrollView.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false })
                    : undefined
                }
              >
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle} accessibilityRole="header">
                    {upcomingDayHeading(day.dateKey, todayKey)}
                  </Text>
                  <Text style={styles.dayMeta}>{upcomingDayCount(day.tasks.length)}</Text>
                </View>
                {day.tasks.map((task) => (
                  <TaskActionRow
                    key={task.id}
                    task={task}
                    actionLabel={MOVE_TO_TODAY_LABEL}
                    onAction={onMoveToToday}
                    onDelete={onDelete}
                  />
                ))}
              </View>
            ))
          )}
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
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
  },
  error: {
    marginTop: theme.spacing.md,
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  dayTitle: {
    flexShrink: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
  },
  dayMeta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: theme.typography.footnote.fontWeight,
  },
  empty: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    textAlign: "center",
  },
}));

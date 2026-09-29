import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  SectionList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { Task } from "../lib/types";
import { useTasks } from "../hooks/useTasks";
import { useSettings } from "../hooks/useSettings";
import { useBrainDump } from "../hooks/useBrainDump";
import { computeStats } from "../lib/stats";
import { GROUP_BY_LABELS, GROUP_BY_OPTIONS } from "../lib/appearance";
import { groupTodayTasks, summarizePending } from "../lib/taskSections";
import { selectUsuals } from "../lib/taskRhythm";
import { buildTaskHistory, findExactMatch } from "@domain/taskHistory";
import { selectTodayTasks } from "@domain/todayTasks";
import { toLocalDateKey } from "@domain/dates";
import { AddTaskSheet } from "../components/AddTaskSheet";
import { TaskItem } from "../components/TaskItem";
import { FocusSessionModal } from "../components/FocusSessionModal";
import { EndOfDayCard } from "../components/EndOfDayCard";
import { BrainDumpSheet } from "../components/BrainDumpSheet";

interface Props {
  userId: string | undefined;
}

interface ListSection {
  key: string;
  title: string;
  totalMinutes: number;
  data: Task[];
}

// iOS can't present a new Modal while the previous one is still animating away.
const MODAL_SWITCH_DELAY_MS = 350;

function greetingEyebrow(): string {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const hour = now.getHours();
  const part = hour < 12 ? "GOOD MORNING" : hour < 18 ? "GOOD AFTERNOON" : "GOOD EVENING";
  return `${day} · ${part}`;
}

// Home screen: today's tasks split into the sections the user picked (all in
// one list, or by size, place, category, time of day), with a summary of how small the
// day really is, and an always-visible capture bar that opens the add sheet
// (plus Brain Dump for many tasks at once). Each task can be timed with a
// lightweight range timer or, for fixed-time tasks, the Focus/Pomodoro modal.
// An end-of-day card appears once nothing is left pending.
export function TaskListScreen({ userId }: Props) {
  const { theme, appearance, updateAppearance } = useTheme();
  const styles = useStyles();
  const { tasks, loading, error, refresh, create, applyCreated, complete, remove, clearCompleted } =
    useTasks(userId);
  const { settings } = useSettings(userId);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const brainDump = useBrainDump({ onTasksCreated: applyCreated });
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (switchTimer.current) clearTimeout(switchTimer.current);
    };
  }, []);

  const closeBrainDump = () => {
    brainDump.close();
    setBrainDumpOpen(false);
  };

  const openBrainDumpFromAdd = () => {
    setAddOpen(false);
    if (switchTimer.current) clearTimeout(switchTimer.current);
    switchTimer.current = setTimeout(() => setBrainDumpOpen(true), MODAL_SWITCH_DELAY_MS);
  };

  const history = useMemo(() => buildTaskHistory(tasks), [tasks]);
  const stats = useMemo(() => computeStats(tasks), [tasks]);

  // "Today" is the phone's local calendar day; recomputed on every render so a
  // list left open past midnight updates on the next foreground reload.
  const todayKey = toLocalDateKey(new Date());
  const usuals = useMemo(() => selectUsuals(tasks, todayKey), [tasks, todayKey]);
  const { pending, done: completedTasks } = useMemo(
    () => selectTodayTasks(tasks, todayKey),
    [tasks, todayKey]
  );
  // The Done section only shows what was finished today; older history lives on the Pace tab.
  const done = useMemo(
    () => completedTasks.filter((t) => t.completed_at && toLocalDateKey(new Date(t.completed_at)) === todayKey),
    [completedTasks, todayKey]
  );
  const hasCompleted = completedTasks.length > 0;
  const allDone = pending.length + done.length > 0 && pending.length === 0;
  const summary = summarizePending(pending, appearance.quickWinMinutes);

  const sections: ListSection[] = useMemo(() => {
    const grouped = groupTodayTasks(pending, appearance.groupBy, appearance.quickWinMinutes).map(
      ({ key, title, totalMinutes, tasks: sectionTasks }) => ({ key, title, totalMinutes, data: sectionTasks })
    );
    if (done.length > 0) {
      grouped.push({
        key: "done",
        title: "Done",
        totalMinutes: done.reduce((total, t) => total + (t.actual_minutes ?? t.estimated_minutes), 0),
        data: done,
      });
    }
    return grouped;
  }, [pending, done, appearance.groupBy, appearance.quickWinMinutes]);

  // Today's Focus tasks (any task with a fixed start time) ordered by that time —
  // this is what "SESSION X OF Y" in the Focus modal counts against.
  const focusTasksToday = useMemo(
    () =>
      [...pending, ...done]
        .filter((t) => t.scheduled_time)
        .sort((a, b) => (a.scheduled_time! < b.scheduled_time! ? -1 : 1)),
    [pending, done]
  );
  const focusSessionIndex = focusTask
    ? focusTasksToday.findIndex((t) => t.id === focusTask.id) + 1
    : 0;

  const openMenu = () => {
    const options: any[] = [];
    if (hasCompleted) {
      options.push({
        text: "Clear completed tasks",
        style: "destructive",
        onPress: clearCompleted,
      });
    }
    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Options", hasCompleted ? undefined : "No completed tasks yet.", options);
  };

  const summaryText =
    summary.count === 0
      ? allDone
        ? "Everything's done. Enjoy the rest of your day."
        : "Nothing yet. Add whatever's on your mind."
      : `${summary.count} left, about ${summary.totalMinutes} min.`;

  return (
    <LinearGradient
      colors={[theme.colors.background, theme.colors.backgroundEnd]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.eyebrow}>{greetingEyebrow()}</Text>
            <TouchableOpacity onPress={openMenu} style={styles.menuButton} accessibilityLabel="List options">
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Today</Text>
          <Text style={styles.summary}>
            <Text style={styles.summaryStrong}>{summaryText}</Text>
            {summary.quickWinCount > 0 &&
              ` ${summary.quickWinCount} ${summary.quickWinCount === 1 ? "takes" : "take"} ${
                appearance.quickWinMinutes
              } minutes or less.`}
          </Text>

          <View style={styles.groupSwitch} accessibilityRole="radiogroup" accessibilityLabel="Group tasks by">
            {GROUP_BY_OPTIONS.map((option) => {
              const isActive = appearance.groupBy === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.groupOption, isActive && styles.groupOptionActive]}
                  onPress={() => updateAppearance({ groupBy: option })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isActive }}
                >
                  <Text style={[styles.groupOptionText, isActive && styles.groupOptionTextActive]}>
                    {GROUP_BY_LABELS[option].short}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {loading && tasks.length === 0 ? (
          <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {section.title.toUpperCase()} · {section.data.length}
                </Text>
                <Text style={styles.sectionMinutes}>{section.totalMinutes} min</Text>
              </View>
            )}
            renderItem={({ item }) => {
              // The range timer's suggested min/max come from this task's own
              // history (see taskHistory.ts); a task with no completed history
              // yet just gets its single estimate as both ends of the range.
              const historyEntry = findExactMatch(history, item.title);
              const suggestedMin = historyEntry?.minMinutes ?? item.estimated_minutes;
              const suggestedMax = historyEntry?.maxMinutes ?? item.estimated_minutes;
              return (
                <TaskItem
                  task={item}
                  pomodoroWorkMinutes={settings?.pomodoro_work_minutes ?? 25}
                  pomodoroBreakMinutes={settings?.pomodoro_break_minutes ?? 5}
                  suggestedMin={Math.min(suggestedMin, suggestedMax)}
                  suggestedMax={Math.max(suggestedMin, suggestedMax)}
                  quickWinMinutes={appearance.quickWinMinutes}
                  chimeEnabled={settings?.timer_chime_enabled ?? true}
                  onComplete={complete}
                  onDelete={remove}
                  onStartFocus={setFocusTask}
                />
              );
            }}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refresh}
                tintColor={theme.colors.textSecondary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Tap “Add a task” below the moment something pops into your head.
                </Text>
              </View>
            }
            ListFooterComponent={
              allDone ? (
                <EndOfDayCard
                  tasksToday={stats.todayCompleted}
                  minutesToday={stats.todayActualMinutes}
                  streakDays={stats.currentStreakDays}
                />
              ) : null
            }
          />
        )}

        <View style={styles.captureBar}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setAddOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Add a task"
          >
            <Text style={styles.addButtonText}>Add a task…</Text>
            <View style={styles.addButtonIcon}>
              <Ionicons name="add" size={24} color={theme.colors.onAccent} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.micButton}
            onPress={() => setBrainDumpOpen(true)}
            accessibilityLabel="Brain dump: say everything at once"
          >
            <Ionicons name="mic-outline" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <AddTaskSheet
          visible={addOpen}
          history={history}
          usuals={usuals}
          onAdd={create}
          onUndo={remove}
          onOpenBrainDump={openBrainDumpFromAdd}
          onClose={() => setAddOpen(false)}
        />

        <BrainDumpSheet
          visible={brainDumpOpen}
          state={brainDump.state}
          onChangeText={brainDump.setText}
          onSubmit={brainDump.submit}
          onToggle={brainDump.setIncluded}
          onChangeTitle={brainDump.setTitle}
          onCommit={brainDump.commit}
          onClose={closeBrainDump}
        />

        <FocusSessionModal
          task={focusTask}
          sessionIndex={focusSessionIndex}
          sessionTotal={focusTasksToday.length}
          workMinutes={settings?.pomodoro_work_minutes ?? 25}
          breakMinutes={settings?.pomodoro_break_minutes ?? 5}
          chimeEnabled={settings?.timer_chime_enabled ?? true}
          onClose={() => setFocusTask(null)}
          onComplete={(taskId, actualMinutes) => {
            complete(taskId, actualMinutes);
            setFocusTask(null);
          }}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const useStyles = makeStyles((theme) => ({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
    gap: 10,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.largeTitle.fontSize,
    fontWeight: theme.typography.largeTitle.fontWeight,
    fontFamily: theme.typography.largeTitle.fontFamily,
    letterSpacing: theme.typography.largeTitle.letterSpacing,
  },
  summary: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: 22,
  },
  summaryStrong: {
    color: theme.colors.textPrimary,
  },
  groupSwitch: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    marginTop: theme.spacing.xs,
  },
  groupOption: {
    flex: 1,
    height: 36,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  groupOptionActive: {
    backgroundColor: theme.colors.surface,
  },
  groupOptionText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "600",
  },
  groupOptionTextActive: {
    color: theme.colors.textPrimary,
  },
  errorText: {
    color: theme.colors.danger,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  loader: {
    marginTop: theme.spacing.xl,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
  },
  sectionMinutes: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
    fontFamily: theme.fonts.mono,
  },
  emptyState: {
    alignItems: "center",
    marginTop: theme.spacing.xl,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: theme.spacing.lg,
  },
  captureBar: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  addButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 60,
    paddingLeft: 20,
    paddingRight: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  addButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
  },
  addButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.accentDark,
    alignItems: "center",
    justifyContent: "center",
  },
  micButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
}));

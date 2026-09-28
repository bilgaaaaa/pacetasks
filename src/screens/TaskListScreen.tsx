import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import { Task, TaskTiming } from "../lib/types";
import { useTasks } from "../hooks/useTasks";
import { useSettings } from "../hooks/useSettings";
import { buildTaskHistory, findExactMatch } from "../lib/taskHistory";
import { computeStats } from "../lib/stats";
import { QuickAddBar } from "../components/QuickAddBar";
import { TaskItem } from "../components/TaskItem";
import { FocusSessionModal } from "../components/FocusSessionModal";
import { EndOfDayCard } from "../components/EndOfDayCard";

interface Props {
  userId: string | undefined;
}

// Pending tasks read in this fixed order (before work, then anytime, then
// after work) so the "when" grouping from earlier versions is still implied
// by list order, even though this design shows one continuous list with no
// section headers.
const TIMING_ORDER: TaskTiming[] = ["before_work", "anytime", "after_work"];

function greetingEyebrow(): string {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const hour = now.getHours();
  const part = hour < 12 ? "GOOD MORNING" : hour < 18 ? "GOOD AFTERNOON" : "GOOD EVENING";
  return `${day} · ${part}`;
}

// Home screen: quick capture, then every task in one calm list (ordered by
// timing, completed ones sink to the bottom). Each task can be timed one of
// two ways: a lightweight range timer (tap its minutes pill — counts down
// from the task's suggested max, learned from history) or, for tasks with a
// fixed scheduled time, the full-screen Focus/Pomodoro modal via its FOCUS
// badge. An end-of-day card appears once nothing is left pending.
export function TaskListScreen({ userId }: Props) {
  const { tasks, loading, error, refresh, create, complete, remove, clearCompleted } =
    useTasks(userId);
  const { settings } = useSettings(userId);
  const [focusTask, setFocusTask] = useState<Task | null>(null);

  const history = useMemo(() => buildTaskHistory(tasks), [tasks]);
  const stats = useMemo(() => computeStats(tasks), [tasks]);

  const totalCount = tasks.length;
  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === "done").length,
    [tasks]
  );
  const remainingCount = totalCount - completedCount;
  const hasCompleted = completedCount > 0;
  const allDone = totalCount > 0 && remainingCount === 0;

  const orderedTasks = useMemo(() => {
    const pending = tasks
      .filter((t) => t.status === "pending")
      .sort((a, b) => TIMING_ORDER.indexOf(a.timing) - TIMING_ORDER.indexOf(b.timing));
    const done = tasks.filter((t) => t.status === "done");
    return [...pending, ...done];
  }, [tasks]);

  // Focus tasks (any task with a fixed start time) ordered by that time —
  // this is what "SESSION X OF Y" in the Focus modal counts against.
  const focusTasksToday = useMemo(
    () =>
      [...tasks]
        .filter((t) => t.scheduled_time)
        .sort((a, b) => (a.scheduled_time! < b.scheduled_time! ? -1 : 1)),
    [tasks]
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

  return (
    <LinearGradient
      colors={[theme.colors.background, theme.colors.backgroundEnd]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{greetingEyebrow()}</Text>
            <Text style={styles.title}>Today</Text>
          </View>
          <TouchableOpacity onPress={openMenu} hitSlop={8} style={styles.menuButton}>
            <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.quickAddWrapper}>
          <QuickAddBar
            history={history}
            onAdd={(title, minutes, timing, category, scheduledTime) =>
              create(title, minutes, timing, category, scheduledTime)
            }
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {loading && tasks.length === 0 ? (
          <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
        ) : (
          <FlatList
            data={orderedTasks}
            keyExtractor={(item) => item.id}
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
                  Nothing here yet — add your first task above.
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

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
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
    fontSize: theme.typography.largeTitle.fontSize,
    fontWeight: theme.typography.largeTitle.fontWeight,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  quickAddWrapper: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
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
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
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
});

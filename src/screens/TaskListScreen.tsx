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
import { Task } from "../lib/types";
import { useTasks } from "../hooks/useTasks";
import { useSettings } from "../hooks/useSettings";
import { useBrainDump } from "../hooks/useBrainDump";
import { useDoNow } from "../hooks/useDoNow";
import { useOneThing } from "../hooks/useOneThing";
import { useRollover } from "../hooks/useRollover";
import { useWeeklyReset } from "../hooks/useWeeklyReset";
import { DEFAULT_SETTINGS } from "../lib/settingsApi";
import { computeStats } from "../lib/stats";
import { buildTaskHistory, findExactMatch } from "@domain/taskHistory";
import { selectSomedayTasks, selectTodayTasks } from "@domain/todayTasks";
import { PARK_PATCH, UNPARK_PATCH } from "@domain/taskPatch";
import { toLocalDateKey } from "@domain/dates";
import { QuickAddBar } from "../components/QuickAddBar";
import { TaskItem } from "../components/TaskItem";
import { FocusSessionModal } from "../components/FocusSessionModal";
import { EndOfDayCard } from "../components/EndOfDayCard";
import { BrainDumpSheet } from "../components/BrainDumpSheet";
import { DoNowSheet } from "../components/DoNowSheet";
import { OneThingSheet } from "../components/OneThingSheet";
import { RolloverCard } from "../components/RolloverCard";
import { SomedaySheet } from "../components/SomedaySheet";
import { WeeklyResetSheet } from "../components/WeeklyResetSheet";

interface Props {
  userId: string | undefined;
}

function greetingEyebrow(): string {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase();
  const hour = now.getHours();
  const part = hour < 12 ? "GOOD MORNING" : hour < 18 ? "GOOD AFTERNOON" : "GOOD EVENING";
  return `${day} · ${part}`;
}

// Home screen: quick capture (plus Brain Dump for many tasks at once), then today's tasks in one calm list (ordered by
// timing, completed ones sink to the bottom, future-dated ones stay hidden).
// Each task can be timed one of two ways: a lightweight range timer (tap its
// minutes pill — counts down from the task's suggested max, learned from
// history) or, for tasks with a fixed scheduled time, the full-screen
// Focus/Pomodoro modal via its FOCUS badge. "What can I do now?" narrows the
// list to what fits the time and energy the user has, and "Tell me what to do"
// (One Thing mode) shows a single task. When tasks were left unfinished, a
// rollover card on top proposes where each one goes. The foot of the list links
// to Weekly Reset (decide, one by one, what happens to neglected tasks) and to
// the Someday sheet (parked tasks). An end-of-day card appears once nothing is
// left pending.
export function TaskListScreen({ userId }: Props) {
  const { tasks, loading, error, refresh, create, applyCreated, complete, update, updateMany, remove, clearCompleted } =
    useTasks(userId);
  const { settings } = useSettings(userId);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [doNowOpen, setDoNowOpen] = useState(false);
  const [oneThingOpen, setOneThingOpen] = useState(false);
  const [somedayOpen, setSomedayOpen] = useState(false);
  const [weeklyResetOpen, setWeeklyResetOpen] = useState(false);
  const brainDump = useBrainDump({ onTasksCreated: applyCreated });
  const workStartHour = settings?.work_start_hour ?? DEFAULT_SETTINGS.work_start_hour;
  const workEndHour = settings?.work_end_hour ?? DEFAULT_SETTINGS.work_end_hour;
  const doNow = useDoNow(tasks, workStartHour, workEndHour);
  const oneThing = useOneThing({ tasks, energy: doNow.energy, workStartHour, workEndHour, onComplete: complete });
  const rollover = useRollover({ tasks, onApply: updateMany });
  const weeklyReset = useWeeklyReset({ tasks, onUpdate: update, onRemove: remove });

  const closeWeeklyReset = () => {
    weeklyReset.reset();
    setWeeklyResetOpen(false);
  };

  const closeOneThing = () => {
    oneThing.reset();
    setOneThingOpen(false);
  };

  const closeBrainDump = () => {
    brainDump.close();
    setBrainDumpOpen(false);
  };

  const history = useMemo(() => buildTaskHistory(tasks), [tasks]);
  const stats = useMemo(() => computeStats(tasks), [tasks]);

  // "Today" is the phone's local calendar day; recomputed on every render so a
  // list left open past midnight updates on the next foreground reload.
  const todayKey = toLocalDateKey(new Date());
  const { pending, done } = useMemo(
    () => selectTodayTasks(tasks, todayKey),
    [tasks, todayKey]
  );
  const orderedTasks = useMemo(() => [...pending, ...done], [pending, done]);
  const somedayTasks = useMemo(() => selectSomedayTasks(tasks), [tasks]);
  const hasCompleted = done.length > 0;
  const allDone = orderedTasks.length > 0 && pending.length === 0;

  // Today's Focus tasks (any task with a fixed start time) ordered by that time —
  // this is what "SESSION X OF Y" in the Focus modal counts against.
  const focusTasksToday = useMemo(
    () =>
      orderedTasks
        .filter((t) => t.scheduled_time)
        .sort((a, b) => (a.scheduled_time! < b.scheduled_time! ? -1 : 1)),
    [orderedTasks]
  );
  const focusSessionIndex = focusTask
    ? focusTasksToday.findIndex((t) => t.id === focusTask.id) + 1
    : 0;

  // One task row for both the Today list and the "What can I do now?" sheet.
  // The range timer's suggested min/max come from this task's own history
  // (see taskHistory.ts); with no completed history yet, both ends are its estimate.
  const renderTaskItem = (task: Task) => {
    const historyEntry = findExactMatch(history, task.title);
    const suggestedMin = historyEntry?.minMinutes ?? task.estimated_minutes;
    const suggestedMax = historyEntry?.maxMinutes ?? task.estimated_minutes;
    return (
      <TaskItem
        task={task}
        pomodoroWorkMinutes={settings?.pomodoro_work_minutes ?? DEFAULT_SETTINGS.pomodoro_work_minutes}
        pomodoroBreakMinutes={settings?.pomodoro_break_minutes ?? DEFAULT_SETTINGS.pomodoro_break_minutes}
        suggestedMin={Math.min(suggestedMin, suggestedMax)}
        suggestedMax={Math.max(suggestedMin, suggestedMax)}
        chimeEnabled={settings?.timer_chime_enabled ?? DEFAULT_SETTINGS.timer_chime_enabled}
        onComplete={complete}
        onDelete={remove}
        onPark={(taskId) => update(taskId, PARK_PATCH)}
        onStartFocus={setFocusTask}
      />
    );
  };

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
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setBrainDumpOpen(true)}
              style={styles.brainDumpButton}
              accessibilityLabel="Open Brain Dump"
            >
              <Text style={styles.brainDumpButtonText}>Brain dump</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openMenu} hitSlop={8} style={styles.menuButton}>
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.quickAddWrapper}>
          <QuickAddBar
            history={history}
            onAdd={(draft) => create({ ...draft, source: "app" })}
          />
          <View style={styles.helpRow}>
            <TouchableOpacity
              onPress={() => setDoNowOpen(true)}
              style={styles.helpButton}
              accessibilityRole="button"
            >
              <Text style={styles.helpButtonText}>What can I do now?</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setOneThingOpen(true)}
              style={styles.helpButton}
              accessibilityRole="button"
            >
              <Text style={styles.helpButtonText}>Tell me what to do</Text>
            </TouchableOpacity>
          </View>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {loading && tasks.length === 0 ? (
          <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
        ) : (
          <FlatList
            data={orderedTasks}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => renderTaskItem(item)}
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
            ListHeaderComponent={
              rollover.visible ? (
                <RolloverCard
                  choices={rollover.choices}
                  saving={rollover.saving}
                  onChangeDestination={rollover.setDestination}
                  onApply={rollover.apply}
                  onDismiss={rollover.dismiss}
                />
              ) : null
            }
            ListFooterComponent={
              <>
                {allDone && (
                  <EndOfDayCard
                    tasksToday={stats.todayCompleted}
                    minutesToday={stats.todayActualMinutes}
                    streakDays={stats.currentStreakDays}
                  />
                )}
                {weeklyReset.pendingCount > 0 && (
                  <TouchableOpacity
                    onPress={() => setWeeklyResetOpen(true)}
                    style={styles.footerLink}
                    accessibilityRole="button"
                  >
                    <Text style={styles.footerLinkText}>Weekly reset · {weeklyReset.pendingCount} to review</Text>
                  </TouchableOpacity>
                )}
                {somedayTasks.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSomedayOpen(true)}
                    style={styles.footerLink}
                    accessibilityRole="button"
                  >
                    <Text style={styles.footerLinkText}>Someday · {somedayTasks.length} parked</Text>
                  </TouchableOpacity>
                )}
              </>
            }
          />
        )}

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

        <DoNowSheet
          visible={doNowOpen}
          availableMinutes={doNow.availableMinutes}
          energy={doNow.energy}
          selection={doNow.selection}
          hasPendingToday={doNow.hasPendingToday}
          errorMessage={error}
          onChangeMinutes={doNow.setAvailableMinutes}
          onChangeEnergy={doNow.setEnergy}
          renderTask={renderTaskItem}
          onClose={() => setDoNowOpen(false)}
        />

        <OneThingSheet
          visible={oneThingOpen}
          phase={oneThing.phase}
          task={oneThing.task}
          remainingCount={oneThing.remainingCount}
          skippedCount={oneThing.skippedCount}
          minutes={oneThing.minutes}
          saving={oneThing.saving}
          completedTitle={oneThing.completedTitle}
          todayKey={oneThing.todayKey}
          errorMessage={error}
          onChangeMinutes={oneThing.setMinutes}
          onSkip={oneThing.skip}
          onResetSkipped={oneThing.resetSkipped}
          onStartConfirm={oneThing.startConfirm}
          onCancelConfirm={oneThing.cancelConfirm}
          onConfirm={oneThing.confirm}
          onNext={oneThing.next}
          onClose={closeOneThing}
        />

        <SomedaySheet
          visible={somedayOpen}
          tasks={somedayTasks}
          errorMessage={error}
          onBringBack={(taskId) => update(taskId, UNPARK_PATCH)}
          onDelete={remove}
          onClose={() => setSomedayOpen(false)}
        />

        <WeeklyResetSheet
          visible={weeklyResetOpen}
          phase={weeklyReset.phase}
          pendingCount={weeklyReset.pendingCount}
          reasonCounts={weeklyReset.reasonCounts}
          item={weeklyReset.item}
          index={weeklyReset.index}
          total={weeklyReset.total}
          tally={weeklyReset.tally}
          saving={weeklyReset.saving}
          todayKey={weeklyReset.todayKey}
          errorMessage={error}
          onStart={weeklyReset.start}
          onDecide={weeklyReset.decide}
          onClose={closeWeeklyReset}
        />

        <FocusSessionModal
          task={focusTask}
          sessionIndex={focusSessionIndex}
          sessionTotal={focusTasksToday.length}
          workMinutes={settings?.pomodoro_work_minutes ?? DEFAULT_SETTINGS.pomodoro_work_minutes}
          breakMinutes={settings?.pomodoro_break_minutes ?? DEFAULT_SETTINGS.pomodoro_break_minutes}
          chimeEnabled={settings?.timer_chime_enabled ?? DEFAULT_SETTINGS.timer_chime_enabled}
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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  brainDumpButton: {
    backgroundColor: theme.colors.accentDark,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    height: 36,
    justifyContent: "center",
  },
  brainDumpButtonText: {
    color: "#FFFFFF",
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "700",
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
    gap: theme.spacing.sm,
  },
  helpRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  helpButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
  },
  helpButtonText: {
    color: theme.colors.accentDark,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "700",
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
  footerLink: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  footerLinkText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: theme.typography.footnote.fontWeight,
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

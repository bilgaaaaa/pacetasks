import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  SectionList,
  StyleSheet,
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
import { useDoNow } from "../hooks/useDoNow";
import { useOneThing } from "../hooks/useOneThing";
import { useRollover } from "../hooks/useRollover";
import { useWeeklyReset } from "../hooks/useWeeklyReset";
import { DEFAULT_SETTINGS } from "../lib/settingsApi";
import { computeStats } from "../lib/stats";
import { filterTodayTasks, groupTodayTasks, summarizePending, TodayFilter } from "../lib/taskSections";
import { emptyFilterMessage, quickWinsMessage, totalsLine } from "../lib/todayCopy";
import { selectUsuals } from "../lib/taskRhythm";
import { buildTaskHistory, findExactMatch } from "@domain/taskHistory";
import { selectSomedayTasks, selectTodayTasks } from "@domain/todayTasks";
import { PARK_PATCH, UNPARK_PATCH } from "@domain/taskPatch";
import { toLocalDateKey } from "@domain/dates";
import { AddTaskSheet } from "../components/AddTaskSheet";
import { TaskItem } from "../components/TaskItem";
import { FocusSessionModal } from "../components/FocusSessionModal";
import { EndOfDayCard } from "../components/EndOfDayCard";
import { BrainDumpSheet } from "../components/BrainDumpSheet";
import { DoNowSheet } from "../components/DoNowSheet";
import { OneThingSheet } from "../components/OneThingSheet";
import { RolloverCard } from "../components/RolloverCard";
import { PickNextTaskSheet } from "../components/PickNextTaskSheet";
import { TodayFilterBar } from "../components/TodayFilterBar";
import { Button } from "../components/Button";
import { SomedaySheet } from "../components/SomedaySheet";
import { WeeklyResetSheet } from "../components/WeeklyResetSheet";

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
// One "Pick my next task" button opens a chooser for the two helpers: "Fit my
// time" (narrows the list to what fits the time and energy the user has) and
// "Decide for me" (One Thing mode, a single task). When tasks were left
// unfinished, a slim "carried over" row opens a review that proposes where
// each one goes. Quick filters (All, Quick wins, Due today) sit above the
// list; groupings live behind "Filter". The foot of the list links to Weekly Reset and to the Someday sheet
// (parked tasks). An end-of-day card appears once nothing is left pending.
export function TaskListScreen({ userId }: Props) {
  const { theme, appearance, updateAppearance } = useTheme();
  const styles = useStyles();
  const { tasks, loading, error, refresh, create, applyCreated, complete, update, updateMany, remove, clearCompleted } =
    useTasks(userId);
  const { settings } = useSettings(userId);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [doNowOpen, setDoNowOpen] = useState(false);
  const [oneThingOpen, setOneThingOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [filter, setFilter] = useState<TodayFilter>("all");
  const [somedayOpen, setSomedayOpen] = useState(false);
  const [weeklyResetOpen, setWeeklyResetOpen] = useState(false);
  const brainDump = useBrainDump({ onTasksCreated: applyCreated });
  const workStartHour = settings?.work_start_hour ?? DEFAULT_SETTINGS.work_start_hour;
  const workEndHour = settings?.work_end_hour ?? DEFAULT_SETTINGS.work_end_hour;
  const doNow = useDoNow(tasks, workStartHour, workEndHour);
  const oneThing = useOneThing({ tasks, energy: doNow.energy, workStartHour, workEndHour, onComplete: complete });
  const rollover = useRollover({ tasks, onApply: updateMany });
  const weeklyReset = useWeeklyReset({ tasks, onUpdate: update, onRemove: remove });
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (switchTimer.current) clearTimeout(switchTimer.current);
    };
  }, []);

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

  // Close the chooser first; iOS can't present the next sheet until it is gone.
  const openFromPick = (open: (value: boolean) => void) => {
    setPickOpen(false);
    if (switchTimer.current) clearTimeout(switchTimer.current);
    switchTimer.current = setTimeout(() => open(true), MODAL_SWITCH_DELAY_MS);
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
  const somedayTasks = useMemo(() => selectSomedayTasks(tasks), [tasks]);
  const hasCompleted = completedTasks.length > 0;
  const allDone = pending.length + done.length > 0 && pending.length === 0;
  const summary = summarizePending(pending, appearance.quickWinMinutes, todayKey);
  const filterCounts = { all: summary.count, quick: summary.quickWinCount, due: summary.dueCount };

  const sections: ListSection[] = useMemo(() => {
    const shown = filterTodayTasks(pending, filter, appearance.quickWinMinutes, todayKey);
    const grouped = groupTodayTasks(shown, appearance.groupBy, appearance.quickWinMinutes).map(
      ({ key, title, totalMinutes, tasks: sectionTasks }) => ({ key, title, totalMinutes, data: sectionTasks })
    );
    // Finished tasks belong to the unfiltered view only.
    if (filter === "all" && done.length > 0) {
      grouped.push({
        key: "done",
        title: "Done",
        totalMinutes: done.reduce((total, t) => total + (t.actual_minutes ?? t.estimated_minutes), 0),
        data: done,
      });
    }
    return grouped;
  }, [pending, done, filter, todayKey, appearance.groupBy, appearance.quickWinMinutes]);

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
        quickWinMinutes={appearance.quickWinMinutes}
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

  // The headline is what can be done fast; the totals are secondary.
  const quickWinsText = quickWinsMessage(summary.quickWinCount);
  const totalsText =
    summary.count === 0
      ? allDone
        ? "Everything's done. Enjoy the rest of your day."
        : "Nothing yet. Add whatever's on your mind."
      : totalsLine(summary.count, summary.totalMinutes);

  return (
    <LinearGradient
      colors={[theme.colors.background, theme.colors.backgroundEnd]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitles}>
              <Text style={styles.eyebrow} numberOfLines={1}>{greetingEyebrow()}</Text>
              <Text style={styles.title} accessibilityRole="header">Today</Text>
            </View>
            <TouchableOpacity onPress={openMenu} style={styles.menuButton} accessibilityLabel="List options">
              <Ionicons name="ellipsis-horizontal" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.summaryRow}>
            {quickWinsText && (
              <View style={styles.quickWinsBadge}>
                <Ionicons name="flash" size={13} color={theme.colors.quickText} />
                <Text style={styles.quickWinsText}>{quickWinsText}</Text>
              </View>
            )}
            <Text style={styles.totals}>{totalsText}</Text>
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
                <Text style={styles.emptyText}>{emptyFilterMessage(filter)}</Text>
              </View>
            }
            ListHeaderComponent={
              <>
                {/* The main action, the carried-over row and the filters scroll
                    away with the list so the tasks get the screen. */}
                <View style={styles.listControls}>
                  <Button label="Pick my next task" onPress={() => setPickOpen(true)} />
                </View>
                {rollover.visible && (
                  <RolloverCard
                    choices={rollover.choices}
                    saving={rollover.saving}
                    onChangeDestination={rollover.setDestination}
                    onApply={rollover.apply}
                    onDismiss={rollover.dismiss}
                  />
                )}
                <View style={styles.filterRow}>
                  <TodayFilterBar
                    filter={filter}
                    counts={filterCounts}
                    groupBy={appearance.groupBy}
                    onChangeFilter={setFilter}
                    onChangeGroupBy={(groupBy) => updateAppearance({ groupBy })}
                  />
                </View>
              </>
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

        <View style={styles.captureBar}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setAddOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Add a task"
          >
            <Text style={styles.addButtonText} numberOfLines={1}>Add a task…</Text>
            <View style={styles.addButtonIcon}>
              <Ionicons name="add" size={22} color={theme.colors.onAccent} />
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

        <PickNextTaskSheet
          visible={pickOpen}
          onDecideForMe={() => openFromPick(setOneThingOpen)}
          onFitMyTime={() => openFromPick(setDoNowOpen)}
          onClose={() => setPickOpen(false)}
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

const useStyles = makeStyles((theme) => ({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
    gap: 6,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: theme.spacing.sm,
  },
  headerTitles: {
    flex: 1,
    gap: 8, // breathing room between the greeting label and the title
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
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
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
  summaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: theme.spacing.sm,
    rowGap: 4,
  },
  quickWinsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.quickFill,
  },
  quickWinsText: {
    color: theme.colors.quickText,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "700",
  },
  totals: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "400",
    fontVariant: ["tabular-nums"],
  },
  listControls: {
    paddingHorizontal: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  filterRow: {
    paddingHorizontal: theme.spacing.sm,
    paddingTop: 4,
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
    paddingTop: theme.spacing.xs,
    paddingBottom: theme.spacing.md,
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
    fontVariant: ["tabular-nums"],
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
  // Pinned under the list on its own solid strip with a hairline, so the
  // list ends at a clear edge instead of sliding under a floating bar.
  captureBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: theme.colors.backgroundEnd,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  addButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    minHeight: 52,
    paddingLeft: 20,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  addButtonText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
  },
  addButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentDark,
    alignItems: "center",
    justifyContent: "center",
  },
  micButton: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
}));

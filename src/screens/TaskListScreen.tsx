import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { useReminders } from "../hooks/useReminders";
import { useDeskfocusWidget } from "../hooks/useDeskfocusWidget";
import { useFocusScreen } from "../hooks/useFocusScreen";
import { useBrainDump } from "../hooks/useBrainDump";
import { useSheetHandoff } from "../hooks/useSheetHandoff";
import { useHaptics } from "../hooks/useHaptics";
import { usePro } from "../hooks/usePro";
import { useDoNow } from "../hooks/useDoNow";
import { useOneThing } from "../hooks/useOneThing";
import { useRescue } from "../hooks/useRescue";
import { useRollover } from "../hooks/useRollover";
import { useWeeklyReset } from "../hooks/useWeeklyReset";
import { DEFAULT_SETTINGS } from "../lib/settingsApi";
import { computeStats } from "../lib/stats";
import { filterTodayTasks, groupTodayTasks, summarizePending, TodayFilter } from "../lib/taskSections";
import { dayEyebrow, dayTitle, emptyFilterMessage, totalsLine } from "../lib/todayCopy";
import { upcomingLink } from "../lib/upcomingCopy";
import { dayHeroMessage, heroMessage, heroStart } from "../lib/heroCopy";
import { buildWeek } from "../lib/weekStrip";
import { plannedDayKey, selectDayTasks } from "../lib/dayTasks";
import { selectUsuals } from "../lib/taskRhythm";
import { rescueSubtitle, rescueSummary } from "../lib/rescueCopy";
import { rolloverSubtitle, rolloverSummary } from "../lib/rolloverCopy";
import { buildPaceModel, hasLearnedPace } from "@domain/pace";
import { buildTaskHistory, findExactMatch } from "@domain/taskHistory";
import { groupUpcomingByDay, selectSomedayTasks, selectUpcomingTasks } from "@domain/todayTasks";
import { PARK_PATCH, reschedulePatch, UNPARK_PATCH } from "@domain/taskPatch";
import { addDays, toLocalDateKey } from "@domain/dates";
import { AddTaskSheet } from "../components/AddTaskSheet";
import { TaskItem } from "../components/TaskItem";
import { FocusSessionModal } from "../components/FocusSessionModal";
import { EndOfDayCard } from "../components/EndOfDayCard";
import { BrainDumpSheet } from "../components/BrainDumpSheet";
import { DoNowSheet } from "../components/DoNowSheet";
import { OneThingSheet } from "../components/OneThingSheet";
import { MoveTasksCard } from "../components/MoveTasksCard";
import { PickNextTaskSheet } from "../components/PickNextTaskSheet";
import { TodayFilterBar } from "../components/TodayFilterBar";
import { TodayHero } from "../components/TodayHero";
import { WeekStrip } from "../components/WeekStrip";
import { SomedaySheet } from "../components/SomedaySheet";
import { UpcomingSheet } from "../components/UpcomingSheet";
import { WeeklyResetSheet } from "../components/WeeklyResetSheet";
import { t } from "../i18n";

interface Props {
  userId: string | undefined;
}

interface ListSection {
  key: string;
  title: string;
  totalMinutes: number;
  data: Task[];
}


// Home screen: today's tasks split into the sections the user picked (all in
// one list, or by size, place, category, time of day), with a summary of how small the
// day really is, and an always-visible capture bar that opens the add sheet
// (plus Brain Dump for many tasks at once). Each task can be timed with a
// lightweight range timer or, for fixed-time tasks, the Focus session.
// One "Pick my next task" button opens a chooser for the two helpers: "Fit my
// time" (narrows the list to what fits the time and energy the user has) and
// "Decide for me" (One Thing mode, a single task). When tasks were left
// unfinished, a slim "carried over" row opens a review that proposes where
// each one goes. Quick filters (All, Quick wins, Due today) sit above the
// list; groupings live behind the round button beside them. The foot of the list links to Weekly Reset, to the
// Upcoming sheet (tasks set for a later day) and to the Someday sheet (parked tasks). An end-of-day card
// appears once nothing is left pending. The week strip shows any other day in place of today: a later day
// lists what is set for it, and tasks added there are set for it; an earlier day lists what was finished.
export function TaskListScreen({ userId }: Props) {
  const { theme, appearance, updateAppearance } = useTheme();
  const styles = useStyles();
  const { tasks, loading, error, refresh, create, applyCreated, complete, update, updateMany, remove } =
    useTasks();
  const { settings } = useSettings();
  // An empty list after a failed load is not "no tasks": reminders wait for a real one.
  const tasksReady = !loading && (tasks.length > 0 || !error);
  useReminders(userId, tasks, tasksReady);
  // How long tasks really take this user, from the timers; planning and the widgets count these lengths.
  const paceModel = useMemo(() => buildPaceModel(tasks), [tasks]);
  useDeskfocusWidget(tasks, paceModel, tasksReady, complete);
  // One sheet adds and edits. `editing` stays while it slides away, so its heading doesn't flip.
  const [taskSheet, setTaskSheet] = useState<{ open: boolean; editing: Task | null }>({ open: false, editing: null });
  const closeTaskSheet = () => setTaskSheet((sheet) => ({ ...sheet, open: false }));
  const [brainDumpOpen, setBrainDumpOpen] = useState(false);
  const [doNowOpen, setDoNowOpen] = useState(false);
  const [oneThingOpen, setOneThingOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [filter, setFilter] = useState<TodayFilter>("all");
  const [somedayOpen, setSomedayOpen] = useState(false);
  const [weeklyResetOpen, setWeeklyResetOpen] = useState(false);
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  // The day on screen, picked in the week strip; null follows today, also across midnight.
  const [shownDayKey, setShownDayKey] = useState<string | null>(null);
  const brainDump = useBrainDump({ onTasksCreated: applyCreated });
  const workStartHour = settings?.work_start_hour ?? DEFAULT_SETTINGS.work_start_hour;
  const workEndHour = settings?.work_end_hour ?? DEFAULT_SETTINGS.work_end_hour;
  const doNow = useDoNow(tasks, paceModel, workStartHour, workEndHour);
  const haptics = useHaptics();
  const pro = usePro();
  // Every way of finishing a task (a row, Focus, One Thing) goes through here, so all of them feel the same:
  // one tap once the save has really succeeded. `silent` is for a moment that already had its own cue.
  const completeTask = async (taskId: string, actualMinutes: number, silent = false) => {
    const saved = await complete(taskId, actualMinutes);
    if (saved && !silent) haptics.play("taskCompleted");
    return saved;
  };
  const workMinutes = settings?.pomodoro_work_minutes ?? DEFAULT_SETTINGS.pomodoro_work_minutes;
  const oneThing = useOneThing({ tasks, energy: doNow.energy, workStartHour, workEndHour, onComplete: completeTask });
  const rollover = useRollover({ tasks, onApply: updateMany });
  const rescue = useRescue({ tasks, paceModel, workStartHour, workEndHour, onApply: updateMany });
  const weeklyReset = useWeeklyReset({ tasks, onUpdate: update, onRemove: remove });
  const sheetHandoff = useSheetHandoff();

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

  // The chooser and the add sheet each open another sheet: they close first and
  // the next one opens once they are gone (see useSheetHandoff).
  const openFromPick = (open: (value: boolean) => void) =>
    sheetHandoff.handOff(() => setPickOpen(false), () => open(true));

  // Brain Dump is Pro: free users get the paywall instead, once the add sheet is gone.
  const openBrainDump = () => pro.requirePro("brainDump", () => setBrainDumpOpen(true));
  const openBrainDumpFromAdd = () => sheetHandoff.handOff(closeTaskSheet, openBrainDump);

  // A Focus pill tapped inside "Fit my time": that sheet has to go before the session can show.
  const startFocusFromDoNow = (task: Task) =>
    sheetHandoff.handOff(() => setDoNowOpen(false), () => focusScreen.open(task));

  // Another sheet on screen would swallow the Focus screen (iOS shows only one at a time).
  const otherSheetOpen =
    taskSheet.open || brainDumpOpen || doNowOpen || oneThingOpen || pickOpen || somedayOpen || weeklyResetOpen || upcomingOpen;
  const focusScreen = useFocusScreen({
    tasks,
    tasksReady,
    workMinutes,
    timerSoundEnabled: settings?.timer_chime_enabled,
    otherSheetOpen,
    completeTask,
  });

  const history = useMemo(() => buildTaskHistory(tasks), [tasks]);
  // The user's own task names help Talk hear them (names, places, brands).
  const taskTitles = useMemo(() => [...history.values()].map((entry) => entry.title), [history]);
  const stats = useMemo(() => computeStats(tasks), [tasks]);

  // "Today" is the phone's local calendar day; recomputed on every render so a
  // list left open past midnight updates on the next foreground reload.
  const now = new Date();
  const todayKey = toLocalDateKey(now);
  const dayKey = shownDayKey ?? todayKey;
  const isToday = dayKey === todayKey;
  const usuals = useMemo(() => selectUsuals(tasks, todayKey), [tasks, todayKey]);
  // Today's own lists drive the hero, the helpers and Focus; the day on screen may be another one.
  // The Done section only shows what was finished that day; older history lives on the Pace tab.
  const { pending, done } = useMemo(() => selectDayTasks(tasks, todayKey, todayKey), [tasks, todayKey]);
  const shownDay = useMemo(
    () => (isToday ? { pending, done } : selectDayTasks(tasks, dayKey, todayKey)),
    [isToday, pending, done, tasks, dayKey, todayKey]
  );
  const shownFilter: TodayFilter = isToday ? filter : "all";
  const somedayTasks = useMemo(() => selectSomedayTasks(tasks), [tasks]);
  const upcomingTasks = useMemo(() => selectUpcomingTasks(tasks, todayKey), [tasks, todayKey]);
  const upcomingDays = useMemo(() => groupUpcomingByDay(upcomingTasks), [upcomingTasks]);
  const allDone = pending.length + done.length > 0 && pending.length === 0;
  const summary = summarizePending(pending, appearance.quickWinMinutes, todayKey);
  const filterCounts = { all: summary.count, quick: summary.quickWinCount, due: summary.dueCount };

  const sections: ListSection[] = useMemo(() => {
    const shown = filterTodayTasks(shownDay.pending, shownFilter, appearance.quickWinMinutes, todayKey);
    // The one-list heading says "Today's plan"; another day's list is that day's plan.
    const grouped = groupTodayTasks(shown, appearance.groupBy, appearance.quickWinMinutes).map(
      ({ key, title, totalMinutes, tasks: sectionTasks }) => ({
        key,
        title: !isToday && key === "all" ? t("The plan") : title,
        totalMinutes,
        data: sectionTasks,
      })
    );
    // Finished tasks belong to the unfiltered view only.
    if (shownFilter === "all" && shownDay.done.length > 0) {
      grouped.push({
        key: "done",
        title: t("Done"),
        totalMinutes: shownDay.done.reduce((total, t) => total + (t.actual_minutes ?? t.estimated_minutes), 0),
        data: shownDay.done,
      });
    }
    return grouped;
  }, [shownDay, shownFilter, isToday, todayKey, appearance.groupBy, appearance.quickWinMinutes]);

  // Today's Focus tasks (any task with a fixed start time) ordered by that time —
  // this is what "SESSION X OF Y" in the Focus modal counts against.
  const focusTasksToday = useMemo(
    () =>
      [...pending, ...done]
        .filter((t) => t.scheduled_time)
        .sort((a, b) => (a.scheduled_time! < b.scheduled_time! ? -1 : 1)),
    [pending, done]
  );
  const focusSessionIndex = focusScreen.task
    ? focusTasksToday.findIndex((t) => t.id === focusScreen.task!.id) + 1
    : 0;

  // One task row for both the Today list and the "What can I do now?" sheet,
  // which passes its own way of starting Focus (it has to close first).
  // The range timer's suggested min/max come from this task's own history
  // (see taskHistory.ts); with no completed history yet, both ends are its estimate.
  const editTask = (task: Task) => setTaskSheet({ open: true, editing: task });
  // Editing from inside another sheet: that sheet closes first, then the task sheet opens.
  const editTaskFrom = (closeSheet: () => void) => (task: Task) =>
    sheetHandoff.handOff(closeSheet, () => editTask(task));
  const renderTaskItem = (
    task: Task,
    onStartFocus: (task: Task) => void = focusScreen.open,
    onEdit: (task: Task) => void = editTask
  ) => {
    const historyEntry = findExactMatch(history, task.title);
    const suggestedMin = historyEntry?.minMinutes ?? task.estimated_minutes;
    const suggestedMax = historyEntry?.maxMinutes ?? task.estimated_minutes;
    return (
      <TaskItem
        task={task}
        suggestedMin={Math.min(suggestedMin, suggestedMax)}
        suggestedMax={Math.max(suggestedMin, suggestedMax)}
        quickWinMinutes={appearance.quickWinMinutes}
        onComplete={completeTask}
        onDelete={remove}
        onPark={(taskId) => update(taskId, PARK_PATCH)}
        onEdit={onEdit}
        onStartFocus={onStartFocus}
      />
    );
  };

  const week = useMemo(() => buildWeek(todayKey, tasks, dayKey), [todayKey, tasks, dayKey]);
  // Picking today again follows today from then on.
  const showDay = (key: string) => setShownDayKey(key === todayKey ? null : key);
  const shownMinutes = shownDay.pending.reduce((total, task) => total + task.estimated_minutes, 0);

  return (
    <LinearGradient
      colors={[theme.colors.background, theme.colors.backgroundEnd]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerTitles}>
              <Text style={styles.eyebrow} numberOfLines={1}>
                {dayEyebrow(dayKey)}
              </Text>
              <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
                {dayTitle(dayKey, todayKey, now.getHours())}
              </Text>
            </View>
            {!isToday && (
              <TouchableOpacity
                style={styles.todayButton}
                onPress={() => setShownDayKey(null)}
                accessibilityRole="button"
                accessibilityLabel={t("Back to today")}
              >
                <Ionicons name="arrow-undo" size={14} color={theme.colors.onAccent} />
                <Text style={styles.todayButtonText}>{t("Today")}</Text>
              </TouchableOpacity>
            )}
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
                <Text style={styles.sectionTitle} accessibilityRole="header">
                  {section.title}
                </Text>
                <Text style={styles.sectionMeta}>
                  {section.data.length} · {section.totalMinutes} min
                </Text>
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
              // Another day's hero already says what the day holds.
              isToday ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>{emptyFilterMessage(filter)}</Text>
                </View>
              ) : null
            }
            ListHeaderComponent={
              <>
                {/* The hero (with the main action), the week, the carried-over
                    row and the filters scroll away with the list. */}
                {isToday ? (
                  <TodayHero
                    message={heroMessage({
                      count: summary.count,
                      quickWinCount: summary.quickWinCount,
                      quickWinMinutes: appearance.quickWinMinutes,
                      streakDays: stats.currentStreakDays,
                      doneToday: stats.todayCompleted > 0,
                      allDone,
                      start: heroStart(oneThing.firstPick, todayKey, appearance.quickWinMinutes),
                    })}
                    totals={summary.count > 0 ? totalsLine(summary.count, summary.totalMinutes) : ""}
                    showAction={summary.count > 0}
                    onPick={() => setPickOpen(true)}
                  />
                ) : (
                  <TodayHero
                    message={dayHeroMessage(dayKey, todayKey, shownDay.pending.length, shownDay.done.length)}
                    totals={shownDay.pending.length > 0 ? totalsLine(shownDay.pending.length, shownMinutes) : ""}
                    showAction={false}
                    onPick={() => setPickOpen(true)}
                  />
                )}
                <WeekStrip
                  days={week}
                  onSelectDay={showDay}
                  onPreviousWeek={() => showDay(addDays(dayKey, -7))}
                  onNextWeek={() => showDay(addDays(dayKey, 7))}
                />
                {/* Carrying over, rescuing and filtering are about today only. */}
                {isToday && rollover.visible && (
                  <MoveTasksCard
                    summary={rolloverSummary(rollover.choices.length)}
                    subtitle={rolloverSubtitle()}
                    icon="return-down-forward"
                    choices={rollover.choices}
                    saving={rollover.saving}
                    onChangeDestination={rollover.setDestination}
                    onApply={rollover.apply}
                    onDismiss={rollover.dismiss}
                  />
                )}
                {/* Yesterday's leftovers are settled first, then the rest of today. */}
                {isToday && !rollover.visible && rescue.visible && (
                  <MoveTasksCard
                    summary={rescueSummary(rescue.moveCount)}
                    subtitle={rescueSubtitle(rescue.minutesLeft, rescue.minutesPlanned)}
                    icon="help-buoy-outline"
                    choices={rescue.choices}
                    saving={rescue.saving}
                    onChangeDestination={rescue.setDestination}
                    onApply={rescue.apply}
                    onDismiss={rescue.dismiss}
                  />
                )}
                {isToday && (
                  <View style={styles.filterRow}>
                    <TodayFilterBar
                      filter={filter}
                      counts={filterCounts}
                      groupBy={appearance.groupBy}
                      onChangeFilter={setFilter}
                      onChangeGroupBy={(groupBy) => updateAppearance({ groupBy })}
                    />
                  </View>
                )}
              </>
            }
            ListFooterComponent={
              <>
                {isToday && allDone && (
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
                    <Text style={styles.footerLinkText}>{t("Weekly reset · {0} to review", weeklyReset.pendingCount)}</Text>
                  </TouchableOpacity>
                )}
                {upcomingTasks.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setUpcomingOpen(true)}
                    style={styles.footerLink}
                    accessibilityRole="button"
                  >
                    <Text style={styles.footerLinkText}>{upcomingLink(upcomingTasks.length)}</Text>
                  </TouchableOpacity>
                )}
                {somedayTasks.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setSomedayOpen(true)}
                    style={styles.footerLink}
                    accessibilityRole="button"
                  >
                    <Text style={styles.footerLinkText}>{t("Someday · {0} parked", somedayTasks.length)}</Text>
                  </TouchableOpacity>
                )}
              </>
            }
          />
        )}

        <View style={styles.captureBar}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setTaskSheet({ open: true, editing: null })}
            accessibilityRole="button"
            accessibilityLabel={t("Add a task")}
          >
            <Text style={styles.addButtonText} numberOfLines={1}>{t("Add a task…")}</Text>
            <View style={styles.addButtonIcon}>
              <Ionicons name="add" size={22} color={theme.colors.onAccent} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.micButton}
            onPress={openBrainDump}
            accessibilityLabel={t("Brain dump: say everything at once")}
          >
            <Ionicons name="mic-outline" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <AddTaskSheet
          visible={taskSheet.open}
          editing={taskSheet.editing}
          history={history}
          usuals={usuals}
          workStartHour={workStartHour}
          workEndHour={workEndHour}
          taskRemindersEnabled={settings?.task_reminder_enabled ?? true}
          plannedDayKey={plannedDayKey(dayKey, todayKey)}
          onAdd={create}
          onUndo={remove}
          onSave={update}
          onOpenBrainDump={openBrainDumpFromAdd}
          onClose={closeTaskSheet}
          onDismissed={sheetHandoff.onDismissed}
        />

        <BrainDumpSheet
          visible={brainDumpOpen}
          listenOnOpen
          taskTitles={taskTitles}
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
          onDismissed={sheetHandoff.onDismissed}
        />

        <DoNowSheet
          visible={doNowOpen}
          availableMinutes={doNow.availableMinutes}
          energy={doNow.energy}
          selection={doNow.selection}
          hasPendingToday={doNow.hasPendingToday}
          atYourPace={hasLearnedPace(paceModel)}
          errorMessage={error}
          onChangeMinutes={doNow.setAvailableMinutes}
          onChangeEnergy={doNow.setEnergy}
          renderTask={(task) => renderTaskItem(task, startFocusFromDoNow, editTaskFrom(() => setDoNowOpen(false)))}
          onClose={() => setDoNowOpen(false)}
          onDismissed={sheetHandoff.onDismissed}
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
          onEdit={editTaskFrom(() => setSomedayOpen(false))}
          onDismissed={sheetHandoff.onDismissed}
          onClose={() => setSomedayOpen(false)}
        />

        <UpcomingSheet
          visible={upcomingOpen}
          days={upcomingDays}
          todayKey={todayKey}
          errorMessage={error}
          onMoveToToday={(task) => update(task.id, reschedulePatch(task, todayKey))}
          onDelete={remove}
          onEdit={editTaskFrom(() => setUpcomingOpen(false))}
          onDismissed={sheetHandoff.onDismissed}
          onClose={() => setUpcomingOpen(false)}
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
          task={focusScreen.task}
          session={focusScreen.session}
          sessionIndex={focusSessionIndex}
          sessionTotal={focusTasksToday.length}
          workMinutes={workMinutes}
          breakMinutes={settings?.pomodoro_break_minutes ?? DEFAULT_SETTINGS.pomodoro_break_minutes}
          onClose={focusScreen.close}
          onPause={focusScreen.pause}
          onResume={focusScreen.resume}
          onDoneEarly={focusScreen.doneEarly}
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
    minWidth: 0,
    gap: 8, // breathing room between the date label and the greeting
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.largeTitle.fontSize,
    fontWeight: theme.typography.largeTitle.fontWeight,
    fontFamily: theme.typography.largeTitle.fontFamily,
    letterSpacing: theme.typography.largeTitle.letterSpacing,
  },
  eyebrow: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
  },
  // "Today" on another day: the way back, in the accent like the main button.
  todayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 32,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentDark,
  },
  todayButtonText: {
    color: theme.colors.onAccent,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "700",
  },
  filterRow: {
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
    gap: theme.spacing.sm,
    paddingHorizontal: 4,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    flexShrink: 1,
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sectionMeta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "500",
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

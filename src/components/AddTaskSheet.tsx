import React, { ComponentRef, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { clampEstimatedMinutes, TASK_LIMITS } from "@domain/task";
import { editPatch } from "@domain/taskPatch";
import { ANY_TIME, isValidTaskTime, reminderAnchor, TaskTime, TaskTimeKind, taskTimeOf, timeFields } from "@domain/taskTime";
import { TaskHistoryEntry, findExactMatch, findMatches, normalizeTitle } from "@domain/taskHistory";
import { toLocalDateKey } from "@domain/dates";
import { timingForHour } from "@domain/timing";
import { DEFAULT_REMINDER_MINUTES, REMINDER_OFFSETS, taskReminderMoment } from "@domain/reminders";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { EnergyLevel, Task, TaskDraft, TaskPatch, TaskTiming } from "../lib/types";
import { CATEGORIES, categoryColor, getCategory } from "../lib/categories";
import { TIMING_LABELS } from "../lib/taskSections";
import { ANY_ENERGY_LABEL, ENERGY_OPTIONS, energyLabel } from "../lib/energy";
import {
  DEFAULT_DUE_CHOICE,
  DueChoice,
  dueChoiceLabel,
  dueChoiceOfTask,
  dueChoiceSummary,
  resolveDueChoice,
} from "../lib/dueOptions";
import { formatDueLabel } from "../lib/dueLabel";
import { hourOf, shiftTime, suggestedStartTime } from "../lib/timeOptions";
import { taskTimeLabel, taskTimeSpoken } from "../lib/taskTimeLabel";
import {
  REMINDER_PERMISSION_OFF,
  reminderChipLabel,
  reminderHint,
  reminderLabel,
  TASK_REMINDERS_SWITCHED_OFF,
} from "../lib/reminderCopy";
import {
  getNotificationPermission,
  NotificationPermission,
  requestNotificationPermission,
} from "../lib/notifications";
import { TaskRhythm, describeLastDone, isLate } from "../lib/taskRhythm";
import { DayPicker } from "./DayPicker";
import type { RepeatRule } from "@domain/repeat";
import { REPEAT_CHOICES, repeatChoiceLabel, repeatTag } from "../lib/repeatCopy";
import { TimePicker } from "./TimePicker";
import { t } from "../i18n";

const MINUTE_PRESETS = [2, 5, 10, 15, 20, 30, 45, 60, 90];
const TIMING_VALUES: TaskTiming[] = ["anytime", "before_work", "after_work"];
// null = no energy set, so "What can I do now?" never hides the task.
const ENERGY_VALUES: (EnergyLevel | null)[] = [null, ...ENERGY_OPTIONS.map((option) => option.value)];
const REMINDER_VALUES: (number | null)[] = [null, ...REMINDER_OFFSETS];
const TIME_KINDS: TaskTimeKind[] = ["any", "at", "after", "before", "between"];
// A new "between" window starts this long: an evening "19:00–21:00".
const DEFAULT_WINDOW_MINUTES = 120;

// The time kinds as the chips say them.
function timeKindLabel(kind: TaskTimeKind): string {
  switch (kind) {
    case "any":
      return t("Anytime");
    case "at":
      return t("At");
    case "after":
      return t("After");
    case "before":
      return t("Before");
    case "between":
      return t("Between");
  }
}

// The detail panel open under the task card; only one at a time keeps the sheet short.
type Panel = "when" | "duration" | "time" | "notes" | "more";

// Fields set by hand; task memory and suggestions never overwrite them.
const UNTOUCHED = { minutes: false, timing: false, category: false, energy: false, time: false, due: false };
// An existing task's values are all its own, except its day, which is kept as it is until changed.
const EDIT_TOUCHED = { minutes: true, timing: true, category: true, energy: true, time: true, due: false };

interface Props {
  visible: boolean;
  editing: Task | null; // the task being edited; null adds a new one
  history: Map<string, TaskHistoryEntry>;
  usuals: TaskRhythm[]; // repeat tasks for one-tap adding, most overdue first
  workStartHour: number; // picks "before work"/"after work" from a chosen time
  workEndHour: number;
  taskRemindersEnabled: boolean; // the Settings switch; the sheet says so when it is off
  plannedDayKey: string | null; // a later day shown on Today: new tasks and usuals are set for it
  onAdd: (draft: TaskDraft) => Promise<Task | undefined>; // undefined when saving failed
  onUndo: (taskId: string) => Promise<boolean>; // false when the delete failed
  onSave: (taskId: string, patch: TaskPatch) => Promise<boolean>; // saves an edit; false when it failed
  onOpenBrainDump: () => void;
  onClose: () => void;
  onDismissed: () => void; // the sheet has fully gone (iOS): lets the screen open the next sheet
}

// The task sheet, for a new task or an existing one (`editing`): one card with
// the task's name and a row of pills (day, duration, start time with its
// reminder, details, more). Each pill opens its own small panel below the card.
// Adding: with the name still empty, your usuals sit underneath, one tap each,
// and after each add it clears for the next task and offers Undo.
export function AddTaskSheet({
  visible,
  editing,
  history,
  usuals,
  workStartHour,
  workEndHour,
  taskRemindersEnabled,
  plannedDayKey,
  onAdd,
  onUndo,
  onSave,
  onOpenBrainDump,
  onClose,
  onDismissed,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState<number>(TASK_LIMITS.defaultEstimatedMinutes);
  const [timing, setTiming] = useState<TaskTiming>("anytime");
  const [due, setDue] = useState<DueChoice>(DEFAULT_DUE_CHOICE);
  const [repeat, setRepeat] = useState<RepeatRule | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [time, setTime] = useState<TaskTime>(ANY_TIME);
  const [reminder, setReminder] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [minutesText, setMinutesText] = useState(""); // what is typed in the duration field
  const [panel, setPanel] = useState<Panel | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("undetermined");
  const [touched, setTouched] = useState(UNTOUCHED);
  // Snapshot taken on open: an added usual becomes pending and would otherwise vanish from the list.
  const [shownUsuals, setShownUsuals] = useState<TaskRhythm[]>(usuals);
  const [addedKeys, setAddedKeys] = useState<string[]>([]);
  // `when` is the "for Thu" part of the confirmation; null when the task has no day.
  const [lastAdded, setLastAdded] = useState<{ taskId: string; key: string; title: string; when: string | null } | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A later day being planned on Today is where a new task goes until another day is picked.
  const plannedDue: DueChoice = plannedDayKey ? { kind: "day", dateKey: plannedDayKey } : DEFAULT_DUE_CHOICE;

  const resetDraft = () => {
    setTitle("");
    setMinutes(TASK_LIMITS.defaultEstimatedMinutes);
    setTiming("anytime");
    setDue(plannedDue);
    setRepeat(null);
    setCategory(null);
    setEnergy(null);
    setTime(ANY_TIME);
    setReminder(null);
    setNotes("");
    setMinutesText("");
    setPanel(null);
    setTouched(UNTOUCHED);
  };

  // Fills the sheet with an existing task; its details open right away when it has some.
  const loadTask = (task: Task) => {
    setTitle(task.title);
    setMinutes(task.estimated_minutes);
    setTiming(task.timing);
    setDue(dueChoiceOfTask(task, toLocalDateKey(new Date())));
    setRepeat(task.repeat_rule);
    setCategory(task.category);
    setEnergy(task.energy_level);
    setTime(taskTimeOf(task));
    setReminder(task.reminder_minutes_before);
    setNotes(task.notes ?? "");
    setMinutesText("");
    setPanel(task.notes ? "notes" : null);
    setTouched({ ...EDIT_TOUCHED, time: taskTimeOf(task).kind !== "any" });
  };

  // Every opening starts clean, with nothing left over from last time.
  useEffect(() => {
    if (!visible) return;
    if (editing) loadTask(editing);
    else resetDraft();
    setShownUsuals(usuals);
    setAddedKeys([]);
    setLastAdded(null);
    setError(null);
  }, [visible, editing?.id, plannedDayKey]);

  // The reminder panel says up front when notifications are off for the app.
  useEffect(() => {
    if (panel !== "time") return;
    getNotificationPermission()
      .then(setPermission)
      .catch((e) => console.warn("[AddTaskSheet] permission check failed", e));
  }, [panel]);

  const now = new Date();
  const todayKey = toLocalDateKey(now);
  // "Tomorrow", "Thu", "2 Nov": named on the usuals while a later day is being planned.
  const plannedDayLabel = plannedDayKey ? formatDueLabel(plannedDayKey, "on", todayKey) : null;
  const trimmedTitle = title.trim();
  const exactMatch = trimmedTitle ? findExactMatch(history, title) : undefined;
  const suggestions = trimmedTitle && !exactMatch ? findMatches(history, title, 3) : [];
  // An edited task keeps its exact day and deadline until another one is picked.
  const pickedDue =
    editing && !touched.due
      ? { due_date: editing.due_date, due_kind: editing.due_kind }
      : resolveDueChoice(due, todayKey);
  // A repeating task happens on days: without one picked it starts today, and a deadline becomes its day.
  const resolvedDue = repeat ? { due_date: pickedDue.due_date ?? todayKey, due_kind: "on" as const } : pickedDue;
  const pickedDueLabel =
    editing && !touched.due && editing.due_date
      ? formatDueLabel(editing.due_date, editing.due_kind, todayKey)
      : dueChoiceLabel(due, todayKey);
  const dueLabel = repeat
    ? `${pickedDue.due_date ? pickedDueLabel : formatDueLabel(todayKey, "on", todayKey)} · ${repeatTag(repeat)}`
    : pickedDueLabel;
  const work = { workStartHour, workEndHour };

  const applyMemory = (
    entry: Pick<TaskHistoryEntry, "usualMinutes" | "timing" | "category" | "energyLevel">,
    force: boolean
  ) => {
    if (force || !touched.minutes) setMinutes(entry.usualMinutes);
    if (force || !touched.timing) setTiming(entry.timing);
    if (force || !touched.category) setCategory(entry.category);
    if (force || !touched.energy) setEnergy(entry.energyLevel);
  };

  const handleTitleChange = (text: string) => {
    setTitle(text);
    setError(null);
    const match = findExactMatch(history, text);
    if (match) applyMemory(match, false);
  };

  const selectSuggestion = (entry: TaskHistoryEntry) => {
    setTitle(entry.title);
    applyMemory(entry, true);
  };

  const togglePanel = (next: Panel) => {
    Keyboard.dismiss();
    setPanel((current) => (current === next ? null : next));
  };

  // A time also places the task before/after work, unless that was set by hand.
  const applyTime = (next: TaskTime) => {
    setTime(next);
    const placing = reminderAnchor(timeFields(next)) ?? timeFields(next).window_end;
    if (!touched.timing && placing) setTiming(timingForHour(hourOf(placing), workStartHour, workEndHour));
    // A reminder needs a moment to count back from: "before 18:00" has none.
    if (!reminderAnchor(timeFields(next))) setReminder(null);
  };

  // A time picked by hand stays, whatever part of the day is chosen later.
  const changeTime = (next: TaskTime) => {
    applyTime(next);
    setTouched((t) => ({ ...t, time: true }));
  };

  // Switching kind keeps the time already chosen where it fits: "at 19:00" becomes "after 19:00".
  const changeTimeKind = (kind: TaskTimeKind) => {
    const chosen = timeFields(time);
    const first = chosen.scheduled_time ?? chosen.window_start ?? chosen.window_end ?? suggestedStartTime(now, timing, work);
    const hadAnchor = reminderAnchor(chosen) !== null;
    switch (kind) {
      case "any":
        removeTime();
        return;
      case "at":
        changeTime({ kind: "at", time: first });
        break;
      case "after":
        changeTime({ kind: "after", start: first });
        break;
      case "before":
        changeTime({ kind: "before", end: chosen.window_end ?? first });
        break;
      case "between": {
        const end = chosen.window_end && chosen.window_end > first ? chosen.window_end : shiftTime(first, DEFAULT_WINDOW_MINUTES);
        // Near midnight the end would wrap to the morning; start earlier instead.
        changeTime(end > first ? { kind: "between", start: first, end } : { kind: "between", start: shiftTime(first, -DEFAULT_WINDOW_MINUTES), end: first });
        break;
      }
    }
    // The first time a task gets a moment to start from, it also gets the default nudge.
    if (!hadAnchor && kind !== "before") changeReminder(DEFAULT_REMINDER_MINUTES);
  };

  const changeDue = (choice: DueChoice) => {
    setDue(choice);
    setTouched((t) => ({ ...t, due: true }));
  };

  // A repeat happens on days, so a task without one starts today and the picker shows it.
  const changeRepeat = (rule: RepeatRule | null) => {
    setRepeat(rule);
    if (rule && pickedDue.due_date === null) changeDue({ kind: "day", dateKey: todayKey });
  };

  // A part of the day picked by hand moves a suggested start time into it.
  const changeTiming = (value: TaskTiming) => {
    setTiming(value);
    setTouched((t) => ({ ...t, timing: true }));
    if (time.kind === "at" && !touched.time) setTime({ kind: "at", time: suggestedStartTime(now, value, work) });
  };

  // Any number of minutes can be typed; the chips are only shortcuts.
  const typeMinutes = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "");
    setMinutesText(digits);
    if (!digits) return;
    setMinutes(clampEstimatedMinutes(Number(digits)));
    setTouched((t) => ({ ...t, minutes: true }));
  };

  const removeTime = () => {
    setTime(ANY_TIME);
    setReminder(null);
    setTouched((t) => ({ ...t, time: false }));
    if (!touched.timing) setTiming("anytime");
  };

  // Picking a reminder is the natural moment for iOS to ask about notifications.
  const changeReminder = async (value: number | null) => {
    setReminder(value);
    if (value === null || permission === "granted" || !taskRemindersEnabled) return;
    const granted = await requestNotificationPermission().catch((e) => {
      console.warn("[AddTaskSheet] permission request failed", e);
      return false;
    });
    setPermission(granted ? "granted" : await getNotificationPermission());
  };

  // Shared by one-tap usuals and the form; returns true when the task was saved.
  const save = async (draft: TaskDraft, when: string | null = null): Promise<boolean> => {
    setSaving(true);
    setError(null);
    const created = await onAdd(draft);
    setSaving(false);
    if (!created) {
      console.warn("[AddTaskSheet] add failed", draft.title);
      setError(t("Couldn't add that task. Check your connection and try again."));
      return false;
    }
    const key = normalizeTitle(draft.title);
    setAddedKeys((prev) => [...prev, key]);
    setLastAdded({ taskId: created.id, key, title: draft.title, when });
    return true;
  };

  // A usual's length is the median of its latest timed runs, the same as typing its name would fill in.
  const usualMinutesOf = (rhythm: TaskRhythm) => findExactMatch(history, rhythm.title)?.usualMinutes ?? rhythm.lastMinutes;

  const addUsual = (rhythm: TaskRhythm) => {
    // An added usual stays added until Undo: a second tap must not create a duplicate.
    if (saving || addedKeys.includes(rhythm.key)) return;
    save(
      {
        title: rhythm.title,
        estimated_minutes: usualMinutesOf(rhythm),
        timing: rhythm.timing,
        category: rhythm.category,
        energy_level: findExactMatch(history, rhythm.title)?.energyLevel ?? null,
        ...resolveDueChoice(plannedDue, todayKey),
        source: "app",
      },
      dueChoiceSummary(plannedDue, todayKey)
    );
  };

  const adjustUsual = (rhythm: TaskRhythm) => {
    resetDraft();
    setTitle(rhythm.title);
    applyMemory(
      { ...rhythm, usualMinutes: usualMinutesOf(rhythm), energyLevel: findExactMatch(history, rhythm.title)?.energyLevel ?? null },
      true
    );
    inputRef.current?.focus();
  };

  // Writes only what changed on the edited task, then closes.
  const saveEdit = async (task: Task, patch: TaskPatch) => {
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    const saved = await onSave(task.id, patch);
    setSaving(false);
    if (!saved) {
      console.warn("[AddTaskSheet] edit failed", task.id);
      setError(t("Couldn't save your changes. Check your connection and try again."));
      return;
    }
    console.log("[AddTaskSheet] task edited", task.id, Object.keys(patch));
    onClose();
  };

  const submit = async () => {
    if (!trimmedTitle || saving) return;
    if (!isValidTaskTime(time)) {
      setPanel("time");
      return;
    }
    const fields = {
      title: trimmedTitle.slice(0, TASK_LIMITS.titleMaxLength),
      estimated_minutes: clampEstimatedMinutes(minutes),
      timing,
      category,
      energy_level: energy,
      ...timeFields(time),
      reminder_minutes_before: reminderAnchor(timeFields(time)) ? reminder : null,
      notes: notes.trim().slice(0, TASK_LIMITS.notesMaxLength) || null,
      ...resolvedDue,
      repeat_rule: repeat,
    };
    if (editing) {
      await saveEdit(editing, editPatch(editing, fields));
      return;
    }
    const saved = await save({ ...fields, source: "app" }, dueChoiceSummary(due, todayKey));
    if (saved) {
      // Cleared for the next thought: usuals and Undo are back in view.
      Keyboard.dismiss();
      resetDraft();
    }
  };

  const undoLastAdd = async () => {
    if (!lastAdded) return;
    const { taskId, key } = lastAdded;
    setLastAdded(null);
    const undone = await onUndo(taskId);
    if (!undone) {
      console.warn("[AddTaskSheet] undo failed", taskId);
      setError(t("Couldn't undo that one. You can delete it from the list."));
      return;
    }
    setAddedKeys((prev) => {
      const index = prev.lastIndexOf(key);
      return index === -1 ? prev : [...prev.slice(0, index), ...prev.slice(index + 1)];
    });
  };

  // When the reminder would go off for the draft as it stands now.
  const reminderPlan =
    reminderAnchor(timeFields(time)) && reminder !== null
      ? taskReminderMoment(
          {
            id: "draft",
            status: "pending",
            ...timeFields(time),
            reminder_minutes_before: reminder,
            due_date: resolvedDue.due_date,
            due_kind: resolvedDue.due_kind,
          },
          now
        )
      : null;

  const durationChoices = Array.from(new Set([...MINUTE_PRESETS, minutes])).sort((a, b) => a - b);
  const moreIsSet = category !== null || energy !== null || (touched.timing && timing !== "anytime");
  // "More" stays a small icon until it holds something worth naming.
  const moreLabel = category ? getCategory(category).label : energy ? energyLabel(energy) : moreIsSet ? TIMING_LABELS[timing] : null;

  const renderChips = <T,>(values: T[], selected: T, label: (value: T) => string, onPick: (value: T) => void) => (
    <View style={styles.chipWrap} accessibilityRole="radiogroup">
      {values.map((value) => {
        const isSelected = value === selected;
        return (
          <TouchableOpacity
            key={String(value)}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onPick(value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{label(value)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // One readable line per setting ("Time · 19:00–21:00"); tapping it opens its panel right underneath.
  const renderRow = (
    id: Panel,
    icon: React.ComponentProps<typeof Ionicons>["name"],
    label: string,
    value: string,
    isSet: boolean,
    a11y: string,
    trailingIcon?: React.ComponentProps<typeof Ionicons>["name"]
  ) => {
    const open = panel === id;
    return (
      <View key={id} style={styles.rowBlock}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => togglePanel(id)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={a11y}
        >
          <Ionicons name={icon} size={18} color={isSet || open ? theme.colors.accentDark : theme.colors.textSecondary} />
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={[styles.rowValue, isSet && styles.rowValueSet]} numberOfLines={1}>
            {value}
          </Text>
          {trailingIcon && <Ionicons name={trailingIcon} size={14} color={theme.colors.accentDark} />}
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={theme.colors.textTertiary} />
        </TouchableOpacity>
        {open && <View style={styles.inlinePanel}>{renderPanel()}</View>}
      </View>
    );
  };

  const renderPanel = () => {
    switch (panel) {
      case "when":
        return (
          <>
            <DayPicker todayKey={todayKey} value={due} onChange={changeDue} />
            <Text style={styles.panelTitle}>{t("REPEAT")}</Text>
            {renderChips(REPEAT_CHOICES, repeat, repeatChoiceLabel, changeRepeat)}
          </>
        );
      case "duration":
        return (
          <>
            <Text style={styles.panelTitle}>{t("HOW LONG, HONESTLY?")}</Text>
            {renderChips(durationChoices, minutes, (value) => t("{0} min", value), (value) => {
              setMinutes(value);
              setMinutesText("");
              setTouched((t) => ({ ...t, minutes: true }));
            })}
            <View style={styles.minutesRow}>
              <Text style={styles.hint}>{t("Or type it:")}</Text>
              <TextInput
                style={styles.minutesInput}
                value={minutesText}
                onChangeText={typeMinutes}
                placeholder={String(minutes)}
                placeholderTextColor={theme.colors.textTertiary}
                keyboardType="number-pad"
                returnKeyType="done"
                maxLength={3}
                accessibilityLabel={t("Minutes, typed")}
              />
              <Text style={styles.hint}>{t("min")}</Text>
            </View>
          </>
        );
      case "time": {
        const anchor = reminderAnchor(timeFields(time));
        const picker = (value: string, label: string, onPick: (picked: string) => void, showShortcuts = true) => (
          <TimePicker
            value={value}
            now={now}
            workStartHour={workStartHour}
            workEndHour={workEndHour}
            onChange={onPick}
            label={label}
            showShortcuts={showShortcuts}
          />
        );
        return (
          <>
            <Text style={styles.panelTitle}>{t("WHEN IN THE DAY")}</Text>
            {renderChips(TIME_KINDS, time.kind, timeKindLabel, changeTimeKind)}
            {time.kind === "any" && (
              <Text style={styles.hint}>
                {t("Do it whenever it suits you. Pick a time to get a nudge, or a window like “after 20:00” so it waits until then.")}
              </Text>
            )}
            {time.kind === "at" && picker(time.time, t("Start time"), (picked) => changeTime({ kind: "at", time: picked }))}
            {time.kind === "after" && picker(time.start, t("After"), (picked) => changeTime({ kind: "after", start: picked }))}
            {time.kind === "before" && picker(time.end, t("Done by"), (picked) => changeTime({ kind: "before", end: picked }))}
            {time.kind === "between" && (
              <>
                <Text style={[styles.panelTitle, styles.panelTitleSpaced]}>{t("FROM")}</Text>
                {picker(time.start, t("From"), (picked) => changeTime({ ...time, start: picked }), false)}
                <Text style={[styles.panelTitle, styles.panelTitleSpaced]}>{t("TO")}</Text>
                {picker(time.end, t("To"), (picked) => changeTime({ ...time, end: picked }), false)}
                {!isValidTaskTime(time) && <Text style={styles.errorText}>{t("The window has to end after it starts.")}</Text>}
              </>
            )}
            {anchor && (
              <>
                <Text style={[styles.panelTitle, styles.panelTitleSpaced]}>
                  {time.kind === "at" ? t("REMIND ME · BEFORE IT STARTS") : t("REMIND ME · BEFORE {0}", anchor)}
                </Text>
                {renderChips(REMINDER_VALUES, reminder, reminderChipLabel, changeReminder)}
                {reminder !== null && (
                  <Text style={styles.hint}>
                    {!taskRemindersEnabled
                      ? t(TASK_REMINDERS_SWITCHED_OFF)
                      : permission === "denied"
                      ? t(REMINDER_PERMISSION_OFF)
                      : reminderHint(reminderPlan, now)}
                  </Text>
                )}
              </>
            )}
          </>
        );
      }
      case "notes":
        return (
          <>
            <Text style={styles.panelTitle}>{t("DETAILS")}</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder={t("Anything you want to remember about it")}
              placeholderTextColor={theme.colors.textTertiary}
              multiline
              maxLength={TASK_LIMITS.notesMaxLength}
              accessibilityLabel={t("Details")}
            />
          </>
        );
      case "more":
        return (
          <>
            <Text style={styles.panelTitle}>{t("PART OF THE DAY")}</Text>
            {renderChips(TIMING_VALUES, timing, (value) => TIMING_LABELS[value], changeTiming)}
            <Text style={[styles.panelTitle, styles.panelTitleSpaced]}>{t("CATEGORY")}</Text>
            {renderChips<string | null>(
              [null, ...CATEGORIES.map((c) => c.id)],
              category,
              (value) => (value ? getCategory(value).label : t("None")),
              (value) => {
                setCategory(value);
                setTouched((t) => ({ ...t, category: true }));
              }
            )}
            <Text style={[styles.panelTitle, styles.panelTitleSpaced]}>{t("ENERGY IT NEEDS")}</Text>
            {renderChips(
              ENERGY_VALUES,
              energy,
              (value) => (value ? energyLabel(value) : t(ANY_ENERGY_LABEL)),
              (value) => {
                setEnergy(value);
                setTouched((t) => ({ ...t, energy: true }));
              }
            )}
          </>
        );
      default:
        return null;
    }
  };

  // Usuals only while nothing is typed or open, so the pop-up stays small.
  const showUsuals = !editing && !trimmedTitle && panel === null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onDismiss={onDismissed}>
      <KeyboardAvoidingView style={styles.frame} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t("Close task sheet")} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.heading}>{editing ? t("Edit task") : t("New task")}</Text>
            <View style={styles.headerActions}>
              {!editing && (
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={onOpenBrainDump}
                  accessibilityLabel={t("Brain dump: say everything at once")}
                >
                  <Ionicons name="mic-outline" size={20} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.iconButton} onPress={onClose} accessibilityLabel={t("Close")}>
                <Ionicons name="close" size={22} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <TextInput
                ref={inputRef}
                style={styles.titleInput}
                value={title}
                onChangeText={handleTitleChange}
                onFocus={() => setPanel(null)}
                placeholder={t("What needs doing?")}
                placeholderTextColor={theme.colors.textTertiary}
                returnKeyType="done"
                onSubmitEditing={submit}
                maxLength={TASK_LIMITS.titleMaxLength}
                accessibilityLabel={t("What do you need to do?")}
              />
              {!editing && exactMatch && (
                <Text style={styles.memoryText}>
                  {exactMatch.timesCompleted > 0 && exactMatch.minMinutes !== null && exactMatch.maxMinutes !== null
                    ? exactMatch.minMinutes === exactMatch.maxMinutes
                      ? t("Done {0}× before · usually {1} min. Filled in for you.", exactMatch.timesCompleted, exactMatch.minMinutes)
                      : t(
                          "Done {0}× before · usually {1}–{2} min. Filled in for you.",
                          exactMatch.timesCompleted,
                          exactMatch.minMinutes,
                          exactMatch.maxMinutes
                        )
                    : t("You've added this before · last time {0} min.", exactMatch.lastMinutes)}
                </Text>
              )}
              {!editing && suggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {suggestions.map((entry) => (
                    <TouchableOpacity
                      key={entry.title}
                      style={styles.suggestionRow}
                      onPress={() => selectSuggestion(entry)}
                      accessibilityLabel={t("Use {0}", entry.title)}
                    >
                      <Ionicons name="time-outline" size={14} color={theme.colors.textTertiary} />
                      <Text style={styles.suggestionText} numberOfLines={1}>{entry.title}</Text>
                      <Text style={styles.suggestionMeta}>{t("{0} min", entry.usualMinutes)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.rows}>
                {renderRow("when", "calendar-outline", t("Day"), dueLabel, resolvedDue.due_date !== null, t("Day: {0}", dueLabel))}
                {renderRow(
                  "time",
                  "time-outline",
                  t("Time"),
                  taskTimeLabel(time) ?? t("Anytime"),
                  time.kind !== "any",
                  time.kind !== "any"
                    ? t("Time: {0}, {1}", taskTimeSpoken(time), reminderLabel(reminder).toLowerCase())
                    : t("Time and reminder"),
                  reminderAnchor(timeFields(time)) && reminder !== null ? "notifications" : undefined
                )}
                {renderRow(
                  "duration",
                  "hourglass-outline",
                  t("How long"),
                  t("{0} min", minutes),
                  touched.minutes || !!exactMatch,
                  t("Duration: {0} minutes", minutes)
                )}
                {renderRow(
                  "notes",
                  "document-text-outline",
                  t("Details"),
                  notes.trim() ? notes.trim().split("\n")[0] : t("Add"),
                  notes.trim() !== "",
                  notes.trim() ? t("Details, added") : t("Add details")
                )}
                {renderRow(
                  "more",
                  "options-outline",
                  t("More"),
                  moreLabel ?? t("Category, energy"),
                  moreIsSet,
                  t("More: part of the day, category, energy")
                )}
              </View>
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {showUsuals && shownUsuals.length > 0 && (
              <View style={styles.usuals}>
                <Text style={styles.sectionTitle}>
                  {plannedDayLabel
                    ? t("YOUR USUALS · ONE TAP ADDS FOR {0}", plannedDayLabel.toUpperCase())
                    : t("YOUR USUALS · ONE TAP ADDS FOR TODAY")}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.usualRow} keyboardShouldPersistTaps="handled">
                  {shownUsuals.map((rhythm) => {
                    const added = addedKeys.includes(rhythm.key);
                    const late = isLate(rhythm);
                    return (
                      <TouchableOpacity
                        key={rhythm.key}
                        style={[styles.usualChip, added && styles.usualChipAdded, late && !added && styles.usualChipLate]}
                        onPress={() => addUsual(rhythm)}
                        onLongPress={() => adjustUsual(rhythm)}
                        disabled={saving || added}
                        accessibilityState={{ disabled: saving || added }}
                        accessibilityLabel={
                          plannedDayLabel
                            ? added
                              ? t("{0}, added for {1}", rhythm.title, plannedDayLabel)
                              : t("Add {0} for {1}. {2} min, {3}", rhythm.title, plannedDayLabel, usualMinutesOf(rhythm), describeLastDone(rhythm))
                            : added
                            ? t("{0}, added for today", rhythm.title)
                            : t("Add {0} for today. {1} min, {2}", rhythm.title, usualMinutesOf(rhythm), describeLastDone(rhythm))
                        }
                        accessibilityHint={t("Touch and hold to adjust it before adding")}
                      >
                        <View style={[styles.usualDot, { backgroundColor: categoryColor(getCategory(rhythm.category), theme) }]} />
                        <Text style={[styles.usualChipText, added && styles.usualChipTextAdded]} numberOfLines={1}>
                          {rhythm.title}
                        </Text>
                        <Text style={[styles.usualChipMeta, added && styles.usualChipTextAdded]}>
                          {added ? "✓" : t("{0} min", usualMinutesOf(rhythm))}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {!editing && lastAdded && !trimmedTitle && (
              <View style={styles.toast} accessibilityLiveRegion="polite">
                <Ionicons name="checkmark" size={16} color={theme.colors.quickText} />
                <Text style={styles.toastText} numberOfLines={1}>
                  {t("Added “{0}”", lastAdded.title)}
                  {lastAdded.when ? ` ${lastAdded.when}` : ""}
                </Text>
                <TouchableOpacity
                  style={styles.toastUndo}
                  onPress={undoLastAdd}
                  accessibilityRole="button"
                  accessibilityLabel={t("Undo adding {0}", lastAdded.title)}
                >
                  <Text style={styles.toastUndoText}>{t("Undo")}</Text>
                </TouchableOpacity>
              </View>
            )}
            {(editing || trimmedTitle || !lastAdded) && (
              <TouchableOpacity
                style={[styles.addButton, (!trimmedTitle || saving) && styles.addButtonDisabled]}
                onPress={submit}
                disabled={!trimmedTitle || saving}
                accessibilityRole="button"
              >
                {saving && <ActivityIndicator color={theme.colors.onAccent} />}
                <Text style={styles.addButtonText} numberOfLines={1}>
                  {editing ? t("Save changes") : trimmedTitle ? t("Add “{0}”", trimmedTitle) : t("Add task")}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
  // The page stays visible and dimmed above; the pop-up sits at the bottom, only as tall as it needs.
  frame: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: theme.colors.overlay,
  },
  sheet: {
    maxHeight: "92%",
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingTop: 10,
  },
  scroll: {
    flexGrow: 0,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  heading: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontFamily: theme.fonts.display,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    gap: 12,
  },
  card: {
    padding: theme.spacing.md,
    paddingTop: 6,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
  },
  titleInput: {
    color: theme.colors.textPrimary,
    fontSize: 22,
    fontFamily: theme.fonts.display,
    paddingVertical: theme.spacing.sm,
    outlineWidth: 0, // web: the card already frames the field
  },
  memoryText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    marginTop: -6,
  },
  suggestions: {
    marginTop: -4,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 40,
  },
  suggestionText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
  },
  suggestionMeta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontFamily: theme.fonts.mono,
    fontVariant: ["tabular-nums"],
  },
  rows: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  rowBlock: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 46,
  },
  rowLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "500",
  },
  rowValue: {
    flex: 1,
    textAlign: "right",
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    fontVariant: ["tabular-nums"],
  },
  rowValueSet: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
  inlinePanel: {
    paddingBottom: theme.spacing.md,
    gap: 10,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  panelTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  panelTitleSpaced: {
    marginTop: theme.spacing.xs,
  },
  textButton: {
    minHeight: 32,
    justifyContent: "center",
  },
  textButtonText: {
    color: theme.colors.danger,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "600",
  },
  emptyPanel: {
    gap: 12,
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    height: 48,
    borderRadius: theme.radius.pill,
    borderWidth: 1.5,
    borderColor: theme.colors.accentDark,
  },
  secondaryButtonText: {
    color: theme.colors.accentDark,
    fontSize: 16,
    fontWeight: "600",
  },
  hint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    lineHeight: 18,
  },
  minutesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  minutesInput: {
    minWidth: 64,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  notesInput: {
    minHeight: 96,
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: "center",
  },
  chipSelected: {
    borderColor: theme.colors.accentDark,
    backgroundColor: theme.colors.accentDark,
  },
  chipText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  chipTextSelected: {
    color: theme.colors.onAccent,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.footnote.fontSize,
    paddingHorizontal: 4,
  },
  usuals: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  usualRow: {
    gap: theme.spacing.sm,
  },
  usualChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    maxWidth: 240,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  usualChipLate: {
    borderColor: theme.colors.accentDark,
  },
  usualChipAdded: {
    backgroundColor: theme.colors.accentDark,
    borderColor: theme.colors.accentDark,
  },
  usualDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  usualChipText: {
    flexShrink: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "600",
  },
  usualChipMeta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontVariant: ["tabular-nums"],
  },
  usualChipTextAdded: {
    color: theme.colors.onAccent,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    height: 56,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentDark,
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    color: theme.colors.onAccent,
    fontSize: 17,
    fontWeight: "600",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    minHeight: 52,
    paddingLeft: theme.spacing.md,
    paddingRight: 4,
    borderRadius: 16,
    backgroundColor: theme.colors.quickFill,
  },
  toastText: {
    flex: 1,
    color: theme.colors.quickText,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "500",
  },
  toastUndo: {
    height: 44,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  toastUndoText: {
    color: theme.colors.quickText,
    textDecorationLine: "underline",
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "700",
  },
}));

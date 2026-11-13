import React, { useEffect, useRef, useState } from "react";
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
import { hourOf, suggestedStartTime } from "../lib/timeOptions";
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
import { TimePicker } from "./TimePicker";
import { t } from "../i18n";

const MINUTE_PRESETS = [2, 5, 10, 15, 20, 30, 45, 60, 90];
const TIMING_VALUES: TaskTiming[] = ["anytime", "before_work", "after_work"];
// null = no energy set, so "What can I do now?" never hides the task.
const ENERGY_VALUES: (EnergyLevel | null)[] = [null, ...ENERGY_OPTIONS.map((option) => option.value)];
const REMINDER_VALUES: (number | null)[] = [null, ...REMINDER_OFFSETS];

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
  onAdd,
  onUndo,
  onSave,
  onOpenBrainDump,
  onClose,
  onDismissed,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const inputRef = useRef<TextInput>(null);

  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState<number>(TASK_LIMITS.defaultEstimatedMinutes);
  const [timing, setTiming] = useState<TaskTiming>("anytime");
  const [due, setDue] = useState<DueChoice>(DEFAULT_DUE_CHOICE);
  const [category, setCategory] = useState<string | null>(null);
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
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

  const resetDraft = () => {
    setTitle("");
    setMinutes(TASK_LIMITS.defaultEstimatedMinutes);
    setTiming("anytime");
    setDue(DEFAULT_DUE_CHOICE);
    setCategory(null);
    setEnergy(null);
    setScheduledTime(null);
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
    setCategory(task.category);
    setEnergy(task.energy_level);
    setScheduledTime(task.scheduled_time);
    setReminder(task.reminder_minutes_before);
    setNotes(task.notes ?? "");
    setMinutesText("");
    setPanel(task.notes ? "notes" : null);
    setTouched({ ...EDIT_TOUCHED, time: task.scheduled_time !== null });
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
  }, [visible, editing?.id]);

  // The reminder panel says up front when notifications are off for the app.
  useEffect(() => {
    if (panel !== "time") return;
    getNotificationPermission()
      .then(setPermission)
      .catch((e) => console.warn("[AddTaskSheet] permission check failed", e));
  }, [panel]);

  const now = new Date();
  const todayKey = toLocalDateKey(now);
  const trimmedTitle = title.trim();
  const exactMatch = trimmedTitle ? findExactMatch(history, title) : undefined;
  const suggestions = trimmedTitle && !exactMatch ? findMatches(history, title, 3) : [];
  // An edited task keeps its exact day and deadline until another one is picked.
  const resolvedDue =
    editing && !touched.due
      ? { due_date: editing.due_date, due_kind: editing.due_kind }
      : resolveDueChoice(due, todayKey);
  const dueLabel =
    editing && !touched.due && editing.due_date
      ? formatDueLabel(editing.due_date, editing.due_kind, todayKey)
      : dueChoiceLabel(due, todayKey);
  const work = { workStartHour, workEndHour };

  const applyMemory = (
    entry: Pick<TaskHistoryEntry, "lastMinutes" | "timing" | "category" | "energyLevel">,
    force: boolean
  ) => {
    if (force || !touched.minutes) setMinutes(entry.lastMinutes);
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
  const applyTime = (time: string) => {
    setScheduledTime(time);
    if (!touched.timing) setTiming(timingForHour(hourOf(time), workStartHour, workEndHour));
  };

  // A time picked by hand stays, whatever part of the day is chosen later.
  const changeTime = (time: string) => {
    applyTime(time);
    setTouched((t) => ({ ...t, time: true }));
  };

  const changeDue = (choice: DueChoice) => {
    setDue(choice);
    setTouched((t) => ({ ...t, due: true }));
  };

  // A part of the day picked by hand moves a suggested start time into it.
  const changeTiming = (value: TaskTiming) => {
    setTiming(value);
    setTouched((t) => ({ ...t, timing: true }));
    if (scheduledTime && !touched.time) setScheduledTime(suggestedStartTime(now, value, work));
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
    setScheduledTime(null);
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

  // The first time a task gets a start time it also gets the default nudge.
  const addTime = () => {
    applyTime(suggestedStartTime(now, timing, work));
    changeReminder(DEFAULT_REMINDER_MINUTES);
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

  const addUsual = (rhythm: TaskRhythm) => {
    // An added usual stays added until Undo: a second tap must not create a duplicate.
    if (saving || addedKeys.includes(rhythm.key)) return;
    save({
      title: rhythm.title,
      estimated_minutes: rhythm.lastMinutes,
      timing: rhythm.timing,
      category: rhythm.category,
      energy_level: findExactMatch(history, rhythm.title)?.energyLevel ?? null,
      source: "app",
    });
  };

  const adjustUsual = (rhythm: TaskRhythm) => {
    resetDraft();
    setTitle(rhythm.title);
    applyMemory({ ...rhythm, energyLevel: findExactMatch(history, rhythm.title)?.energyLevel ?? null }, true);
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
    const fields = {
      title: trimmedTitle.slice(0, TASK_LIMITS.titleMaxLength),
      estimated_minutes: clampEstimatedMinutes(minutes),
      timing,
      category,
      energy_level: energy,
      scheduled_time: scheduledTime,
      reminder_minutes_before: scheduledTime ? reminder : null,
      notes: notes.trim().slice(0, TASK_LIMITS.notesMaxLength) || null,
      ...resolvedDue,
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
    scheduledTime && reminder !== null
      ? taskReminderMoment(
          {
            id: "draft",
            status: "pending",
            scheduled_time: scheduledTime,
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

  const renderPill = (
    id: Panel,
    icon: React.ComponentProps<typeof Ionicons>["name"],
    label: string | null,
    isSet: boolean,
    a11y: string,
    trailingIcon?: React.ComponentProps<typeof Ionicons>["name"]
  ) => {
    const open = panel === id;
    const color = open ? theme.colors.onAccent : isSet ? theme.colors.accentDark : theme.colors.textSecondary;
    return (
      <TouchableOpacity
        style={[styles.pill, !label && styles.pillIconOnly, isSet && styles.pillSet, open && styles.pillOpen]}
        onPress={() => togglePanel(id)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={a11y}
      >
        <Ionicons name={icon} size={16} color={color} />
        {label && (
          <Text style={[styles.pillText, isSet && styles.pillTextSet, open && styles.pillTextOpen]} numberOfLines={1}>
            {label}
          </Text>
        )}
        {trailingIcon && <Ionicons name={trailingIcon} size={14} color={color} />}
      </TouchableOpacity>
    );
  };

  const renderPanel = () => {
    switch (panel) {
      case "when":
        return <DayPicker todayKey={todayKey} value={due} onChange={changeDue} />;
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
      case "time":
        return scheduledTime ? (
          <>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{t("STARTS AT")}</Text>
              <TouchableOpacity style={styles.textButton} onPress={removeTime} accessibilityRole="button">
                <Text style={styles.textButtonText}>{t("Remove time")}</Text>
              </TouchableOpacity>
            </View>
            <TimePicker
              value={scheduledTime}
              now={now}
              workStartHour={workStartHour}
              workEndHour={workEndHour}
              onChange={changeTime}
            />
            <Text style={[styles.panelTitle, styles.panelTitleSpaced]}>{t("REMIND ME · BEFORE IT STARTS")}</Text>
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
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={styles.hint}>
              {t("Give it a start time and PaceTasks can nudge you when it's time. It also unlocks a Focus session.")}
            </Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={addTime} accessibilityRole="button">
              <Ionicons name="time-outline" size={18} color={theme.colors.accentDark} />
              <Text style={styles.secondaryButtonText}>{t("Set a start time")}</Text>
            </TouchableOpacity>
          </View>
        );
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

  const showUsuals = !editing && !trimmedTitle && panel === null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onDismiss={onDismissed}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
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

          <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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
                      <Text style={styles.suggestionMeta}>{entry.lastMinutes} min</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={styles.pillRow}>
                {renderPill(
                  "when",
                  "calendar-outline",
                  dueLabel,
                  resolvedDue.due_date !== null,
                  t("Day: {0}", dueLabel)
                )}
                {renderPill("duration", "hourglass-outline", t("{0} min", minutes), touched.minutes || !!exactMatch, t("Duration: {0} minutes", minutes))}
                {renderPill(
                  "time",
                  "time-outline",
                  scheduledTime ?? t("Time"),
                  scheduledTime !== null,
                  scheduledTime
                    ? t("Start time {0}, {1}", scheduledTime, reminderLabel(reminder).toLowerCase())
                    : t("Start time and reminder"),
                  scheduledTime && reminder !== null ? "notifications" : undefined
                )}
                {renderPill(
                  "notes",
                  "document-text-outline",
                  notes.trim() ? t("Details") : null,
                  notes.trim() !== "",
                  notes.trim() ? t("Details, added") : t("Add details")
                )}
                {renderPill("more", "options-outline", moreLabel, moreIsSet, t("More: part of the day, category, energy"))}
              </View>
            </View>

            {panel && <View style={styles.panel}>{renderPanel()}</View>}

            {error && <Text style={styles.errorText}>{error}</Text>}

            {showUsuals && (
              <View style={styles.usuals}>
                <Text style={styles.sectionTitle}>{t("YOUR USUALS · ONE TAP ADDS FOR TODAY")}</Text>
                {shownUsuals.length === 0 ? (
                  <Text style={styles.emptyText}>
                    {t("Tasks you do more than once show up here, ready to add again in one tap.")}
                  </Text>
                ) : (
                  <View style={styles.usualList}>
                    {shownUsuals.map((rhythm, index) => {
                      const added = addedKeys.includes(rhythm.key);
                      const late = isLate(rhythm);
                      return (
                        <View key={rhythm.key} style={[styles.usualRow, index > 0 && styles.usualDivider]}>
                          <TouchableOpacity
                            style={styles.usualMain}
                            onPress={() => addUsual(rhythm)}
                            disabled={saving || added}
                            accessibilityState={{ disabled: saving || added }}
                            accessibilityLabel={added ? t("{0}, added for today", rhythm.title) : t("Add {0} for today", rhythm.title)}
                          >
                            <View
                              style={[styles.usualIcon, added && styles.usualIconAdded]}
                            >
                              <Ionicons
                                name={added ? "checkmark" : "add"}
                                size={18}
                                color={added ? theme.colors.onAccent : theme.colors.accentDark}
                              />
                            </View>
                            <View style={styles.usualText}>
                              <Text style={styles.usualTitle} numberOfLines={1}>{rhythm.title}</Text>
                              <View style={styles.usualMetaRow}>
                                <View
                                  style={[styles.usualDot, { backgroundColor: categoryColor(getCategory(rhythm.category), theme) }]}
                                />
                                <Text
                                  style={[styles.usualMeta, late && !added && styles.usualMetaLate, added && styles.usualMetaAdded]}
                                  numberOfLines={1}
                                >
                                  {added ? t("Added for today") : t("{0} min · {1}", rhythm.lastMinutes, describeLastDone(rhythm))}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.usualAdjust}
                            onPress={() => adjustUsual(rhythm)}
                            accessibilityLabel={t("Adjust {0} before adding", rhythm.title)}
                          >
                            <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
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
  flex: {
    flex: 1,
  },
  backdrop: {
    height: "8%",
    backgroundColor: theme.colors.overlay,
  },
  sheet: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingTop: 10,
    marginTop: -theme.radius.xl,
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
    fontSize: 24,
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
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: 14,
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
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 36,
    maxWidth: "100%",
    paddingHorizontal: 11,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  pillIconOnly: {
    width: 36,
    paddingHorizontal: 0,
    justifyContent: "center",
  },
  pillSet: {
    borderColor: theme.colors.accentDark,
    backgroundColor: theme.colors.surface,
  },
  pillOpen: {
    borderColor: theme.colors.accentDark,
    backgroundColor: theme.colors.accentDark,
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  pillTextSet: {
    color: theme.colors.accentDark,
  },
  pillTextOpen: {
    color: theme.colors.onAccent,
  },
  panel: {
    padding: theme.spacing.md,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
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
    marginTop: theme.spacing.xs,
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
    paddingHorizontal: 4,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    lineHeight: 20,
    padding: theme.spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.colors.border,
  },
  usualList: {
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  usualRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  usualDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  usualMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingLeft: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  usualIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: theme.colors.accentDark,
    alignItems: "center",
    justifyContent: "center",
  },
  usualIconAdded: {
    backgroundColor: theme.colors.accentDark,
  },
  usualText: {
    flex: 1,
    gap: 2,
  },
  usualTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "600",
  },
  usualMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  usualDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  usualMeta: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
  },
  usualMetaLate: {
    color: theme.colors.danger,
  },
  usualMetaAdded: {
    color: theme.colors.quickText,
    fontWeight: "600",
  },
  usualAdjust: {
    width: 48,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
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

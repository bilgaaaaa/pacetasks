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
import { TASK_LIMITS } from "@domain/task";
import { TaskHistoryEntry, findExactMatch, findMatches, normalizeTitle } from "@domain/taskHistory";
import { addDays, toLocalDateKey } from "@domain/dates";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { EnergyLevel, Task, TaskDraft, TaskTiming } from "../lib/types";
import { CATEGORIES, categoryColor, getCategory } from "../lib/categories";
import { TIMING_LABELS } from "../lib/taskSections";
import { ANY_ENERGY_LABEL, ENERGY_OPTIONS, energyLabel } from "../lib/energy";
import { resolveDueOption } from "../lib/dueOptions";
import { TaskRhythm, describeLastDone, isLate } from "../lib/taskRhythm";

const MINUTE_PRESETS = [2, 5, 15, 30, 60];
const TIMING_VALUES: TaskTiming[] = ["anytime", "before_work", "after_work"];
// null = no energy set, so "What can I do now?" never hides the task.
const ENERGY_VALUES: (EnergyLevel | null)[] = [null, ...ENERGY_OPTIONS.map((option) => option.value)];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Half-hour presets from 6am to 10pm; a fixed time turns the task into a Focus session.
const SCHEDULED_TIMES = Array.from({ length: 33 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
});

type Mode = "usuals" | "new";
type WhenChoice = "today" | "after_work" | "tomorrow";

interface Props {
  visible: boolean;
  history: Map<string, TaskHistoryEntry>;
  usuals: TaskRhythm[]; // repeat tasks for one-tap adding, most overdue first
  onAdd: (draft: TaskDraft) => Promise<Task | undefined>; // undefined when saving failed
  onUndo: (taskId: string) => Promise<boolean>; // false when the delete failed
  onOpenBrainDump: () => void;
  onClose: () => void;
}

// "Wed 30 Sep" for a date key, used on the Tomorrow card.
function shortDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return `${WEEKDAY_SHORT[date.getUTCDay()]} ${date.getUTCDate()} ${MONTH_SHORT[date.getUTCMonth()]}`;
}

// The add sheet: opens on your usuals (repeat tasks, one tap adds them for
// today, ⋯ adjusts first) with a big "What?" field on top. Typing something
// new switches to three calm questions (what, how long, when) with optional
// extras tucked away. After each add it returns to the usuals with an Undo.
export function AddTaskSheet({ visible, history, usuals, onAdd, onUndo, onOpenBrainDump, onClose }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const inputRef = useRef<TextInput>(null);

  const [mode, setMode] = useState<Mode>("usuals");
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState<number>(TASK_LIMITS.defaultEstimatedMinutes);
  const [timing, setTiming] = useState<TaskTiming>("anytime");
  const [tomorrow, setTomorrow] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  // Fields the user set by hand are never overwritten by task memory.
  const [touched, setTouched] = useState({ minutes: false, timing: false, category: false, energy: false });
  // Snapshot taken on open: an added usual becomes pending and would otherwise vanish from the grid.
  const [shownUsuals, setShownUsuals] = useState<TaskRhythm[]>(usuals);
  const [addedKeys, setAddedKeys] = useState<string[]>([]);
  const [lastAdded, setLastAdded] = useState<{ taskId: string; key: string; title: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetDraft = () => {
    setTitle("");
    setMinutes(TASK_LIMITS.defaultEstimatedMinutes);
    setTiming("anytime");
    setTomorrow(false);
    setCategory(null);
    setEnergy(null);
    setScheduledTime(null);
    setShowExtras(false);
    setTouched({ minutes: false, timing: false, category: false, energy: false });
  };

  // Every opening starts on the usuals with nothing left over from last time.
  useEffect(() => {
    if (!visible) return;
    resetDraft();
    setMode("usuals");
    setShownUsuals(usuals);
    setAddedKeys([]);
    setLastAdded(null);
    setError(null);
  }, [visible]);

  const todayKey = toLocalDateKey(new Date());
  const exactMatch = title.trim() ? findExactMatch(history, title) : undefined;
  const suggestions = mode === "new" && !exactMatch ? findMatches(history, title, 3) : [];
  const whenChoice: WhenChoice = tomorrow ? "tomorrow" : timing === "after_work" ? "after_work" : "today";

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
    setMode("new");
    const match = findExactMatch(history, text);
    if (match) applyMemory(match, false);
  };

  const selectSuggestion = (entry: TaskHistoryEntry) => {
    setTitle(entry.title);
    applyMemory(entry, true);
  };

  // Shared by one-tap usuals and the "new" form; returns true when the task was saved.
  const save = async (draft: TaskDraft): Promise<boolean> => {
    setSaving(true);
    setError(null);
    const created = await onAdd(draft);
    setSaving(false);
    if (!created) {
      console.warn("[AddTaskSheet] add failed", draft.title);
      setError("Couldn't add that task. Check your connection and try again.");
      return false;
    }
    const key = normalizeTitle(draft.title);
    setAddedKeys((prev) => [...prev, key]);
    setLastAdded({ taskId: created.id, key, title: draft.title });
    return true;
  };

  const addUsual = (rhythm: TaskRhythm) => {
    if (saving) return;
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
    setMode("new");
  };

  const submitNew = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    const saved = await save({
      title: trimmed.slice(0, TASK_LIMITS.titleMaxLength),
      estimated_minutes: Math.min(TASK_LIMITS.maxEstimatedMinutes, Math.max(TASK_LIMITS.minEstimatedMinutes, minutes)),
      timing,
      category,
      energy_level: energy,
      scheduled_time: scheduledTime,
      ...resolveDueOption(tomorrow ? "tomorrow" : "any", todayKey),
      source: "app",
    });
    if (saved) {
      // Back to the usuals, so the next thought is one tap or one word away.
      Keyboard.dismiss();
      resetDraft();
      setMode("usuals");
    }
  };

  const undoLastAdd = async () => {
    if (!lastAdded) return;
    const { taskId, key } = lastAdded;
    setLastAdded(null);
    const undone = await onUndo(taskId);
    if (!undone) {
      console.warn("[AddTaskSheet] undo failed", taskId);
      setError("Couldn't undo that one. You can delete it from the list.");
      return;
    }
    setAddedKeys((prev) => {
      const index = prev.lastIndexOf(key);
      return index === -1 ? prev : [...prev.slice(0, index), ...prev.slice(index + 1)];
    });
  };

  const backToUsuals = () => {
    Keyboard.dismiss();
    resetDraft();
    setMode("usuals");
    setError(null);
  };

  const pickWhen = (choice: WhenChoice) => {
    setTomorrow(choice === "tomorrow");
    if (choice === "after_work") setTiming("after_work");
    if (choice === "today" && timing === "after_work") setTiming("anytime");
    if (choice !== "tomorrow") setTouched((t) => ({ ...t, timing: true }));
  };

  const durationChoices = Array.from(new Set([...MINUTE_PRESETS, minutes])).sort((a, b) => a - b);
  const whenCards: { id: WhenChoice; label: string; hint: string }[] = [
    { id: "today", label: "Today", hint: timing === "before_work" ? "before work" : "anytime" },
    { id: "after_work", label: "After work", hint: "today" },
    { id: "tomorrow", label: "Tomorrow", hint: shortDayLabel(addDays(todayKey, 1)) },
  ];

  const renderChips = <T,>(values: T[], selected: T, label: (value: T) => string, onPick: (value: T) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
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
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close add task" />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            {mode === "new" ? (
              <TouchableOpacity style={styles.pillButton} onPress={backToUsuals} accessibilityLabel="Back to your usuals">
                <Ionicons name="chevron-back" size={18} color={theme.colors.textPrimary} />
                <Text style={styles.pillButtonText}>Usuals</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.eyebrow}>ADD TO TODAY</Text>
            )}
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={onOpenBrainDump}
                accessibilityLabel="Brain dump: say everything at once"
              >
                <Ionicons name="mic-outline" size={20} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.pillButton} onPress={onClose}>
                <Text style={styles.pillButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.whatBlock}>
              <Text style={styles.questionLabel}>What?</Text>
              <TextInput
                ref={inputRef}
                style={[styles.whatInput, mode === "new" && styles.whatInputActive]}
                value={title}
                onChangeText={handleTitleChange}
                onFocus={() => setMode("new")}
                placeholder="Something new…"
                placeholderTextColor={theme.colors.textTertiary}
                returnKeyType="done"
                onSubmitEditing={submitNew}
                maxLength={TASK_LIMITS.titleMaxLength}
                accessibilityLabel="What do you need to do?"
              />
              {exactMatch && mode === "new" && (
                <Text style={styles.memoryText}>
                  {exactMatch.timesCompleted > 0 && exactMatch.minMinutes !== null && exactMatch.maxMinutes !== null
                    ? `Done ${exactMatch.timesCompleted}× before · usually ${
                        exactMatch.minMinutes === exactMatch.maxMinutes
                          ? exactMatch.minMinutes
                          : `${exactMatch.minMinutes}–${exactMatch.maxMinutes}`
                      } min. Filled in for you.`
                    : `You've added this before · last time ${exactMatch.lastMinutes} min.`}
                </Text>
              )}
              {suggestions.length > 0 && (
                <View style={styles.suggestions}>
                  {suggestions.map((entry, i) => (
                    <TouchableOpacity
                      key={entry.title}
                      style={[styles.suggestionRow, i > 0 && styles.suggestionDivider]}
                      onPress={() => selectSuggestion(entry)}
                    >
                      <Text style={styles.suggestionText} numberOfLines={1}>{entry.title}</Text>
                      <Text style={styles.suggestionMeta}>{entry.lastMinutes} min</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            {mode === "usuals" ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>OR ONE TAP · YOUR USUALS</Text>
                  {shownUsuals.length > 0 && <Text style={styles.sectionHint}>⋯ to adjust</Text>}
                </View>
                {shownUsuals.length === 0 ? (
                  <Text style={styles.emptyText}>
                    Tasks you do more than once show up here, ready to add again in one tap.
                  </Text>
                ) : (
                  <View style={styles.grid}>
                    {shownUsuals.map((rhythm) => {
                      const added = addedKeys.includes(rhythm.key);
                      const late = isLate(rhythm);
                      return (
                        <View key={rhythm.key} style={styles.tileSlot}>
                          <TouchableOpacity
                            style={[styles.tile, added && styles.tileAdded]}
                            onPress={() => addUsual(rhythm)}
                            disabled={saving}
                            accessibilityLabel={`Add ${rhythm.title} for today`}
                          >
                            <View style={styles.tileTop}>
                              <View
                                style={[styles.tileDot, { backgroundColor: categoryColor(getCategory(rhythm.category), theme) }]}
                              />
                              <Text style={styles.tileMinutes}>{rhythm.lastMinutes} min</Text>
                            </View>
                            <Text style={styles.tileTitle} numberOfLines={2}>{rhythm.title}</Text>
                            <Text style={[styles.tileNote, late && styles.tileNoteLate, added && styles.tileNoteAdded]}>
                              {added ? "Added for today" : describeLastDone(rhythm)}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.tileAdjust}
                            onPress={() => adjustUsual(rhythm)}
                            accessibilityLabel={`Adjust ${rhythm.title} before adding`}
                          >
                            <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <Text style={styles.questionLabel}>How long, honestly?</Text>
                  <View style={styles.durationRow} accessibilityRole="radiogroup">
                    {durationChoices.map((value) => {
                      const isSelected = value === minutes;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.durationCircle, isSelected && styles.durationSelected]}
                          onPress={() => {
                            setMinutes(value);
                            setTouched((t) => ({ ...t, minutes: true }));
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={`${value} minutes`}
                        >
                          <Text style={[styles.durationValue, isSelected && styles.textOnAccent]}>{value}</Text>
                          <Text style={[styles.durationUnit, isSelected && styles.textOnAccent]}>min</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.questionLabel}>When?</Text>
                  <View style={styles.whenRow} accessibilityRole="radiogroup">
                    {whenCards.map((card) => {
                      const isSelected = card.id === whenChoice;
                      return (
                        <TouchableOpacity
                          key={card.id}
                          style={[styles.whenCard, isSelected && styles.whenSelected]}
                          onPress={() => pickWhen(card.id)}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: isSelected }}
                        >
                          <Text style={[styles.whenHint, isSelected && styles.textOnAccent]}>{card.hint}</Text>
                          <Text style={[styles.whenLabel, isSelected && styles.textOnAccent]}>{card.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <TouchableOpacity style={styles.extrasToggle} onPress={() => setShowExtras((v) => !v)}>
                  <Text style={styles.extrasToggleText}>
                    {showExtras ? "− Fewer options" : "+ Category, energy, time of day, fixed time"}
                  </Text>
                </TouchableOpacity>

                {showExtras && (
                  <View style={styles.extras}>
                    <Text style={styles.extrasLabel}>CATEGORY</Text>
                    {renderChips<string | null>(
                      [null, ...CATEGORIES.map((c) => c.id)],
                      category,
                      (value) => (value ? getCategory(value).label : "None"),
                      (value) => {
                        setCategory(value);
                        setTouched((t) => ({ ...t, category: true }));
                      }
                    )}
                    <Text style={styles.extrasLabel}>ENERGY IT NEEDS</Text>
                    {renderChips(
                      ENERGY_VALUES,
                      energy,
                      (value) => (value ? energyLabel(value) : ANY_ENERGY_LABEL),
                      (value) => {
                        setEnergy(value);
                        setTouched((t) => ({ ...t, energy: true }));
                      }
                    )}
                    <Text style={styles.extrasLabel}>TIME OF DAY</Text>
                    {renderChips(TIMING_VALUES, timing, (value) => TIMING_LABELS[value], (value) => {
                      setTiming(value);
                      setTouched((t) => ({ ...t, timing: true }));
                    })}
                    <Text style={styles.extrasLabel}>FIXED START (FOCUS SESSION)</Text>
                    {renderChips<string | null>([null, ...SCHEDULED_TIMES], scheduledTime, (value) => value ?? "None", setScheduledTime)}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {mode === "new" ? (
              <TouchableOpacity
                style={[styles.addButton, (!title.trim() || saving) && styles.addButtonDisabled]}
                onPress={submitNew}
                disabled={!title.trim() || saving}
              >
                {saving && <ActivityIndicator color={theme.colors.onAccent} />}
                <Text style={styles.addButtonText} numberOfLines={1}>
                  {title.trim() ? `Add “${title.trim()}”` : "Add task"}
                </Text>
              </TouchableOpacity>
            ) : (
              lastAdded && (
                <View style={styles.toast} accessibilityLiveRegion="polite">
                  <Ionicons name="checkmark" size={16} color={theme.colors.quickText} />
                  <Text style={styles.toastText} numberOfLines={1}>Added “{lastAdded.title}”</Text>
                  <TouchableOpacity style={styles.toastUndo} onPress={undoLastAdd}>
                    <Text style={styles.toastUndoText}>Undo</Text>
                  </TouchableOpacity>
                </View>
              )
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
  eyebrow: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
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
  pillButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
  },
  pillButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: 22,
  },
  whatBlock: {
    gap: theme.spacing.sm,
  },
  questionLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "600",
  },
  whatInput: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontFamily: theme.fonts.display,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: theme.colors.border,
    outlineWidth: 0, // web: the underline already shows focus
  },
  whatInputActive: {
    borderBottomColor: theme.colors.accentDark,
  },
  memoryText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
  },
  suggestions: {
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
  },
  suggestionDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  suggestionText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
  },
  suggestionMeta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontFamily: theme.fonts.mono,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.footnote.fontSize,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  sectionTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
  },
  sectionHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: theme.spacing.sm,
  },
  tileSlot: {
    width: "48.5%",
  },
  tile: {
    minHeight: 108,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "space-between",
    gap: 6,
  },
  tileAdded: {
    borderColor: theme.colors.accentDark,
    backgroundColor: theme.colors.quickFill,
  },
  tileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tileDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tileMinutes: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: theme.fonts.mono,
  },
  tileTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "600",
    paddingRight: 20,
  },
  tileNote: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "600",
  },
  tileNoteLate: {
    color: theme.colors.danger,
  },
  tileNoteAdded: {
    color: theme.colors.quickText,
  },
  tileAdjust: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  durationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  durationCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  durationSelected: {
    borderColor: theme.colors.accentDark,
    backgroundColor: theme.colors.accentDark,
  },
  durationValue: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.mono,
  },
  durationUnit: {
    color: theme.colors.textSecondary,
    fontSize: 10,
  },
  textOnAccent: {
    color: theme.colors.onAccent,
  },
  whenRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  whenCard: {
    flex: 1,
    height: 88,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "space-between",
  },
  whenSelected: {
    borderColor: theme.colors.accentDark,
    backgroundColor: theme.colors.accentDark,
  },
  whenHint: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  whenLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "600",
  },
  extrasToggle: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  extrasToggleText: {
    color: theme.colors.accentDark,
    fontSize: 15,
    fontWeight: "600",
  },
  extras: {
    gap: theme.spacing.sm,
    marginTop: -theme.spacing.sm,
  },
  extrasLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginTop: theme.spacing.xs,
  },
  chipRow: {
    gap: 6,
  },
  chip: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
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
  },
  chipTextSelected: {
    color: theme.colors.onAccent,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    height: 60,
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

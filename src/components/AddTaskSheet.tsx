import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { TaskHistoryEntry, findExactMatch, findMatches } from "@domain/taskHistory";
import { toLocalDateKey } from "@domain/dates";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { TaskDraft, TaskTiming } from "../lib/types";
import { CATEGORIES, categoryColor, getCategory } from "../lib/categories";
import { TIMING_LABELS } from "../lib/taskSections";
import { DUE_OPTION_IDS, DUE_OPTION_LABELS, DueOption, resolveDueOption } from "../lib/dueOptions";

const MINUTE_PRESETS = [2, 5, 10, 15, 30, 60];
const TIMING_VALUES: TaskTiming[] = ["anytime", "before_work", "after_work"];
// Half-hour presets from 6am to 10pm; a fixed time turns the task into a Focus session.
const SCHEDULED_TIMES = Array.from({ length: 33 }, (_, i) => {
  const totalMinutes = 6 * 60 + i * 30;
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
});

type DetailField = "time" | "when" | "day" | "section" | "focus";

const FIELD_LABELS: Record<DetailField, string> = {
  time: "How long",
  when: "When in the day",
  day: "Which day",
  section: "Category",
  focus: "Fixed start time",
};

interface Props {
  visible: boolean;
  history: Map<string, TaskHistoryEntry>;
  onAdd: (draft: TaskDraft) => Promise<void>;
  onOpenBrainDump: () => void;
  onClose: () => void;
}

interface Choice<T> {
  value: T;
  label: string;
  badge?: string;
}

// The capture sheet: type, hit return, next thought. Only the name is needed;
// the chips above the keyboard (time, time of day, day, category, fixed time)
// are optional and pre-filled from task memory when a name is recognized. The
// sheet stays open after each add so a burst of small tasks takes seconds.
export function AddTaskSheet({ visible, history, onAdd, onOpenBrainDump, onClose }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const inputRef = useRef<TextInput>(null);

  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState<number>(TASK_LIMITS.defaultEstimatedMinutes);
  const [timing, setTiming] = useState<TaskTiming>("anytime");
  const [due, setDue] = useState<DueOption>("any");
  const [category, setCategory] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  // Fields the user set by hand are never overwritten by task memory.
  const [touched, setTouched] = useState({ minutes: false, timing: false, category: false });
  const [openField, setOpenField] = useState<DetailField | null>(null);
  const [addedTitles, setAddedTitles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetDetails = () => {
    setMinutes(TASK_LIMITS.defaultEstimatedMinutes);
    setTiming("anytime");
    setDue("any");
    setCategory(null);
    setScheduledTime(null);
    setTouched({ minutes: false, timing: false, category: false });
    setOpenField(null);
  };

  // Every opening starts clean: no leftover text or "just added" chips from last time.
  useEffect(() => {
    if (!visible) return;
    setTitle("");
    setAddedTitles([]);
    setError(null);
    resetDetails();
  }, [visible]);

  const exactMatch = title.trim() ? findExactMatch(history, title) : undefined;
  const suggestions = exactMatch ? [] : findMatches(history, title, 3);
  const canSubmit = title.trim().length > 0 && !saving;

  const applyMemory = (entry: TaskHistoryEntry, force: boolean) => {
    if (force || !touched.minutes) setMinutes(entry.lastMinutes);
    if (force || !touched.timing) setTiming(entry.timing);
    if (force || !touched.category) setCategory(entry.category);
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
    setTouched({ minutes: false, timing: false, category: false });
    inputRef.current?.focus();
  };

  const submit = async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    const draft: TaskDraft = {
      title: trimmed.slice(0, TASK_LIMITS.titleMaxLength),
      estimated_minutes: Math.min(TASK_LIMITS.maxEstimatedMinutes, Math.max(TASK_LIMITS.minEstimatedMinutes, minutes)),
      timing,
      category,
      scheduled_time: scheduledTime,
      ...resolveDueOption(due, toLocalDateKey(new Date())),
      source: "app",
    };
    setSaving(true);
    try {
      await onAdd(draft);
      setAddedTitles((prev) => [trimmed, ...prev]);
      setTitle("");
      resetDetails();
    } catch (e) {
      console.warn("[AddTaskSheet] add failed", e);
      setError("Couldn't add that task. Check your connection and try again.");
    } finally {
      setSaving(false);
      // Keeps the keyboard up for the next thought.
      inputRef.current?.focus();
    }
  };

  const timeChoices: Choice<number>[] = Array.from(
    new Set([...MINUTE_PRESETS, ...(exactMatch ? [exactMatch.lastMinutes] : [])])
  )
    .sort((a, b) => a - b)
    .map((m) => ({ value: m, label: `${m} min`, badge: exactMatch?.lastMinutes === m ? "usual" : undefined }));

  const chips: { field: DetailField; label: string; dot: string }[] = [
    { field: "time", label: `${minutes} min`, dot: theme.colors.accent },
    { field: "when", label: TIMING_LABELS[timing], dot: theme.colors.warning },
    { field: "day", label: DUE_OPTION_LABELS[due], dot: theme.colors.indigo },
    {
      field: "section",
      label: getCategory(category).label,
      dot: categoryColor(getCategory(category), theme),
    },
    { field: "focus", label: scheduledTime ? `Focus ${scheduledTime}` : "No fixed time", dot: theme.colors.textPrimary },
  ];

  const renderChoices = () => {
    switch (openField) {
      case "time":
        return renderChoiceRow(timeChoices, minutes, (value) => {
          setMinutes(value);
          setTouched((t) => ({ ...t, minutes: true }));
        });
      case "when":
        return renderChoiceRow(
          TIMING_VALUES.map((value) => ({ value, label: TIMING_LABELS[value] })),
          timing,
          (value) => {
            setTiming(value);
            setTouched((t) => ({ ...t, timing: true }));
          }
        );
      case "day":
        return renderChoiceRow(
          DUE_OPTION_IDS.map((value) => ({ value, label: DUE_OPTION_LABELS[value] })),
          due,
          setDue
        );
      case "section":
        return renderChoiceRow<string | null>(
          [{ value: null, label: "None" }, ...CATEGORIES.map((c) => ({ value: c.id, label: c.label }))],
          category,
          (value) => {
            setCategory(value);
            setTouched((t) => ({ ...t, category: true }));
          }
        );
      case "focus":
        return renderChoiceRow<string | null>(
          [{ value: null, label: "No fixed time" }, ...SCHEDULED_TIMES.map((value) => ({ value, label: value }))],
          scheduledTime,
          setScheduledTime,
          true
        );
      default:
        return null;
    }
  };

  function renderChoiceRow<T>(choices: Choice<T>[], selected: T, onPick: (value: T) => void, scrolls = false) {
    const items = choices.map((choice) => {
      const isSelected = choice.value === selected;
      return (
        <TouchableOpacity
          key={String(choice.value)}
          style={[styles.choice, isSelected && styles.choiceSelected]}
          onPress={() => {
            onPick(choice.value);
            setOpenField(null);
            // Back to typing: return adds the task with the detail just picked.
            inputRef.current?.focus();
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected: isSelected }}
        >
          <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>{choice.label}</Text>
          {choice.badge && (
            <Text style={[styles.choiceBadge, isSelected && styles.choiceTextSelected]}>{choice.badge.toUpperCase()}</Text>
          )}
        </TouchableOpacity>
      );
    });
    return scrolls ? (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.choiceRow} keyboardShouldPersistTaps="always">
        {items}
      </ScrollView>
    ) : (
      <View style={[styles.choiceRow, styles.choiceWrap]}>{items}</View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close new task" />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>New task</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={onOpenBrainDump}
                accessibilityLabel="Brain dump: say everything at once"
              >
                <Ionicons name="mic-outline" size={20} color={theme.colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneButton} onPress={onClose}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>

          {addedTitles.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.addedRow}
              accessibilityLiveRegion="polite"
            >
              {addedTitles.map((added, i) => (
                <View key={`${added}-${addedTitles.length - i}`} style={styles.addedChip}>
                  <Ionicons name="checkmark" size={13} color={theme.colors.quickText} />
                  <Text style={styles.addedChipText} numberOfLines={1}>
                    {added}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={title}
              onChangeText={handleTitleChange}
              placeholder="What's on your mind?"
              placeholderTextColor={theme.colors.textTertiary}
              autoFocus
              returnKeyType="send"
              submitBehavior="submit"
              onSubmitEditing={submit}
              maxLength={TASK_LIMITS.titleMaxLength}
              accessibilityLabel="Task name"
            />
            <TouchableOpacity
              style={[styles.sendButton, !canSubmit && styles.sendButtonDisabled]}
              onPress={submit}
              disabled={!canSubmit}
              accessibilityLabel="Add task"
            >
              {saving ? (
                <ActivityIndicator color={theme.colors.onAccent} />
              ) : (
                <Ionicons name="arrow-up" size={22} color={theme.colors.onAccent} />
              )}
            </TouchableOpacity>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {exactMatch && (
            <View style={styles.memoryRow}>
              <Ionicons name="time-outline" size={16} color={theme.colors.accent} />
              <Text style={styles.memoryText}>
                {exactMatch.timesCompleted > 0 && exactMatch.minMinutes !== null && exactMatch.maxMinutes !== null
                  ? `Done ${exactMatch.timesCompleted}× before · usually ${
                      exactMatch.minMinutes === exactMatch.maxMinutes
                        ? exactMatch.minMinutes
                        : `${exactMatch.minMinutes}–${exactMatch.maxMinutes}`
                    } min. Details filled in.`
                  : `You've added this before · last time ${exactMatch.lastMinutes} min.`}
              </Text>
            </View>
          )}

          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((entry, i) => (
                <TouchableOpacity
                  key={entry.title}
                  style={[styles.suggestionRow, i > 0 && styles.suggestionDivider]}
                  onPress={() => selectSuggestion(entry)}
                >
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text style={styles.suggestionMeta}>
                    {entry.lastMinutes} min
                    {entry.category ? ` · ${getCategory(entry.category).label}` : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {openField && (
            <View style={styles.choicePanel}>
              <Text style={styles.choicePanelLabel}>{FIELD_LABELS[openField].toUpperCase()}</Text>
              {renderChoices()}
            </View>
          )}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            keyboardShouldPersistTaps="always"
            accessibilityLabel="Task details"
          >
            {chips.map((chip) => {
              const isOpen = openField === chip.field;
              return (
                <TouchableOpacity
                  key={chip.field}
                  style={[styles.chip, isOpen && styles.chipOpen]}
                  onPress={() => setOpenField(isOpen ? null : chip.field)}
                  accessibilityLabel={`${FIELD_LABELS[chip.field]}: ${chip.label}`}
                  accessibilityState={{ expanded: isOpen }}
                >
                  <View style={[styles.chipDot, { backgroundColor: chip.dot }]} />
                  <Text style={styles.chipText}>{chip.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
    flex: 1,
    backgroundColor: theme.colors.overlay,
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.md,
    paddingTop: 10,
    paddingBottom: theme.spacing.md,
    gap: 12,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.border,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.spacing.xs,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title.fontSize,
    fontWeight: theme.typography.title.fontWeight,
    fontFamily: theme.typography.title.fontFamily,
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
  doneButton: {
    height: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: "center",
  },
  doneButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  addedRow: {
    gap: 6,
    paddingHorizontal: theme.spacing.xs,
  },
  addedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 30,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.quickFill,
    maxWidth: 220,
  },
  addedChipText: {
    color: theme.colors.quickText,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "500",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 18,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 48,
    outlineWidth: 0, // web: the bordered row already shows focus
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: "500",
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.colors.accentDark,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.footnote.fontSize,
    paddingHorizontal: theme.spacing.sm,
  },
  memoryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  memoryText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
  },
  suggestions: {
    borderRadius: 18,
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
    minHeight: 52,
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
    fontWeight: "400",
    fontFamily: theme.fonts.mono,
  },
  choicePanel: {
    gap: theme.spacing.sm,
    padding: 12,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  choicePanelLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
    paddingHorizontal: theme.spacing.xs,
  },
  choiceRow: {
    gap: 6,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  choiceSelected: {
    backgroundColor: theme.colors.accentDark,
    borderColor: theme.colors.accentDark,
  },
  choiceText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "500",
  },
  choiceTextSelected: {
    color: theme.colors.onAccent,
  },
  choiceBadge: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  chipRow: {
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
    backgroundColor: theme.colors.surfaceAlt,
  },
  chipOpen: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.surface,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "600",
  },
}));

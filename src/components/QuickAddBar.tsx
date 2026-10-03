import React, { useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import { EnergyLevel, TaskDraft, TaskTiming } from "../lib/types";
import { CATEGORIES, NO_CATEGORY, getCategory } from "../lib/categories";
import { ANY_ENERGY_LABEL, ENERGY_OPTIONS, energyLabel } from "../lib/energy";
import {
  TaskHistoryEntry,
  findExactMatch,
  findMatches,
} from "@domain/taskHistory";
import { DropdownPill } from "./DropdownPill";

const MINUTE_PRESETS = [3, 5, 15, 30, 60];
const TIMING_OPTIONS: { value: TaskTiming; label: string }[] = [
  { value: "anytime", label: "Anytime" },
  { value: "before_work", label: "Before work" },
  { value: "after_work", label: "After work" },
];
// "No category" (null) first, then the fixed category list.
const CATEGORY_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: NO_CATEGORY.label },
  ...CATEGORIES.map((c) => ({ value: c.id, label: c.label })),
];
// "Any energy" (null) first: energy is what "What can I do now?" matches tasks against.
const ENERGY_LEVEL_OPTIONS: { value: EnergyLevel | null; label: string }[] = [
  { value: null, label: ANY_ENERGY_LABEL },
  ...ENERGY_OPTIONS.map((o) => ({ value: o.value, label: energyLabel(o.value) })),
];
// Half-hour presets from 6am to 10pm, formatted like the design's "09:30".
// A fixed time is what enables Focus/Pomodoro mode for a task.
const SCHEDULED_TIME_OPTIONS: { value: string | null; label: string }[] = [
  { value: null, label: "No fixed time" },
  ...Array.from({ length: 33 }, (_, i) => {
    const totalMinutes = 6 * 60 + i * 30;
    const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
    const mm = String(totalMinutes % 60).padStart(2, "0");
    return { value: `${hh}:${mm}`, label: `${hh}:${mm}` };
  }),
];

interface Props {
  onAdd: (draft: TaskDraft) => void; // the caller adds the source and creates the task
  history: Map<string, TaskHistoryEntry>;
}

// The core "moment I think of it, I write it" capture bar: a name field with
// autocomplete over past task names, plus one-tap dropdown pills for timing,
// time estimate, category, energy, and an optional fixed start time — all
// optional so nothing blocks a quick add. Pills sit in a horizontal scroller
// so all five fit regardless of screen width.
export function QuickAddBar({ onAdd, history }: Props) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(5);
  const [timing, setTiming] = useState<TaskTiming>("anytime");
  const [category, setCategory] = useState<string | null>(null);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel | null>(null);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);
  const [timingTouched, setTimingTouched] = useState(false);
  const [minutesTouched, setMinutesTouched] = useState(false);
  const [energyTouched, setEnergyTouched] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const exactMatch = findExactMatch(history, title);
  const suggestions = exactMatch ? [] : findMatches(history, title);
  const canSubmit = title.trim().length > 0;

  const handleTitleChange = (text: string) => {
    setTitle(text);
    const match = findExactMatch(history, text);
    if (match) {
      if (!timingTouched) setTiming(match.timing);
      if (!minutesTouched) setMinutes(match.lastMinutes);
      if (!energyTouched) setEnergyLevel(match.energyLevel);
    }
  };

  const selectSuggestion = (entry: TaskHistoryEntry) => {
    setTitle(entry.title);
    setTiming(entry.timing);
    setMinutes(entry.lastMinutes);
    setEnergyLevel(entry.energyLevel);
    setTimingTouched(false);
    setMinutesTouched(false);
    setEnergyTouched(false);
  };

  const submit = () => {
    if (!canSubmit) return;
    onAdd({
      title: title.trim(),
      estimated_minutes: minutes,
      timing,
      category,
      energy_level: energyLevel,
      scheduled_time: scheduledTime,
    });
    setTitle("");
    setTimingTouched(false);
    setMinutesTouched(false);
    setEnergyTouched(false);
    setCategory(null);
    setEnergyLevel(null);
    setScheduledTime(null);
    // Keeps the field ready for the next task without re-tapping it.
    inputRef.current?.focus();
  };

  const timeOptions = exactMatch
    ? Array.from(
        new Set(
          [exactMatch.minMinutes, exactMatch.lastMinutes, exactMatch.maxMinutes].filter(
            (m): m is number => m !== null
          )
        )
      )
        .sort((a, b) => a - b)
        .map((m) => ({
          value: m,
          label:
            m === exactMatch.lastMinutes
              ? `Last: ${m} min`
              : m === exactMatch.minMinutes
              ? `Min: ${m} min`
              : `Max: ${m} min`,
        }))
    : MINUTE_PRESETS.map((m) => ({ value: m, label: `${m} min` }));

  const categoryLabel = getCategory(category).label;
  const scheduledTimeLabel = scheduledTime ?? "No fixed time";

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={title}
          onChangeText={handleTitleChange}
          placeholder="What needs doing?"
          placeholderTextColor={theme.colors.textTertiary}
          returnKeyType="done"
          blurOnSubmit={false}
          onSubmitEditing={submit}
        />
        <TouchableOpacity
          style={[styles.sendButton, !canSubmit && styles.sendButtonDisabled]}
          onPress={submit}
          disabled={!canSubmit}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((entry) => (
            <TouchableOpacity
              key={entry.title}
              style={styles.suggestionRow}
              onPress={() => selectSuggestion(entry)}
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={theme.colors.textTertiary}
              />
              <Text style={styles.suggestionText} numberOfLines={1}>
                {entry.title}
              </Text>
              <Text style={styles.suggestionMeta}>
                {entry.timesCompleted > 0 ? `${entry.lastMinutes}m` : "new"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
      >
        <DropdownPill
          label={TIMING_OPTIONS.find((o) => o.value === timing)?.label ?? "Anytime"}
          options={TIMING_OPTIONS}
          value={timing}
          onChange={(v) => {
            setTiming(v);
            setTimingTouched(true);
          }}
        />
        <DropdownPill
          label={`${minutes} min`}
          options={timeOptions}
          value={minutes}
          onChange={(v) => {
            setMinutes(v);
            setMinutesTouched(true);
          }}
        />
        <DropdownPill
          label={categoryLabel}
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={setCategory}
        />
        <DropdownPill
          label={energyLabel(energyLevel)}
          options={ENERGY_LEVEL_OPTIONS}
          value={energyLevel}
          onChange={(v) => {
            setEnergyLevel(v);
            setEnergyTouched(true);
          }}
        />
        <DropdownPill
          label={scheduledTimeLabel}
          options={SCHEDULED_TIME_OPTIONS}
          value={scheduledTime}
          onChange={setScheduledTime}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingLeft: theme.spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    paddingVertical: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.textTertiary,
  },
  pillRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  suggestions: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  suggestionText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
  },
  suggestionMeta: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.caption.fontSize,
  },
});

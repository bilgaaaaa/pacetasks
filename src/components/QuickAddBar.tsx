import React, { useState } from "react";
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Text,
} from "react-native";
import { theme } from "../lib/theme";
import { TaskTiming } from "../lib/types";

const MINUTE_PRESETS = [3, 5, 15, 30, 60];
const TIMING_OPTIONS: { value: TaskTiming; label: string }[] = [
  { value: "anytime", label: "Anytime" },
  { value: "before_work", label: "Before work" },
  { value: "after_work", label: "After work" },
];

interface Props {
  onAdd: (title: string, estimatedMinutes: number, timing: TaskTiming) => void;
}

// The core "moment I think of it, I write it" capture bar. Title entry is
// the only required step; minutes/timing default sensibly and can be tapped
// to adjust without ever leaving this bar.
export function QuickAddBar({ onAdd }: Props) {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(5);
  const [timing, setTiming] = useState<TaskTiming>("anytime");

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed, minutes, timing);
    setTitle("");
    setMinutes(5);
    setTiming("anytime");
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="What do you need to do?"
          placeholderTextColor={theme.colors.textSecondary}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <TouchableOpacity
          style={[styles.addButton, !title.trim() && styles.addButtonDisabled]}
          onPress={submit}
          disabled={!title.trim()}
        >
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chipRow}>
        {MINUTE_PRESETS.map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.chip, minutes === m && styles.chipActive]}
            onPress={() => setMinutes(m)}
          >
            <Text style={[styles.chipText, minutes === m && styles.chipTextActive]}>
              {m}m
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.chipRow}>
        {TIMING_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.chip, timing === opt.value && styles.chipActive]}
            onPress={() => setTiming(opt.value)}
          >
            <Text
              style={[
                styles.chipText,
                timing === opt.value && styles.chipTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  addButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  addButtonText: {
    color: theme.colors.background,
    fontWeight: "700",
  },
  chipRow: {
    flexDirection: "row",
    gap: theme.spacing.xs,
    flexWrap: "wrap",
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  chipActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  chipText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  chipTextActive: {
    color: theme.colors.background,
    fontWeight: "600",
  },
});

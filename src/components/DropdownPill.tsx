import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../lib/theme";

interface Option<T> {
  value: T;
  label: string;
}

interface Props<T> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

// A compact pill that opens a small choice dialog on tap — used for the
// timing/time/category/scheduled-time pickers in the quick-add bar so those
// controls take one tap to open instead of a permanently-visible row of chips.
export function DropdownPill<T>({ label, options, value, onChange }: Props<T>) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity style={styles.pill} onPress={() => setOpen(true)}>
        <Text style={styles.pillText}>{label}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.colors.textSecondary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {options.map((opt) => (
              <TouchableOpacity
                key={String(opt.value)}
                style={styles.optionRow}
                onPress={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    opt.value === value && styles.optionTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
                {opt.value === value && (
                  <Ionicons name="checkmark" size={18} color={theme.colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    minHeight: 40,
  },
  pillText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "600",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.xs,
    minWidth: 220,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  optionText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
  },
  optionTextActive: {
    color: theme.colors.accent,
    fontWeight: "700",
  },
});

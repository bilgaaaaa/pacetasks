import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import { CATEGORIES } from "../lib/categories";

interface Props {
  selected: string | null; // null = "All"
  onSelect: (categoryId: string | null) => void;
}

// Horizontal row of category pills used to filter the task list. "All" is
// always first; each category pill uses its own icon + color so the row
// reads as colorful and scannable, matching the categories.ts palette.
export function CategoryFilterRow({ selected, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <TouchableOpacity
        style={[styles.pill, selected === null && styles.pillActive]}
        onPress={() => onSelect(null)}
      >
        <Ionicons
          name="list-outline"
          size={14}
          color={selected === null ? "#FFFFFF" : theme.colors.textSecondary}
        />
        <Text style={[styles.pillText, selected === null && styles.pillTextActive]}>
          All
        </Text>
      </TouchableOpacity>

      {CATEGORIES.map((cat) => {
        const isActive = selected === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.pill,
              { backgroundColor: isActive ? cat.color : theme.colors.surface },
            ]}
            onPress={() => onSelect(cat.id)}
          >
            <Ionicons
              name={cat.icon}
              size={14}
              color={isActive ? "#FFFFFF" : cat.color}
            />
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: theme.spacing.xs,
    paddingRight: theme.spacing.lg,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 8,
  },
  pillActive: {
    backgroundColor: theme.colors.accent,
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "600",
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
});

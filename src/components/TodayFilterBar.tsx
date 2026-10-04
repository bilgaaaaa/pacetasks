import React, { useState } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { GROUP_BY_LABELS, GROUP_BY_OPTIONS, GroupBy } from "../lib/appearance";
import { TODAY_FILTERS, TodayFilter } from "../lib/taskSections";
import { TODAY_FILTER_LABELS } from "../lib/todayCopy";

interface Props {
  filter: TodayFilter;
  counts: Record<TodayFilter, number>;
  groupBy: GroupBy;
  onChangeFilter: (filter: TodayFilter) => void;
  onChangeGroupBy: (groupBy: GroupBy) => void;
}

// Three quick filters for the Today list (All, Quick wins, Due today) plus a
// "Filter" control that opens the less-used grouping options (size, place,
// category, time of day), so the bar stays short.
export function TodayFilterBar({ filter, counts, groupBy, onChangeFilter, onChangeGroupBy }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [sheetOpen, setSheetOpen] = useState(false);
  const grouped = groupBy !== "all";

  return (
    <View style={styles.bar}>
      <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Show tasks">
        {TODAY_FILTERS.map((option) => {
          const active = filter === option;
          const count = option === "all" ? null : counts[option];
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChangeFilter(option)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextActive]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.4}
              >
                {TODAY_FILTER_LABELS[option]}
                {count !== null && <Text style={[styles.chipCount, active && styles.chipTextActive]}> {count}</Text>}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.filterButton, grouped && styles.filterButtonActive]}
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={grouped ? `Filter: ${GROUP_BY_LABELS[groupBy].label}` : "Filter"}
      >
        <Ionicons
          name="options-outline"
          size={16}
          color={grouped ? theme.colors.onAccent : theme.colors.textPrimary}
        />
        <Text
          style={[styles.filterText, grouped && styles.filterTextActive]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.4}
        >
          Filter
        </Text>
      </TouchableOpacity>

      <Modal visible={sheetOpen} transparent animationType="fade" onRequestClose={() => setSheetOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSheetOpen(false)} accessibilityLabel="Close">
          <Pressable style={styles.panel} onPress={() => {}}>
            <Text style={styles.panelTitle} accessibilityRole="header">
              Group the list
            </Text>
            {GROUP_BY_OPTIONS.map((option) => {
              const active = groupBy === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => {
                    onChangeGroupBy(option);
                    setSheetOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{GROUP_BY_LABELS[option].label}</Text>
                    <Text style={styles.optionHint}>{GROUP_BY_LABELS[option].hint}</Text>
                  </View>
                  {active && <Ionicons name="checkmark" size={20} color={theme.colors.accentDark} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  chips: {
    flex: 1,
    flexDirection: "row",
    gap: 4,
    padding: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
  },
  chip: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 38,
    paddingHorizontal: 8,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: {
    backgroundColor: theme.colors.surface,
  },
  chipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "600",
  },
  chipCount: {
    color: theme.colors.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  chipTextActive: {
    color: theme.colors.textPrimary,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterButtonActive: {
    backgroundColor: theme.colors.accentDark,
    borderColor: theme.colors.accentDark,
  },
  filterText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "600",
  },
  filterTextActive: {
    color: theme.colors.onAccent,
  },
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  panel: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.sm,
    gap: 2,
  },
  panelTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: "700",
    padding: theme.spacing.sm,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
  },
  optionRowActive: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "600",
  },
  optionHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "400",
  },
}));

import React from "react";
import { Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DO_NOW_MINUTE_OPTIONS } from "@domain/doNow";
import type { DoNowSelection } from "@domain/doNow";
import { theme } from "../lib/theme";
import { emptyMessage, minutesLabel, planSummary } from "../lib/doNowCopy";
import { ENERGY_OPTIONS } from "../lib/energy";
import { EnergyLevel, Task } from "../lib/types";
import { ChoiceChips } from "./ChoiceChips";

const MINUTE_OPTIONS = DO_NOW_MINUTE_OPTIONS.map((minutes) => ({ value: minutes as number, label: minutesLabel(minutes) }));
// Enough to offer a real choice without turning the sheet back into the full list.
const MAX_ALTERNATIVES_SHOWN = 5;

interface Props {
  visible: boolean;
  availableMinutes: number;
  energy: EnergyLevel;
  selection: DoNowSelection;
  hasPendingToday: boolean;
  onChangeMinutes: (minutes: number) => void;
  onChangeEnergy: (energy: EnergyLevel) => void;
  renderTask: (task: Task) => React.ReactElement; // the screen's own task row, so timers and completion work as on Today
  onClose: () => void;
}

// Full-screen sheet for "What can I do now?": pick how much time and energy you
// have, get the few tasks worth doing right now. Purely presentational — the
// choices and suggestions come from useDoNow.
export function DoNowSheet({
  visible,
  availableMinutes,
  energy,
  selection,
  hasPendingToday,
  onChangeMinutes,
  onChangeEnergy,
  renderTask,
  onClose,
}: Props) {
  const { plan, planMinutes, alternatives } = selection;
  const shownAlternatives = alternatives.slice(0, MAX_ALTERNATIVES_SHOWN);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>DO NOW</Text>
            <Text style={styles.title}>What can I do now?</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeButton} accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
          <Text style={styles.label}>I HAVE</Text>
          <ChoiceChips
            options={MINUTE_OPTIONS}
            value={availableMinutes}
            onChange={onChangeMinutes}
            accessibilityLabel="Time available"
          />

          <Text style={styles.label}>MY ENERGY</Text>
          <ChoiceChips
            options={ENERGY_OPTIONS}
            value={energy}
            onChange={onChangeEnergy}
            accessibilityLabel="Energy level"
          />

          {plan.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{emptyMessage(hasPendingToday, availableMinutes, energy)}</Text>
            </View>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Do these now</Text>
                <Text style={styles.sectionMeta}>{planSummary(plan.length, planMinutes, availableMinutes)}</Text>
              </View>
              {plan.map((task) => (
                <React.Fragment key={task.id}>{renderTask(task)}</React.Fragment>
              ))}

              {shownAlternatives.length > 0 && (
                <>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Or instead</Text>
                  </View>
                  {shownAlternatives.map((task) => (
                    <React.Fragment key={task.id}>{renderTask(task)}</React.Fragment>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  eyebrow: {
    color: theme.colors.accentDark,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title.fontSize,
    fontWeight: theme.typography.title.fontWeight,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
  },
  sectionMeta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: theme.typography.footnote.fontWeight,
  },
  empty: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    textAlign: "center",
  },
});

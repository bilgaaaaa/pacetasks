import React, { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { RolloverDestination } from "@domain/rollover";
import { RolloverChoice } from "../hooks/useRollover";
import { destinationLabel, reasonLabel, ROLLOVER_DESTINATION_OPTIONS, rolloverSummary } from "../lib/rolloverCopy";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { Button } from "./Button";
import { DropdownPill } from "./DropdownPill";

interface Props {
  choices: RolloverChoice[];
  saving: boolean;
  onChangeDestination: (taskId: string, destination: RolloverDestination) => void;
  onApply: () => void;
  onDismiss: () => void;
}

// The "I didn't do it" rollover on Today, folded into one slim row ("4 tasks
// carried over · Review") so it doesn't push the list off the first screen.
// Review opens every unfinished task with the day PaceTasks would move it to,
// each changeable. Nothing is saved until "Apply changes"; "Not now" hides it
// until tomorrow. Purely presentational — the proposals come from useRollover.
export function RolloverCard({ choices, saving, onChangeDestination, onApply, onDismiss }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);
  const summary = rolloverSummary(choices.length);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.summaryRow}
        onPress={() => setExpanded((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${summary}. ${expanded ? "Hide review" : "Review"}`}
      >
        <View style={styles.icon}>
          <Ionicons name="return-down-forward" size={16} color={theme.colors.accentDark} />
        </View>
        <Text style={styles.summaryText} numberOfLines={2}>
          {summary}
        </Text>
        <Text style={styles.reviewText}>{expanded ? "Hide" : "Review"}</Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.colors.accentDark}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          <Text style={styles.subtitle}>Here's where I'd move them. Change any, then apply.</Text>
          <View style={styles.list}>
            {choices.map((choice) => {
              const reason = reasonLabel(choice.reason);
              return (
                <View key={choice.task.id} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text style={styles.taskTitle} numberOfLines={2}>
                      {choice.task.title}
                    </Text>
                    {reason && <Text style={styles.reason}>{reason}</Text>}
                  </View>
                  <DropdownPill
                    style={styles.pill}
                    label={destinationLabel(choice.destination)}
                    options={ROLLOVER_DESTINATION_OPTIONS}
                    value={choice.destination}
                    onChange={(destination) => onChangeDestination(choice.task.id, destination)}
                  />
                </View>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Button
              style={styles.action}
              label={saving ? "Applying…" : "Apply changes"}
              loading={saving}
              onPress={onApply}
            />
            <Button
              style={[styles.action, styles.secondaryOnCard]}
              label="Not now"
              variant="secondary"
              disabled={saving}
              onPress={onDismiss}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    marginBottom: theme.spacing.sm,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.quickFill,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  reviewText: {
    color: theme.colors.accentDark,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "700",
  },
  body: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
  },
  // Each task sits on its own soft tile instead of between hairlines, so rows
  // with and without a reason line still read as an even, aligned stack.
  list: {
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
    paddingLeft: theme.spacing.md,
    paddingRight: 10,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  taskTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  reason: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  // Same width on every row so the destinations line up in one column.
  pill: {
    minWidth: 112,
    justifyContent: "space-between",
    backgroundColor: theme.colors.surface,
    minHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  action: {
    flex: 1,
  },
  // The secondary button's own fill is the card's color, so on a card it uses the nested fill.
  secondaryOnCard: {
    backgroundColor: theme.colors.surfaceAlt,
  },
}));

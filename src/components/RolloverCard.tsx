import React from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { RolloverDestination } from "@domain/rollover";
import { RolloverChoice } from "../hooks/useRollover";
import { destinationLabel, reasonLabel, ROLLOVER_DESTINATION_OPTIONS, rolloverTitle } from "../lib/rolloverCopy";
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

// Card at the top of Today for the "I didn't do it" rollover: every unfinished
// task with the day PaceTasks would move it to, each changeable, accepted in one
// tap. Purely presentational — the proposals come from useRollover.
export function RolloverCard({ choices, saving, onChangeDestination, onApply, onDismiss }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="return-down-forward" size={18} color={theme.colors.accentDark} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>UNFINISHED</Text>
          <Text style={styles.title}>{rolloverTitle(choices.length)}</Text>
          <Text style={styles.subtitle}>Here's where I'd move them.</Text>
        </View>
      </View>

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
          label={saving ? "Moving…" : "Looks good"}
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
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.quickFill,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    color: theme.colors.accentDark,
    fontSize: 11,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 19,
    fontWeight: theme.typography.title.fontWeight,
    fontFamily: theme.typography.title.fontFamily,
    letterSpacing: theme.typography.title.letterSpacing,
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

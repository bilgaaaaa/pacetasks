import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { RolloverDestination } from "@domain/rollover";
import { RolloverChoice } from "../hooks/useRollover";
import { destinationLabel, reasonLabel, ROLLOVER_DESTINATION_OPTIONS, rolloverTitle } from "../lib/rolloverCopy";
import { makeStyles } from "../hooks/useTheme";
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
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>UNFINISHED</Text>
      <Text style={styles.title}>{rolloverTitle(choices.length)}</Text>
      <Text style={styles.subtitle}>Here's where I'd move them.</Text>

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
              label={destinationLabel(choice.destination)}
              options={ROLLOVER_DESTINATION_OPTIONS}
              value={choice.destination}
              onChange={(destination) => onChangeDestination(choice.task.id, destination)}
            />
          </View>
        );
      })}

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
    fontFamily: theme.typography.title.fontFamily,
    marginTop: 2,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    marginBottom: theme.spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  taskTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: "600",
  },
  reason: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  action: {
    flex: 1,
  },
  // The secondary button's own fill is the card's color, so on a card it uses the nested fill.
  secondaryOnCard: {
    backgroundColor: theme.colors.surfaceAlt,
  },
}));

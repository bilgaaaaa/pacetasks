import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCategory } from "../lib/categories";
import { confirmDestructive } from "../lib/confirmDestructive";
import { deleteTaskPrompt, taskDetailLine } from "../lib/taskActionsCopy";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { Task } from "../lib/types";

interface Props {
  task: Task;
  actionLabel: string; // the one way back onto Today, e.g. "Bring back"
  onAction: (task: Task) => void;
  onDelete: (taskId: string) => void; // called only after the user confirmed
}

// A task that is off the Today list (parked, or set for a later day): its title,
// one pill to bring it onto Today, and a small trash that asks before deleting.
// Shared by the Someday and Upcoming sheets so both behave the same.
export function TaskActionRow({ task, actionLabel, onAction, onDelete }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.taskTitle} numberOfLines={3}>
          {task.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {taskDetailLine(task.category ? getCategory(task.category).label : null, task.estimated_minutes)}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => onAction(task)}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel}: ${task.title}`}
      >
        <Text style={styles.actionText}>{actionLabel}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => confirmDestructive(deleteTaskPrompt(task.title), () => onDelete(task.id))}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${task.title}`}
      >
        <Ionicons name="trash-outline" size={16} color={theme.colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  taskTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
  },
  meta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
  },
  actionButton: {
    backgroundColor: theme.colors.accentDark,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  actionText: {
    color: theme.colors.onAccent,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "700",
  },
  deleteButton: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
}));

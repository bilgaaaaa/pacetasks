import React from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BrainDumpCandidate } from "@domain/brainDump/types";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { getCategory } from "../lib/categories";
import { formatDueLabel } from "../lib/dueLabel";
import { issueLabel } from "../lib/brainDumpCopy";
import { EditableCandidate } from "../lib/brainDumpState";

interface Props {
  candidate: BrainDumpCandidate;
  edit: EditableCandidate;
  todayKey: string;
  disabled: boolean;
  onToggle: (included: boolean) => void;
  onChangeTitle: (title: string) => void;
}

// One interpreted task in the Brain Dump review: a keep/skip circle, the title
// (editable, in the user's own language), what PaceTasks understood, and any
// reasons it deserves a second look.
export function BrainDumpCandidateRow({ candidate, edit, todayKey, disabled, onToggle, onChangeTitle }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const { draft } = edit;
  const hasIssues = candidate.issues.length > 0;

  const details = [
    draft.due_date ? formatDueLabel(draft.due_date, draft.due_kind ?? null, todayKey) : null,
    draft.scheduled_time ?? null,
    draft.estimated_minutes ? `${draft.estimated_minutes} min` : null,
    draft.category ? getCategory(draft.category).label : null,
    draft.flexible ? "maybe" : null,
  ].filter((part): part is string => part !== null);

  return (
    <View style={[styles.row, hasIssues && styles.rowFlagged, !edit.included && styles.rowSkipped]}>
      <TouchableOpacity
        onPress={() => onToggle(!edit.included)}
        disabled={disabled}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: edit.included }}
      >
        <View style={[styles.checkCircle, edit.included && styles.checkCircleOn]}>
          {edit.included && <Ionicons name="checkmark" size={16} color={theme.colors.onAccent} />}
        </View>
      </TouchableOpacity>

      <View style={styles.body}>
        <TextInput
          style={[styles.title, !edit.included && styles.titleSkipped]}
          value={draft.title}
          onChangeText={onChangeTitle}
          editable={!disabled}
          multiline
          blurOnSubmit
          returnKeyType="done"
        />
        {details.length > 0 && <Text style={styles.meta}>{details.join(" · ")}</Text>}
        {candidate.dateText && draft.due_date && (
          <Text style={styles.source}>from "{candidate.dateText}"</Text>
        )}
        {candidate.issues.map((issue, i) => (
          <View key={`${issue.code}-${i}`} style={styles.issueRow}>
            <Ionicons name="alert-circle-outline" size={14} color={theme.colors.warning} />
            <Text style={styles.issueText}>{issueLabel(issue)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowFlagged: {
    borderColor: theme.colors.warning,
  },
  rowSkipped: {
    opacity: 0.55,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.75,
    borderColor: theme.colors.textTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkCircleOn: {
    borderWidth: 0,
    backgroundColor: theme.colors.accentDark,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: "700",
    padding: 0,
  },
  titleSkipped: {
    textDecorationLine: "line-through",
  },
  meta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
  },
  source: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "400",
  },
  issueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    marginTop: 2,
  },
  issueText: {
    flex: 1,
    color: theme.colors.warning,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "600",
  },
}));

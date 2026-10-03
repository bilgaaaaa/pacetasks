import React from "react";
import { Modal, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCategory } from "../lib/categories";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { Task } from "../lib/types";
import { ErrorBanner } from "./ErrorBanner";

interface Props {
  visible: boolean;
  tasks: Task[]; // parked tasks, from selectSomedayTasks
  errorMessage: string | null; // a failed save from the task list, which this sheet covers
  onBringBack: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onClose: () => void;
}

// Full-screen sheet listing the "someday" tasks: things worth keeping but not
// part of the daily workload. Each can be brought back to Today or deleted.
// Purely presentational — the list and the actions come from the screen.
export function SomedaySheet({ visible, tasks, errorMessage, onBringBack, onDelete, onClose }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>SOMEDAY</Text>
            <Text style={styles.title}>Not now, maybe later</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeButton} accessibilityLabel="Close">
            <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>
            Parked tasks stay out of your day until you bring them back.
          </Text>

          {errorMessage && <ErrorBanner style={styles.error} message={errorMessage} />}

          {tasks.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nothing parked right now.</Text>
            </View>
          ) : (
            tasks.map((task) => (
              <View key={task.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.meta}>
                    {[task.category ? getCategory(task.category).label : null, `~${task.estimated_minutes} min`]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.bringBackButton}
                  onPress={() => onBringBack(task.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Bring back ${task.title}`}
                >
                  <Text style={styles.bringBackText}>Bring back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => onDelete(task.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete ${task.title}`}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
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
    fontFamily: theme.typography.title.fontFamily,
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
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    marginBottom: theme.spacing.md,
  },
  error: {
    marginBottom: theme.spacing.md,
  },
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
  bringBackButton: {
    backgroundColor: theme.colors.accentDark,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  bringBackText: {
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
  empty: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    textAlign: "center",
  },
}));

import React from "react";
import { Modal, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { Task } from "../lib/types";
import { ErrorBanner } from "./ErrorBanner";
import { TaskActionRow } from "./TaskActionRow";

interface Props {
  visible: boolean;
  tasks: Task[]; // parked tasks, from selectSomedayTasks
  errorMessage: string | null; // a failed save from the task list, which this sheet covers
  onBringBack: (taskId: string) => void;
  onDelete: (taskId: string) => void; // already confirmed by the row
  onClose: () => void;
}

// Full-screen sheet listing the "someday" tasks: things worth keeping but not
// part of the daily workload. Each can be brought back to Today or deleted
// (after a confirmation, see TaskActionRow).
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
              <TaskActionRow
                key={task.id}
                task={task}
                actionLabel="Bring back"
                onAction={(parked) => onBringBack(parked.id)}
                onDelete={onDelete}
              />
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

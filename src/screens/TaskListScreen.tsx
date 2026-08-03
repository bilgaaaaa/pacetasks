import React, { useMemo } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { theme } from "../lib/theme";
import { Task, TaskTiming } from "../lib/types";
import { useTasks } from "../hooks/useTasks";
import { QuickAddBar } from "../components/QuickAddBar";
import { TaskItem } from "../components/TaskItem";

const SECTION_ORDER: { key: TaskTiming; label: string }[] = [
  { key: "before_work", label: "Before work" },
  { key: "anytime", label: "Anytime" },
  { key: "after_work", label: "After work" },
];

interface Props {
  userId: string | undefined;
}

// Home screen: quick capture at the top, pending tasks grouped by when the
// user plans to do them, completed tasks tucked away at the bottom.
export function TaskListScreen({ userId }: Props) {
  const { tasks, loading, error, refresh, create, complete, remove } =
    useTasks(userId);

  const sections = useMemo(() => {
    const pending = tasks.filter((t) => t.status === "pending");
    const done = tasks.filter((t) => t.status === "done");

    const grouped = SECTION_ORDER.map(({ key, label }) => ({
      title: label,
      data: pending.filter((t) => t.timing === key),
    })).filter((section) => section.data.length > 0);

    if (done.length > 0) {
      grouped.push({ title: "Completed", data: done });
    }

    return grouped;
  }, [tasks]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>PaceTasks</Text>
        <Text style={styles.headerSubtitle}>
          Capture it now, sort it later.
        </Text>
      </View>

      <View style={styles.quickAddWrapper}>
        <QuickAddBar
          onAdd={(title, minutes, timing) => create(title, minutes, timing)}
        />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {loading && tasks.length === 0 ? (
        <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item: Task) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <TaskItem task={item} onComplete={complete} onDelete={remove} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} />
          }
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Nothing here yet — add your first task above.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: "800",
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  quickAddWrapper: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.danger,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  loader: {
    marginTop: theme.spacing.xl,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  sectionHeader: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: theme.spacing.xl,
  },
});

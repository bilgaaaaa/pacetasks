import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { theme } from "../lib/theme";
import { useTasks } from "../hooks/useTasks";
import { computeStats } from "../lib/stats";
import { StatCard } from "../components/StatCard";

interface Props {
  userId: string | undefined;
}

// "Compete with yourself": no leaderboards against other people, just your
// own streaks and how close your time estimates land versus reality.
export function StatsScreen({ userId }: Props) {
  const { tasks, loading } = useTasks(userId);
  const stats = useMemo(() => computeStats(tasks), [tasks]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your pace</Text>
        <Text style={styles.headerSubtitle}>
          Beat yesterday's you, not anyone else.
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
      ) : (
        <FlatList
          data={stats.dailyBreakdown}
          keyExtractor={(item) => item.date}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View>
              <View style={styles.grid}>
                <StatCard label="Done today" value={String(stats.todayCompleted)} />
                <StatCard
                  label="Minutes today"
                  value={String(stats.todayActualMinutes)}
                />
                <StatCard
                  label="Current streak"
                  value={`${stats.currentStreakDays}d`}
                  hint="consecutive days with a task done"
                />
                <StatCard
                  label="Best streak"
                  value={`${stats.bestStreakDays}d`}
                />
                <StatCard
                  label="Best day"
                  value={String(stats.bestDayCount)}
                  hint="most tasks done in one day"
                />
                <StatCard
                  label="Estimate accuracy"
                  value={
                    stats.estimateAccuracyPercent === null
                      ? "—"
                      : `${stats.estimateAccuracyPercent}%`
                  }
                  hint="how close estimates matched reality"
                />
              </View>
              {stats.dailyBreakdown.length > 0 && (
                <Text style={styles.sectionHeader}>Daily history</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.dayRow}>
              <Text style={styles.dayDate}>{item.date}</Text>
              <Text style={styles.dayMeta}>
                {item.completedCount} done · {item.actualMinutes}m actual (est{" "}
                {item.estimatedMinutes}m)
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Complete a task to start building your history.
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
  loader: {
    marginTop: theme.spacing.xl,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: theme.spacing.sm,
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
  dayRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  dayDate: {
    color: theme.colors.textPrimary,
    fontWeight: "600",
  },
  dayMeta: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: "center",
    marginTop: theme.spacing.xl,
  },
});

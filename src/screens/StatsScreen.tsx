import React, { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { useTasks } from "../hooks/useTasks";
import { computeStats, buildWeekdayHeatmap } from "../lib/stats";
import { computePaceInsights } from "../lib/paceInsights";
import { paceInsightLines } from "../lib/paceInsightsCopy";
import { PaceInsightsCard } from "../components/PaceInsightsCard";
import { StatCard } from "../components/StatCard";
import { WeekHeatmap } from "../components/WeekHeatmap";

interface Props {
  userId: string | undefined;
}

// "Compete with yourself" ("Your pace"): a 2-column stat grid, the "My Pace"
// insights (best hours, strongest day, estimates vs reality), a weekday
// contribution heatmap, and a per-day history list with a relative progress
// bar — no comparisons to anyone else's numbers, only your own history.
export function StatsScreen({ userId }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const { tasks, loading } = useTasks(userId);
  const stats = useMemo(() => computeStats(tasks), [tasks]);
  const heatmap = useMemo(() => buildWeekdayHeatmap(stats.dailyBreakdown), [stats]);
  const paceLines = useMemo(() => paceInsightLines(computePaceInsights(tasks)), [tasks]);

  return (
    <LinearGradient
      colors={[theme.colors.background, theme.colors.backgroundEnd]}
      style={styles.gradient}
    >
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
                  <StatCard label="Minutes today" value={String(stats.todayActualMinutes)} />
                  <StatCard
                    label="Current streak"
                    value={`${stats.currentStreakDays}d`}
                    valueColor={theme.colors.accentDark}
                    hint="consecutive days with a task done"
                  />
                  <StatCard label="Best streak" value={`${stats.bestStreakDays}d`} />
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
                    hint="estimates vs reality"
                  />
                </View>

                <PaceInsightsCard lines={paceLines} />

                <WeekHeatmap heatmap={heatmap} />

                {stats.dailyBreakdown.length > 0 && (
                  <Text style={styles.sectionHeader}>History</Text>
                )}
              </View>
            }
            renderItem={({ item }) => {
              const progress =
                stats.bestDayCount === 0
                  ? 0
                  : Math.min(1, item.completedCount / stats.bestDayCount);
              return (
                <View style={styles.dayRow}>
                  <View style={styles.dayInfo}>
                    <Text style={styles.dayDate}>{item.date}</Text>
                    <Text style={styles.dayMeta}>
                      {item.completedCount} tasks · {item.actualMinutes} min
                    </Text>
                  </View>
                  <View style={styles.dayProgressTrack}>
                    <View style={[styles.dayProgressFill, { flex: progress || 0.0001 }]} />
                    <View style={{ flex: 1 - progress || 0.0001 }} />
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  Complete a task to start building your history.
                </Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const useStyles = makeStyles((theme) => ({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.largeTitle.fontSize,
    fontWeight: theme.typography.largeTitle.fontWeight,
    fontFamily: theme.typography.largeTitle.fontFamily,
    letterSpacing: theme.typography.largeTitle.letterSpacing,
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
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
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: "700",
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xs,
  },
  dayRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  dayInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayDate: {
    color: theme.colors.textPrimary,
    fontWeight: "700",
  },
  dayMeta: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontFamily: theme.fonts.mono,
    fontVariant: ["tabular-nums"],
  },
  dayProgressTrack: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: theme.colors.border,
  },
  dayProgressFill: {
    backgroundColor: theme.colors.accentDark,
  },
  emptyState: {
    alignItems: "center",
    marginTop: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
}));

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
import { usePro } from "../hooks/usePro";
import { computeStats, buildWeekdayHeatmap } from "../lib/stats";
import { computePaceInsights } from "../lib/paceInsights";
import { paceInsightLines } from "../lib/paceInsightsCopy";
import { PACE_LOCK_BODY, PACE_LOCK_EYEBROW, PACE_LOCK_TITLE } from "../lib/proCopy";
import { formatDayLabel } from "../lib/dueLabel";
import { Button } from "../components/Button";
import { ErrorBanner } from "../components/ErrorBanner";
import { PaceInsightsCard } from "../components/PaceInsightsCard";
import { ProLockCard } from "../components/ProLockCard";
import { StatCard } from "../components/StatCard";
import { WeekHeatmap } from "../components/WeekHeatmap";
import { t } from "../i18n";

// "Compete with yourself" ("Your pace"): a 2-column stat grid, the "My Pace"
// insights (best hours, strongest day, estimates vs reality), a weekday
// contribution heatmap, and a per-day history list with a relative progress
// bar — no comparisons to anyone else's numbers, only your own history.
// A failed load shows the error with a retry: zeros would read as "no history".
// Today's numbers are free; everything over time (streaks, insights, heatmap, history) is Pro.
export function StatsScreen() {
  const { theme } = useTheme();
  const styles = useStyles();
  const { tasks, loading, error, refresh } = useTasks();
  const loadFailed = error !== null && tasks.length === 0;
  const stats = useMemo(() => computeStats(tasks), [tasks]);
  const heatmap = useMemo(() => buildWeekdayHeatmap(stats.dailyBreakdown), [stats]);
  const paceLines = useMemo(() => paceInsightLines(computePaceInsights(tasks)), [tasks]);
  const { isPro, openPaywall } = usePro();

  return (
    <LinearGradient
      colors={[theme.colors.background, theme.colors.backgroundEnd]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t("Your pace")}</Text>
          <Text style={styles.headerSubtitle}>
            {t("Beat yesterday's you, not anyone else.")}
          </Text>
        </View>

        {loading && tasks.length === 0 ? (
          <ActivityIndicator color={theme.colors.accent} style={styles.loader} />
        ) : loadFailed ? (
          <View style={styles.loadError}>
            <ErrorBanner message={t("Your history could not be loaded. {0}", error)} />
            <Button label={t("Try again")} variant="secondary" onPress={refresh} />
          </View>
        ) : (
          <FlatList
            data={isPro ? stats.dailyBreakdown : []}
            keyExtractor={(item) => item.date}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <View>
                <View style={styles.grid}>
                  <StatCard label={t("Done today")} value={String(stats.todayCompleted)} />
                  <StatCard label={t("Minutes today")} value={String(stats.todayActualMinutes)} />
                  {isPro && (
                    <>
                      <StatCard
                        label={t("Current streak")}
                        value={t("{0}d", stats.currentStreakDays)}
                        valueColor={theme.colors.accentDark}
                        hint={t("consecutive days with a task done")}
                      />
                      <StatCard label={t("Best streak")} value={t("{0}d", stats.bestStreakDays)} />
                      <StatCard
                        label={t("Best day")}
                        value={String(stats.bestDayCount)}
                        hint={t("most tasks done in one day")}
                      />
                      <StatCard
                        label={t("Estimate accuracy")}
                        value={
                          stats.estimateAccuracyPercent === null
                            ? "—"
                            : `${stats.estimateAccuracyPercent}%`
                        }
                        hint={t("estimates vs reality")}
                      />
                    </>
                  )}
                </View>

                {isPro ? (
                  <>
                    <PaceInsightsCard lines={paceLines} />
                    <WeekHeatmap heatmap={heatmap} />
                  </>
                ) : (
                  <ProLockCard
                    eyebrow={PACE_LOCK_EYEBROW}
                    title={t(PACE_LOCK_TITLE)}
                    body={t(PACE_LOCK_BODY)}
                    onSeePlans={() => openPaywall("paceHistory")}
                  />
                )}

                {isPro && stats.dailyBreakdown.length > 0 && (
                  <Text style={styles.sectionHeader}>{t("History")}</Text>
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
                    <Text style={styles.dayDate}>{formatDayLabel(item.date)}</Text>
                    <Text style={styles.dayMeta}>
                      {item.completedCount === 1 ? t("1 task") : t("{0} tasks", item.completedCount)} · {item.actualMinutes} min
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
              isPro ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    {t("Complete a task to start building your history.")}
                  </Text>
                </View>
              ) : null
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
  loadError: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
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

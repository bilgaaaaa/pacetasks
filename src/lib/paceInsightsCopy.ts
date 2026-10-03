import { PACE_INSIGHTS_POLICY } from "./paceInsights";
import type { PaceInsights } from "./paceInsights";

// UI copy for "My Pace". The numbers come from paceInsights.ts; wording lives
// here so it can be localized later without touching the logic.

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

// One sentence per pattern found; before there is enough history, one sentence saying how much is missing.
export function paceInsightLines(insights: PaceInsights): string[] {
  if (!insights.ready) {
    const missing = PACE_INSIGHTS_POLICY.minCompletedTasks - insights.completedCount;
    const tasks = missing === 1 ? "1 more task" : `${missing} more tasks`;
    return [`Complete ${tasks} and Pace will start showing how you work.`];
  }

  const lines: string[] = [];
  if (insights.bestWindow) {
    const { startHour, endHour, sharePercent } = insights.bestWindow;
    lines.push(
      `You finish most tasks between ${formatHour(startHour)} and ${formatHour(endHour)} (${sharePercent}% of them).`
    );
  }
  if (insights.bestWeekday) {
    lines.push(`${WEEKDAY_NAMES[insights.bestWeekday.weekday]} is your strongest day.`);
  }
  if (insights.estimateBias) {
    const { direction, percent } = insights.estimateBias;
    lines.push(
      direction === "close"
        ? "Your time estimates are close to reality."
        : direction === "longer"
        ? `Tasks take you about ${percent}% longer than you estimate.`
        : `You finish about ${percent}% faster than you estimate.`
    );
  }
  return lines;
}

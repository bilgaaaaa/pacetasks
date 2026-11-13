import { PACE_INSIGHTS_POLICY } from "./paceInsights";
import type { PaceInsights } from "./paceInsights";
import { localized, msg, t } from "../i18n";

// UI copy for "My Pace". The numbers come from paceInsights.ts; wording lives
// here so it can be localized later without touching the logic.

const WEEKDAY_NAMES = localized([msg("Sunday"), msg("Monday"), msg("Tuesday"), msg("Wednesday"), msg("Thursday"), msg("Friday"), msg("Saturday")]);

// A window can start at hour 0 or end at hour 24; both are midnight, and "24:00" is not a time people read.
function formatHour(hour: number): string {
  return hour % 24 === 0 ? t("midnight") : `${String(hour).padStart(2, "0")}:00`;
}

// One sentence per pattern found; before there is enough history, one sentence saying how much is missing.
export function paceInsightLines(insights: PaceInsights): string[] {
  if (!insights.ready) {
    const missing = PACE_INSIGHTS_POLICY.minCompletedTasks - insights.completedCount;
    const tasks = missing === 1 ? t("1 more task") : t("{0} more tasks", missing);
    return [t("Complete {0} and Pace will start showing how you work.", tasks)];
  }

  const lines: string[] = [];
  if (insights.bestWindow) {
    const { startHour, endHour, sharePercent } = insights.bestWindow;
    lines.push(
      t("You finish most tasks between {0} and {1} ({2}% of them).", formatHour(startHour), formatHour(endHour), sharePercent)
    );
  }
  if (insights.bestWeekday) {
    lines.push(t("{0} is your strongest day.", WEEKDAY_NAMES[insights.bestWeekday.weekday]));
  }
  if (insights.estimateBias) {
    const { direction, percent } = insights.estimateBias;
    lines.push(
      direction === "close"
        ? t("Your time estimates are close to reality.")
        : direction === "longer"
        ? t("Tasks take you about {0}% longer than you estimate.", percent)
        : t("You finish about {0}% faster than you estimate.", percent)
    );
  }
  return lines;
}

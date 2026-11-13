import { ROLLOVER_DESTINATIONS } from "@domain/rollover";
import type { RolloverDestination, RolloverReason } from "@domain/rollover";
import { localized, msg, t } from "../i18n";

// UI copy for the "I didn't do it" rollover. Rules live in @domain/rollover;
// wording lives here so it can be localized later without touching the logic.

const DESTINATION_LABELS: Record<RolloverDestination, string> = localized({
  today: msg("Today"),
  tomorrow: msg("Tomorrow"),
  weekend: msg("Weekend"),
  someday: msg("Someday"),
});

// A few words on why a destination was proposed; null when it needs no explanation.
const REASON_LABELS: Record<RolloverReason, string | null> = localized({
  deadline_passed: msg("Deadline passed"),
  high_priority: msg("High priority"),
  postponed_often: msg("Moved several times already"),
  maybe: msg("A maybe"),
  fits_today: null,
  today_full: msg("Today is full"),
});

export const ROLLOVER_DESTINATION_OPTIONS: { value: RolloverDestination; label: string }[] =
  ROLLOVER_DESTINATIONS.map((destination) => ({
    value: destination,
    // Read when shown, so it follows the app's language.
    get label() {
      return DESTINATION_LABELS[destination];
    },
  }));

export function destinationLabel(destination: RolloverDestination): string {
  return DESTINATION_LABELS[destination];
}

// `reason` is null once the user picked the destination themselves.
export function reasonLabel(reason: RolloverReason | null): string | null {
  return reason ? REASON_LABELS[reason] : null;
}

// The collapsed rollover row: "4 tasks carried over".
export function rolloverSummary(taskCount: number): string {
  return taskCount === 1 ? t("1 task carried over") : t("{0} tasks carried over", taskCount);
}

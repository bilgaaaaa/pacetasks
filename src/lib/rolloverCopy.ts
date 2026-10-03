import { ROLLOVER_DESTINATIONS } from "@domain/rollover";
import type { RolloverDestination, RolloverReason } from "@domain/rollover";

// UI copy for the "I didn't do it" rollover. Rules live in @domain/rollover;
// wording lives here so it can be localized later without touching the logic.

const DESTINATION_LABELS: Record<RolloverDestination, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  weekend: "Weekend",
  someday: "Someday",
};

// A few words on why a destination was proposed; null when it needs no explanation.
const REASON_LABELS: Record<RolloverReason, string | null> = {
  deadline_passed: "Deadline passed",
  high_priority: "High priority",
  postponed_often: "Moved several times already",
  maybe: "A maybe",
  fits_today: null,
  today_full: "Today is full",
};

export const ROLLOVER_DESTINATION_OPTIONS: { value: RolloverDestination; label: string }[] =
  ROLLOVER_DESTINATIONS.map((destination) => ({ value: destination, label: DESTINATION_LABELS[destination] }));

export function destinationLabel(destination: RolloverDestination): string {
  return DESTINATION_LABELS[destination];
}

// `reason` is null once the user picked the destination themselves.
export function reasonLabel(reason: RolloverReason | null): string | null {
  return reason ? REASON_LABELS[reason] : null;
}

export function rolloverTitle(taskCount: number): string {
  return taskCount === 1 ? "You left 1 thing unfinished." : `You left ${taskCount} things unfinished.`;
}

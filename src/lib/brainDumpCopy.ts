import type { CandidateIssue, ReviewReason } from "@domain/brainDump/types";
import { localized, msg, t } from "../i18n";

// UI copy for Brain Dump. Codes come from the shared domain; wording lives here
// so the server stays language-neutral and copy can be localized later.

const ISSUE_LABELS: Record<Exclude<CandidateIssue["code"], "ambiguous">, string> = localized({
  low_confidence: msg("Not sure I got this one right"),
  date_unresolved: msg("No exact day, so it has no date"),
  date_in_past: msg("That date has already passed"),
  title_truncated: msg("Title was shortened"),
  unknown_category: msg("Category not recognised"),
  possible_duplicate: msg("Already on your list"),
});

// One line explaining why a candidate needs a look; ambiguities use the AI's reason.
export function issueLabel(issue: CandidateIssue): string {
  return issue.code === "ambiguous" ? t("Check: {0}", issue.message) : ISSUE_LABELS[issue.code];
}

// Subtitle above the review list.
export function reviewSummary(taskCount: number, reasons: ReviewReason[]): string {
  if (taskCount === 0) return t("I couldn't find any tasks in that. Try adding a bit more detail.");
  const tasks = taskCount === 1 ? t("1 task") : t("{0} tasks", taskCount);
  if (reasons.includes("candidate_issues")) return t("{0}. Check the highlighted ones before adding.", tasks);
  if (reasons.includes("unparsed_text")) return t("{0}. Some of what you wrote didn't become a task.", tasks);
  return t("{0}, ready to add.", tasks);
}

export function addButtonLabel(selectedCount: number): string {
  if (selectedCount === 0) return t("Nothing selected");
  return selectedCount === 1 ? t("Add 1 task") : t("Add {0} tasks", selectedCount);
}

export function doneMessage(createdCount: number): string {
  return createdCount === 1 ? t("Added 1 task") : t("Added {0} tasks", createdCount);
}

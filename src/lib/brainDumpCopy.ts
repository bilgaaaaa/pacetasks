import type { CandidateIssue, ReviewReason } from "@domain/brainDump/types";

// UI copy for Brain Dump. Codes come from the shared domain; wording lives here
// so the server stays language-neutral and copy can be localized later.

const ISSUE_LABELS: Record<Exclude<CandidateIssue["code"], "ambiguous">, string> = {
  low_confidence: "Not sure I got this one right",
  date_unresolved: "No exact day, so it has no date",
  date_in_past: "That date has already passed",
  title_truncated: "Title was shortened",
  unknown_category: "Category not recognised",
  possible_duplicate: "Already on your list",
};

// One line explaining why a candidate needs a look; ambiguities use the AI's reason.
export function issueLabel(issue: CandidateIssue): string {
  return issue.code === "ambiguous" ? `Check: ${issue.message}` : ISSUE_LABELS[issue.code];
}

// Subtitle above the review list.
export function reviewSummary(taskCount: number, reasons: ReviewReason[]): string {
  if (taskCount === 0) return "I couldn't find any tasks in that. Try adding a bit more detail.";
  const tasks = taskCount === 1 ? "1 task" : `${taskCount} tasks`;
  if (reasons.includes("candidate_issues")) return `${tasks}. Check the highlighted ones before adding.`;
  if (reasons.includes("unparsed_text")) return `${tasks}. Some of what you wrote didn't become a task.`;
  return `${tasks}, ready to add.`;
}

export function addButtonLabel(selectedCount: number): string {
  if (selectedCount === 0) return "Nothing selected";
  return selectedCount === 1 ? "Add 1 task" : `Add ${selectedCount} tasks`;
}

export function doneMessage(createdCount: number): string {
  return createdCount === 1 ? "Added 1 task" : `Added ${createdCount} tasks`;
}

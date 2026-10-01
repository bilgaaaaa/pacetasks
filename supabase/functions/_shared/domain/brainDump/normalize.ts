import { isCategoryId } from "../categories.ts";
import { TASK_LIMITS } from "../task.ts";
import type { Task, TaskDraft, TaskSource, TaskTiming } from "../task.ts";
import { buildTaskHistory, findExactMatch, normalizeTitle } from "../taskHistory.ts";
import type { TaskHistoryEntry } from "../taskHistory.ts";
import { timingForHour } from "../timing.ts";
import type { AiTaskCandidate, BrainDumpAiResult, TimeOfDay } from "./aiResult.ts";
import { resolveDate } from "./resolveDate.ts";
import { BRAIN_DUMP_REVIEW_POLICY } from "./reviewPolicy.ts";
import type { BrainDumpCandidate, CandidateIssue } from "./types.ts";

const LANGUAGE_TAG_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export interface NormalizeContext {
  todayKey: string; // the phone's local day, "YYYY-MM-DD"
  source: TaskSource; // how these tasks entered PaceTasks (brain_dump, siri, shortcut)
  workStartHour: number;
  workEndHour: number;
  tasks: Task[]; // the user's tasks, newest-first: history and duplicate checks
}

export interface NormalizedBrainDump {
  candidates: BrainDumpCandidate[];
  unparsedFragments: string[];
  detectedLanguages: string[];
}

// Converts a validated AI proposal into PaceTasks task drafts using the app's
// own rules: dates from the phone's today, durations and energy from the user's history,
// timing from their work hours, and flags for anything worth a second look.
export function normalizeBrainDump(result: BrainDumpAiResult, context: NormalizeContext): NormalizedBrainDump {
  const history = buildTaskHistory(context.tasks);
  const pendingByTitle = new Map(
    context.tasks
      .filter((task) => task.status === "pending")
      .map((task) => [normalizeTitle(task.title), task.id] as const)
  );

  const candidates: BrainDumpCandidate[] = [];
  const unparsedFragments = result.unparsedFragments.map((f) => f.trim()).filter(Boolean);

  for (const aiCandidate of result.candidates) {
    const candidate = normalizeCandidate(aiCandidate, candidates.length, context, history, pendingByTitle);
    if (candidate) {
      candidates.push(candidate);
    } else {
      unparsedFragments.push(aiCandidate.sourceSpan.trim());
    }
  }

  return {
    candidates,
    unparsedFragments,
    detectedLanguages: normalizeLanguages(result.detectedLanguages),
  };
}

// Returns null when nothing usable is left (e.g. a whitespace-only title).
function normalizeCandidate(
  ai: AiTaskCandidate,
  index: number,
  context: NormalizeContext,
  history: Map<string, TaskHistoryEntry>,
  pendingByTitle: Map<string, string>
): BrainDumpCandidate | null {
  const issues: CandidateIssue[] = [];

  const cleanTitle = ai.title.replace(/\s+/g, " ").trim();
  if (!cleanTitle) return null;
  const title = cleanTitle.slice(0, TASK_LIMITS.titleMaxLength).trim();
  if (title.length < cleanTitle.length) {
    issues.push(issue("title_truncated", "title", "Title was shortened to fit"));
  }

  let dueDate: string | null = null;
  let dueKind: TaskDraft["due_kind"] = null;
  if (ai.when) {
    const resolution = resolveDate(ai.when, context.todayKey);
    if (resolution.ok) {
      dueDate = resolution.dueDate;
      dueKind = resolution.dueKind;
      if (resolution.inPast) issues.push(issue("date_in_past", "due_date", "Date is in the past"));
    } else {
      issues.push(issue("date_unresolved", "due_date", `Couldn't pin down "${ai.when.text}" to a day`));
    }
  }

  let category: string | null = null;
  if (ai.category) {
    if (isCategoryId(ai.category)) {
      category = ai.category;
    } else {
      issues.push(issue("unknown_category", "category", `Unknown category "${ai.category}"`));
    }
  }

  const historyEntry = findExactMatch(history, title);
  const scheduledTime = ai.dueTime;
  const timing = timingFor(scheduledTime, ai.timeOfDay, historyEntry?.timing ?? null, context);

  const duplicateId = pendingByTitle.get(normalizeTitle(title)) ?? null;
  if (duplicateId) {
    issues.push(issue("possible_duplicate", "title", "A pending task with this name already exists"));
  }

  const confidence = clamp(ai.confidence, 0, 1);
  if (confidence < BRAIN_DUMP_REVIEW_POLICY.minConfidence) {
    issues.push(issue("low_confidence", null, "PaceTasks isn't sure it understood this one"));
  }
  for (const ambiguity of ai.ambiguities) {
    issues.push(issue("ambiguous", ambiguity.field || null, ambiguity.reason));
  }

  const notes = ai.notes?.trim().slice(0, TASK_LIMITS.notesMaxLength) || null;
  const language = ai.language.trim();

  const draft: TaskDraft = {
    title,
    estimated_minutes: estimatedMinutesFor(ai.estimatedDurationMinutes, historyEntry),
    timing,
    category,
    scheduled_time: scheduledTime,
    due_date: dueDate,
    due_kind: dueKind,
    notes,
    priority: ai.priority,
    energy_level: ai.energyRequired ?? historyEntry?.energyLevel ?? null,
    flexible: ai.flexible,
    tags: [...new Set(ai.context)].slice(0, TASK_LIMITS.maxTags),
    source: context.source,
    source_language: LANGUAGE_TAG_PATTERN.test(language) ? language : null,
    ai_confidence: confidence,
  };

  return {
    index,
    draft,
    sourceSpan: ai.sourceSpan.trim(),
    dateText: ai.when?.text ?? null,
    confidence,
    issues,
    possibleDuplicateOfTaskId: duplicateId,
  };
}

// The user's own history beats the AI's guess: a task they've done before
// keeps its usual time, exactly like quick-add does.
function estimatedMinutesFor(aiMinutes: number | null, historyEntry: TaskHistoryEntry | undefined): number {
  const minutes = historyEntry?.lastMinutes ?? aiMinutes ?? TASK_LIMITS.defaultEstimatedMinutes;
  return clamp(Math.round(minutes), TASK_LIMITS.minEstimatedMinutes, TASK_LIMITS.maxEstimatedMinutes);
}

// Maps a fixed time or a part of the day onto the app's before/after-work
// buckets using the user's work hours; falls back to the task's usual timing.
function timingFor(
  scheduledTime: string | null,
  timeOfDay: TimeOfDay | null,
  historyTiming: TaskTiming | null,
  context: NormalizeContext
): TaskTiming {
  if (scheduledTime) {
    return timingForHour(Number(scheduledTime.slice(0, 2)), context.workStartHour, context.workEndHour);
  }
  if (timeOfDay === "morning") return "before_work";
  if (timeOfDay === "evening") return "after_work";
  if (timeOfDay === "afternoon") return "anytime";
  return historyTiming ?? "anytime";
}

function normalizeLanguages(languages: string[]): string[] {
  return [...new Set(languages.map((l) => l.trim()).filter((l) => LANGUAGE_TAG_PATTERN.test(l)))];
}

function issue(code: CandidateIssue["code"], field: string | null, message: string): CandidateIssue {
  return { code, field, message };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

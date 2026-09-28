import type { BrainDumpCandidate } from "../../_shared/domain/brainDump/types.ts";
import type { EvalCase, ExpectedTask } from "./cases.ts";

export interface FieldCheck {
  field: string;
  expected: unknown;
  actual: unknown;
  ok: boolean;
}

export interface TaskScore {
  keywords: string[];
  matchedTitle: string | null; // null = no candidate had the keywords (missed or translated)
  languageTagOk: boolean;
  fields: FieldCheck[];
}

export interface CaseScore {
  id: string;
  passed: boolean; // right number of tasks, every task found, every scored field correct
  expectedCount: number;
  actualCount: number;
  tasks: TaskScore[];
}

// Lowercases per language so Turkish dotted/dotless i compare correctly.
function lower(text: string, language: string): string {
  return text.normalize("NFC").toLocaleLowerCase(language.startsWith("tr") ? "tr" : "en");
}

// Matches each expected task to the first unused candidate whose title holds all
// its keywords, then checks the fields the case cares about.
export function scoreCase(testCase: EvalCase, candidates: BrainDumpCandidate[]): CaseScore {
  const used = new Set<number>();

  const tasks = testCase.tasks.map((expected): TaskScore => {
    const match = candidates.find(
      (candidate) =>
        !used.has(candidate.index) &&
        expected.keywords.every((keyword) =>
          lower(candidate.draft.title, expected.language).includes(lower(keyword, expected.language))
        )
    );
    if (!match) return { keywords: expected.keywords, matchedTitle: null, languageTagOk: false, fields: [] };

    used.add(match.index);
    return {
      keywords: expected.keywords,
      matchedTitle: match.draft.title,
      languageTagOk: (match.draft.source_language ?? "").split("-")[0] === expected.language,
      fields: checkFields(expected, match),
    };
  });

  const passed =
    candidates.length === testCase.tasks.length &&
    tasks.every((task) => task.matchedTitle !== null && task.fields.every((field) => field.ok));

  return { id: testCase.id, passed, expectedCount: testCase.tasks.length, actualCount: candidates.length, tasks };
}

function checkFields(expected: ExpectedTask, candidate: BrainDumpCandidate): FieldCheck[] {
  const checks: FieldCheck[] = [];
  const check = (field: string, want: unknown, got: unknown) => {
    if (want !== undefined) checks.push({ field, expected: want, actual: got, ok: want === got });
  };
  check("due_date", expected.dueDate, candidate.draft.due_date ?? null);
  check("due_kind", expected.dueKind, candidate.draft.due_kind ?? null);
  check("scheduled_time", expected.scheduledTime, candidate.draft.scheduled_time ?? null);
  check("flexible", expected.flexible, candidate.draft.flexible ?? false);
  return checks;
}

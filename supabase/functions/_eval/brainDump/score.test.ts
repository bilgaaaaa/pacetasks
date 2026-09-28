import assert from "node:assert/strict";
import type { BrainDumpCandidate } from "../../_shared/domain/brainDump/types.ts";
import type { TaskDraft } from "../../_shared/domain/task.ts";
import { scoreCase } from "./score.ts";

function candidate(index: number, draft: TaskDraft): BrainDumpCandidate {
  return { index, draft, sourceSpan: "", dateText: null, confidence: 0.9, issues: [], possibleDuplicateOfTaskId: null };
}

const testCase = {
  id: "t",
  text: "",
  tasks: [
    { keywords: ["veterinario"], language: "it", dueDate: "2026-09-29", dueKind: "on" as const },
    { keywords: ["kira"], language: "tr" },
  ],
};

Deno.test("scoreCase: passes when every task is found in its original language with correct fields", () => {
  const score = scoreCase(testCase, [
    candidate(0, { title: "Chiamare il veterinario", due_date: "2026-09-29", due_kind: "on", source_language: "it" }),
    candidate(1, { title: "KİRAYI öde", source_language: "tr" }),
  ]);
  assert.equal(score.passed, true);
  assert.equal(score.tasks[1].matchedTitle, "KİRAYI öde");
  assert.equal(score.tasks[1].languageTagOk, true);
});

Deno.test("scoreCase: a translated title or a wrong date fails the case", () => {
  const translated = scoreCase(testCase, [
    candidate(0, { title: "Call the vet", due_date: "2026-09-29", due_kind: "on" }),
    candidate(1, { title: "Kirayı öde" }),
  ]);
  assert.equal(translated.passed, false);
  assert.equal(translated.tasks[0].matchedTitle, null);

  const wrongDate = scoreCase(testCase, [
    candidate(0, { title: "Chiamare il veterinario", due_date: "2026-09-30", due_kind: "on" }),
    candidate(1, { title: "Kirayı öde" }),
  ]);
  assert.equal(wrongDate.passed, false);
  assert.deepEqual(wrongDate.tasks[0].fields[0], {
    field: "due_date",
    expected: "2026-09-29",
    actual: "2026-09-30",
    ok: false,
  });
});

Deno.test("scoreCase: extra tasks fail the case", () => {
  const score = scoreCase(testCase, [
    candidate(0, { title: "Chiamare il veterinario", due_date: "2026-09-29", due_kind: "on" }),
    candidate(1, { title: "Kirayı öde" }),
    candidate(2, { title: "Something invented" }),
  ]);
  assert.equal(score.passed, false);
  assert.equal(score.actualCount, 3);
});

import assert from "node:assert/strict";
import type { BrainDumpAiResult } from "../../domain/brainDump/aiResult.ts";
import type { BrainDumpProposal } from "../../domain/brainDump/types.ts";
import type { AIProvider, BrainDumpInterpretationRequest } from "../ai/AIProvider.ts";
import { AIError } from "../ai/errors.ts";
import { InMemoryBrainDumpRepository } from "../testing/inMemoryBrainDumpRepository.ts";
import { SAMPLE_AI_RESULT } from "../testing/sampleAiResult.ts";
import { handleBrainDumpHttp } from "./brainDumpHandler.ts";
import type { BrainDumpHandlerDeps } from "./brainDumpHandler.ts";

// 22:30 UTC on Monday 28 Sep is already Tuesday 29 Sep in Rome.
const NOW = new Date("2026-09-28T22:30:00Z");

function scriptedAI(result: BrainDumpAiResult | AIError): AIProvider & { calls: BrainDumpInterpretationRequest[] } {
  const calls: BrainDumpInterpretationRequest[] = [];
  return {
    calls,
    parseBrainDump(request) {
      calls.push(request);
      if (result instanceof AIError) return Promise.reject(result);
      return Promise.resolve({
        result,
        provider: "anthropic",
        model: "test-model",
        promptVersion: "brain-dump.v1",
        usage: { inputTokens: 1500, outputTokens: 400 },
        attempts: 1,
      });
    },
  };
}

function setup(options: { autoCreate?: boolean; ai?: AIProvider; userId?: string | null; dailyLimit?: number } = {}) {
  const repository = new InMemoryBrainDumpRepository(options.userId === undefined ? "user-1" : options.userId, {
    workStartHour: 9,
    workEndHour: 17,
    autoCreateEnabled: options.autoCreate ?? false,
    tasks: [],
  });
  const ai = options.ai ?? scriptedAI(SAMPLE_AI_RESULT);
  const deps: BrainDumpHandlerDeps = {
    createRepository: () => repository,
    createAI: () => ai,
    now: () => NOW,
    dailyLimit: options.dailyLimit ?? 30,
  };
  return { repository, ai, deps };
}

function post(body: unknown, headers: Record<string, string> = { authorization: "Bearer token" }): Request {
  return new Request("http://localhost/brain-dump", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID = { text: "domani devo chiamare il veterinario per Bruno e comprare lo shampoo", timeZone: "Europe/Rome", locale: "en-IT" };

Deno.test("propose: returns reviewable drafts dated from the phone's today, without creating tasks", async () => {
  const { repository, ai, deps } = setup();

  const response = await handleBrainDumpHttp(post(VALID), deps);
  const proposal = (await response.json()) as BrainDumpProposal;

  assert.equal(response.status, 200);
  assert.equal(proposal.status, "proposed");
  assert.equal(proposal.needsReview, false);
  assert.equal(proposal.candidates.length, 2);
  assert.deepEqual(proposal.candidates[0].draft, {
    title: "Chiamare il veterinario per Bruno",
    estimated_minutes: 10,
    timing: "anytime",
    category: "personal",
    scheduled_time: null,
    due_date: "2026-09-30", // "domani" from Tuesday 29 Sep in Rome
    due_kind: "on",
    notes: null,
    priority: null,
    energy_level: "low",
    flexible: false,
    tags: ["phone"],
    source: "brain_dump",
    source_language: "it",
    ai_confidence: 0.93,
  });
  assert.deepEqual(proposal.createdTasks, []);
  assert.equal(repository.createdTasks.length, 0);
  assert.equal((ai as ReturnType<typeof scriptedAI>).calls[0].todayKey, "2026-09-29");
  assert.equal(repository.sessions[0].rawText, VALID.text);
  assert.deepEqual(repository.sessions[0].usage, { inputTokens: 1500, outputTokens: 400 });
});

Deno.test("auto: creates the tasks only when the user enabled auto-create and nothing needs review", async () => {
  const enabled = setup({ autoCreate: true });
  const response = await handleBrainDumpHttp(post({ ...VALID, mode: "auto" }), enabled.deps);
  const proposal = (await response.json()) as BrainDumpProposal;
  assert.equal(proposal.status, "committed");
  assert.equal(proposal.createdTasks.length, 2);
  assert.deepEqual(enabled.repository.sessions[0].committedTaskIds, ["session-1-task-1", "session-1-task-2"]);

  const disabled = setup({ autoCreate: false });
  const disabledProposal = (await (await handleBrainDumpHttp(post({ ...VALID, mode: "auto" }), disabled.deps)).json()) as BrainDumpProposal;
  assert.equal(disabledProposal.status, "proposed");
  assert.equal(disabled.repository.createdTasks.length, 0);

  const unsure: BrainDumpAiResult = {
    ...SAMPLE_AI_RESULT,
    candidates: [{ ...SAMPLE_AI_RESULT.candidates[0], confidence: 0.5 }],
  };
  const needsReview = setup({ autoCreate: true, ai: scriptedAI(unsure) });
  const reviewProposal = (await (await handleBrainDumpHttp(post({ ...VALID, mode: "auto" }), needsReview.deps)).json()) as BrainDumpProposal;
  assert.equal(reviewProposal.status, "proposed");
  assert.deepEqual(reviewProposal.reviewReasons, ["candidate_issues"]);
  assert.equal(needsReview.repository.createdTasks.length, 0);
});

Deno.test("siri channel: tasks are sourced as siri", async () => {
  const { deps } = setup();
  const proposal = (await (await handleBrainDumpHttp(post({ ...VALID, channel: "siri" }), deps)).json()) as BrainDumpProposal;
  assert.equal(proposal.candidates[0].draft.source, "siri");
});

Deno.test("quota: over the daily limit returns 429 without calling the AI", async () => {
  const { repository, ai, deps } = setup({ dailyLimit: 1 });
  repository.usageCount = 1;

  const response = await handleBrainDumpHttp(post(VALID), deps);

  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, "quota_exceeded");
  assert.equal((ai as ReturnType<typeof scriptedAI>).calls.length, 0);
});

Deno.test("request validation and auth errors", async () => {
  const { deps } = setup();
  const cases: Array<[Request, number, string]> = [
    [post({ ...VALID, text: "   " }), 400, "invalid_request"],
    [post({ ...VALID, text: "x".repeat(2001) }), 400, "invalid_request"],
    [post({ ...VALID, timeZone: "Mars/Olympus" }), 400, "invalid_request"],
    [post({ ...VALID, channel: "email" }), 400, "invalid_request"],
    [post("{not json"), 400, "invalid_json"],
    [post(VALID, {}), 401, "unauthorized"],
    [new Request("http://localhost/brain-dump", { method: "GET" }), 405, "method_not_allowed"],
  ];
  for (const [request, status, code] of cases) {
    const response = await handleBrainDumpHttp(request, deps);
    assert.equal(response.status, status, code);
    assert.equal((await response.json()).error.code, code);
  }

  const anonymous = setup({ userId: null });
  assert.equal((await handleBrainDumpHttp(post(VALID), anonymous.deps)).status, 401);
});

Deno.test("AI failures map to stable, user-safe errors", async () => {
  const cases: Array<[AIError, number, string, boolean]> = [
    [new AIError("unavailable", "timeout"), 503, "ai_unavailable", true],
    [new AIError("rate_limited", "429"), 503, "ai_busy", true],
    [new AIError("invalid_output", "bad"), 422, "not_understood", true],
    [new AIError("truncated", "long"), 422, "too_long", false],
  ];
  for (const [error, status, code, retryable] of cases) {
    const { repository, deps } = setup({ ai: scriptedAI(error) });
    const response = await handleBrainDumpHttp(post(VALID), deps);
    const body = await response.json();
    assert.equal(response.status, status);
    assert.equal(body.error.code, code);
    assert.equal(body.error.retryable, retryable);
    assert.equal(repository.sessions.length, 0);
  }

  const { deps } = setup();
  const misconfigured: BrainDumpHandlerDeps = {
    ...deps,
    createAI: () => {
      throw new AIError("configuration", "AI_PROVIDER missing");
    },
  };
  const response = await handleBrainDumpHttp(post(VALID), misconfigured);
  assert.equal(response.status, 500);
  assert.equal((await response.json()).error.code, "ai_not_configured");
});

Deno.test("CORS preflight is answered", async () => {
  const { deps } = setup();
  const response = await handleBrainDumpHttp(new Request("http://localhost/brain-dump", { method: "OPTIONS" }), deps);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
});

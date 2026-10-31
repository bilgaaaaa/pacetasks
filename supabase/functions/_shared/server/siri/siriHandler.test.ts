import assert from "node:assert/strict";
import type { BrainDumpProposal } from "../../domain/brainDump/types.ts";
import { makeTask } from "../../domain/testing/makeTask.ts";
import type { Task } from "../../domain/task.ts";
import type { BrainDumpRequest } from "../brainDump/brainDumpRequest.ts";
import { ApiError } from "../http/apiError.ts";
import { handleSiriHttp } from "./siriHandler.ts";
import type { SiriServiceDeps } from "./siriHandler.ts";
import type { SiriReply } from "./siriRequest.ts";

// 17:30 UTC on Monday 28 Sep is 19:30 in Rome: after a 9–17 workday.
const NOW = new Date("2026-09-28T17:30:00Z");

function setup(options: { pro?: boolean; userId?: string | null; tasks?: Task[]; brainDump?: BrainDumpProposal | Error } = {}) {
  const brainDumpCalls: BrainDumpRequest[] = [];
  const deps: SiriServiceDeps = {
    repository: {
      getUserId: () => Promise.resolve(options.userId === undefined ? "user-1" : options.userId),
      isPro: () => Promise.resolve(options.pro ?? true),
      loadUserContext: () => Promise.resolve({ workStartHour: 9, workEndHour: 17, tasks: options.tasks ?? [] }),
    },
    runBrainDump: (request) => {
      brainDumpCalls.push(request);
      const answer = options.brainDump;
      if (answer instanceof Error) return Promise.reject(answer);
      return Promise.resolve(answer ?? proposal([makeTask({ id: "new-1", title: "Chiamare il veterinario" })], 0));
    },
    now: () => NOW,
  };
  return { deps: { createDeps: () => deps }, brainDumpCalls };
}

function proposal(createdTasks: Task[], unparsed: number): BrainDumpProposal {
  return {
    sessionId: "session-1",
    status: "committed",
    needsReview: false,
    reviewReasons: [],
    candidates: [],
    unparsedFragments: Array.from({ length: unparsed }, (_, i) => `fragment ${i}`),
    detectedLanguages: ["it"],
    createdTasks,
  };
}

function post(body: unknown, headers: Record<string, string> = { authorization: "Bearer token" }): Request {
  return new Request("http://localhost/siri", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function ask(body: unknown, deps: ReturnType<typeof setup>["deps"], headers?: Record<string, string>) {
  const response = await handleSiriHttp(post(body, headers), deps);
  return { status: response.status, reply: (await response.json()) as SiriReply };
}

Deno.test("add: runs Brain Dump for Siri and confirms in the phone's language", async () => {
  const { deps, brainDumpCalls } = setup();
  const { status, reply } = await ask(
    { action: "add", text: "domani chiamare il veterinario", timeZone: "Europe/Rome", locale: "it-IT" },
    deps
  );
  assert.equal(status, 200);
  assert.deepEqual(reply, { action: "add", outcome: "ok", speech: "Ho aggiunto Chiamare il veterinario.", taskIds: ["new-1"] });
  assert.deepEqual(brainDumpCalls, [
    { text: "domani chiamare il veterinario", timeZone: "Europe/Rome", locale: "it-IT", channel: "siri", mode: "auto" },
  ]);
});

Deno.test("next: picks from Today with the phone's evening timing", async () => {
  const tasks = [
    makeTask({ id: "morning", title: "Stretch", timing: "before_work", estimated_minutes: 5 }),
    makeTask({ id: "evening", title: "Cook dinner", timing: "after_work", estimated_minutes: 30 }),
  ];
  const { reply } = await ask({ action: "next", timeZone: "Europe/Rome", locale: "en-GB" }, setup({ tasks }).deps);
  assert.equal(reply.speech, "Next up: Cook dinner. It takes about 30 minutes.");
  assert.deepEqual(reply.taskIds, ["evening"]);
});

Deno.test("today: counts what is left", async () => {
  const tasks = [makeTask({ id: "a", title: "Pay rent", estimated_minutes: 10 })];
  const { reply } = await ask({ action: "today", timeZone: "Europe/Istanbul", locale: "tr-TR" }, setup({ tasks }).deps);
  assert.equal(reply.speech, "Bugün 1 görevin kaldı: Pay rent, yaklaşık 10 dakika.");
});

Deno.test("free users hear the Pro invitation and nothing runs", async () => {
  const { deps, brainDumpCalls } = setup({ pro: false });
  const { status, reply } = await ask({ action: "add", text: "buy milk", timeZone: "Europe/Rome", locale: "en" }, deps);
  assert.equal(status, 402);
  assert.equal(reply.outcome, "pro_required");
  assert.match(reply.speech, /PaceTasks Pro/);
  assert.equal(brainDumpCalls.length, 0);
});

Deno.test("failures still give Siri something to say", async () => {
  const signedOut = await ask({ action: "today", timeZone: "Europe/Rome", locale: "en" }, setup({ userId: null }).deps);
  assert.equal(signedOut.status, 401);
  assert.equal(signedOut.reply.speech, "Open PaceTasks once so Siri can reach your tasks.");

  const quota = await ask(
    { action: "add", text: "buy milk", timeZone: "Europe/Rome", locale: "en" },
    setup({ brainDump: new ApiError(429, "quota_exceeded", "limit") }).deps
  );
  assert.equal(quota.status, 429);
  assert.equal(quota.reply.outcome, "quota_exceeded");

  const crash = await ask(
    { action: "add", text: "buy milk", timeZone: "Europe/Rome", locale: "it" },
    setup({ brainDump: new Error("db down") }).deps
  );
  assert.equal(crash.status, 500);
  assert.equal(crash.reply.speech, "Al momento non è stato possibile. Riprova tra poco.");
});

Deno.test("bad requests are refused in the asked language", async () => {
  const { deps } = setup();
  const noText = await ask({ action: "add", timeZone: "Europe/Rome", locale: "tr" }, deps);
  assert.equal(noText.status, 400);
  assert.equal(noText.reply.outcome, "failed");
  assert.equal(noText.reply.speech, "Şu anda bunu yapamadım. Birazdan tekrar dene.");

  const noAuth = await ask({ action: "today", timeZone: "Europe/Rome" }, deps, {});
  assert.equal(noAuth.status, 401);
});

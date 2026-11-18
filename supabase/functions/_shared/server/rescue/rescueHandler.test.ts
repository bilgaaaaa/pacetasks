import assert from "node:assert/strict";
import { makeTask } from "../../domain/testing/makeTask.ts";
import type { Task } from "../../domain/task.ts";
import type { TaskPatch } from "../../domain/taskPatch.ts";
import { handleRescueHttp } from "./rescueHandler.ts";
import type { RescueServiceDeps } from "./rescueHandler.ts";

// 20:30 UTC on Monday 16 Nov is 21:30 in Rome: 30 minutes before the day's plan ends.
const NOW = new Date("2026-11-16T20:30:00Z");
const TODAY = "2026-11-16";
const ID = {
  short: "00000000-0000-4000-8000-000000000001",
  long: "00000000-0000-4000-8000-000000000002",
  done: "00000000-0000-4000-8000-000000000003",
};

function setup(options: { userId?: string | null; tasks?: Task[] } = {}) {
  const updates: { taskId: string; patch: TaskPatch }[] = [];
  const deps: RescueServiceDeps = {
    repository: {
      getUserId: () => Promise.resolve(options.userId === undefined ? "user-1" : options.userId),
      loadUserContext: () => Promise.resolve({ workStartHour: 9, workEndHour: 17, tasks: options.tasks ?? [] }),
      updateTask: (taskId, patch) => {
        updates.push({ taskId, patch });
        return Promise.resolve();
      },
    },
    now: () => NOW,
  };
  return { deps: { createDeps: () => deps }, updates };
}

function post(body: unknown, authorization: string | null = "Bearer token"): Request {
  return new Request("https://example.test/functions/v1/rescue", {
    method: "POST",
    headers: authorization ? { authorization, "content-type": "application/json" } : { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const TASKS = [
  makeTask({ id: ID.short, title: "Reply to Anna", estimated_minutes: 20, due_date: TODAY }),
  makeTask({ id: ID.long, title: "Clean the kitchen", estimated_minutes: 60, due_date: TODAY }),
];

Deno.test("plan: what still fits in the user's time zone and what to move", async () => {
  const { deps } = setup({ tasks: TASKS });
  const response = await handleRescueHttp(post({ action: "plan", timeZone: "Europe/Rome" }), deps);
  assert.equal(response.status, 200);
  const reply = await response.json();
  assert.equal(reply.behind, true);
  assert.equal(reply.minutesLeft, 30);
  assert.equal(reply.minutesPlanned, 80);
  assert.deepEqual(
    reply.proposals.map((p: { taskId: string; destination: string; minutes: number }) => [p.taskId, p.destination, p.minutes]),
    [
      [ID.long, "tomorrow", 60],
      [ID.short, "today", 20],
    ]
  );
});

Deno.test("apply: only real moves of pending tasks, with patches computed on the server", async () => {
  const tasks = [...TASKS, makeTask({ id: ID.done, status: "done", due_date: TODAY })];
  const { deps, updates } = setup({ tasks });
  const moves = [
    { taskId: ID.long, destination: "tomorrow" },
    { taskId: ID.short, destination: "today" },
    { taskId: ID.done, destination: "someday" },
  ];
  const response = await handleRescueHttp(post({ action: "apply", timeZone: "Europe/Rome", moves }), deps);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { action: "apply", moved: 1 });
  assert.deepEqual(updates, [{ taskId: ID.long, patch: { due_date: "2026-11-17", due_kind: "on" } }]);
});

Deno.test("refuses requests without a session or with a bad body", async () => {
  const signedOut = setup({ userId: null });
  assert.equal((await handleRescueHttp(post({ action: "plan", timeZone: "Europe/Rome" }), signedOut.deps)).status, 401);
  assert.equal((await handleRescueHttp(post({ action: "plan", timeZone: "Europe/Rome" }, null), setup().deps)).status, 401);
  assert.equal((await handleRescueHttp(post({ action: "plan", timeZone: "Mars/Base" }), setup().deps)).status, 400);
  assert.equal((await handleRescueHttp(post({ action: "apply", timeZone: "Europe/Rome", moves: [] }), setup().deps)).status, 400);
});

import { FunctionsHttpError } from "@supabase/supabase-js";
import type { Task, TaskDraft } from "@domain/task";
import type { BrainDumpProposal } from "@domain/brainDump/types";
import { runBrainDump } from "@server/brainDump/brainDumpService";
import { brainDumpRequestSchema } from "@server/brainDump/brainDumpRequest";
import type { BrainDumpRepository } from "@server/brainDump/brainDumpRepository";
import { createRulesAIProvider } from "@server/ai/rulesAIProvider";
import { ApiError } from "@server/http/apiError";
import { createDemoTask, DEMO_USER_ID, demoTables, newDemoId } from "./demoStore";

// Demo-mode replacements for the brain-dump Edge Function and its RPCs. The
// Edge Function's own service (runBrainDump) runs here with an in-memory
// repository, so quota, review policy and auto-create follow production rules.

const DEMO_DAILY_LIMIT = 30;

let usageToday = 0;

// Same contract as supabaseBrainDumpRepository, backed by demoStore.
const demoRepository: BrainDumpRepository = {
  async getUserId() {
    return DEMO_USER_ID;
  },

  async incrementUsage() {
    usageToday += 1;
    return usageToday;
  },

  async loadUserContext() {
    const settings = demoTables.user_settings.find((s) => s.user_id === DEMO_USER_ID);
    const tasks = [...(demoTables.tasks as Task[])].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return {
      workStartHour: settings?.work_start_hour ?? 9,
      workEndHour: settings?.work_end_hour ?? 17,
      autoCreateEnabled: settings?.brain_dump_auto_create ?? false,
      tasks: tasks.map((t) => ({ ...t })),
    };
  },

  async createSession(session) {
    const id = newDemoId();
    demoTables.brain_dump_sessions.push({
      id,
      user_id: DEMO_USER_ID,
      status: "proposed",
      channel: session.channel,
      raw_text: session.rawText,
      time_zone: session.timeZone,
      proposal: session.proposal,
      committed_task_ids: [],
      created_at: new Date().toISOString(),
    });
    return id;
  },

  async commitSession(sessionId, drafts) {
    return commitDemoBrainDump(sessionId, drafts);
  },
};

// Mirror of public.commit_brain_dump: idempotent, so a retried commit returns
// the tasks it already created instead of duplicating them.
export function commitDemoBrainDump(sessionId: string, drafts: TaskDraft[]): Task[] {
  const session = demoTables.brain_dump_sessions.find((s) => s.id === sessionId);
  if (!session) throw new Error("commit_brain_dump: session not found");
  if (session.status === "discarded") throw new Error("commit_brain_dump: session was discarded");
  if (session.status === "committed") {
    return (demoTables.tasks as Task[]).filter((t) => session.committed_task_ids.includes(t.id)).map((t) => ({ ...t }));
  }
  if (!Array.isArray(drafts) || drafts.length < 1 || drafts.length > 25) {
    throw new Error("commit_brain_dump: drafts must be an array of 1-25 tasks");
  }

  const created = drafts.map((draft) => createDemoTask(draft));
  session.status = "committed";
  session.committed_task_ids = created.map((t) => t.id);
  session.committed_at = new Date().toISOString();
  return created;
}

// Mirror of public.discard_brain_dump; only a proposed session can be discarded.
export function discardDemoBrainDump(sessionId: string): void {
  const session = demoTables.brain_dump_sessions.find((s) => s.id === sessionId);
  if (session?.status === "proposed") session.status = "discarded";
}

// Stands in for supabase.functions.invoke("brain-dump"). Errors come back as a
// FunctionsHttpError carrying the Edge Function's JSON body, so brainDumpApi's
// error mapping works exactly as it does against the deployed function.
export async function invokeDemoBrainDump(
  body: unknown
): Promise<{ data: BrainDumpProposal | null; error: FunctionsHttpError | null }> {
  try {
    const parsed = brainDumpRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "invalid_request", "That request couldn't be read — try again", false);
    }

    const proposal = await runBrainDump(parsed.data, {
      repository: demoRepository,
      ai: createRulesAIProvider(),
      now: () => new Date(),
      dailyLimit: DEMO_DAILY_LIMIT,
    });
    return { data: proposal, error: null };
  } catch (e) {
    console.warn("[demoBrainDump] brain dump failed", e);
    const apiError =
      e instanceof ApiError ? e : new ApiError(500, "internal", "Brain Dump hit a problem — try again", true);
    const response = new Response(
      JSON.stringify({ error: { code: apiError.code, message: apiError.message, retryable: apiError.retryable } }),
      { status: apiError.status, headers: { "content-type": "application/json" } }
    );
    return { data: null, error: new FunctionsHttpError(response) };
  }
}

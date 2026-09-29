import { FunctionsHttpError } from "@supabase/supabase-js";
import type { BrainDumpProposal } from "@domain/brainDump/types";
import { supabase } from "./supabase";
import { getDeviceLocale, getDeviceTimeZone } from "./deviceContext";
import { Task, TaskDraft } from "./types";

// A Brain Dump failure the UI can show as-is: `message` is user-facing and
// `retryable` says whether "Try again" makes sense.
export class BrainDumpApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
    this.name = "BrainDumpApiError";
  }
}

// Sends the text to the brain-dump Edge Function. Mode "auto" lets the server
// create the tasks directly only when the user enabled auto-create and nothing
// needs review; otherwise it returns a proposal to review.
export async function proposeBrainDump(text: string): Promise<BrainDumpProposal> {
  const { data, error } = await supabase.functions.invoke<BrainDumpProposal>("brain-dump", {
    body: {
      text,
      timeZone: getDeviceTimeZone(),
      locale: getDeviceLocale(),
      channel: "app",
      mode: "auto",
    },
  });

  if (error) throw await toBrainDumpApiError(error);
  if (!data) throw new BrainDumpApiError("empty_response", "Brain Dump returned nothing — try again", true);
  return data;
}

// Creates the reviewed drafts through commit_brain_dump (→ create_task).
// Safe to retry: a session that was already committed returns its tasks.
export async function commitBrainDump(sessionId: string, drafts: TaskDraft[]): Promise<Task[]> {
  const { data, error } = await supabase.rpc("commit_brain_dump", { session_id: sessionId, drafts });
  if (error) {
    console.warn("[brainDumpApi] commit failed", error);
    throw new BrainDumpApiError("commit_failed", "Couldn't add the tasks — try again", true);
  }
  return (data ?? []) as Task[];
}

// Marks a proposal as dismissed; best effort, since nothing depends on it.
export async function discardBrainDump(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc("discard_brain_dump", { session_id: sessionId });
  if (error) console.warn("[brainDumpApi] discard failed", error);
}

async function toBrainDumpApiError(error: unknown): Promise<BrainDumpApiError> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await (error.context as Response).json();
      if (body?.error?.message) {
        return new BrainDumpApiError(body.error.code ?? "unknown", body.error.message, Boolean(body.error.retryable));
      }
    } catch {
      // Body wasn't our JSON error shape; fall through to the generic message.
    }
  }
  console.warn("[brainDumpApi] brain-dump request failed", error);
  return new BrainDumpApiError("network", "Couldn't reach Brain Dump — check your connection and try again", true);
}

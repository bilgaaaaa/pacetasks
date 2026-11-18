import type { BrainDumpCandidate, ReviewReason } from "../../domain/brainDump/types.ts";
import type { Task, TaskDraft } from "../../domain/task.ts";
import type { InterpretationProvider } from "../ai/AIProvider.ts";
import type { TokenUsage } from "../ai/LLMClient.ts";
import type { BrainDumpChannel } from "./brainDumpRequest.ts";

export interface BrainDumpUserContext {
  workStartHour: number;
  workEndHour: number;
  autoCreateEnabled: boolean;
  tasks: Task[]; // newest-first
}

export interface NewBrainDumpSession {
  channel: BrainDumpChannel;
  rawText: string;
  timeZone: string;
  proposal: {
    schemaVersion: number;
    candidates: BrainDumpCandidate[];
    unparsedFragments: string[];
    detectedLanguages: string[];
    reviewReasons: ReviewReason[];
  };
  aiProvider: InterpretationProvider;
  aiModel: string;
  promptVersion: string;
  usage: TokenUsage;
}

// Data access the Brain Dump service needs, always acting as the signed-in
// user (RLS applies). An interface so the service is tested without a database.
export interface BrainDumpRepository {
  getUserId(): Promise<string | null>;
  incrementUsage(feature: "brain_dump"): Promise<number>; // today's count after this request
  loadUserContext(): Promise<BrainDumpUserContext>;
  createSession(session: NewBrainDumpSession): Promise<string>;
  commitSession(sessionId: string, drafts: TaskDraft[]): Promise<Task[]>;
}

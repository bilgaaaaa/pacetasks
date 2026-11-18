import { BRAIN_DUMP_SCHEMA_VERSION } from "../../domain/brainDump/aiResult.ts";
import { normalizeBrainDump } from "../../domain/brainDump/normalize.ts";
import { decideReview } from "../../domain/brainDump/reviewPolicy.ts";
import type { BrainDumpProposal } from "../../domain/brainDump/types.ts";
import { toLocalDateKey } from "../../domain/dates.ts";
import type { Task, TaskSource } from "../../domain/task.ts";
import type { AIProvider } from "../ai/AIProvider.ts";
import { ApiError } from "../http/apiError.ts";
import type { BrainDumpRepository } from "./brainDumpRepository.ts";
import type { BrainDumpChannel, BrainDumpRequest } from "./brainDumpRequest.ts";

export interface BrainDumpServiceDeps {
  repository: BrainDumpRepository;
  ai: AIProvider;
  now: () => Date;
  dailyLimit: number;
}

const TASK_SOURCE_BY_CHANNEL: Record<BrainDumpChannel, TaskSource> = {
  app: "brain_dump",
  siri: "siri",
  shortcut: "shortcut",
};

// The Brain Dump use case shared by the app, Siri and Shortcuts:
// quota → AI interpretation → validation/normalization → review decision →
// saved proposal → (optionally) creation through commit_brain_dump.
// The AI never writes; only commit_brain_dump → create_task does.
export async function runBrainDump(request: BrainDumpRequest, deps: BrainDumpServiceDeps): Promise<BrainDumpProposal> {
  const { repository, ai } = deps;

  const userId = await repository.getUserId();
  if (!userId) throw new ApiError(401, "unauthorized", "Sign in to use Brain Dump");

  const usedToday = await repository.incrementUsage("brain_dump");
  if (usedToday > deps.dailyLimit) {
    throw new ApiError(429, "quota_exceeded", "Daily Brain Dump limit reached — try again tomorrow", false, {
      dailyLimit: deps.dailyLimit,
    });
  }

  const todayKey = toLocalDateKey(deps.now(), request.timeZone);
  const userContext = await repository.loadUserContext();

  const interpretation = await ai.parseBrainDump({
    text: request.text,
    todayKey,
    timeZone: request.timeZone,
    localeHint: request.locale,
  });

  const normalized = normalizeBrainDump(interpretation.result, {
    todayKey,
    source: TASK_SOURCE_BY_CHANNEL[request.channel],
    workStartHour: userContext.workStartHour,
    workEndHour: userContext.workEndHour,
    tasks: userContext.tasks,
  });
  const review = decideReview(normalized.candidates, normalized.unparsedFragments);

  const sessionId = await repository.createSession({
    channel: request.channel,
    rawText: request.text,
    timeZone: request.timeZone,
    proposal: {
      schemaVersion: BRAIN_DUMP_SCHEMA_VERSION,
      candidates: normalized.candidates,
      unparsedFragments: normalized.unparsedFragments,
      detectedLanguages: normalized.detectedLanguages,
      reviewReasons: review.reasons,
    },
    aiProvider: interpretation.provider,
    aiModel: interpretation.model,
    promptVersion: interpretation.promptVersion,
    usage: interpretation.usage,
  });

  const shouldAutoCreate = request.mode === "auto" && !review.needsReview && userContext.autoCreateEnabled;
  let createdTasks: Task[] = [];
  if (shouldAutoCreate) {
    createdTasks = await repository.commitSession(
      sessionId,
      normalized.candidates.map((candidate) => candidate.draft)
    );
  }

  console.info(
    JSON.stringify({
      event: "brain_dump",
      sessionId,
      channel: request.channel,
      mode: request.mode,
      candidates: normalized.candidates.length,
      needsReview: review.needsReview,
      reviewReasons: review.reasons,
      autoCreated: createdTasks.length,
      provider: interpretation.provider,
      model: interpretation.model,
      attempts: interpretation.attempts,
      inputTokens: interpretation.usage.inputTokens,
      outputTokens: interpretation.usage.outputTokens,
    })
  );

  return {
    sessionId,
    status: shouldAutoCreate ? "committed" : "proposed",
    needsReview: review.needsReview,
    reviewReasons: review.reasons,
    candidates: normalized.candidates,
    unparsedFragments: normalized.unparsedFragments,
    detectedLanguages: normalized.detectedLanguages,
    createdTasks,
  };
}

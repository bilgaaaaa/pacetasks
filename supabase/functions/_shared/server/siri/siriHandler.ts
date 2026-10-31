import type { BrainDumpProposal } from "../../domain/brainDump/types.ts";
import { toLocalDateKey, toLocalTimeOfDay } from "../../domain/dates.ts";
import { answerNext, answerToday } from "../../domain/siri/siriAnswers.ts";
import type { SiriMoment } from "../../domain/siri/siriAnswers.ts";
import {
  addedSpeech,
  failedSpeech,
  openAppSpeech,
  proRequiredSpeech,
  quotaSpeech,
  siriLanguage,
} from "../../domain/siri/siriSpeech.ts";
import type { SiriLanguage } from "../../domain/siri/siriSpeech.ts";
import { timingForHour } from "../../domain/timing.ts";
import { ApiError, CORS_HEADERS, jsonResponse } from "../http/apiError.ts";
import type { BrainDumpRequest } from "../brainDump/brainDumpRequest.ts";
import type { SiriRepository } from "./siriRepository.ts";
import { siriRequestSchema } from "./siriRequest.ts";
import type { SiriOutcome, SiriReply, SiriRequest } from "./siriRequest.ts";

export interface SiriServiceDeps {
  repository: SiriRepository;
  runBrainDump: (request: BrainDumpRequest) => Promise<BrainDumpProposal>; // the same use case the app's Brain Dump runs
  now: () => Date;
}

export interface SiriHandlerDeps {
  createDeps: (authorizationHeader: string) => SiriServiceDeps;
}

// Answers one Siri request. Every action is Pro; adding goes through Brain Dump
// (which creates the tasks right away for Siri), the others read Today.
export async function answerSiri(request: SiriRequest, deps: SiriServiceDeps): Promise<SiriReply> {
  const language = siriLanguage(request.locale);
  const { repository } = deps;

  if (!(await repository.getUserId())) throw new ApiError(401, "unauthorized", "Sign in to use Siri");
  if (!(await repository.isPro())) throw new ApiError(402, "pro_required", "Siri is part of PaceTasks Pro");

  if (request.action === "add") {
    const proposal = await deps.runBrainDump({
      text: request.text ?? "",
      timeZone: request.timeZone,
      locale: request.locale,
      channel: request.channel,
      mode: "auto",
    });
    return {
      action: "add",
      outcome: "ok",
      speech: addedSpeech(language, proposal.createdTasks.map((task) => task.title), proposal.unparsedFragments.length),
      taskIds: proposal.createdTasks.map((task) => task.id),
    };
  }

  const context = await repository.loadUserContext();
  const now = deps.now();
  const timeOfDay = toLocalTimeOfDay(now, request.timeZone);
  const moment: SiriMoment = {
    todayKey: toLocalDateKey(now, request.timeZone),
    timeOfDay,
    currentTiming: timingForHour(Number(timeOfDay.slice(0, 2)), context.workStartHour, context.workEndHour),
    language,
  };
  const answer = request.action === "next" ? answerNext(context.tasks, moment) : answerToday(context.tasks, moment);
  return { action: request.action, outcome: "ok", ...answer };
}

// What Siri says for each failure; anything unexpected gets the generic "try again".
const OUTCOME_BY_CODE: Record<string, [SiriOutcome, (language: SiriLanguage) => string]> = {
  unauthorized: ["unauthorized", openAppSpeech],
  pro_required: ["pro_required", proRequiredSpeech],
  quota_exceeded: ["quota_exceeded", quotaSpeech],
};

// HTTP layer for POST /siri. Always answers with a SiriReply, so the phone only
// ever reads `speech`; the status code still tells logs and tests what happened.
export async function handleSiriHttp(request: Request, deps: SiriHandlerDeps): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  const startedAt = Date.now();
  let language: SiriLanguage = "en";
  let action: SiriReply["action"] = null;
  try {
    if (request.method !== "POST") throw new ApiError(405, "method_not_allowed", "Use POST");
    const authorization = request.headers.get("authorization");
    if (!authorization) throw new ApiError(401, "unauthorized", "Sign in to use Siri");

    const body = await request.json().catch(() => null);
    language = siriLanguage(typeof body?.locale === "string" ? body.locale : null);
    const parsed = siriRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid Siri request");
    action = parsed.data.action;

    const reply = await answerSiri(parsed.data, deps.createDeps(authorization));
    console.info(
      JSON.stringify({ event: "siri", action, outcome: reply.outcome, tasks: reply.taskIds.length, latencyMs: Date.now() - startedAt })
    );
    return jsonResponse(200, reply);
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError(500, "internal_error", "Siri request failed", true);
    const [outcome, speech] = OUTCOME_BY_CODE[apiError.code] ?? ["failed", failedSpeech];
    console.error(
      JSON.stringify({
        event: "siri_failed",
        action,
        code: apiError.code,
        status: apiError.status,
        cause: error instanceof ApiError ? undefined : String(error),
        latencyMs: Date.now() - startedAt,
      })
    );
    const reply: SiriReply = { action, outcome, speech: speech(language), taskIds: [] };
    return jsonResponse(apiError.status, reply);
  }
}

import { toLocalDateKey, toLocalTimeOfDay } from "../../domain/dates.ts";
import { DO_NOW_DEFAULT_ENERGY, taskMinutes } from "../../domain/doNow.ts";
import { buildPaceModel } from "../../domain/pace.ts";
import { planRescue } from "../../domain/rescue.ts";
import type { RescueContext } from "../../domain/rescue.ts";
import { rolloverPatch } from "../../domain/rollover.ts";
import { timingForHour } from "../../domain/timing.ts";
import { ApiError, CORS_HEADERS, errorResponse, jsonResponse } from "../http/apiError.ts";
import type { TaskRepository } from "../tasks/taskRepository.ts";
import { rescueRequestSchema } from "./rescueRequest.ts";
import type { RescueReply, RescueRequest } from "./rescueRequest.ts";

export interface RescueServiceDeps {
  repository: TaskRepository;
  now: () => Date;
}

export interface RescueHandlerDeps {
  createDeps: (authorizationHeader: string) => RescueServiceDeps;
}

// Plans or applies Rescue my day with the same domain rules the iPhone app runs,
// so both apps propose the same moves. Applying re-reads the tasks and computes each
// patch on the server: the app only says which task goes where.
export async function answerRescue(request: RescueRequest, deps: RescueServiceDeps): Promise<RescueReply> {
  const { repository } = deps;
  if (!(await repository.getUserId())) throw new ApiError(401, "unauthorized", "Sign in to PaceTasks");

  const userContext = await repository.loadUserContext();
  const now = deps.now();
  const todayKey = toLocalDateKey(now, request.timeZone);

  if (request.action === "apply") {
    const pending = new Map(userContext.tasks.filter((task) => task.status === "pending").map((task) => [task.id, task]));
    let moved = 0;
    for (const move of request.moves) {
      const task = pending.get(move.taskId);
      // A task done, deleted or kept for today in the meantime is simply left alone.
      if (!task || move.destination === "today") continue;
      await repository.updateTask(task.id, rolloverPatch(task, move.destination, todayKey));
      moved += 1;
    }
    return { action: "apply", moved };
  }

  const timeOfDay = toLocalTimeOfDay(now, request.timeZone);
  const context: RescueContext = {
    todayKey,
    timeOfDay,
    currentTiming: timingForHour(Number(timeOfDay.slice(0, 2)), userContext.workStartHour, userContext.workEndHour),
    energy: DO_NOW_DEFAULT_ENERGY,
    paceModel: buildPaceModel(userContext.tasks),
  };
  const plan = planRescue(userContext.tasks, context);
  return {
    action: "plan",
    behind: plan.behind,
    minutesLeft: plan.minutesLeft,
    minutesPlanned: plan.minutesPlanned,
    proposals: plan.proposals.map(({ task, destination, reason }) => ({
      taskId: task.id,
      title: task.title,
      destination,
      reason,
      minutes: taskMinutes(task, context),
    })),
  };
}

// HTTP layer for POST /rescue.
export async function handleRescueHttp(request: Request, deps: RescueHandlerDeps): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  const startedAt = Date.now();
  try {
    if (request.method !== "POST") throw new ApiError(405, "method_not_allowed", "Use POST");
    const authorization = request.headers.get("authorization");
    if (!authorization) throw new ApiError(401, "unauthorized", "Sign in to PaceTasks");

    const parsed = rescueRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiError(400, "invalid_request", "Invalid rescue request");

    const reply = await answerRescue(parsed.data, deps.createDeps(authorization));
    const outcome = reply.action === "plan" ? { behind: reply.behind, proposals: reply.proposals.length } : { moved: reply.moved };
    console.info(JSON.stringify({ event: "rescue", action: reply.action, ...outcome, latencyMs: Date.now() - startedAt }));
    return jsonResponse(200, reply);
  } catch (error) {
    const apiError = error instanceof ApiError ? error : new ApiError(500, "internal_error", "Rescue request failed", true);
    console.error(
      JSON.stringify({
        event: "rescue_failed",
        code: apiError.code,
        status: apiError.status,
        cause: error instanceof ApiError ? undefined : String(error),
        latencyMs: Date.now() - startedAt,
      })
    );
    return errorResponse(apiError);
  }
}

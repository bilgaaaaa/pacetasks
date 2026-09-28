import type { AIProvider } from "../ai/AIProvider.ts";
import { AIError } from "../ai/errors.ts";
import type { AIErrorKind } from "../ai/errors.ts";
import { ApiError, CORS_HEADERS, errorResponse, jsonResponse } from "../http/apiError.ts";
import type { BrainDumpRepository } from "./brainDumpRepository.ts";
import { brainDumpRequestSchema } from "./brainDumpRequest.ts";
import { runBrainDump } from "./brainDumpService.ts";

export interface BrainDumpHandlerDeps {
  createRepository: (authorizationHeader: string) => BrainDumpRepository;
  createAI: () => AIProvider;
  now: () => Date;
  dailyLimit: number;
}

// How each AI failure reaches the client: status, code, message, retryable.
const AI_ERROR_RESPONSES: Record<AIErrorKind, [number, string, string, boolean]> = {
  configuration: [500, "ai_not_configured", "Brain Dump isn't set up on the server yet", false],
  rate_limited: [503, "ai_busy", "Brain Dump is busy right now — try again in a moment", true],
  unavailable: [503, "ai_unavailable", "Brain Dump couldn't reach its AI service — try again", true],
  refused: [422, "not_understood", "Brain Dump couldn't turn this into tasks", false],
  truncated: [422, "too_long", "That brain dump is too long to process at once — try splitting it", false],
  invalid_output: [422, "not_understood", "Brain Dump couldn't turn this into tasks — try rephrasing", true],
};

// HTTP layer for POST /brain-dump: validates the request, runs the service and
// maps every failure to a stable JSON error. Runtime-agnostic, so it's tested
// with plain Request objects; index.ts only wires real dependencies.
export async function handleBrainDumpHttp(request: Request, deps: BrainDumpHandlerDeps): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  const startedAt = Date.now();
  try {
    if (request.method !== "POST") throw new ApiError(405, "method_not_allowed", "Use POST");

    const authorization = request.headers.get("authorization");
    if (!authorization) throw new ApiError(401, "unauthorized", "Sign in to use Brain Dump");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, "invalid_json", "Request body must be JSON");
    }

    const parsed = brainDumpRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(400, "invalid_request", "Invalid Brain Dump request", false, {
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      });
    }

    const proposal = await runBrainDump(parsed.data, {
      repository: deps.createRepository(authorization),
      ai: deps.createAI(),
      now: deps.now,
      dailyLimit: deps.dailyLimit,
    });
    return jsonResponse(200, proposal);
  } catch (error) {
    const apiError = toApiError(error);
    console.error(
      JSON.stringify({
        event: "brain_dump_failed",
        code: apiError.code,
        status: apiError.status,
        cause: describeCause(error),
        latencyMs: Date.now() - startedAt,
      })
    );
    return errorResponse(apiError);
  }
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AIError) {
    const [status, code, message, retryable] = AI_ERROR_RESPONSES[error.kind];
    return new ApiError(status, code, message, retryable);
  }
  if (isPostgrestError(error)) {
    return new ApiError(500, "database_error", "Brain Dump couldn't save your tasks — try again", true);
  }
  return new ApiError(500, "internal_error", "Something went wrong in Brain Dump", true);
}

function isPostgrestError(error: unknown): error is { code: string; message: string } {
  return typeof error === "object" && error !== null && "code" in error && "message" in error && "details" in error;
}

// Error details for logs only; never includes the user's text.
function describeCause(error: unknown): unknown {
  if (error instanceof AIError) return { kind: error.kind, message: error.message, details: error.details };
  if (error instanceof ApiError) return { code: error.code };
  if (isPostgrestError(error)) return { dbCode: error.code, message: error.message };
  return error instanceof Error ? { name: error.name, message: error.message } : String(error);
}

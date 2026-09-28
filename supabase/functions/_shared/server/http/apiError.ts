// A failure with a stable machine-readable code and an HTTP status, returned
// to clients as { error: { code, message, retryable } }.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const CORS_HEADERS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
  });
}

export function errorResponse(error: ApiError): Response {
  return jsonResponse(error.status, {
    error: { code: error.code, message: error.message, retryable: error.retryable, details: error.details ?? null },
  });
}

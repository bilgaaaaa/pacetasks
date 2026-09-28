// Failure categories every AI vendor adapter maps its errors onto, so callers
// decide retry/user messaging without knowing which vendor is behind it.
export type AIErrorKind =
  | "configuration" // missing/invalid key or model: an operator problem, not the user's
  | "rate_limited" // vendor throttled us; retry later
  | "unavailable" // network error, timeout, vendor outage
  | "refused" // the model declined to answer
  | "truncated" // output hit the token limit before completing
  | "invalid_output"; // output didn't match the required schema

export class AIError extends Error {
  constructor(
    readonly kind: AIErrorKind,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "AIError";
  }
}

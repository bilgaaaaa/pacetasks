import { AIError } from "./errors.ts";
import type { AIErrorKind } from "./errors.ts";
import type { FetchFn } from "./LLMClient.ts";

// POSTs JSON to a vendor API with a timeout, mapping transport and HTTP
// failures onto AIError kinds so every adapter reports failures the same way.
export async function postJson(
  fetchFn: FetchFn,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new AIError("unavailable", `AI request failed: ${(error as Error).message}`);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new AIError(kindForStatus(response.status), `AI vendor returned HTTP ${response.status}`, {
      status: response.status,
      body: text.slice(0, 500),
    });
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new AIError("unavailable", "AI vendor returned a non-JSON response");
  }
}

function kindForStatus(status: number): AIErrorKind {
  if (status === 429) return "rate_limited";
  if (status >= 500) return "unavailable"; // includes Anthropic's 529 "overloaded"
  return "configuration"; // 400/401/403/404: bad key, model name or request shape
}

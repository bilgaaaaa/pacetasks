import type { FetchFn } from "../ai/LLMClient.ts";

export interface RecordedCall {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

// A fetch stand-in that replays vendor responses (shaped per each vendor's API
// docs) and records what was sent, so adapters are tested without a network.
export function fakeFetch(responses: Array<{ status: number; body: unknown }>): {
  fetchFn: FetchFn;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const queue = [...responses];

  const fetchFn: FetchFn = (input, init) => {
    calls.push({
      url: String(input),
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      body: JSON.parse(String(init?.body ?? "{}")),
    });
    const next = queue.shift();
    if (!next) return Promise.reject(new TypeError("network down"));
    return Promise.resolve(
      new Response(typeof next.body === "string" ? next.body : JSON.stringify(next.body), { status: next.status })
    );
  };

  return { fetchFn, calls };
}

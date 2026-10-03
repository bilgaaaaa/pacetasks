import { createAIProvider } from "../_shared/server/ai/providerFactory.ts";
import { handleBrainDumpHttp } from "../_shared/server/brainDump/brainDumpHandler.ts";
import { createSupabaseBrainDumpRepository } from "../_shared/server/brainDump/supabaseBrainDumpRepository.ts";

// POST /functions/v1/brain-dump — turns messy text into reviewable task proposals.
// Secrets: AI_PROVIDER ("rules" needs nothing else; an AI vendor also needs
// AI_MODEL_BRAIN_DUMP and its API key) and optionally BRAIN_DUMP_DAILY_LIMIT.
// SUPABASE_URL/SUPABASE_ANON_KEY are injected.

const DEFAULT_DAILY_LIMIT = 30;

const supabaseUrl = requireEnv("SUPABASE_URL");
const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
const dailyLimit = Number(Deno.env.get("BRAIN_DUMP_DAILY_LIMIT") ?? DEFAULT_DAILY_LIMIT);

Deno.serve((request) =>
  handleBrainDumpHttp(request, {
    createRepository: (authorizationHeader) =>
      createSupabaseBrainDumpRepository({ supabaseUrl, supabaseAnonKey, authorizationHeader }),
    // Read per request, so rotating a secret or switching model needs no redeploy.
    createAI: () => createAIProvider((name) => Deno.env.get(name), "BRAIN_DUMP"),
    now: () => new Date(),
    dailyLimit: Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : DEFAULT_DAILY_LIMIT,
  })
);

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`[brain-dump] missing required env ${name}`);
  return value;
}

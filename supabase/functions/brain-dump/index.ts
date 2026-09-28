import { createLLMClient, readAIConfig } from "../_shared/server/ai/clientFactory.ts";
import { createPaceAIProvider } from "../_shared/server/ai/paceAIProvider.ts";
import { handleBrainDumpHttp } from "../_shared/server/brainDump/brainDumpHandler.ts";
import { createSupabaseBrainDumpRepository } from "../_shared/server/brainDump/supabaseBrainDumpRepository.ts";

// POST /functions/v1/brain-dump — turns messy text into reviewable task proposals.
// Secrets: AI_PROVIDER, AI_MODEL_BRAIN_DUMP, the provider's API key, and
// optionally BRAIN_DUMP_DAILY_LIMIT. SUPABASE_URL/SUPABASE_ANON_KEY are injected.

const DEFAULT_DAILY_LIMIT = 30;

const supabaseUrl = requireEnv("SUPABASE_URL");
const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
const dailyLimit = Number(Deno.env.get("BRAIN_DUMP_DAILY_LIMIT") ?? DEFAULT_DAILY_LIMIT);

Deno.serve((request) =>
  handleBrainDumpHttp(request, {
    createRepository: (authorizationHeader) =>
      createSupabaseBrainDumpRepository({ supabaseUrl, supabaseAnonKey, authorizationHeader }),
    // Read per request, so rotating a secret or switching model needs no redeploy.
    createAI: () => createPaceAIProvider(createLLMClient(readAIConfig((name) => Deno.env.get(name), "BRAIN_DUMP"))),
    now: () => new Date(),
    dailyLimit: Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : DEFAULT_DAILY_LIMIT,
  })
);

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`[brain-dump] missing required env ${name}`);
  return value;
}

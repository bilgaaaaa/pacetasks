import { createAIProviderForUser } from "../_shared/server/ai/providerFactory.ts";
import { readBrainDumpDailyLimit } from "../_shared/server/brainDump/brainDumpConfig.ts";
import { handleBrainDumpHttp } from "../_shared/server/brainDump/brainDumpHandler.ts";
import { createSupabaseBrainDumpRepository } from "../_shared/server/brainDump/supabaseBrainDumpRepository.ts";
import { requireEnv } from "../_shared/server/http/supabaseAuth.ts";

// POST /functions/v1/brain-dump — turns messy text into reviewable task proposals.
// Pro users run on AI_PROVIDER, free users on the rules; Siri and Shortcuts need Pro.
// Secrets: AI_PROVIDER ("rules" needs nothing else; an AI vendor also needs
// AI_MODEL_BRAIN_DUMP and its API key) and optionally BRAIN_DUMP_DAILY_LIMIT.
// SUPABASE_URL/SUPABASE_ANON_KEY are injected.

const env = (name: string) => Deno.env.get(name);
const supabaseUrl = requireEnv("brain-dump", "SUPABASE_URL");
const supabaseAnonKey = requireEnv("brain-dump", "SUPABASE_ANON_KEY");
const dailyLimit = readBrainDumpDailyLimit(env);

Deno.serve((request) =>
  handleBrainDumpHttp(request, {
    createRepository: (authorizationHeader) =>
      createSupabaseBrainDumpRepository({ supabaseUrl, supabaseAnonKey, authorizationHeader }),
    // Read per request, so rotating a secret or switching model needs no redeploy.
    createAI: (isPro) => createAIProviderForUser(env, "BRAIN_DUMP", isPro),
    now: () => new Date(),
    dailyLimit,
  })
);

import { createAIProviderForUser } from "../_shared/server/ai/providerFactory.ts";
import { readBrainDumpDailyLimit } from "../_shared/server/brainDump/brainDumpConfig.ts";
import { runBrainDump } from "../_shared/server/brainDump/brainDumpService.ts";
import { createSupabaseBrainDumpRepository } from "../_shared/server/brainDump/supabaseBrainDumpRepository.ts";
import { requireEnv } from "../_shared/server/http/supabaseAuth.ts";
import { handleSiriHttp } from "../_shared/server/siri/siriHandler.ts";
import { createSupabaseSiriRepository } from "../_shared/server/siri/siriRepository.ts";

// POST /functions/v1/siri — what the iPhone's App Intents call: add tasks by voice,
// "what's next?" and "what's on today?". Pro only; answers carry the words Siri says.
// Adding uses brain-dump's secrets (AI_PROVIDER, BRAIN_DUMP_DAILY_LIMIT).

const env = (name: string) => Deno.env.get(name);
const supabaseUrl = requireEnv("siri", "SUPABASE_URL");
const supabaseAnonKey = requireEnv("siri", "SUPABASE_ANON_KEY");
const dailyLimit = readBrainDumpDailyLimit(env);

Deno.serve((request) =>
  handleSiriHttp(request, {
    createDeps: (authorizationHeader) => {
      const connection = { supabaseUrl, supabaseAnonKey, authorizationHeader };
      return {
        repository: createSupabaseSiriRepository(connection),
        runBrainDump: (brainDumpRequest) =>
          runBrainDump(brainDumpRequest, {
            repository: createSupabaseBrainDumpRepository(connection),
            createAI: (isPro) => createAIProviderForUser(env, "BRAIN_DUMP", isPro),
            now: () => new Date(),
            dailyLimit,
          }),
        now: () => new Date(),
      };
    },
  })
);

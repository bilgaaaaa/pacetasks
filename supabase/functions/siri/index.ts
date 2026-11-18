import { createAIProvider } from "../_shared/server/ai/providerFactory.ts";
import { runBrainDump } from "../_shared/server/brainDump/brainDumpService.ts";
import { createSupabaseBrainDumpRepository } from "../_shared/server/brainDump/supabaseBrainDumpRepository.ts";
import { createProAccessCheck, siriRequiresPro } from "../_shared/server/pro/proAccess.ts";
import { handleSiriHttp } from "../_shared/server/siri/siriHandler.ts";
import { createSupabaseTaskRepository } from "../_shared/server/tasks/taskRepository.ts";

// POST /functions/v1/siri — what the iPhone's App Intents call: add tasks by voice,
// "what's next?" and "what's on today?". Answers carry the words Siri says.
// Adding uses brain-dump's secrets (AI_PROVIDER, BRAIN_DUMP_DAILY_LIMIT);
// SIRI_REQUIRES_PRO=1 limits Siri to PaceTasks Pro subscribers.

const DEFAULT_DAILY_LIMIT = 30;

const supabaseUrl = requireEnv("SUPABASE_URL");
const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");
const dailyLimit = Number(Deno.env.get("BRAIN_DUMP_DAILY_LIMIT") ?? DEFAULT_DAILY_LIMIT);

Deno.serve((request) =>
  handleSiriHttp(request, {
    createDeps: (authorizationHeader) => {
      const connection = { supabaseUrl, supabaseAnonKey, authorizationHeader };
      const checkPro = createProAccessCheck(connection);
      return {
        repository: createSupabaseTaskRepository(connection),
        // Read per request, so switching the check on needs no redeploy.
        hasSiriAccess: () => (siriRequiresPro((name) => Deno.env.get(name)) ? checkPro() : Promise.resolve(true)),
        runBrainDump: (brainDumpRequest) =>
          runBrainDump(brainDumpRequest, {
            repository: createSupabaseBrainDumpRepository(connection),
            // Read per request, so rotating a secret or switching model needs no redeploy.
            ai: createAIProvider((name) => Deno.env.get(name), "BRAIN_DUMP"),
            now: () => new Date(),
            dailyLimit: Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : DEFAULT_DAILY_LIMIT,
          }),
        now: () => new Date(),
      };
    },
  })
);

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`[siri] missing required env ${name}`);
  return value;
}

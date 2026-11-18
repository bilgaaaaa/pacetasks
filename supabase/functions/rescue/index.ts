import { handleRescueHttp } from "../_shared/server/rescue/rescueHandler.ts";
import { createSupabaseTaskRepository } from "../_shared/server/tasks/taskRepository.ts";

// POST /functions/v1/rescue — Rescue my day for PaceTasks for Mac: "plan" says what
// still fits today and what to move, "apply" moves the tasks the user confirmed.
// Same rules as the iPhone app (domain/rescue.ts).

const supabaseUrl = requireEnv("SUPABASE_URL");
const supabaseAnonKey = requireEnv("SUPABASE_ANON_KEY");

Deno.serve((request) =>
  handleRescueHttp(request, {
    createDeps: (authorizationHeader) => ({
      repository: createSupabaseTaskRepository({ supabaseUrl, supabaseAnonKey, authorizationHeader }),
      now: () => new Date(),
    }),
  })
);

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`[rescue] missing required env ${name}`);
  return value;
}

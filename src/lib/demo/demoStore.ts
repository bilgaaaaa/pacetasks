import { TASK_LIMITS } from "@domain/task";
import type { Task, TaskDraft, TaskTiming } from "@domain/task";
import { addDays, toLocalDateKey } from "@domain/dates";

// In-memory tables behind demo mode. Shapes and defaults mirror supabase/migrations
// so demo data behaves like the real database; it resets on every reload.

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

export type Row = Record<string, any>;

export const demoTables: Record<string, Row[]> = {
  tasks: buildSeedTasks(),
  user_settings: [],
  brain_dump_sessions: [],
  profiles: [],
};

export function newDemoId(): string {
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Fills the columns Postgres would default, for inserts made through .from().insert().
export function withTableDefaults(table: string, row: Row): Row {
  const now = new Date().toISOString();
  if (table === "tasks") return { ...taskFromDraft({ title: row.title ?? "" }), ...row, postponed_count: 0 };
  if (table === "user_settings") return { brain_dump_auto_create: false, updated_at: now, ...row };
  if (table === "brain_dump_sessions") return { id: newDemoId(), status: "proposed", created_at: now, ...row };
  if (table === "profiles") {
    return {
      marketing_opt_in: false,
      created_at: now,
      updated_at: now,
      ...row,
      marketing_opt_in_at: row.marketing_opt_in ? now : null,
    };
  }
  return row;
}

// Mirror of the tasks_track_postponement trigger: the store owns postponed_count,
// adding one whenever an unfinished task's due date moves to a later day and
// clearing it when a task comes back from someday.
export function withUpdateRules(table: string, row: Row, patch: Row): Row {
  if (table === "profiles") return withProfileStamp(row, patch);
  if (table !== "tasks") return patch;
  const nextStatus = patch.status ?? row.status;
  const nextDueDate = "due_date" in patch ? patch.due_date : row.due_date;
  if (row.status === "someday" && nextStatus === "pending") return { ...patch, postponed_count: 0 };
  const postponed =
    row.status !== "done" && nextStatus !== "done" && row.due_date !== null && nextDueDate > row.due_date;
  return { ...patch, postponed_count: row.postponed_count + (postponed ? 1 : 0) };
}

// Mirror of the profiles_stamp trigger: the consent date is set when consent is
// given, cleared when it is withdrawn, and never taken from the caller.
function withProfileStamp(row: Row, patch: Row): Row {
  const now = new Date().toISOString();
  const optIn = patch.marketing_opt_in ?? row.marketing_opt_in;
  const marketing_opt_in_at = !optIn ? null : row.marketing_opt_in ? row.marketing_opt_in_at : now;
  return { ...patch, marketing_opt_in_at, updated_at: now };
}

// Mirror of public.create_task: validates the draft, applies its defaults and
// inserts it for the demo user. Throws the same kind of message the RPC raises.
export function createDemoTask(draft: TaskDraft): Task {
  const title = (draft.title ?? "").trim();
  if (!title) throw new Error("create_task: title is required");

  const task = taskFromDraft({ ...draft, title });
  demoTables.tasks.push(task);
  return { ...task };
}

function taskFromDraft(draft: TaskDraft): Task {
  const tags = [...new Set((draft.tags ?? []).map((t) => t.trim()).filter(Boolean))];
  return {
    id: newDemoId(),
    user_id: DEMO_USER_ID,
    title: draft.title,
    estimated_minutes: draft.estimated_minutes ?? TASK_LIMITS.defaultEstimatedMinutes,
    actual_minutes: null,
    timing: draft.timing ?? "anytime",
    category: draft.category?.trim() || null,
    scheduled_time: draft.scheduled_time?.trim() || null,
    status: "pending",
    created_at: new Date().toISOString(),
    completed_at: null,
    due_date: draft.due_date ?? null,
    due_kind: draft.due_kind ?? null,
    notes: draft.notes?.trim() || null,
    priority: draft.priority ?? null,
    energy_level: draft.energy_level ?? null,
    flexible: draft.flexible ?? false,
    tags,
    source: draft.source ?? "app",
    source_language: draft.source_language ?? null,
    ai_confidence: draft.ai_confidence ?? null,
    postponed_count: 0,
  };
}

// Seeds ~6 weeks of weekday history plus today's list, so Stats, streaks,
// range-timer bounds, Brain Dump's history-based durations and "What can I do
// now?" (durations and energy levels of different sizes) have real input.
function buildSeedTasks(): Task[] {
  const recurring: Array<[string, number, TaskTiming, string | null]> = [
    ["Morning run", 30, "before_work", "health"],
    ["Groceries", 25, "after_work", "shopping"],
    ["Answer emails", 15, "anytime", "work"],
    ["Laundry", 20, "after_work", "home"],
    ["Read 20 pages", 20, "after_work", "personal"],
  ];
  const tasks: Task[] = [];
  const todayKey = toLocalDateKey(new Date());

  for (let daysAgo = 42; daysAgo >= 1; daysAgo--) {
    const dayKey = addDays(todayKey, -daysAgo);
    const weekday = new Date(`${dayKey}T12:00:00`).getDay();
    if (weekday === 0 || weekday === 6) continue;

    // Deterministic variety: 0–3 tasks per day, so some days stay empty.
    const count = (daysAgo * 7) % 4;
    for (let i = 0; i < count; i++) {
      const [title, estimate, timing, category] = recurring[(daysAgo + i) % recurring.length];
      const completedAt = new Date(`${dayKey}T${timing === "before_work" ? "07" : "19"}:${10 + i * 10}:00`);
      const task = taskFromDraft({ title, estimated_minutes: estimate, timing, category });
      tasks.push({
        ...task,
        actual_minutes: Math.max(5, estimate + (((daysAgo * 13 + i * 5) % 11) - 5)),
        status: "done",
        created_at: completedAt.toISOString(),
        completed_at: completedAt.toISOString(),
      });
    }
  }

  const today: TaskDraft[] = [
    { title: "Morning run", estimated_minutes: 30, timing: "before_work", category: "health", energy_level: "high" },
    { title: "Call the dentist", estimated_minutes: 5, category: "health", due_date: todayKey, due_kind: "on", energy_level: "low" },
    { title: "Deep work: PaceTasks AI layer", estimated_minutes: 50, category: "personal", scheduled_time: "20:00", energy_level: "high" },
    { title: "Renew bike insurance", estimated_minutes: 15, category: "personal", due_date: addDays(todayKey, 3), due_kind: "by" },
    { title: "Groceries", estimated_minutes: 25, timing: "after_work", category: "shopping", energy_level: "medium" },
    { title: "Pay the phone bill", estimated_minutes: 3, category: "home", energy_level: "low" },
    { title: "Reply to Marco", estimated_minutes: 10, category: "work", energy_level: "low" },
    { title: "Plan the weekend trip", estimated_minutes: 30, category: "personal", flexible: true, energy_level: "medium" },
  ];
  today.forEach((draft, i) => {
    tasks.push({ ...taskFromDraft(draft), created_at: new Date(Date.now() - i * 60_000).toISOString() });
  });

  // Tasks left unfinished on earlier days, one for each kind of rollover proposal.
  const yesterdayKey = addDays(todayKey, -1);
  const unfinished: Array<[TaskDraft, number]> = [
    [{ title: "Send the tax documents", estimated_minutes: 20, category: "work", due_date: yesterdayKey, due_kind: "by" }, 0],
    [{ title: "Call the bank", estimated_minutes: 10, category: "personal", due_date: yesterdayKey, due_kind: "on" }, 1],
    [{ title: "Clean the bathroom", estimated_minutes: 45, category: "home", due_date: addDays(todayKey, -4), due_kind: "on" }, 3],
    [{ title: "Try the new climbing gym", estimated_minutes: 60, category: "health", due_date: yesterdayKey, due_kind: "on", flexible: true }, 0],
  ];
  unfinished.forEach(([draft, postponedCount], i) => {
    tasks.push({
      ...taskFromDraft(draft),
      postponed_count: postponedCount,
      created_at: new Date(Date.now() - (i + 1) * 86_400_000).toISOString(),
    });
  });

  // Undated tasks that have sat on the list for weeks, for Weekly Reset.
  const stale: TaskDraft[] = [
    { title: "Sort the photo backup", estimated_minutes: 40, category: "personal" },
    { title: "Fix the squeaky door", estimated_minutes: 15, category: "home" },
  ];
  stale.forEach((draft, i) => {
    tasks.push({ ...taskFromDraft(draft), created_at: new Date(Date.now() - (i + 20) * 86_400_000).toISOString() });
  });

  // Parked "someday" tasks for the Someday sheet.
  const someday: TaskDraft[] = [
    { title: "Learn Spanish", estimated_minutes: 30, category: "personal" },
    { title: "Redecorate the bedroom", estimated_minutes: 120, category: "home" },
  ];
  someday.forEach((draft, i) => {
    tasks.push({
      ...taskFromDraft(draft),
      status: "someday",
      created_at: new Date(Date.now() - (i + 10) * 86_400_000).toISOString(),
    });
  });

  return tasks;
}

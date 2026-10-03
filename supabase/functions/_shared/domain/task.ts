// PaceTasks task model shared by the app and Edge Functions. Must stay in sync
// with the tasks table and its check constraints in supabase/migrations.

export const TASK_TIMINGS = ["before_work", "after_work", "anytime"] as const;
export const TASK_STATUSES = ["pending", "someday", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export const ENERGY_LEVELS = ["low", "medium", "high"] as const;
export const DUE_KINDS = ["on", "by"] as const;
export const TASK_SOURCES = ["app", "brain_dump", "siri", "shortcut"] as const;

export type TaskTiming = (typeof TASK_TIMINGS)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number]; // "someday" = parked, hidden from daily lists
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];
export type DueKind = (typeof DUE_KINDS)[number]; // "on" = that day, "by" = deadline
export type TaskSource = (typeof TASK_SOURCES)[number];

// Same limits the database enforces, so callers can validate before a round trip.
export const TASK_LIMITS = {
  titleMaxLength: 200,
  notesMaxLength: 2000,
  minEstimatedMinutes: 1,
  maxEstimatedMinutes: 480,
  maxTags: 20,
  defaultEstimatedMinutes: 5,
} as const;

export interface Task {
  id: string;
  user_id: string;
  title: string;
  estimated_minutes: number;
  actual_minutes: number | null;
  timing: TaskTiming;
  category: string | null; // Category id from src/lib/categories.ts, or null for "No category"
  scheduled_time: string | null; // "HH:MM", 24h — a fixed start time enables Focus/Pomodoro mode
  status: TaskStatus;
  created_at: string;
  completed_at: string | null;
  due_date: string | null; // "YYYY-MM-DD" in the user's local calendar; null = no date
  due_kind: DueKind | null;
  notes: string | null;
  priority: TaskPriority | null;
  energy_level: EnergyLevel | null;
  flexible: boolean; // "maybe" tasks that planning may freely move or skip
  tags: string[];
  source: TaskSource;
  source_language: string | null; // BCP-47 language the task was written in, e.g. "it"
  ai_confidence: number | null; // 0–1, only set for AI-interpreted tasks
  postponed_count: number; // times the due date moved later; kept by a database trigger, never written by callers
}

// Input for public.create_task — the one creation path for app, Brain Dump and Siri.
// Omitted fields get database defaults; user_id always comes from the session.
export interface TaskDraft {
  title: string;
  estimated_minutes?: number;
  timing?: TaskTiming;
  category?: string | null;
  scheduled_time?: string | null;
  due_date?: string | null;
  due_kind?: DueKind | null;
  notes?: string | null;
  priority?: TaskPriority | null;
  energy_level?: EnergyLevel | null;
  flexible?: boolean;
  tags?: string[];
  source?: TaskSource;
  source_language?: string | null;
  ai_confidence?: number | null;
}

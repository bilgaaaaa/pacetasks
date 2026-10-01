// Shared types kept in one place so every screen uses the exact same shape.
// Task types live in the shared domain so Edge Functions use the same model.

export type {
  DueKind,
  EnergyLevel,
  Task,
  TaskDraft,
  TaskPriority,
  TaskSource,
  TaskStatus,
  TaskTiming,
} from "@domain/task";

export type { TaskChange, TaskPatch } from "@domain/taskPatch";

export interface UserSettings {
  user_id: string;
  work_start_hour: number;
  work_end_hour: number;
  reminder_enabled: boolean;
  reminder_time: string; // "HH:MM", 24h
  timer_chime_enabled: boolean; // haptic "chime" when a Focus session or range-timer ends
  haptics_enabled: boolean; // haptic tap when a task is completed
  pomodoro_work_minutes: number; // Focus session length
  pomodoro_break_minutes: number; // break length between Focus sessions
  brain_dump_auto_create: boolean; // create high-confidence Brain Dump tasks without review
  updated_at: string;
}

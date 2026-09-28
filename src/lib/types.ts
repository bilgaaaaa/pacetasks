// Shared types kept in one place so every screen uses the exact same shape.

export type TaskTiming = "before_work" | "after_work" | "anytime";
export type TaskStatus = "pending" | "done";

export interface Task {
  id: string;
  user_id: string;
  title: string;
  estimated_minutes: number;
  actual_minutes: number | null;
  timing: TaskTiming;
  category: string | null; // Category id from lib/categories.ts, or null for "No category"
  scheduled_time: string | null; // "HH:MM", 24h — a fixed start time enables Focus/Pomodoro mode for this task
  status: TaskStatus;
  created_at: string;
  completed_at: string | null;
}

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
  updated_at: string;
}

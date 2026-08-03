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
  updated_at: string;
}

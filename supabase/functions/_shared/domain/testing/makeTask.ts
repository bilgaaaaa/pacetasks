import type { Task } from "../task.ts";

// Builds a complete Task for tests; each test overrides only the fields it is about.
export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    user_id: "user-1",
    title: "Buy dog food",
    estimated_minutes: 5,
    actual_minutes: null,
    timing: "anytime",
    category: null,
    scheduled_time: null,
    status: "pending",
    created_at: "2026-09-28T08:00:00.000Z",
    completed_at: null,
    due_date: null,
    due_kind: null,
    notes: null,
    priority: null,
    energy_level: null,
    flexible: false,
    tags: [],
    source: "app",
    source_language: null,
    ai_confidence: null,
    ...overrides,
  };
}

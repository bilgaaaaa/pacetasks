import type { Task, TaskDraft } from "../../domain/task.ts";
import type { BrainDumpRepository, BrainDumpUserContext, NewBrainDumpSession } from "../brainDump/brainDumpRepository.ts";

// In-memory BrainDumpRepository for service/handler tests; mirrors the RPC
// behaviour the migrations implement (quota counting, commit → tasks).
export class InMemoryBrainDumpRepository implements BrainDumpRepository {
  usageCount = 0;
  sessions: Array<NewBrainDumpSession & { id: string; committedTaskIds: string[] }> = [];
  createdTasks: Task[] = [];

  constructor(
    private readonly userId: string | null,
    private readonly context: BrainDumpUserContext
  ) {}

  getUserId() {
    return Promise.resolve(this.userId);
  }

  incrementUsage() {
    this.usageCount += 1;
    return Promise.resolve(this.usageCount);
  }

  loadUserContext() {
    return Promise.resolve(this.context);
  }

  createSession(session: NewBrainDumpSession) {
    const id = `session-${this.sessions.length + 1}`;
    this.sessions.push({ ...session, id, committedTaskIds: [] });
    return Promise.resolve(id);
  }

  commitSession(sessionId: string, drafts: TaskDraft[]) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) return Promise.reject(new Error("session not found"));
    const tasks = drafts.map((draft, i) => this.toTask(draft, `${sessionId}-task-${i + 1}`));
    session.committedTaskIds = tasks.map((t) => t.id);
    this.createdTasks.push(...tasks);
    return Promise.resolve(tasks);
  }

  private toTask(draft: TaskDraft, id: string): Task {
    return {
      id,
      user_id: this.userId ?? "",
      title: draft.title,
      estimated_minutes: draft.estimated_minutes ?? 5,
      actual_minutes: null,
      timing: draft.timing ?? "anytime",
      category: draft.category ?? null,
      scheduled_time: draft.scheduled_time ?? null,
      status: "pending",
      created_at: "2026-09-28T20:00:00.000Z",
      completed_at: null,
      due_date: draft.due_date ?? null,
      due_kind: draft.due_kind ?? null,
      notes: draft.notes ?? null,
      priority: draft.priority ?? null,
      energy_level: draft.energy_level ?? null,
      flexible: draft.flexible ?? false,
      tags: draft.tags ?? [],
      source: draft.source ?? "app",
      source_language: draft.source_language ?? null,
      ai_confidence: draft.ai_confidence ?? null,
    };
  }
}

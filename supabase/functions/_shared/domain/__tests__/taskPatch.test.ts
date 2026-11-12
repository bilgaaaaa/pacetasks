import type { Task } from "../task";
import { editPatch, TaskEdit } from "../taskPatch";

const TASK: Task = {
  id: "t1",
  user_id: "u1",
  title: "Owner",
  estimated_minutes: 5,
  actual_minutes: null,
  timing: "after_work",
  category: null,
  scheduled_time: "10:00",
  reminder_minutes_before: 10,
  status: "pending",
  created_at: "2026-11-12T08:00:00Z",
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
  postponed_count: 0,
};

const UNCHANGED: TaskEdit = {
  title: TASK.title,
  estimated_minutes: TASK.estimated_minutes,
  timing: TASK.timing,
  category: TASK.category,
  energy_level: TASK.energy_level,
  scheduled_time: TASK.scheduled_time,
  reminder_minutes_before: TASK.reminder_minutes_before,
  due_date: TASK.due_date,
  due_kind: TASK.due_kind,
  notes: TASK.notes,
};

describe("editPatch", () => {
  it("is empty when nothing changed", () => {
    expect(editPatch(TASK, UNCHANGED)).toEqual({});
    expect(editPatch(TASK, { ...UNCHANGED, notes: "   " })).toEqual({});
  });

  it("holds only the fields that changed", () => {
    expect(editPatch(TASK, { ...UNCHANGED, scheduled_time: "18:30", estimated_minutes: 7, notes: " Call first " })).toEqual({
      scheduled_time: "18:30",
      estimated_minutes: 7,
      notes: "Call first",
    });
  });

  it("drops the reminder together with the start time", () => {
    expect(editPatch(TASK, { ...UNCHANGED, scheduled_time: null })).toEqual({
      scheduled_time: null,
      reminder_minutes_before: null,
    });
  });

  it("gives a new day a kind and clears the kind with the day", () => {
    expect(editPatch(TASK, { ...UNCHANGED, due_date: "2026-11-13" })).toEqual({ due_date: "2026-11-13", due_kind: "on" });
    const dated: Task = { ...TASK, due_date: "2026-11-13", due_kind: "by" };
    expect(editPatch(dated, { ...UNCHANGED, due_date: null, due_kind: "by" })).toEqual({ due_date: null, due_kind: null });
  });
});

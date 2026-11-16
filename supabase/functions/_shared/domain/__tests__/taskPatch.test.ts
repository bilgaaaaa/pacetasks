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
  window_start: null,
  window_end: null,
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
  repeat_rule: null,
  repeat_anchor: null,
  repeat_source_id: null,
};

const UNCHANGED: TaskEdit = {
  title: TASK.title,
  estimated_minutes: TASK.estimated_minutes,
  timing: TASK.timing,
  category: TASK.category,
  energy_level: TASK.energy_level,
  scheduled_time: TASK.scheduled_time,
  window_start: TASK.window_start,
  window_end: TASK.window_end,
  reminder_minutes_before: TASK.reminder_minutes_before,
  due_date: TASK.due_date,
  due_kind: TASK.due_kind,
  notes: TASK.notes,
  repeat_rule: TASK.repeat_rule,
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

  it("keeps the reminder when the start time becomes the start of a window", () => {
    expect(editPatch(TASK, { ...UNCHANGED, scheduled_time: null, window_start: "20:00" })).toEqual({
      scheduled_time: null,
      window_start: "20:00",
    });
    expect(editPatch(TASK, { ...UNCHANGED, scheduled_time: null, window_end: "18:00" })).toEqual({
      scheduled_time: null,
      window_end: "18:00",
      reminder_minutes_before: null,
    });
  });

  it("gives a new day a kind and clears the kind with the day", () => {
    expect(editPatch(TASK, { ...UNCHANGED, due_date: "2026-11-13" })).toEqual({ due_date: "2026-11-13", due_kind: "on" });
    const dated: Task = { ...TASK, due_date: "2026-11-13", due_kind: "by" };
    expect(editPatch(dated, { ...UNCHANGED, due_date: null, due_kind: "by" })).toEqual({ due_date: null, due_kind: null });
  });
});

describe("editPatch and repeats", () => {
  const dated = { ...UNCHANGED, due_date: "2026-11-16", due_kind: "on" as const };

  it("anchors a new repeat on the task's day", () => {
    expect(editPatch({ ...TASK, due_date: "2026-11-16", due_kind: "on" }, { ...dated, repeat_rule: "weekly" })).toEqual({
      repeat_rule: "weekly",
      repeat_anchor: "2026-11-16",
    });
  });

  it("moves the anchor when the day is changed in the sheet, so it repeats on the new weekday", () => {
    const weekly: Task = { ...TASK, due_date: "2026-11-16", due_kind: "on", repeat_rule: "weekly", repeat_anchor: "2026-11-16" };
    expect(editPatch(weekly, { ...dated, repeat_rule: "weekly", due_date: "2026-11-17" })).toEqual({
      due_date: "2026-11-17",
      repeat_anchor: "2026-11-17",
    });
  });

  it("clears the anchor when the repeat is turned off", () => {
    const daily: Task = { ...TASK, due_date: "2026-11-16", due_kind: "on", repeat_rule: "daily", repeat_anchor: "2026-11-16" };
    expect(editPatch(daily, { ...dated, repeat_rule: null })).toEqual({ repeat_rule: null, repeat_anchor: null });
  });
});

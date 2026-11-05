import { makeTask } from "@domain/testing/makeTask";
import { completionsToApply, parseWidgetCompletions, WIDGET_TASK_LIMIT, widgetPaceTasks } from "../deskfocusWidget";

const TODAY = "2026-11-05";

describe("widgetPaceTasks", () => {
  it("sends today's open tasks in the Today list's order, with only the fields the widget reads", () => {
    const tasks = [
      makeTask({ id: "after", title: "Gym", timing: "after_work", estimated_minutes: 45 }),
      makeTask({ id: "before", title: "Walk Bruno", timing: "before_work", scheduled_time: "07:30" }),
      makeTask({ id: "anytime", title: "Call the bank", timing: "anytime", due_date: TODAY, due_kind: "on" }),
    ];
    expect(widgetPaceTasks(tasks, TODAY)).toEqual([
      { id: "before", title: "Walk Bruno", estimatedMinutes: 5, scheduledTime: "07:30", dueDate: null, dueKind: null },
      { id: "anytime", title: "Call the bank", estimatedMinutes: 5, scheduledTime: null, dueDate: TODAY, dueKind: "on" },
      { id: "after", title: "Gym", estimatedMinutes: 45, scheduledTime: null, dueDate: null, dueKind: null },
    ]);
  });

  it("adds tomorrow's tasks after today's, with their date, so the widget is right after midnight", () => {
    const tasks = [
      makeTask({ id: "tomorrow", timing: "before_work", due_date: "2026-11-06", due_kind: "on" }),
      makeTask({ id: "today", timing: "after_work" }),
    ];
    expect(widgetPaceTasks(tasks, TODAY).map((task) => [task.id, task.dueDate])).toEqual([
      ["today", null],
      ["tomorrow", "2026-11-06"],
    ]);
  });

  it("leaves out done, parked and later tasks", () => {
    const tasks = [
      makeTask({ id: "done", status: "done" }),
      makeTask({ id: "someday", status: "someday" }),
      makeTask({ id: "later", due_date: "2026-11-09", due_kind: "on" }),
      makeTask({ id: "open" }),
    ];
    expect(widgetPaceTasks(tasks, TODAY).map((task) => task.id)).toEqual(["open"]);
  });

  it("keeps the list short", () => {
    const tasks = Array.from({ length: WIDGET_TASK_LIMIT + 5 }, (_, i) => makeTask({ id: `task-${i}` }));
    expect(widgetPaceTasks(tasks, TODAY)).toHaveLength(WIDGET_TASK_LIMIT);
  });
});

describe("parseWidgetCompletions", () => {
  it("reads the widget's JSON list of ids", () => {
    expect(parseWidgetCompletions('["a","b"]')).toEqual(["a", "b"]);
  });

  it("treats missing or unreadable values as none", () => {
    expect(parseWidgetCompletions(null)).toEqual([]);
    expect(parseWidgetCompletions("")).toEqual([]);
    expect(parseWidgetCompletions("not json")).toEqual([]);
    expect(parseWidgetCompletions('{"a":1}')).toEqual([]);
    expect(parseWidgetCompletions('["a",2,null]')).toEqual(["a"]);
  });
});

describe("completionsToApply", () => {
  it("completes only tasks still open in PaceTasks, once each", () => {
    const tasks = [
      makeTask({ id: "open" }),
      makeTask({ id: "done", status: "done" }),
      makeTask({ id: "parked", status: "someday" }),
    ];
    expect(completionsToApply(["open", "open", "done", "parked", "deleted"], tasks)).toEqual(["open"]);
  });
});

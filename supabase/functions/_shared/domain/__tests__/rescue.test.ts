import { buildPaceModel } from "../pace";
import { RESCUE_POLICY, planRescue } from "../rescue";
import type { RescueContext } from "../rescue";
import { makeTask } from "../testing/makeTask";
import type { Task } from "../task";

const TODAY = "2026-11-16";

function makeContext(overrides: Partial<RescueContext> = {}): RescueContext {
  return { todayKey: TODAY, timeOfDay: "20:00", energy: "medium", currentTiming: "after_work", ...overrides };
}

function destinations(tasks: Task[], context: RescueContext): Record<string, string> {
  return Object.fromEntries(planRescue(tasks, context).proposals.map((p) => [p.task.id, p.destination]));
}

describe("planRescue", () => {
  it("does nothing when today's tasks fit the time left", () => {
    const plan = planRescue([makeTask({ id: "a", estimated_minutes: 30, due_date: TODAY })], makeContext());
    expect(plan.minutesLeft).toBe(120);
    expect(plan.behind).toBe(false);
    expect(plan.proposals.map((p) => p.destination)).toEqual(["today"]);
  });

  it("keeps what fits in ranking order and moves the rest to tomorrow", () => {
    const tasks = [
      makeTask({ id: "short", estimated_minutes: 30, due_date: TODAY }),
      makeTask({ id: "long", estimated_minutes: 120, due_date: TODAY }),
      makeTask({ id: "mid", estimated_minutes: 60, due_date: TODAY }),
    ];
    const plan = planRescue(tasks, makeContext());
    expect(plan.behind).toBe(true);
    expect(plan.minutesPlanned).toBe(210);
    expect(destinations(tasks, makeContext())).toEqual({ short: "today", mid: "today", long: "tomorrow" });
    expect(plan.proposals[0]).toMatchObject({ destination: "tomorrow", reason: "today_full" });
  });

  it("stays quiet when running over by less than the threshold", () => {
    const tasks = [
      makeTask({ id: "a", estimated_minutes: 110, due_date: TODAY }),
      makeTask({ id: "b", estimated_minutes: RESCUE_POLICY.minShortfallMinutes - 1 + 10, due_date: TODAY }),
    ];
    expect(planRescue(tasks, makeContext()).behind).toBe(false);
  });

  it("moves a fixed-time task whose slot has ended and a task whose window has closed", () => {
    const tasks = [
      makeTask({ id: "call", scheduled_time: "18:00", estimated_minutes: 30, due_date: TODAY }),
      makeTask({ id: "shop", window_end: "19:00", due_date: TODAY }),
      makeTask({ id: "now", scheduled_time: "19:45", estimated_minutes: 30, due_date: TODAY }),
    ];
    const plan = planRescue(tasks, makeContext());
    expect(plan.behind).toBe(true);
    expect(plan.proposals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ destination: "tomorrow", reason: "missed_time" }),
        expect.objectContaining({ destination: "tomorrow", reason: "window_closed" }),
      ])
    );
    // A slot still running only counts the minutes it has left.
    expect(plan.minutesPlanned).toBe(15);
    expect(destinations(tasks, makeContext()).now).toBe("today");
  });

  it("always keeps high-priority tasks and deadlines due today, even past the time left", () => {
    const tasks = [
      makeTask({ id: "urgent", priority: "high", estimated_minutes: 100, due_date: TODAY }),
      makeTask({ id: "deadline", due_kind: "by", estimated_minutes: 60, due_date: TODAY }),
      makeTask({ id: "normal", estimated_minutes: 20, due_date: TODAY }),
    ];
    const plan = planRescue(tasks, makeContext());
    expect(destinations(tasks, makeContext())).toEqual({ urgent: "today", deadline: "today", normal: "tomorrow" });
    expect(plan.proposals.find((p) => p.task.id === "deadline")?.reason).toBe("deadline_today");
  });

  it("sends maybes to the weekend and often-postponed tasks to someday, like the rollover", () => {
    const tasks = [
      makeTask({ id: "fill", priority: "high", estimated_minutes: 120, due_date: TODAY }),
      makeTask({ id: "maybe", flexible: true, estimated_minutes: 30, due_date: TODAY }),
      makeTask({ id: "stuck", postponed_count: 3, estimated_minutes: 30, due_date: TODAY }),
    ];
    expect(destinations(tasks, makeContext())).toMatchObject({ maybe: "weekend", stuck: "someday" });
  });

  it("leaves alone a task with a later deadline that doesn't fit, and earlier days to the rollover", () => {
    const tasks = [
      makeTask({ id: "fill", estimated_minutes: 120, due_date: TODAY }),
      makeTask({ id: "later", due_kind: "by", due_date: "2026-11-20", estimated_minutes: 60 }),
      makeTask({ id: "yesterday", due_date: "2026-11-15", estimated_minutes: 60 }),
    ];
    const plan = planRescue(tasks, makeContext());
    expect(plan.proposals.map((p) => p.task.id)).toEqual(["fill"]);
    expect(plan.behind).toBe(false);
  });

  it("counts tasks at the learned pace", () => {
    const runs = [1, 2].map((day) =>
      makeTask({
        id: `run-${day}`,
        title: "Email",
        estimated_minutes: 20,
        actual_minutes: 90,
        status: "done",
        created_at: `2026-11-0${day}T10:00:00.000Z`,
        completed_at: `2026-11-0${day}T10:00:00.000Z`,
      })
    );
    const email = makeTask({ id: "email", title: "Email", estimated_minutes: 20, due_date: TODAY });
    const other = makeTask({ id: "other", estimated_minutes: 60, due_date: TODAY });
    const context = makeContext({ paceModel: buildPaceModel([...runs, email, other]) });
    const plan = planRescue([...runs, email, other], context);
    expect(plan.minutesPlanned).toBe(150);
    expect(plan.behind).toBe(true);
  });

  it("has no time left after the end of the day", () => {
    const plan = planRescue([makeTask({ id: "a", estimated_minutes: 30, due_date: TODAY })], makeContext({ timeOfDay: "23:10" }));
    expect(plan.minutesLeft).toBe(0);
    expect(plan.behind).toBe(true);
    expect(plan.proposals[0].destination).toBe("tomorrow");
  });
});

import { rankTasks, taskMinutes } from "./doNow.ts";
import type { DoNowRankContext } from "./doNow.ts";
import { isUnfinished } from "./rollover.ts";
import type { RolloverDestination, RolloverReason } from "./rollover.ts";
import type { Task } from "./task.ts";
import { isPendingToday } from "./todayTasks.ts";

// "Rescue my day": when what is left on Today no longer fits the time left, propose
// which tasks to keep and which to move, using the same order as Fit my time and
// the user's learned pace. Nothing moves until the user applies it. Deterministic, no AI.
// Days before today belong to the rollover; this only looks at today.

export const RESCUE_POLICY = {
  dayEndTime: "22:00", // the plan for today ends here; after it, everything left can wait for tomorrow
  minShortfallMinutes: 15, // running over by less than this isn't worth interrupting the user
  somedayAfterPostponements: 3, // same rule as the rollover
} as const;

// Why a destination was proposed, so the UI can say it in a few words.
export type RescueReason = RolloverReason | "missed_time" | "window_closed" | "deadline_today";

export interface RescueProposal {
  task: Task;
  destination: RolloverDestination; // "today" keeps the task where it is
  reason: RescueReason;
}

export interface RescuePlan {
  proposals: RescueProposal[]; // tasks to move first, then the ones kept, each in ranking order
  minutesLeft: number; // from now to RESCUE_POLICY.dayEndTime
  minutesPlanned: number; // what today's tasks need at the user's pace, before any move
  behind: boolean; // true when the card should offer a rescue
}

export interface RescueContext extends DoNowRankContext {
  timeOfDay: string; // "HH:MM" now; required here, since the rescue is about the rest of today
}

function minutesOfDay(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

// A deadline later than today keeps the task on Today's list whatever is moved,
// so it is only planned when it fits; otherwise it is left alone.
function hasLaterDeadline(task: Task, todayKey: string): boolean {
  return task.due_kind === "by" && task.due_date !== null && task.due_date > todayKey;
}

// Today's own tasks: pending today, not carried over from an earlier day.
function todaysTasks(tasks: Task[], todayKey: string): Task[] {
  return tasks.filter((task) => isPendingToday(task, todayKey) && !isUnfinished(task, todayKey));
}

// Where a task goes when it doesn't fit today; the rollover's rules, minus a deadline today.
function moveDestination(task: Task): Pick<RescueProposal, "destination" | "reason"> {
  if (task.postponed_count >= RESCUE_POLICY.somedayAfterPostponements) {
    return { destination: "someday", reason: "postponed_often" };
  }
  if (task.flexible) return { destination: "weekend", reason: "maybe" };
  return { destination: "tomorrow", reason: "today_full" };
}

// Fixed-time tasks keep their slot unless it has already ended; closed windows
// go to tomorrow. Deadlines due today and high-priority tasks always stay; the
// rest fill the time left in ranking order.
export function planRescue(tasks: Task[], context: RescueContext): RescuePlan {
  const now = minutesOfDay(context.timeOfDay);
  const minutesLeft = Math.max(0, minutesOfDay(RESCUE_POLICY.dayEndTime) - now);
  const moves: RescueProposal[] = [];
  const kept: RescueProposal[] = [];
  let budget = minutesLeft;
  let minutesPlanned = 0;

  const open: Task[] = [];
  for (const task of todaysTasks(tasks, context.todayKey)) {
    const minutes = taskMinutes(task, context);
    if (task.scheduled_time !== null) {
      const start = minutesOfDay(task.scheduled_time);
      const remaining = start + minutes - Math.max(now, start);
      if (remaining <= 0) {
        moves.push({ task, destination: "tomorrow", reason: "missed_time" });
      } else {
        kept.push({ task, destination: "today", reason: "fits_today" });
        budget -= remaining;
        minutesPlanned += remaining;
      }
    } else if (task.window_end !== null && minutesOfDay(task.window_end) <= now) {
      moves.push({ task, destination: "tomorrow", reason: "window_closed" });
    } else {
      open.push(task);
    }
  }

  const ranked = rankTasks(open, context, "shortest_first");
  const mustStay = (task: Task) =>
    (task.due_kind === "by" && task.due_date !== null && task.due_date <= context.todayKey) || task.priority === "high";

  for (const task of ranked.filter(mustStay)) {
    const minutes = taskMinutes(task, context);
    kept.push({ task, destination: "today", reason: task.priority === "high" ? "high_priority" : "deadline_today" });
    budget -= minutes;
    minutesPlanned += minutes;
  }

  for (const task of ranked.filter((task) => !mustStay(task))) {
    const minutes = taskMinutes(task, context);
    const laterDeadline = hasLaterDeadline(task, context.todayKey);
    if (!laterDeadline) minutesPlanned += minutes;
    if (minutes <= budget) {
      kept.push({ task, destination: "today", reason: "fits_today" });
      budget -= minutes;
      if (laterDeadline) minutesPlanned += minutes;
    } else if (!laterDeadline) {
      moves.push({ task, ...moveDestination(task) });
    }
  }

  const missedSomething = moves.some((move) => move.reason === "missed_time" || move.reason === "window_closed");
  const shortfall = minutesPlanned - minutesLeft;
  const behind = moves.length > 0 && (missedSomething || shortfall >= RESCUE_POLICY.minShortfallMinutes);

  return { proposals: [...moves, ...kept], minutesLeft, minutesPlanned, behind };
}

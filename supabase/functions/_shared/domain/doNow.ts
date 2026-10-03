import { ENERGY_LEVELS } from "./task.ts";
import type { EnergyLevel, Task, TaskPriority, TaskTiming } from "./task.ts";
import { isPendingToday } from "./todayTasks.ts";

// "What can I do now?" and One Thing mode: given the time and energy the user
// has right now, picks the tasks worth doing. Pure and shared, so both screens
// and Siri's answer always rank tasks the same way.

export const DO_NOW_MINUTE_OPTIONS = [5, 15, 30, 60] as const;
export const DO_NOW_DEFAULT_MINUTES = 15;
export const DO_NOW_DEFAULT_ENERGY: EnergyLevel = "medium";

// What ranking needs to know about "now".
export interface DoNowRankContext {
  todayKey: string; // the phone's local day, "YYYY-MM-DD"
  energy: EnergyLevel; // the energy the user has right now
  currentTiming: TaskTiming; // where "now" falls in the user's day, from timingForHour
}

export interface DoNowContext extends DoNowRankContext {
  availableMinutes: number;
}

export interface DoNowSelection {
  plan: Task[]; // best tasks that fit back to back in the available time, in order
  planMinutes: number;
  alternatives: Task[]; // also fit on their own, but not alongside the plan
}

// Tasks without a priority rank with "medium": unknown is neither urgent nor ignorable.
const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
const DEFAULT_PRIORITY_RANK = PRIORITY_RANK.medium;
// For ranking only, a task with unknown energy is assumed to need a normal amount.
const ASSUMED_TASK_ENERGY: EnergyLevel = "medium";

function energyRank(level: EnergyLevel): number {
  return ENERGY_LEVELS.indexOf(level);
}

// A task can be started at any moment when it is on today's list and has no
// fixed start time (those belong to their slot and Focus mode).
export function isDoableToday(task: Task, todayKey: string): boolean {
  return isPendingToday(task, todayKey) && task.scheduled_time === null;
}

// A task fits right now when it is doable today, fits the time, and doesn't need
// more energy than the user has. Tasks with unknown energy are never hidden.
export function fitsNow(task: Task, context: DoNowContext): boolean {
  return (
    isDoableToday(task, context.todayKey) &&
    task.estimated_minutes <= context.availableMinutes &&
    (task.energy_level === null || energyRank(task.energy_level) <= energyRank(context.energy))
  );
}

type RankKey = number | string;

// Sort keys, most important first; lower sorts earlier. Overdue and due-today
// tasks lead (oldest date first), then priority, then tasks that suit this part
// of the day, firm tasks before "maybe" ones, the best use of the user's energy,
// and finally longer tasks so the available time is well used.
function rankKeys(task: Task, context: DoNowRankContext): RankKey[] {
  const energyGap = Math.abs(energyRank(context.energy) - energyRank(task.energy_level ?? ASSUMED_TASK_ENERGY));
  const suitsNow = task.timing === "anytime" || task.timing === context.currentTiming;
  return [
    task.due_date === null ? 1 : 0,
    task.due_date ?? "",
    task.priority === null ? DEFAULT_PRIORITY_RANK : PRIORITY_RANK[task.priority],
    suitsNow ? 0 : 1,
    task.flexible ? 1 : 0,
    energyGap,
    -task.estimated_minutes,
    task.created_at,
    task.id,
  ];
}

// Keys at the same position always share a type: numbers compare by value, text by code unit.
function compareKeys(a: RankKey[], b: RankKey[]): number {
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (typeof left === "number" && typeof right === "number") {
      if (left !== right) return left - right;
    } else if (left !== right) {
      return String(left) < String(right) ? -1 : 1;
    }
  }
  return 0;
}

// Orders tasks from "do this first" to "do this last" for the current moment.
function rankTasks(tasks: Task[], context: DoNowRankContext): Task[] {
  return tasks
    .map((task) => ({ task, keys: rankKeys(task, context) }))
    .sort((a, b) => compareKeys(a.keys, b.keys))
    .map(({ task }) => task);
}

// Ranks every task that fits, then fills the available time in that order: `plan`
// is what to do back to back, `alternatives` are the other tasks that would fit.
export function selectDoNowTasks(tasks: Task[], context: DoNowContext): DoNowSelection {
  const ranked = rankTasks(
    tasks.filter((task) => fitsNow(task, context)),
    context
  );

  const plan: Task[] = [];
  const alternatives: Task[] = [];
  let planMinutes = 0;
  for (const task of ranked) {
    if (planMinutes + task.estimated_minutes <= context.availableMinutes) {
      plan.push(task);
      planMinutes += task.estimated_minutes;
    } else {
      alternatives.push(task);
    }
  }

  return { plan, planMinutes, alternatives };
}

// One Thing mode: every task that could be started today, best first, minus the
// ones the user said "not now" to. Time and energy never hide a task here, since
// the point is a single answer; energy only shapes the order.
export function selectOneThingQueue(
  tasks: Task[],
  context: DoNowRankContext,
  skippedTaskIds: ReadonlySet<string>
): Task[] {
  return rankTasks(
    tasks.filter((task) => isDoableToday(task, context.todayKey) && !skippedTaskIds.has(task.id)),
    context
  );
}

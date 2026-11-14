import { DO_NOW_DEFAULT_ENERGY, selectOneThingQueue } from "../doNow.ts";
import type { Task, TaskTiming } from "../task.ts";
import { selectTodayTasks } from "../todayTasks.ts";
import { allClearSpeech, nextAtSpeech, nextNowSpeech, todaySpeech } from "./siriSpeech.ts";
import type { SiriLanguage } from "./siriSpeech.ts";

// Siri's answers to "What should I do next?" and "What's on today?". Built only
// from the shared Today and One Thing rules, so Siri always agrees with the app.

// How many tasks "What's on today?" names before it stops.
export const TODAY_TITLES_SPOKEN = 3;

export interface SiriMoment {
  todayKey: string; // the phone's local day
  timeOfDay: string; // the phone's local "HH:MM"
  currentTiming: TaskTiming; // before work, during, or after, from the user's work hours
  language: SiriLanguage;
}

export interface SiriAnswer {
  speech: string;
  taskIds: string[]; // the tasks the answer is about, best first; lets the app highlight them later
}

// The task Decide for me would pick right now; when only fixed-time tasks are
// left, the next one by start time (or the earliest, once all have passed).
export function answerNext(tasks: Task[], moment: SiriMoment): SiriAnswer {
  const [next] = selectOneThingQueue(
    tasks,
    { todayKey: moment.todayKey, energy: DO_NOW_DEFAULT_ENERGY, currentTiming: moment.currentTiming },
    new Set()
  );
  if (next) return { speech: nextNowSpeech(moment.language, next.title, next.estimated_minutes), taskIds: [next.id] };

  const timed = selectTodayTasks(tasks, moment.todayKey)
    .pending.filter((task) => task.scheduled_time !== null)
    .sort((a, b) => (a.scheduled_time as string).localeCompare(b.scheduled_time as string));
  const upcoming = timed.find((task) => (task.scheduled_time as string) >= moment.timeOfDay) ?? timed[0];
  if (upcoming) {
    return { speech: nextAtSpeech(moment.language, upcoming.title, upcoming.scheduled_time as string), taskIds: [upcoming.id] };
  }
  return { speech: allClearSpeech(moment.language), taskIds: [] };
}

// What is left on Today, in the list's own order, with the total time it needs.
export function answerToday(tasks: Task[], moment: SiriMoment): SiriAnswer {
  const { pending } = selectTodayTasks(tasks, moment.todayKey);
  const totalMinutes = pending.reduce((sum, task) => sum + task.estimated_minutes, 0);
  const named = pending.slice(0, TODAY_TITLES_SPOKEN);
  return {
    speech: todaySpeech(moment.language, pending.length, totalMinutes, named.map((task) => task.title)),
    taskIds: pending.map((task) => task.id),
  };
}

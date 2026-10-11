import { isQuickWin } from "./taskSections";
import { Task } from "./types";

// The encouraging headline and line in the Today hero card. Picked from the
// real state of the day so it never promises something that isn't there.

// What "Decide for me" would open with, so the hero and One Thing mode tell the same story.
export type HeroStart = "overdue" | "quick_win" | "other";

export interface HeroState {
  count: number; // pending tasks left today
  quickWinCount: number;
  quickWinMinutes: number;
  streakDays: number; // consecutive days with a task done, ending today or yesterday
  doneToday: boolean; // at least one task finished today
  allDone: boolean;
  start: HeroStart;
}

export interface HeroMessage {
  title: string;
  body: string;
}

// Classifies One Thing mode's first pick (null when nothing can be started right now).
export function heroStart(
  firstPick: Pick<Task, "due_date" | "estimated_minutes" | "scheduled_time"> | null,
  todayKey: string,
  quickWinMinutes: number
): HeroStart {
  if (!firstPick) return "other";
  if (firstPick.due_date !== null && firstPick.due_date < todayKey) return "overdue";
  return isQuickWin(firstPick, quickWinMinutes) ? "quick_win" : "other";
}

// A streak leads only while today could still break it; after that the line follows the first pick.
export function heroMessage({
  count,
  quickWinCount,
  quickWinMinutes,
  streakDays,
  doneToday,
  allDone,
  start,
}: HeroState): HeroMessage {
  if (count === 0) {
    return allDone
      ? { title: "You did it.", body: "Everything's done. Enjoy the rest of your day." }
      : { title: "A clean slate.", body: "Add whatever's on your mind and take it from there." };
  }
  if (streakDays >= 2 && !doneToday) {
    return {
      title: `${streakDays} days in a row.`,
      body: "One task today keeps your streak alive.",
    };
  }
  switch (start) {
    case "overdue":
      return {
        title: "Pick up where you left off.",
        body: "Something has been waiting a little while. It's a good place to start.",
      };
    case "quick_win": {
      const tasks = quickWinCount === 1 ? "1 task takes" : `${quickWinCount} tasks take`;
      return {
        title: "Start small, win big.",
        body: `${tasks} ${quickWinMinutes} minutes or less. One is a great start.`,
      };
    }
    case "other":
      return { title: "One step at a time.", body: "Pick one task and give it your full attention." };
  }
}

// The encouraging headline and line in the Today hero card. Picked from the
// real state of the day so it never promises something that isn't there.

export interface HeroState {
  count: number; // pending tasks left today
  quickWinCount: number;
  quickWinMinutes: number;
  streakDays: number; // consecutive days with a task done, today included
  allDone: boolean;
}

export interface HeroMessage {
  title: string;
  body: string;
}

export function heroMessage({ count, quickWinCount, quickWinMinutes, streakDays, allDone }: HeroState): HeroMessage {
  if (count === 0) {
    return allDone
      ? { title: "You did it.", body: "Everything's done. Enjoy the rest of your day." }
      : { title: "A clean slate.", body: "Add whatever's on your mind and take it from there." };
  }
  if (streakDays >= 2) {
    return {
      title: `${streakDays} days in a row.`,
      body: "One task today keeps your streak alive.",
    };
  }
  if (quickWinCount > 0) {
    const tasks = quickWinCount === 1 ? "1 task takes" : `${quickWinCount} tasks take`;
    return {
      title: "Start small, win big.",
      body: `${tasks} ${quickWinMinutes} minutes or less. One is a great start.`,
    };
  }
  return { title: "One step at a time.", body: "Pick one task and give it your full attention." };
}

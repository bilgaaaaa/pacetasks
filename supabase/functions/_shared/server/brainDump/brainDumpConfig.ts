// Brain Dump settings read from secrets, shared by every function that runs it (brain-dump, siri).
export const DEFAULT_BRAIN_DUMP_DAILY_LIMIT = 30;

// BRAIN_DUMP_DAILY_LIMIT per user per day; a missing or invalid value falls back to the default.
export function readBrainDumpDailyLimit(env: (name: string) => string | undefined): number {
  const limit = Number(env("BRAIN_DUMP_DAILY_LIMIT") ?? DEFAULT_BRAIN_DUMP_DAILY_LIMIT);
  return Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_BRAIN_DUMP_DAILY_LIMIT;
}

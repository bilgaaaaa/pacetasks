// Times of day are shown in 24-hour form everywhere ("18:30"), matching how
// they are stored (reminder_time, scheduled_time) and how the app's users read them.
export function formatTimeOfDay(hour: number, minute = 0): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// Reads a stored "HH:MM" back into its parts; anything unreadable counts as 0.
export function parseTimeOfDay(time: string): { hour: number; minute: number } {
  const [hour, minute] = time.split(":");
  return { hour: Number(hour) || 0, minute: Number(minute) || 0 };
}

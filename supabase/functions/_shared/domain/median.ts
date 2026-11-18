// Median of whole numbers (minutes, days), rounded; shared by learned pace, task
// history and task rhythms. Callers never pass an empty list.
export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

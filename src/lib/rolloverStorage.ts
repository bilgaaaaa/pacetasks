import AsyncStorage from "@react-native-async-storage/async-storage";

// Remembers, on this phone, the day the user said "not now" to the rollover
// card, so it stays out of the way until tomorrow instead of nagging all day.
const DISMISSED_DAY_KEY = "pacetasks.rollover.dismissedDay";

// Returns the "YYYY-MM-DD" day the card was last dismissed, or null. Storage
// problems are logged and treated as "never dismissed".
export async function loadRolloverDismissedDay(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(DISMISSED_DAY_KEY);
  } catch (e) {
    console.warn("[rolloverStorage] load failed", e);
    return null;
  }
}

export async function saveRolloverDismissedDay(dayKey: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_DAY_KEY, dayKey);
  } catch (e) {
    console.warn("[rolloverStorage] save failed", e);
  }
}

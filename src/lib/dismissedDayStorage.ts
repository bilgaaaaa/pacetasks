import AsyncStorage from "@react-native-async-storage/async-storage";

// Remembers, on this phone, the day the user said "not now" to a Today card, so it
// stays out of the way until tomorrow. Storage problems are logged and read as
// "never dismissed". One store per card, each under its own key.
export function createDismissedDayStore(storageKey: string, logTag: string) {
  return {
    // The "YYYY-MM-DD" day the card was last dismissed, or null.
    async load(): Promise<string | null> {
      try {
        return await AsyncStorage.getItem(storageKey);
      } catch (e) {
        console.warn(`[${logTag}] load failed`, e);
        return null;
      }
    },
    async save(dayKey: string): Promise<void> {
      try {
        await AsyncStorage.setItem(storageKey, dayKey);
      } catch (e) {
        console.warn(`[${logTag}] save failed`, e);
      }
    },
    // Forgets the dismissal, for when this phone's data is deleted and it starts again empty.
    async clear(): Promise<void> {
      try {
        await AsyncStorage.removeItem(storageKey);
      } catch (e) {
        console.warn(`[${logTag}] clear failed`, e);
      }
    },
  };
}

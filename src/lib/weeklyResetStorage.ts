import AsyncStorage from "@react-native-async-storage/async-storage";
import { parseKeptResetTasks } from "@domain/weeklyReset";
import type { KeptResetTasks } from "@domain/weeklyReset";

// Remembers, on this phone, the tasks the user chose to "Keep as is" in Weekly
// Reset and the week they said so, so the same tasks are not offered again until next week.
const KEPT_TASKS_KEY = "pacetasks.weeklyReset.keptTasks";

// Returns what was kept, or null. Storage problems are logged and treated as "nothing kept".
export async function loadKeptResetTasks(): Promise<KeptResetTasks | null> {
  try {
    return parseKeptResetTasks(await AsyncStorage.getItem(KEPT_TASKS_KEY));
  } catch (e) {
    console.warn("[weeklyResetStorage] load failed", e);
    return null;
  }
}

export async function saveKeptResetTasks(kept: KeptResetTasks): Promise<void> {
  try {
    await AsyncStorage.setItem(KEPT_TASKS_KEY, JSON.stringify(kept));
  } catch (e) {
    console.warn("[weeklyResetStorage] save failed", e);
  }
}

// Forgets the kept tasks, for when this phone's data is deleted and it starts again empty.
export async function clearKeptResetTasks(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEPT_TASKS_KEY);
  } catch (e) {
    console.warn("[weeklyResetStorage] clear failed", e);
  }
}

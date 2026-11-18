import AsyncStorage from "@react-native-async-storage/async-storage";
import { UpdateSnooze } from "./appUpdate";

// Remembers, on this phone, the update version the user said "Later" to, so the
// same prompt doesn't come back on every launch.
const SNOOZE_KEY = "pacetasks.appUpdate.snooze";

// Returns the stored snooze, or null. Storage problems or old data are logged and treated as "none".
export async function loadUpdateSnooze(): Promise<UpdateSnooze | null> {
  try {
    const raw = await AsyncStorage.getItem(SNOOZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.version === "string" && typeof parsed?.until === "number" ? parsed : null;
  } catch (e) {
    console.warn("[appUpdateStorage] load failed", e);
    return null;
  }
}

export async function saveUpdateSnooze(snooze: UpdateSnooze): Promise<void> {
  try {
    await AsyncStorage.setItem(SNOOZE_KEY, JSON.stringify(snooze));
  } catch (e) {
    console.warn("[appUpdateStorage] save failed", e);
  }
}

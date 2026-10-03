import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppearancePrefs, DEFAULT_APPEARANCE, parseAppearance } from "./appearance";

// Persists appearance prefs in on-device storage; failures fall back to defaults
// so a storage problem never blocks the app from opening.

const STORAGE_KEY = "pacetasks.appearance.v1";

export async function loadAppearance(): Promise<AppearancePrefs> {
  try {
    return parseAppearance(await AsyncStorage.getItem(STORAGE_KEY));
  } catch (e) {
    console.warn("[appearanceStorage] load failed, using defaults", e);
    return DEFAULT_APPEARANCE;
  }
}

export async function saveAppearance(prefs: AppearancePrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn("[appearanceStorage] save failed", e);
  }
}

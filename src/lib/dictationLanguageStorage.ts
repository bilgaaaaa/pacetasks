import AsyncStorage from "@react-native-async-storage/async-storage";
import { LANGUAGES, Language } from "../i18n";

// Remembers, on this phone, the language Talk last listened in, so someone who
// dictates in Italian with an English app doesn't switch every time.
const LANGUAGE_KEY = "pacetasks.dictation.language";

// The saved language, or null when none was picked yet. Storage problems are logged and treated as "none".
export async function loadDictationLanguage(): Promise<Language | null> {
  try {
    const raw = await AsyncStorage.getItem(LANGUAGE_KEY);
    return (LANGUAGES as readonly string[]).includes(raw ?? "") ? (raw as Language) : null;
  } catch (e) {
    console.warn("[dictationLanguageStorage] load failed", e);
    return null;
  }
}

export async function saveDictationLanguage(language: Language): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, language);
  } catch (e) {
    console.warn("[dictationLanguageStorage] save failed", e);
  }
}

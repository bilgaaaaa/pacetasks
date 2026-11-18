import type { Language } from "../i18n";

// The iPhone's speech recognizer listens in one language at a time. People here
// mix: an English sentence with "aperitivo", an Italian one with "meeting". These
// are the words each language borrows most, passed to the recognizer as hints so
// it hears them instead of the nearest native word ("appetite").
const BORROWED_WORDS: Record<Language, string[]> = {
  en: [
    "aperitivo", "apericena", "spritz", "spesa", "cena", "pranzo", "colazione", "palestra", "farmacia",
    "commercialista", "bolletta", "condominio", "posta", "tabaccheria", "ferramenta", "parrucchiere",
    "dentista", "medico", "veterinario", "mercato", "caffè", "cornetto", "pizzeria", "trattoria",
    "questura", "comune", "Poste", "Esselunga", "Conad", "Coop", "Padova", "Venezia", "Bruno",
  ],
  it: [
    "meeting", "call", "deadline", "email", "mail", "report", "standup", "weekend", "brunch", "workout",
    "review", "task", "feedback", "slide", "budget", "check-in", "focus", "team", "smart working",
    "PaceTasks", "DeskFocus", "Siri", "TestFlight", "Amazon", "Netflix", "Bruno",
  ],
};

// iOS takes up to 100 hints; more are ignored and slow it down.
export const MAX_DICTATION_HINTS = 100;

// The hints for listening in `language`: the borrowed words first, then distinct words from the
// user's own task titles (names, places, brands they actually say), longest-lived first.
export function dictationHints(language: Language, taskTitles: string[]): string[] {
  const hints = new Set(BORROWED_WORDS[language]);
  for (const title of taskTitles) {
    for (const word of title.split(/[\s,.;:!?()"“”]+/u)) {
      if (hints.size >= MAX_DICTATION_HINTS) return [...hints];
      // Short words are common ones the recognizer already knows.
      if (word.length >= 4) hints.add(word);
    }
  }
  return [...hints].slice(0, MAX_DICTATION_HINTS);
}

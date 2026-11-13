import { it } from "./it";

// The app's languages. English is the source: every text in the code is written
// in English and is also the key of its translation, so a text that has no
// translation yet still shows, in English.
export const LANGUAGES = ["en", "it"] as const;
export type Language = (typeof LANGUAGES)[number];

// The language's own name, for the language choice in Settings.
export const LANGUAGE_NAMES: Record<Language, string> = { en: "English", it: "Italiano" };

// The locale that dates, numbers and voice recognition use for each language.
const LOCALES: Record<Language, string> = { en: "en-US", it: "it-IT" };

const DICTIONARIES: Record<Language, Record<string, string> | null> = { en: null, it };

let currentLanguage: Language = "en";

export function getLanguage(): Language {
  return currentLanguage;
}

// Switches every text read after this call. LanguageProvider calls it before the screens render.
export function setLanguage(language: Language): void {
  if (language !== currentLanguage) console.log("[i18n] language", currentLanguage, "→", language);
  currentLanguage = language;
}

export function getLocale(): string {
  return LOCALES[currentLanguage];
}

// A phone language code ("it", "en", "tr"…) as one of the app's languages; English when it isn't one.
export function languageFor(languageCode: string | null | undefined): Language {
  const code = languageCode?.toLowerCase();
  return (LANGUAGES as readonly string[]).includes(code ?? "") ? (code as Language) : "en";
}

// Two texts that read the same in English but not elsewhere are told apart by a
// note after a bar, which is never shown: "May" (short month) and "May|full month".
const CONTEXT_NOTE = /\|[^|]*$/;

// The text in the current language. `{0}`, `{1}`… are replaced by the values, in
// any order the translation needs: t("Starts in {0}, at {1}.", lead, time).
export function t(text: string, ...values: (string | number)[]): string {
  const template = DICTIONARIES[currentLanguage]?.[text] ?? text.replace(CONTEXT_NOTE, "");
  if (values.length === 0) return template;
  return template.replace(/\{(\d+)\}/g, (placeholder, index) => {
    const value = values[Number(index)];
    return value === undefined ? placeholder : String(value);
  });
}

// A counted text: `one` when the count is 1, otherwise `other`. The count is `{0}`,
// further values follow: tn(count, "1 task", "{0} tasks").
export function tn(count: number, one: string, other: string, ...values: (string | number)[]): string {
  return t(count === 1 ? one : other, count, ...values);
}

// Marks a text that is stored first and translated later (a constant, a label in
// a list): it returns the English text unchanged. Show it through t() or localized().
export function msg<T extends string>(text: T): T {
  return text;
}

const localizedViews = new WeakMap<object, object>();

// A view of a constant list or record of texts (marked with msg) whose texts read
// in the current language, however deep they sit. The constant itself stays in
// English, so it follows a language change without being rebuilt.
export function localized<T extends object>(value: T): T {
  const existing = localizedViews.get(value);
  if (existing) return existing as T;
  const view = new Proxy(value, {
    get(target, key, receiver) {
      const entry = Reflect.get(target, key, receiver);
      if (typeof entry === "string") return t(entry);
      if (entry !== null && typeof entry === "object") return localized(entry);
      return entry;
    },
  });
  localizedViews.set(value, view);
  return view;
}

import type { ExpoSpeechRecognitionErrorCode } from "expo-speech-recognition";

// Pure rules for dictation (speaking instead of typing), kept apart from the
// microphone so they can be tested. The hook in src/hooks/useDictation.ts does the listening.

// The languages Brain Dump understands, with the locale the phone's recognizer needs.
export const DICTATION_LANGUAGES = [
  { code: "en", locale: "en-US", label: "English" },
  { code: "it", locale: "it-IT", label: "Italiano" },
  { code: "tr", locale: "tr-TR", label: "Türkçe" },
] as const;

export type DictationLanguage = (typeof DICTATION_LANGUAGES)[number]["code"];

// The phone's language when Brain Dump understands it, otherwise English.
export function dictationLanguageFor(languageCode: string | null | undefined): DictationLanguage {
  const match = DICTATION_LANGUAGES.find((language) => language.code === languageCode?.toLowerCase());
  return match ? match.code : "en";
}

export function dictationLocale(language: DictationLanguage): string {
  return DICTATION_LANGUAGES.find((entry) => entry.code === language)!.locale;
}

// What has been heard since the mic was turned on: finished phrases, and the one still being spoken.
export interface DictationTranscript {
  committed: string;
  interim: string;
}

export const EMPTY_TRANSCRIPT: DictationTranscript = { committed: "", interim: "" };

function joinSpoken(...parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

// The recognizer reports each phrase on its own: a finished one is kept, an unfinished one replaces the last guess.
export function applyDictationResult(
  transcript: DictationTranscript,
  phrase: string,
  isFinal: boolean
): DictationTranscript {
  return isFinal
    ? { committed: joinSpoken(transcript.committed, phrase), interim: "" }
    : { committed: transcript.committed, interim: phrase };
}

// The field's text while dictating: what was there before the mic, then what was heard, within the field's limit.
export function dictatedText(base: string, transcript: DictationTranscript, maxLength: number): string {
  return joinSpoken(base, transcript.committed, transcript.interim).slice(0, maxLength);
}

export const DICTATION_PERMISSION_OFF =
  "PaceTasks can't use the microphone. Turn on Microphone and Speech Recognition for PaceTasks in iPhone Settings.";

// What to tell the user when listening stops by itself; null when there is nothing to say
// (they stopped it, or simply didn't speak).
export function dictationErrorMessage(code: ExpoSpeechRecognitionErrorCode): string | null {
  switch (code) {
    case "aborted":
    case "no-speech":
    case "speech-timeout":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return DICTATION_PERMISSION_OFF;
    case "language-not-supported":
      return "Your iPhone can't listen in this language yet. Pick another one, or type instead.";
    case "network":
      return "Listening needs a connection right now. Check it and try again, or type instead.";
    default:
      return "Couldn't hear that. Try again, or type instead.";
  }
}

import type { ExpoSpeechRecognitionErrorCode } from "expo-speech-recognition";
import { msg, t } from "../i18n";

// Pure rules for dictation (speaking instead of typing), kept apart from the
// microphone so they can be tested. The hook in src/hooks/useDictation.ts does the listening.

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
  msg("PaceTasks can't use the microphone. Turn on Microphone and Speech Recognition for PaceTasks in iPhone Settings.");

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
      return t(DICTATION_PERMISSION_OFF);
    case "language-not-supported":
      return t("Your iPhone can't listen in this language yet. Pick another one, or type instead.");
    case "network":
      return t("Listening needs a connection right now. Check it and try again, or type instead.");
    default:
      return t("Couldn't hear that. Try again, or type instead.");
  }
}

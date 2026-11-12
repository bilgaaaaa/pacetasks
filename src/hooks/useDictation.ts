import { useCallback, useEffect, useRef, useState } from "react";
import { getLocales } from "expo-localization";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import {
  applyDictationResult,
  dictatedText,
  DICTATION_PERMISSION_OFF,
  dictationErrorMessage,
  DictationLanguage,
  dictationLanguageFor,
  dictationLocale,
  DictationTranscript,
  EMPTY_TRANSCRIPT,
} from "../lib/dictation";

interface Options {
  text: string; // the field's current text; what is spoken is added after it
  maxLength: number;
  onChangeText: (text: string) => void;
}

// Whether this device can listen at all (false in a browser without speech recognition).
function recognitionAvailable(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch (e) {
    console.warn("[useDictation] availability check failed", e);
    return false;
  }
}

// Speaking instead of typing: turns the microphone on and off and writes what is
// heard into a text field, after the text that was already there. The language
// starts as the phone's and can be changed while the mic is off.
export function useDictation({ text, maxLength, onChangeText }: Options) {
  const [available] = useState(recognitionAvailable);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<DictationLanguage>(() =>
    dictationLanguageFor(getLocales()[0]?.languageCode)
  );
  const baseText = useRef(""); // the field's text when the mic was turned on
  const transcript = useRef<DictationTranscript>(EMPTY_TRANSCRIPT);
  const listeningRef = useRef(false); // for the unmount cleanup, which can't read state

  const markListening = (value: boolean) => {
    listeningRef.current = value;
    setListening(value);
  };

  useSpeechRecognitionEvent("start", () => markListening(true));
  useSpeechRecognitionEvent("end", () => markListening(false));
  useSpeechRecognitionEvent("result", (event) => {
    const phrase = event.results[0]?.transcript;
    if (!listeningRef.current || phrase === undefined) return;
    transcript.current = applyDictationResult(transcript.current, phrase, event.isFinal);
    onChangeText(dictatedText(baseText.current, transcript.current, maxLength));
  });
  useSpeechRecognitionEvent("error", (event) => {
    console.warn("[useDictation] recognition error", event.error, event.message);
    setError(dictationErrorMessage(event.error));
    markListening(false);
  });

  const start = useCallback(async () => {
    setError(null);
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        console.warn("[useDictation] microphone or speech permission refused");
        setError(DICTATION_PERMISSION_OFF);
        return;
      }
      baseText.current = text;
      transcript.current = EMPTY_TRANSCRIPT;
      console.log("[useDictation] listening in", dictationLocale(language));
      ExpoSpeechRecognitionModule.start({
        lang: dictationLocale(language),
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
      });
    } catch (e) {
      console.warn("[useDictation] start failed", e);
      setError(dictationErrorMessage("audio-capture"));
    }
  }, [text, language]);

  // Stops and keeps what was heard so far.
  const stop = useCallback(() => {
    if (listeningRef.current) ExpoSpeechRecognitionModule.stop();
  }, []);

  const toggle = useCallback(() => (listeningRef.current ? stop() : void start()), [start, stop]);

  // The mic never stays on after the field that owns it has gone.
  useEffect(
    () => () => {
      if (listeningRef.current) ExpoSpeechRecognitionModule.abort();
    },
    []
  );

  return { available, listening, error, language, setLanguage, toggle, stop };
}

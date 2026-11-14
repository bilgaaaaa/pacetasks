import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";
import {
  applyDictationResult,
  dictatedText,
  DICTATION_PERMISSION_OFF,
  dictationErrorMessage,
  DictationTranscript,
  EMPTY_TRANSCRIPT,
} from "../lib/dictation";
import { getLocale, t } from "../i18n";

interface Options {
  text: string; // the field's current text; what is spoken is added after it
  maxLength: number;
  onChangeText: (text: string) => void;
}

// Whether this device can listen at all. An iPhone always can: if something is
// off (permission, language), starting says so instead of hiding the button.
// A browser without speech recognition can't.
function recognitionAvailable(): boolean {
  if (Platform.OS === "ios") return true;
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch (e) {
    console.warn("[useDictation] availability check failed", e);
    return false;
  }
}

// Speaking instead of typing: turns the microphone on and off and writes what is
// heard into a text field, after the text that was already there. It listens in
// the app's language (Settings › Language).
export function useDictation({ text, maxLength, onChangeText }: Options) {
  const [available] = useState(recognitionAvailable);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        setError(t(DICTATION_PERMISSION_OFF));
        return;
      }
      baseText.current = text;
      transcript.current = EMPTY_TRANSCRIPT;
      console.log("[useDictation] listening in", getLocale());
      ExpoSpeechRecognitionModule.start({
        lang: getLocale(),
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
      });
    } catch (e) {
      console.warn("[useDictation] start failed", e);
      setError(dictationErrorMessage("audio-capture"));
    }
  }, [text]);

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

  return { available, listening, error, start, toggle, stop };
}

import React, { useEffect } from "react";
import { StyleProp, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { useDictation } from "../hooks/useDictation";
import { LANGUAGES, LANGUAGE_NAMES, t } from "../i18n";

interface Props {
  text: string; // the field this bar speaks into
  maxLength: number;
  disabled: boolean; // the field can't change right now (e.g. it is being sent)
  onChangeText: (text: string) => void;
  onListeningChange: (listening: boolean) => void; // lets the owner lock the field while the mic writes into it
  startListening: boolean; // starts listening as soon as the bar appears, as when the user tapped a mic to get here
  taskTitles?: string[]; // the user's task names, heard better when passed as hints
  style?: StyleProp<ViewStyle>;
}

// The microphone under a text field: one button to talk and stop, the language
// it listens in (EN / IT, remembered), and a line when listening could not start.
// Renders nothing on a device that can't listen.
export function DictationBar({ text, maxLength, disabled, onChangeText, onListeningChange, startListening, taskTitles, style }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const dictation = useDictation({ text, maxLength, onChangeText, taskTitles });
  const { listening, start, stop } = dictation;

  // Tapping a mic means "listen now": the bar starts once, when it appears.
  useEffect(() => {
    if (startListening && dictation.available) {
      console.log("[DictationBar] listening on open");
      void start();
    }
    // Only on appearance: later changes to `start` must not restart the mic.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onListeningChange(listening);
  }, [listening, onListeningChange]);

  // A field that is being sent stops listening: nothing more may be added to it.
  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  if (!dictation.available) return null;

  return (
    <View style={style}>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.micButton, listening && styles.micButtonListening]}
          onPress={dictation.toggle}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ selected: listening, disabled }}
          accessibilityLabel={listening ? t("Stop listening") : t("Talk instead of typing")}
        >
          <Ionicons
            name={listening ? "stop" : "mic"}
            size={18}
            color={listening ? theme.colors.onAccent : theme.colors.accentDark}
          />
          <Text style={[styles.micText, listening && styles.micTextListening]}>
            {listening ? t("Listening… tap to stop") : t("Talk")}
          </Text>
        </TouchableOpacity>
        <View style={styles.languages} accessibilityRole="radiogroup" accessibilityLabel={t("Language Talk listens in")}>
          {LANGUAGES.map((language) => {
            const selected = dictation.language === language;
            return (
              <TouchableOpacity
                key={language}
                style={[styles.language, selected && styles.languageSelected]}
                onPress={() => dictation.changeLanguage(language)}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled }}
                accessibilityLabel={t("Listen in {0}", LANGUAGE_NAMES[language])}
              >
                <Text style={[styles.languageText, selected && styles.languageTextSelected]}>{language.toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {dictation.error && <Text style={styles.error}>{dictation.error}</Text>}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  languages: {
    flexDirection: "row",
    height: 40,
    padding: 3,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  language: {
    minWidth: 40,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  languageSelected: {
    backgroundColor: theme.colors.accentDark,
  },
  languageText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "700",
  },
  languageTextSelected: {
    color: theme.colors.onAccent,
  },
  micButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  micButtonListening: {
    borderColor: theme.colors.accentDark,
    backgroundColor: theme.colors.accentDark,
  },
  micText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "600",
  },
  micTextListening: {
    color: theme.colors.onAccent,
  },
  error: {
    color: theme.colors.danger,
    fontSize: theme.typography.footnote.fontSize,
    marginTop: theme.spacing.xs,
  },
}));

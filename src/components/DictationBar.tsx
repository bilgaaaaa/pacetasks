import React, { useEffect } from "react";
import { StyleProp, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { useDictation } from "../hooks/useDictation";
import { t } from "../i18n";

interface Props {
  text: string; // the field this bar speaks into
  maxLength: number;
  disabled: boolean; // the field can't change right now (e.g. it is being sent)
  onChangeText: (text: string) => void;
  onListeningChange: (listening: boolean) => void; // lets the owner lock the field while the mic writes into it
  style?: StyleProp<ViewStyle>;
}

// The microphone under a text field: one button to talk and stop, and a line
// when listening could not start. It listens in the app's language. Renders
// nothing on a device that can't listen.
export function DictationBar({ text, maxLength, disabled, onChangeText, onListeningChange, style }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const dictation = useDictation({ text, maxLength, onChangeText });
  const { listening, stop } = dictation;

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
      </View>
      {dictation.error && <Text style={styles.error}>{dictation.error}</Text>}
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
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

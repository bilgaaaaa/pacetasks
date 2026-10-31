import React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { AvailableUpdate } from "../hooks/useAppUpdate";
import {
  shortReleaseNotes,
  UPDATE_LATER_LABEL,
  UPDATE_NOTES_LABEL,
  UPDATE_NOW_LABEL,
  UPDATE_TITLE,
  updateMessage,
} from "../lib/appUpdateCopy";
import { Button } from "./Button";

interface Props {
  update: AvailableUpdate | null; // null hides the prompt
  onUpdateNow: () => void;
  onLater: () => void;
}

// The prompt shown when the app opens and a newer version is on the App Store:
// what's new, then "Update now" (opens the store) or "Later". Purely presentational.
export function UpdateSheet({ update, onUpdateNow, onLater }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const notes = shortReleaseNotes(update?.release.releaseNotes ?? null);

  return (
    <Modal visible={update !== null} transparent animationType="fade" onRequestClose={onLater}>
      <Pressable style={styles.backdrop} onPress={onLater} accessibilityLabel={UPDATE_LATER_LABEL}>
        {/* Taps inside the panel must not reach the backdrop. */}
        <Pressable style={styles.panel} onPress={() => {}}>
          <View style={styles.icon}>
            <Ionicons name="sparkles-outline" size={24} color={theme.colors.accentDark} />
          </View>
          <Text style={styles.title} accessibilityRole="header">
            {UPDATE_TITLE}
          </Text>
          {update && (
            <Text style={styles.message}>{updateMessage(update.release.version, update.installedVersion)}</Text>
          )}
          {notes && (
            <View style={styles.notes}>
              <Text style={styles.notesLabel}>{UPDATE_NOTES_LABEL}</Text>
              <Text style={styles.notesText}>{notes}</Text>
            </View>
          )}
          <Button label={UPDATE_NOW_LABEL} onPress={onUpdateNow} style={styles.primary} />
          <Button label={UPDATE_LATER_LABEL} variant="secondary" onPress={onLater} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
  backdrop: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  panel: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.quickFill,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontFamily: theme.fonts.display,
    marginTop: theme.spacing.xs,
  },
  message: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    lineHeight: 20,
  },
  notes: {
    gap: 4,
    padding: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
  },
  notesLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption.fontSize,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  notesText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.footnote.fontSize,
    lineHeight: 18,
  },
  primary: {
    marginTop: theme.spacing.sm,
  },
}));

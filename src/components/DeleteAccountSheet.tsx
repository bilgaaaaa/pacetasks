import React from "react";
import { Modal, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  DELETION_WARNING,
  deletionConfirmLabel,
  deletionConsequences,
  deletionDoneMessage,
  deletionIntro,
  deletionTitle,
} from "../lib/accountCopy";
import { AccountDeletionState } from "../lib/accountDeletionState";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { Button } from "./Button";
import { ErrorBanner } from "./ErrorBanner";

interface Props {
  state: AccountDeletionState;
  onConfirm: () => void;
  onClose: () => void;
}

// Full-screen sheet that asks before deleting the account (or, before sign-up,
// this phone's data): it lists what goes, then confirms that it is gone. Purely
// presentational — every transition comes from useAccount.
export function DeleteAccountSheet({ state, onConfirm, onClose }: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const { phase, hasAccount, error } = state;
  const isDeleting = phase === "deleting";

  return (
    <Modal visible={phase !== "closed"} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>YOUR DATA</Text>
            <Text style={styles.title}>{phase === "deleted" ? "Done" : deletionTitle(hasAccount)}</Text>
          </View>
          {!isDeleting && (
            <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeButton} accessibilityLabel="Close">
              <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {phase === "deleted" ? (
          <View style={styles.done}>
            <View style={styles.doneIcon}>
              <Ionicons name="checkmark" size={32} color={theme.colors.onAccent} />
            </View>
            <Text style={styles.doneText}>{deletionDoneMessage(hasAccount)}</Text>
            <Button style={styles.doneButton} label="Close" onPress={onClose} />
          </View>
        ) : (
          <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
            <Text style={styles.subtitle}>{deletionIntro(hasAccount)}</Text>
            <View style={styles.list}>
              {deletionConsequences(hasAccount).map((line) => (
                <View key={line} style={styles.listRow}>
                  <Ionicons name="remove" size={16} color={theme.colors.textTertiary} />
                  <Text style={styles.listText}>{line}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.warning}>{DELETION_WARNING}</Text>

            {error && <ErrorBanner message={error} />}

            <Button
              style={styles.onSurface}
              label={isDeleting ? "Deleting…" : deletionConfirmLabel(hasAccount)}
              variant="destructive"
              loading={isDeleting}
              onPress={onConfirm}
            />
            <Button label="Keep everything" disabled={isDeleting} onPress={onClose} />
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles((theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  eyebrow: {
    color: theme.colors.accentDark,
    fontSize: theme.typography.eyebrow.fontSize,
    fontWeight: theme.typography.eyebrow.fontWeight,
    letterSpacing: theme.typography.eyebrow.letterSpacing,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title.fontSize,
    fontWeight: theme.typography.title.fontWeight,
    fontFamily: theme.typography.title.fontFamily,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
  },
  list: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
  },
  listText: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
  },
  warning: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "600",
  },
  // The destructive button keeps the card fill so its red label stays readable on the page background.
  onSurface: {
    backgroundColor: theme.colors.surface,
  },
  done: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentDark,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title.fontSize,
    fontWeight: theme.typography.title.fontWeight,
    fontFamily: theme.typography.title.fontFamily,
    textAlign: "center",
  },
  doneButton: {
    marginTop: theme.spacing.sm,
  },
}));

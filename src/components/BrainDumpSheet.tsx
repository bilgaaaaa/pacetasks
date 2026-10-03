import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BRAIN_DUMP_MAX_TEXT_LENGTH } from "@domain/brainDump/limits";
import { toLocalDateKey } from "@domain/dates";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { addButtonLabel, doneMessage, reviewSummary } from "../lib/brainDumpCopy";
import { BrainDumpState, selectedDrafts } from "../lib/brainDumpState";
import { BrainDumpCandidateRow } from "./BrainDumpCandidateRow";
import { Button } from "./Button";
import { ErrorBanner } from "./ErrorBanner";

interface Props {
  visible: boolean;
  state: BrainDumpState;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  onToggle: (index: number, included: boolean) => void;
  onChangeTitle: (index: number, title: string) => void;
  onCommit: () => void;
  onClose: () => void;
}

// Full-screen sheet for Brain Dump: write (or dictate with the keyboard mic, in
// any language) everything on your mind, then review what PaceTasks understood
// before anything is added. Purely presentational — state comes from useBrainDump.
export function BrainDumpSheet({
  visible,
  state,
  onChangeText,
  onSubmit,
  onToggle,
  onChangeTitle,
  onCommit,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const { phase, proposal } = state;
  const isInputPhase = phase === "input" || phase === "interpreting";
  const isReviewPhase = phase === "review" || phase === "committing";
  const todayKey = toLocalDateKey(new Date());
  const selectedCount = selectedDrafts(state).length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>BRAIN DUMP</Text>
              <Text style={styles.title}>
                {isReviewPhase ? "Here's what I understood" : phase === "done" ? "All set" : "What's on your mind?"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeButton} accessibilityLabel="Close">
              <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {isInputPhase && (
            <View style={styles.flex}>
              <Text style={styles.subtitle}>
                Everything, in any language. Tap the mic on your keyboard to talk instead.
              </Text>
              <TextInput
                style={styles.input}
                value={state.text}
                onChangeText={onChangeText}
                placeholder={"Tomorrow call the vet, finish the presentation before Friday, belki spora giderim…"}
                placeholderTextColor={theme.colors.textTertiary}
                multiline
                autoFocus
                editable={phase === "input"}
                maxLength={BRAIN_DUMP_MAX_TEXT_LENGTH}
                textAlignVertical="top"
              />
              <Text style={styles.counter}>
                {state.text.length}/{BRAIN_DUMP_MAX_TEXT_LENGTH}
              </Text>
              {state.error && <ErrorBanner style={styles.errorBanner} message={state.error.message} />}
              <Button
                style={styles.action}
                label={phase === "interpreting" ? "Reading your brain dump…" : state.error?.retryable ? "Try again" : "Sort it out"}
                loading={phase === "interpreting"}
                disabled={state.text.trim().length === 0}
                onPress={onSubmit}
              />
            </View>
          )}

          {isReviewPhase && proposal && (
            <View style={styles.flex}>
              <Text style={styles.subtitle}>{reviewSummary(proposal.candidates.length, proposal.reviewReasons)}</Text>
              <ScrollView style={styles.flex} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
                {proposal.candidates.map((candidate) => (
                  <BrainDumpCandidateRow
                    key={candidate.index}
                    candidate={candidate}
                    edit={state.edits[candidate.index]}
                    todayKey={todayKey}
                    disabled={phase === "committing"}
                    onToggle={(included) => onToggle(candidate.index, included)}
                    onChangeTitle={(title) => onChangeTitle(candidate.index, title)}
                  />
                ))}
                {proposal.unparsedFragments.length > 0 && (
                  <View style={styles.unparsed}>
                    <Text style={styles.unparsedTitle}>Not turned into tasks</Text>
                    {proposal.unparsedFragments.map((fragment, i) => (
                      <Text key={i} style={styles.unparsedText}>
                        "{fragment}"
                      </Text>
                    ))}
                  </View>
                )}
              </ScrollView>
              {state.error && <ErrorBanner style={styles.errorBanner} message={state.error.message} />}
              {proposal.candidates.length > 0 ? (
                <Button
                  style={styles.action}
                  label={phase === "committing" ? "Adding…" : addButtonLabel(selectedCount)}
                  loading={phase === "committing"}
                  disabled={selectedCount === 0}
                  onPress={onCommit}
                />
              ) : (
                <Button style={styles.action} label="Close" onPress={onClose} />
              )}
            </View>
          )}

          {phase === "done" && (
            <View style={styles.done}>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark" size={32} color={theme.colors.onAccent} />
              </View>
              <Text style={styles.doneText}>{doneMessage(state.createdTasks.length)}</Text>
              <Button style={styles.action} label="Done" onPress={onClose} />
            </View>
          )}
        </KeyboardAvoidingView>
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.subhead.fontSize,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  input: {
    flex: 1,
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: 22,
  },
  counter: {
    alignSelf: "flex-end",
    color: theme.colors.textTertiary,
    fontSize: theme.typography.caption.fontSize,
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.xs,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  unparsed: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  unparsedTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "700",
  },
  unparsedText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
    fontStyle: "italic",
  },
  action: {
    marginHorizontal: theme.spacing.lg,
    marginVertical: theme.spacing.md,
  },
  errorBanner: {
    marginHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  done: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.md,
  },
  doneIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.accentDark,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title.fontSize,
    fontWeight: theme.typography.title.fontWeight,
    fontFamily: theme.typography.title.fontFamily,
  },
}));

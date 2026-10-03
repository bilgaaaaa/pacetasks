import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ACCOUNT_LIMITS, isCompleteCode, normalizeEmail } from "@domain/account";
import type { AccountField } from "@domain/account";
import type { AccountMode } from "../lib/accountApi";
import {
  codePrompt,
  doneMessage,
  fieldErrorLabel,
  fieldLabel,
  MARKETING_CONSENT_HINT,
  MARKETING_CONSENT_LABEL,
  PRIVACY_POLICY_LABEL,
  sheetSubtitle,
  SIGN_UP_PRIVACY_NOTE,
  sheetTitle,
  switchModeLabel,
} from "../lib/accountCopy";
import { AccountState } from "../lib/accountState";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { Button } from "./Button";
import { ErrorBanner } from "./ErrorBanner";
import { TextField } from "./TextField";

interface Props {
  visible: boolean;
  state: AccountState;
  profileFirstName: string | null; // for the greeting after signing in
  resending: boolean;
  onChangeField: (field: AccountField, value: string) => void;
  onChangeMarketingOptIn: (value: boolean) => void;
  onChangeCode: (code: string) => void;
  onChangeMode: (mode: AccountMode) => void;
  onSubmit: () => void;
  onVerify: () => void;
  onResendCode: () => void;
  onEditEmail: () => void;
  onOpenPrivacyPolicy: () => void;
  onClose: () => void;
}

// Full-screen sheet for creating an account or signing in, without a password:
// details, then the six-digit code from the email, then done. Purely
// presentational — every transition comes from useAccount.
export function AccountSheet({
  visible,
  state,
  profileFirstName,
  resending,
  onChangeField,
  onChangeMarketingOptIn,
  onChangeCode,
  onChangeMode,
  onSubmit,
  onVerify,
  onResendCode,
  onEditEmail,
  onOpenPrivacyPolicy,
  onClose,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  const { mode, phase, fieldErrors } = state;
  const isSignUp = mode === "sign_up";
  const isFormPhase = phase === "form" || phase === "sending";
  const isCodePhase = phase === "code" || phase === "verifying";
  const errorFor = (field: AccountField) => {
    const issue = fieldErrors[field];
    return issue ? fieldErrorLabel(field, issue) : null;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>ACCOUNT</Text>
              <Text style={styles.title}>{phase === "done" ? "Done" : sheetTitle(mode)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8} style={styles.closeButton} accessibilityLabel="Close">
              <Ionicons name="close" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {isFormPhase && (
            <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text style={styles.subtitle}>{sheetSubtitle(mode)}</Text>

              {isSignUp && (
                <>
                  <TextField
                    label={fieldLabel("firstName")}
                    value={state.firstName}
                    error={errorFor("firstName")}
                    onChangeText={(value) => onChangeField("firstName", value)}
                    editable={phase === "form"}
                    maxLength={ACCOUNT_LIMITS.nameMaxLength}
                    autoCapitalize="words"
                    autoComplete="given-name"
                    textContentType="givenName"
                    returnKeyType="next"
                  />
                  <TextField
                    label={fieldLabel("lastName")}
                    value={state.lastName}
                    error={errorFor("lastName")}
                    onChangeText={(value) => onChangeField("lastName", value)}
                    editable={phase === "form"}
                    maxLength={ACCOUNT_LIMITS.nameMaxLength}
                    autoCapitalize="words"
                    autoComplete="family-name"
                    textContentType="familyName"
                    returnKeyType="next"
                  />
                </>
              )}
              <TextField
                label={fieldLabel("email")}
                value={state.email}
                error={errorFor("email")}
                onChangeText={(value) => onChangeField("email", value)}
                editable={phase === "form"}
                maxLength={ACCOUNT_LIMITS.emailMaxLength}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={onSubmit}
              />

              {isSignUp && (
                <View style={styles.consentRow}>
                  <View style={styles.consentText}>
                    <Text style={styles.consentLabel}>{MARKETING_CONSENT_LABEL}</Text>
                    <Text style={styles.hint}>{MARKETING_CONSENT_HINT}</Text>
                  </View>
                  <Switch
                    value={state.marketingOptIn}
                    disabled={phase !== "form"}
                    onValueChange={onChangeMarketingOptIn}
                    trackColor={{ false: theme.colors.border, true: theme.colors.accentDark }}
                    accessibilityLabel={MARKETING_CONSENT_LABEL}
                  />
                </View>
              )}

              {isSignUp && (
                <View style={styles.privacyNote}>
                  <Text style={styles.hint}>{SIGN_UP_PRIVACY_NOTE}</Text>
                  <TouchableOpacity onPress={onOpenPrivacyPolicy} hitSlop={12} accessibilityRole="link">
                    <Text style={styles.link}>{PRIVACY_POLICY_LABEL}</Text>
                  </TouchableOpacity>
                </View>
              )}

              {state.error && <ErrorBanner message={state.error} />}

              <Button
                label={phase === "sending" ? "Sending the code…" : "Email me a code"}
                loading={phase === "sending"}
                onPress={onSubmit}
              />
              <Button
                label={switchModeLabel(mode)}
                variant="secondary"
                disabled={phase === "sending"}
                onPress={() => onChangeMode(isSignUp ? "sign_in" : "sign_up")}
              />
            </ScrollView>
          )}

          {isCodePhase && (
            <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              <Text style={styles.subtitle}>{codePrompt(normalizeEmail(state.email))}</Text>
              <TextField
                label="Code"
                value={state.code}
                onChangeText={onChangeCode}
                editable={phase === "code"}
                maxLength={ACCOUNT_LIMITS.codeLength}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={onVerify}
              />

              {state.error && <ErrorBanner message={state.error} />}

              <Button
                label={phase === "verifying" ? "Checking…" : "Confirm"}
                loading={phase === "verifying"}
                disabled={!isCompleteCode(state.code)}
                onPress={onVerify}
              />
              <Button
                label={resending ? "Sending a new code…" : "Send a new code"}
                variant="secondary"
                disabled={phase === "verifying" || resending}
                onPress={onResendCode}
              />
              <Button
                label="Use a different email"
                variant="secondary"
                disabled={phase === "verifying" || resending}
                onPress={onEditEmail}
              />
              <Text style={styles.hint}>The code can take a minute to arrive. Check your spam folder too.</Text>
            </ScrollView>
          )}

          {phase === "done" && (
            <View style={styles.done}>
              <View style={styles.doneIcon}>
                <Ionicons name="checkmark" size={32} color={theme.colors.onAccent} />
              </View>
              <Text style={styles.doneText}>
                {doneMessage(mode, isSignUp ? state.firstName.trim() || null : profileFirstName)}
              </Text>
              <Button style={styles.doneButton} label="Close" onPress={onClose} />
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
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  consentText: {
    flex: 1,
    gap: 2,
  },
  consentLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
    fontWeight: "600",
  },
  hint: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: "400",
  },
  privacyNote: {
    gap: theme.spacing.xs,
    alignItems: "flex-start",
  },
  link: {
    color: theme.colors.accentDark,
    fontSize: theme.typography.footnote.fontSize,
    fontWeight: theme.typography.footnote.fontWeight,
    textDecorationLine: "underline",
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

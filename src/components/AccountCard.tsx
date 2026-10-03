import React from "react";
import { Switch, Text, View } from "react-native";
import type { AccountMode, Profile } from "../lib/accountApi";
import { MARKETING_CONSENT_LABEL } from "../lib/accountCopy";
import { makeStyles, useTheme } from "../hooks/useTheme";
import { Button } from "./Button";
import { ErrorBanner } from "./ErrorBanner";

interface Props {
  isSignedUp: boolean;
  email: string | null;
  profile: Profile | null; // null while it loads, or before sign-up
  busy: boolean;
  errorMessage: string | null;
  onOpen: (mode: AccountMode) => void;
  onChangeMarketingOptIn: (value: boolean) => void;
  onSignOut: () => void;
}

// Settings card for the account. Before sign-up it explains what an account is
// for and offers to create one or sign in; after, it shows who is signed in, the
// email consent switch and sign out. Purely presentational — state comes from useAccount.
export function AccountCard({
  isSignedUp,
  email,
  profile,
  busy,
  errorMessage,
  onOpen,
  onChangeMarketingOptIn,
  onSignOut,
}: Props) {
  const { theme } = useTheme();
  const styles = useStyles();
  if (!isSignedUp) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Your account</Text>
        <Text style={styles.subtitle}>
          Your tasks live only on this phone for now. Create an account to keep them safe and open them on another phone.
        </Text>
        <View style={styles.actions}>
          <Button label="Create account" onPress={() => onOpen("sign_up")} />
          <Button
            style={styles.secondaryOnCard}
            label="I already have an account"
            variant="secondary"
            onPress={() => onOpen("sign_in")}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{profile ? `${profile.first_name} ${profile.last_name}` : "Your account"}</Text>
      <Text style={styles.subtitle}>{email}</Text>

      {profile && (
        <View style={styles.consentRow}>
          <Text style={styles.consentLabel}>{MARKETING_CONSENT_LABEL}</Text>
          <Switch
            value={profile.marketing_opt_in}
            disabled={busy}
            onValueChange={onChangeMarketingOptIn}
            trackColor={{ false: theme.colors.border, true: theme.colors.accentDark }}
            accessibilityLabel={MARKETING_CONSENT_LABEL}
          />
        </View>
      )}

      {errorMessage && <ErrorBanner message={errorMessage} />}

      <View style={styles.actions}>
        <Button
          style={styles.secondaryOnCard}
          label="Sign out"
          variant="secondary"
          disabled={busy}
          onPress={onSignOut}
        />
        <Text style={styles.hint}>Your tasks stay in your account. This phone starts again empty.</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.footnote.fontSize,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  consentLabel: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.subhead.fontSize,
  },
  actions: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  // The secondary button's own fill is the card's color, so on a card it uses the nested fill.
  secondaryOnCard: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  hint: {
    color: theme.colors.textTertiary,
    fontSize: theme.typography.caption.fontSize,
    textAlign: "center",
  },
}));

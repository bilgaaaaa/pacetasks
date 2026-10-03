import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { isCompleteCode } from "@domain/account";
import type { AccountField } from "@domain/account";
import * as accountApi from "../lib/accountApi";
import { AccountError, AccountMode, Profile } from "../lib/accountApi";
import { accountDeletionReducer, INITIAL_ACCOUNT_DELETION_STATE } from "../lib/accountDeletionState";
import { accountReducer, formErrors, INITIAL_ACCOUNT_STATE } from "../lib/accountState";

// Drives the account card and sheets: who is signed in, their profile, the
// passwordless flow (details → emailed code → verified) and deleting the account.
// All transitions live in accountReducer and accountDeletionReducer; this hook
// only performs the network calls around them.
export function useAccount(session: Session | null) {
  const [state, dispatch] = useReducer(accountReducer, INITIAL_ACCOUNT_STATE);
  const [deletion, dispatchDeletion] = useReducer(accountDeletionReducer, INITIAL_ACCOUNT_DELETION_STATE);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false); // a profile change, new code or sign-out is in flight
  const [cardError, setCardError] = useState<string | null>(null); // failures outside the sheet

  const user = session?.user ?? null;
  const userId = user?.id;
  const isSignedUp = Boolean(user && !user.is_anonymous && user.email);
  const metadata = user?.user_metadata;

  // Loads the profile of a signed-up user. A verified account without one (the
  // app was closed before it could be saved) gets it from the sign-up details.
  useEffect(() => {
    let active = true;
    if (!userId || !isSignedUp) {
      setProfile(null);
      return;
    }
    (async () => {
      try {
        const existing = await accountApi.fetchProfile(userId);
        const pending = existing ? null : accountApi.profileInputFromMetadata(metadata);
        const loaded = pending ? await accountApi.saveProfile(userId, pending) : existing;
        if (active) setProfile(loaded);
      } catch (e) {
        if (active) setCardError(toMessage(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [userId, isSignedUp, metadata]);

  // The email was confirmed through the emailed link while the sheet waited for a code.
  useEffect(() => {
    if (isSignedUp && state.mode === "sign_up" && state.phase === "code") dispatch({ type: "verified" });
  }, [isSignedUp, state.mode, state.phase]);

  const open = useCallback((mode: AccountMode) => dispatch({ type: "opened", mode }), []);
  const setMode = useCallback((mode: AccountMode) => dispatch({ type: "setMode", mode }), []);
  const setField = useCallback(
    (field: AccountField, value: string) => dispatch({ type: "setField", field, value }),
    []
  );
  const setMarketingOptIn = useCallback((value: boolean) => dispatch({ type: "setMarketingOptIn", value }), []);
  const setCode = useCallback((code: string) => dispatch({ type: "setCode", code }), []);
  const editEmail = useCallback(() => dispatch({ type: "editEmail" }), []);

  const requestCode = useCallback(
    () =>
      accountApi.requestEmailCode(
        state.mode,
        state.email,
        state.mode === "sign_up"
          ? { first_name: state.firstName.trim(), last_name: state.lastName.trim(), marketing_opt_in: state.marketingOptIn }
          : undefined
      ),
    [state.mode, state.email, state.firstName, state.lastName, state.marketingOptIn]
  );

  const submit = useCallback(async () => {
    if (state.phase !== "form") return;
    const fieldErrors = formErrors(state);
    if (Object.keys(fieldErrors).length > 0) {
      dispatch({ type: "submitRejected", fieldErrors });
      return;
    }
    dispatch({ type: "sendStarted" });
    try {
      const outcome = await requestCode();
      dispatch({ type: outcome === "confirmed" ? "verified" : "codeSent" });
    } catch (e) {
      dispatch({ type: "failed", message: toMessage(e) });
    }
  }, [state, requestCode]);

  const resendCode = useCallback(async () => {
    if (state.phase !== "code" || busy) return;
    setBusy(true);
    try {
      await requestCode();
      dispatch({ type: "codeSent" });
    } catch (e) {
      dispatch({ type: "failed", message: toMessage(e) });
    } finally {
      setBusy(false);
    }
  }, [state.phase, busy, requestCode]);

  // On success the session changes (same user for sign-up, the account's user for
  // sign-in) and the effect above loads or creates the profile.
  const verify = useCallback(async () => {
    if (state.phase !== "code" || !isCompleteCode(state.code)) return;
    dispatch({ type: "verifyStarted" });
    try {
      await accountApi.verifyEmailCode(state.mode, state.email, state.code);
      dispatch({ type: "verified" });
    } catch (e) {
      dispatch({ type: "failed", message: toMessage(e) });
    }
  }, [state.phase, state.code, state.mode, state.email]);

  // Runs a change made from the card (not the sheet), showing a failure on the card.
  const runOnCard = useCallback(async (action: () => Promise<void>) => {
    setBusy(true);
    setCardError(null);
    try {
      await action();
    } catch (e) {
      setCardError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const changeMarketingOptIn = useCallback(
    (value: boolean) =>
      runOnCard(async () => {
        if (!userId || !profile) return;
        setProfile(
          await accountApi.saveProfile(userId, {
            first_name: profile.first_name,
            last_name: profile.last_name,
            marketing_opt_in: value,
          })
        );
      }),
    [runOnCard, userId, profile]
  );

  const signOut = useCallback(() => runOnCard(accountApi.signOut), [runOnCard]);

  const openDeletion = useCallback(() => {
    if (userId) dispatchDeletion({ type: "opened", userId, hasAccount: isSignedUp });
  }, [userId, isSignedUp]);
  const closeDeletion = useCallback(() => dispatchDeletion({ type: "closed" }), []);

  // The question was asked about one user: if the session changes underneath it
  // (a sign-out finishing), the sheet closes instead of deleting someone else.
  useEffect(() => {
    if (deletion.phase === "confirming" && deletion.userId !== (userId ?? null)) dispatchDeletion({ type: "closed" });
  }, [deletion.phase, deletion.userId, userId]);

  // On success the session becomes a fresh anonymous user, which empties every screen.
  const deletionInFlight = useRef(false); // state updates are async, so a double tap needs its own guard
  const confirmDeletion = useCallback(async () => {
    if (deletion.phase !== "confirming" || deletion.userId !== userId || deletionInFlight.current) return;
    deletionInFlight.current = true;
    dispatchDeletion({ type: "deleteStarted" });
    try {
      await accountApi.deleteAccount();
      setCardError(null);
      dispatchDeletion({ type: "deleted" });
    } catch (e) {
      dispatchDeletion({ type: "failed", message: toMessage(e) });
    } finally {
      deletionInFlight.current = false;
    }
  }, [deletion.phase, deletion.userId, userId]);

  return {
    state,
    isSignedUp,
    email: user?.email ?? null,
    profile,
    busy,
    cardError,
    open,
    setMode,
    setField,
    setMarketingOptIn,
    setCode,
    editEmail,
    submit,
    resendCode,
    verify,
    changeMarketingOptIn,
    signOut,
    deletion,
    openDeletion,
    closeDeletion,
    confirmDeletion,
  };
}

function toMessage(error: unknown): string {
  if (error instanceof AccountError) return error.message;
  console.warn("[useAccount] unexpected error", error);
  return "Something went wrong. Try again.";
}

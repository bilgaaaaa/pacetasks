import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { Session } from "@supabase/supabase-js";
import { ensureSession, refreshAnonymousSession, reviveSession, supabase } from "../lib/supabase";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    ensureSession()
      .then((s) => {
        if (isMounted) setSession(s);
        refreshAnonymousSession(); // not awaited: the app must not wait on the network to start
      })
      .catch((e) => {
        console.warn("[useSession] could not start a session", e);
        if (isMounted) setError(e.message ?? "Failed to start session");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    // A session arriving later (e.g. after a failed offline start) clears the startup error.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) setError(null);
    });

    // Coming back to the app: an email confirmed by link shows up here, and a
    // session that could not be started earlier (no connection) gets another try.
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") reviveSession();
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
      appState.remove();
    };
  }, []);

  return { session, loading, error };
}

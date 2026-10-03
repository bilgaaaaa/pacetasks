import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { Session } from "@supabase/supabase-js";
import { ensureSession, refreshAnonymousSession, supabase } from "../lib/supabase";

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
        if (isMounted) setError(e.message ?? "Failed to start session");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    // Coming back from the mail app: an email confirmed by link shows up here.
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshAnonymousSession();
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
      appState.remove();
    };
  }, []);

  return { session, loading, error };
}

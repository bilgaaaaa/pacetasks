import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { Session } from "@supabase/supabase-js";
import { ensureSession, refreshAnonymousSession, reviveSession, supabase } from "../lib/supabase";

// The current Supabase session for the whole app. `failed` is true while no
// session could be started (usually no connection); `retry` tries again.
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const isMounted = useRef(true);

  const start = useCallback(async () => {
    try {
      const started = await ensureSession();
      if (!isMounted.current) return;
      setSession(started);
      setFailed(false);
    } catch (e) {
      console.warn(
        "[useSession] could not start a session. In development, check that EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env",
        e
      );
      if (isMounted.current) setFailed(true);
    }
  }, []);

  const retry = useCallback(async () => {
    setLoading(true);
    await start();
    if (isMounted.current) setLoading(false);
  }, [start]);

  useEffect(() => {
    isMounted.current = true;

    start().then(() => {
      if (isMounted.current) setLoading(false);
      refreshAnonymousSession(); // not awaited: the app must not wait on the network to start
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (s) setFailed(false); // a session that arrives later (connection back) ends the error screen
      // Signed out from outside the app (token revoked, user deleted elsewhere): start again at once.
      // Deferred because supabase-js must not be called back from inside its own auth callback.
      if (event === "SIGNED_OUT") setTimeout(start, 0);
    });

    // Coming back to the app: an email confirmed by link shows up here, and a
    // session that could not be started earlier (no connection) gets another try.
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") reviveSession();
    });

    return () => {
      isMounted.current = false;
      listener.subscription.unsubscribe();
      appState.remove();
    };
  }, [start]);

  return { session, loading, failed, retry };
}

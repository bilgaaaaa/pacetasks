import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { ensureSession, supabase } from "../lib/supabase";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    ensureSession()
      .then((s) => {
        if (isMounted) setSession(s);
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

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, error };
}

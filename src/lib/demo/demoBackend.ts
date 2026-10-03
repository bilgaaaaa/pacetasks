import type { TaskDraft } from "@domain/task";
import { commitDemoBrainDump, discardDemoBrainDump, invokeDemoBrainDump } from "./demoBrainDump";
import { createDemoTask, DEMO_USER_ID, demoTables, Row, withTableDefaults, withUpdateRules } from "./demoStore";

// In-memory stand-in for the Supabase client, used only when EXPO_PUBLIC_DEMO_MODE=1
// so the web preview runs without real keys. It covers exactly the surface the app
// uses (tables, RPCs, the brain-dump function, Realtime, anonymous auth) — extend
// it here whenever src/lib/*Api.ts or the hooks start calling something new.

type Filter = { column: string; value: unknown };
type DemoError = { message: string };
type QueryResult = { data: any; error: DemoError | null };

// Chainable, awaitable query mirroring supabase-js's builder: filters collect
// lazily and the operation runs once the chain is awaited.
class DemoQuery implements PromiseLike<QueryResult> {
  private operation: "select" | "insert" | "upsert" | "update" | "delete" = "select";
  private payload: Row | null = null;
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private resultMode: "many" | "single" | "maybeSingle" = "many";

  constructor(private readonly table: string) {}

  select(_columns = "*") {
    // After insert/update, select() only asks for the affected rows back.
    return this;
  }

  insert(row: Row) {
    this.operation = "insert";
    this.payload = row;
    return this;
  }

  // Insert, or update the row with the same primary key (only profiles uses it: keyed by user_id).
  upsert(row: Row) {
    this.operation = "upsert";
    this.payload = row;
    return this;
  }

  update(patch: Row) {
    this.operation = "update";
    this.payload = patch;
    return this;
  }

  delete() {
    this.operation = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.orderBy = { column, ascending: options.ascending ?? true };
    return this;
  }

  single() {
    this.resultMode = "single";
    return this;
  }

  maybeSingle() {
    this.resultMode = "maybeSingle";
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onFulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onFulfilled, onRejected);
  }

  private matches(row: Row) {
    return this.filters.every((f) => row[f.column] === f.value);
  }

  private execute(): QueryResult {
    const rows = demoTables[this.table] ?? (demoTables[this.table] = []);
    let affected: Row[];

    switch (this.operation) {
      case "insert": {
        const created = withTableDefaults(this.table, { ...this.payload });
        rows.push(created);
        affected = [created];
        break;
      }
      case "upsert": {
        const existing = rows.find((r) => r.user_id === this.payload?.user_id);
        if (existing) {
          Object.assign(existing, withUpdateRules(this.table, existing, { ...this.payload }));
          affected = [existing];
        } else {
          const created = withTableDefaults(this.table, { ...this.payload });
          rows.push(created);
          affected = [created];
        }
        break;
      }
      case "update": {
        affected = rows.filter((r) => this.matches(r));
        affected.forEach((r) => Object.assign(r, withUpdateRules(this.table, r, { ...this.payload })));
        break;
      }
      case "delete": {
        affected = rows.filter((r) => this.matches(r));
        demoTables[this.table] = rows.filter((r) => !this.matches(r));
        break;
      }
      default:
        affected = rows.filter((r) => this.matches(r));
    }

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      affected = [...affected].sort(
        (a, b) => (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (ascending ? 1 : -1)
      );
    }

    // Return copies so callers can't mutate the in-memory store through React state.
    const copies = affected.map((r) => ({ ...r }));
    console.log(`[demoBackend] ${this.operation} ${this.table}: ${copies.length} row(s)`);

    if (this.resultMode === "many") return { data: copies, error: null };
    if (copies.length === 0 && this.resultMode === "maybeSingle") return { data: null, error: null };
    if (copies.length !== 1) {
      return { data: null, error: { message: `Expected 1 row, got ${copies.length}` } };
    }
    return { data: copies[0], error: null };
  }
}

// Mirrors the Postgres functions the app calls; an exception becomes { error } like PostgREST.
async function callRpc(name: string, args: Record<string, any>): Promise<QueryResult> {
  try {
    console.log(`[demoBackend] rpc ${name}`);
    switch (name) {
      case "create_task":
        return { data: createDemoTask(args.draft as TaskDraft), error: null };
      case "commit_brain_dump":
        return { data: commitDemoBrainDump(args.session_id, args.drafts as TaskDraft[]), error: null };
      case "discard_brain_dump":
        discardDemoBrainDump(args.session_id);
        return { data: null, error: null };
      default:
        return { data: null, error: { message: `Demo mode has no RPC named ${name}` } };
    }
  } catch (e: any) {
    return { data: null, error: { message: e?.message ?? String(e) } };
  }
}

// Realtime stand-in: every change in demo mode comes from this same tab and is
// already applied locally by the hooks, so a channel only needs to report it joined.
function createDemoChannel(name: string) {
  const channel = {
    on: (..._args: unknown[]) => channel,
    subscribe: (callback?: (status: string, err?: Error) => void) => {
      callback?.("SUBSCRIBED");
      return channel;
    },
    unsubscribe: async () => "ok",
    topic: name,
  };
  return channel;
}

// Auth stand-in. The demo user starts anonymous, like a fresh install; signing up
// "verifies" the email with any six-digit code except DEMO_WRONG_CODE, so both
// the happy path and the error message can be seen without a mail server.
const DEMO_WRONG_CODE = "000000";

type DemoAuthListener = (event: string, session: unknown) => void;
type DemoAuthResult = { data: Record<string, unknown>; error: { message: string; code?: string } | null };

function createDemoAuth() {
  const listeners = new Set<DemoAuthListener>();
  let pendingEmail: string | null = null;
  let session = buildSession({ email: null, isAnonymous: true, metadata: {} });

  function buildSession(user: { email: string | null; isAnonymous: boolean; metadata: Row }) {
    return {
      access_token: "demo",
      refresh_token: "demo",
      token_type: "bearer",
      expires_in: 3600,
      user: {
        id: DEMO_USER_ID,
        aud: "authenticated",
        email: user.email ?? undefined,
        is_anonymous: user.isAnonymous,
        user_metadata: user.metadata,
      },
    };
  }

  const emit = (event: string) => listeners.forEach((listener) => listener(event, session));
  const ok = (data: Record<string, unknown> = {}): DemoAuthResult => ({ data, error: null });

  return {
    getSession: async () => ok({ session }),
    signInAnonymously: async () => ok({ session }),
    refreshSession: async () => ok({ session }),
    onAuthStateChange: (listener: DemoAuthListener) => {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
    // Sign-up step 1: remembers the email to confirm and stores the details on the user.
    updateUser: async (attributes: { email?: string; data?: Row }): Promise<DemoAuthResult> => {
      console.log("[demoBackend] auth.updateUser");
      pendingEmail = attributes.email ?? pendingEmail;
      session = buildSession({
        email: session.user.email ?? null,
        isAnonymous: session.user.is_anonymous,
        metadata: { ...session.user.user_metadata, ...attributes.data },
      });
      emit("USER_UPDATED");
      return ok({ user: session.user });
    },
    // The demo has one user, so signing in only works for the email that signed up.
    signInWithOtp: async ({ email }: { email: string }): Promise<DemoAuthResult> => {
      console.log("[demoBackend] auth.signInWithOtp");
      if (session.user.is_anonymous || session.user.email !== email) {
        return { data: {}, error: { message: "Signups not allowed for otp", code: "otp_disabled" } };
      }
      pendingEmail = email;
      return ok();
    },
    verifyOtp: async ({ email, token }: { email: string; token: string }): Promise<DemoAuthResult> => {
      console.log("[demoBackend] auth.verifyOtp");
      if (token === DEMO_WRONG_CODE || email !== pendingEmail) {
        return { data: {}, error: { message: "Token has expired or is invalid", code: "otp_expired" } };
      }
      pendingEmail = null;
      session = buildSession({ email, isAnonymous: false, metadata: session.user.user_metadata });
      emit("USER_UPDATED");
      return ok({ session, user: session.user });
    },
    // Signing out of the demo account starts over as an anonymous user (the demo data stays).
    signOut: async (): Promise<DemoAuthResult> => {
      console.log("[demoBackend] auth.signOut");
      demoTables.profiles = [];
      session = buildSession({ email: null, isAnonymous: true, metadata: {} });
      emit("SIGNED_OUT");
      emit("SIGNED_IN");
      return ok();
    },
  };
}

// Builds the client object with the same surface our code touches on supabase-js.
export function createDemoClient() {
  console.log("[demoBackend] Demo mode on — data lives in memory and resets on reload.");
  return {
    from: (table: string) => new DemoQuery(table),
    rpc: (name: string, args: Record<string, any> = {}) => callRpc(name, args),
    functions: {
      invoke: async (functionName: string, options: { body?: unknown } = {}) => {
        if (functionName === "brain-dump") return invokeDemoBrainDump(options.body);
        return { data: null, error: { message: `Demo mode has no function named ${functionName}` } };
      },
    },
    channel: (name: string) => createDemoChannel(name),
    removeChannel: async (_channel: unknown) => "ok",
    auth: createDemoAuth(),
  };
}

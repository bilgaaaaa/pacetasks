import type { TaskDraft } from "@domain/task";
import { commitDemoBrainDump, discardDemoBrainDump, invokeDemoBrainDump } from "./demoBrainDump";
import { createDemoTask, DEMO_USER_ID, demoTables, Row, withTableDefaults } from "./demoStore";

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
  private operation: "select" | "insert" | "update" | "delete" = "select";
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
      case "update": {
        affected = rows.filter((r) => this.matches(r));
        affected.forEach((r) => Object.assign(r, this.payload));
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

const demoSession = {
  access_token: "demo",
  refresh_token: "demo",
  token_type: "bearer",
  expires_in: 3600,
  user: { id: DEMO_USER_ID, aud: "authenticated", is_anonymous: true },
};

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
    auth: {
      getSession: async () => ({ data: { session: demoSession }, error: null }),
      signInAnonymously: async () => ({ data: { session: demoSession }, error: null }),
      onAuthStateChange: (_callback: unknown) => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
    },
  };
}

import { Task, TaskTiming, UserSettings } from "./types";

// In-memory stand-in for the Supabase client, used only when EXPO_PUBLIC_DEMO_MODE=1
// so the web preview runs without real keys. It mirrors exactly the query subset
// that tasksApi.ts / settingsApi.ts use — extend it there first if those grow.

type Row = Record<string, any>;
type Filter = { column: string; value: unknown };
type QueryResult = { data: any; error: { message: string } | null };

const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
const DAY_MS = 24 * 60 * 60 * 1000;

const tables: Record<string, Row[]> = {
  tasks: buildSeedTasks(),
  user_settings: [],
};

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
    const rows = tables[this.table] ?? (tables[this.table] = []);
    let affected: Row[];

    switch (this.operation) {
      case "insert": {
        const created = withDefaults(this.table, { ...this.payload });
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
        tables[this.table] = rows.filter((r) => !this.matches(r));
        break;
      }
      default:
        affected = rows.filter((r) => this.matches(r));
    }

    if (this.orderBy) {
      const { column, ascending } = this.orderBy;
      affected = [...affected].sort((a, b) =>
        (a[column] < b[column] ? -1 : a[column] > b[column] ? 1 : 0) * (ascending ? 1 : -1)
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

// Fills the columns Postgres would default, matching supabase/schema.sql.
function withDefaults(table: string, row: Row): Row {
  if (table === "tasks") {
    return {
      id: newId(),
      estimated_minutes: 5,
      actual_minutes: null,
      timing: "anytime",
      category: null,
      scheduled_time: null,
      status: "pending",
      created_at: new Date().toISOString(),
      completed_at: null,
      ...row,
    };
  }
  if (table === "user_settings") {
    return { updated_at: new Date().toISOString(), ...row } as UserSettings;
  }
  return row;
}

function newId() {
  return `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Seeds ~6 weeks of weekday history plus today's pending list, so the Stats
// heatmap, streaks and range-timer suggestions have something real to show.
function buildSeedTasks(): Task[] {
  const recurring: Array<[string, number, TaskTiming, string | null]> = [
    ["Morning run", 30, "before_work", "health"],
    ["Groceries", 25, "after_work", "shopping"],
    ["Answer emails", 15, "anytime", "work"],
    ["Laundry", 20, "after_work", "home"],
    ["Read 20 pages", 20, "after_work", "personal"],
  ];
  const tasks: Task[] = [];
  const now = Date.now();

  for (let daysAgo = 42; daysAgo >= 1; daysAgo--) {
    const day = new Date(now - daysAgo * DAY_MS);
    const weekday = day.getDay();
    if (weekday === 0 || weekday === 6) continue;

    // Deterministic variety: 1–3 tasks per day, with the occasional off day.
    const count = (daysAgo * 7) % 4;
    for (let i = 0; i < count; i++) {
      const [title, estimate, timing, category] = recurring[(daysAgo + i) % recurring.length];
      const drift = ((daysAgo * 13 + i * 5) % 11) - 5;
      const completedAt = new Date(day);
      completedAt.setHours(timing === "before_work" ? 7 : 19, 10 * i, 0, 0);
      tasks.push({
        id: newId() + `-${daysAgo}-${i}`,
        user_id: DEMO_USER_ID,
        title,
        estimated_minutes: estimate,
        actual_minutes: Math.max(5, estimate + drift),
        timing,
        category,
        scheduled_time: null,
        status: "done",
        created_at: completedAt.toISOString(),
        completed_at: completedAt.toISOString(),
      });
    }
  }

  const today: Array<[string, number, TaskTiming, string | null, string | null]> = [
    ["Morning run", 30, "before_work", "health", null],
    ["Call the dentist", 5, "anytime", "health", null],
    ["Deep work: PaceTasks AI layer", 50, "anytime", "personal", "20:00"],
    ["Groceries", 25, "after_work", "shopping", null],
  ];
  today.forEach(([title, estimate, timing, category, scheduledTime], i) => {
    tasks.push({
      id: newId() + `-today-${i}`,
      user_id: DEMO_USER_ID,
      title,
      estimated_minutes: estimate,
      actual_minutes: null,
      timing,
      category,
      scheduled_time: scheduledTime,
      status: "pending",
      created_at: new Date(now - i * 60_000).toISOString(),
      completed_at: null,
    });
  });

  return tasks;
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
    auth: {
      getSession: async () => ({ data: { session: demoSession }, error: null }),
      signInAnonymously: async () => ({ data: { session: demoSession }, error: null }),
      onAuthStateChange: (_callback: unknown) => ({
        data: { subscription: { unsubscribe: () => undefined } },
      }),
    },
  };
}

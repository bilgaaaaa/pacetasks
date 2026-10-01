# PaceTasks

A mobile task app for people who work a fixed schedule (e.g. 8 hours in an
office) and want to capture personal tasks the instant they think of them,
then knock them out before or after work — competing only against their own
past pace, not anyone else's.

Built with Expo SDK 57 (React Native 0.86 + TypeScript) and Supabase. Styled
to match the "PaceTasks Film" Claude Design: a calm, light sage/cream theme
with a forest-green accent, plain white cards, and a text-only pill tab bar.

## Features

- **Quick add** — a name field with autocomplete over past task names, plus dropdown pills for timing, time estimate, category, energy, and an optional fixed start time. Nothing is mandatory so it never blocks a quick add; typing a task name you've used before shows a dropdown of matches and, once recognized, the time pill switches from generic presets to that task's own **min / last time / max**.
- **Range timer** — tap a task's minutes pill to start a simple countdown from its suggested max time (learned from your history for that task name); the countdown turns green once you cross the suggested min, so you can see you're in the acceptable window without checking off yet. Reaching zero opens the actual-minutes confirm step so you finish logging it yourself. Tasks with no history yet just use their single estimate as both ends of the range.
- **Focus sessions (Pomodoro)** — give a task a fixed start time and it gets a FOCUS badge instead of the range timer; tapping it opens a full-screen countdown (session X of Y, progress bar, session segments) using your Pomodoro length from Settings. Finishing a session auto-completes the task and logs the real minutes spent.
- **Categories** — tag a task as Work / Personal / Shopping / Home / Health (or leave it uncategorized) from the quick-add bar; shown alongside the timing label on each task row.
- **Task memory** — every task name you've ever typed is remembered (grouped case-insensitively); a recognized name auto-fills its usual timing, time and energy, and feeds the range timer's min/max, unless you manually override them for that entry.
- **One calm list** — today's pending tasks (undated, due today, or overdue) ordered before work → anytime → after work, completed ones sink to the bottom, no section dividers. Future-dated tasks stay hidden until their day; "today" is always the phone's local day.
- **What can I do now?** — tap it on Today, pick how much time you have (5 min / 15 min / 30 min / 1 hour) and your energy (low / normal / high). PaceTasks answers with **Do these now**: the tasks that fit back to back in that time, ordered by what matters most (overdue and due today first, then priority, what suits this part of your day, and the best use of your energy), plus **Or instead** for other tasks that would also fit. Tasks never need more energy than you have; tasks with no energy set are never hidden. Completing a task there works exactly as on Today, and the next suggestion moves up. No AI involved.
- **Tell me what to do (One Thing mode)** — for when the list is too long to choose from. One task fills the screen, picked with the same ranking as "What can I do now?" (time and energy never hide a task here; your last energy choice only shapes the order). **Done** asks how long it took, logs it and offers the next one; **Not now** passes on it until you close the sheet.
- **Brain Dump** — tap **Brain dump** on Today, then type or dictate (keyboard mic) everything on your mind, in English, Italian, Turkish or a mix. PaceTasks shows what it understood (titles kept in your words, due days like "Tomorrow" / "by Fri", durations, "maybe" tasks) and highlights anything unclear or already on your list. Edit titles, untick what you don't want, then add. With **Add clear brain dumps directly** on in Settings, clear dumps skip the review.
- **Due days on tasks** — tasks with a date show it first on their row ("Today", "by Fri", "Overdue"); "maybe" tasks are marked as such.
- **Live sync** — changes made outside the list (another screen, device, or later Siri/Brain Dump) appear immediately via Supabase Realtime, and the list silently reloads whenever the app returns to the foreground.
- **Day cleared card** — once every task is done, a green summary card appears with today's task count, minutes, and current streak.
- **Work schedule** — set your work start/end hour once in Settings; used for the before/after-work timing labels.
- **Evening review** — a single configurable local notification (renamed from "daily reminder", same mechanism).
- **Timer chime / Haptics** — toggle a haptic pulse when a Focus session or range timer ends, or when you complete a task (no audio asset pipeline in this build — "chime" is a haptic, not a sound).
- **Compete with yourself ("Your pace")** — done today, minutes today, current/best streak, best day, estimate accuracy, a Mon–Fri × 13-week completion heatmap, and a per-day history list with a relative progress bar.

## Project structure

```
App.tsx                  Root component, custom pill tab bar, session bootstrap
src/screens/              TaskListScreen, SettingsScreen, StatsScreen
src/components/           QuickAddBar, TaskItem, FocusSessionModal, EndOfDayCard,
                          WeekHeatmap, DropdownPill, ChoiceChips, Stepper, StatCard,
                          BrainDumpSheet, DoNowSheet, OneThingSheet, Button
src/hooks/                useSession, useTasks, useSettings, useBrainDump, useDoNow,
                          useOneThing
src/lib/                  supabase client, tasksApi, settingsApi, notifications,
                          stats, categories, energy, theme, types
supabase/migrations/       Database schema, RLS policies and the create_task RPC
supabase/tests/database/   pgTAP tests for the database (`npm run db:test`)
supabase/functions/_shared/domain/
                           Pure TypeScript domain logic shared by the app and
                           Edge Functions: task model, dates, Today selection,
                           "What can I do now?" rules, task history, Brain Dump
                           schema/normalization.
                           Imported in the app as `@domain/...`.
supabase/functions/_shared/server/
                           Deno-only server code: vendor-neutral AI layer,
                           Brain Dump service/handler, HTTP errors.
supabase/functions/brain-dump/   The Brain Dump Edge Function (thin entrypoint)
supabase/functions/_eval/        AI evaluation set + runner (never deployed)
```

## 1. Set up Supabase (free tier is enough)

The database is managed with Supabase CLI migrations (`supabase/migrations/`).
The CLI is a dev dependency, so `npx supabase` works after `npm install`.

1. Create a project at https://supabase.com (or reuse your existing one).
2. Link this folder to it and apply the migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```
   - **New project:** run `npx supabase db push`.
   - **Existing project that already has the `tasks` / `user_settings` tables**
     (created from the old `schema.sql`): first tell the CLI the baseline is
     already there, then push only the new migrations:
     ```bash
     npx supabase migration repair --status applied 20260928000000
     npx supabase db push
     ```
     Make sure your old `schema.sql` columns (`category`, `scheduled_time`,
     Pomodoro/haptics settings) were already added before doing this.
3. Go to **Authentication → Sign In / Providers** and make sure **Anonymous
   sign-ins** is enabled (the app signs each device in anonymously — no
   login screen needed).
4. Go to **Settings → API Keys** and copy the **Project URL** (bare domain,
   no `/rest/v1/` suffix) and the **Publishable key** (`sb_publishable_...`,
   NOT the secret key — the secret key must never go into a mobile app).

## 2. Configure the app

```bash
cp .env.example .env
```

Edit `.env` and paste in your Supabase URL and publishable key exactly:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```
No quotes, no trailing slash on the URL, no duplicated variable names.

## 3. Tests

```bash
npm test            # Jest: shared domain logic and stats (runs in Europe/Rome time)
npm run typecheck   # TypeScript
npm run db:test     # pgTAP database tests — needs Docker and `npx supabase start`
cd supabase/functions && deno task test    # Edge Function + AI layer tests (needs Deno 2)
cd supabase/functions && deno task check   # type-check the Edge Function
```

## AI Brain Dump (backend)

Brain Dump turns messy text ("domani chiamare il veterinario, finish the
presentation before Friday, belki spora giderim") into task proposals. The AI
only *proposes*: its output is schema-validated, normalized with PaceTasks'
own rules (dates from the phone's today, durations from your history, timing
from your work hours), and tasks are only created through `create_task`.

```
app / Siri / Shortcuts → POST /functions/v1/brain-dump
  → quota → AIProvider.parseBrainDump (any vendor) → zod validation (1 retry)
  → normalizeBrainDump → review policy → brain_dump_sessions (proposal)
  → mode "auto" + auto-create on + nothing to review → commit_brain_dump → create_task
```

**Choose a model with the evaluation set** (30 English/Italian/Turkish/mixed
cases, anchored to Monday 2026-09-28). Needs [Deno 2](https://deno.com) and an API key:
```bash
cd supabase/functions
ANTHROPIC_API_KEY=... deno task eval --provider anthropic --model <model> --price-in <$/M in> --price-out <$/M out>
OPENAI_API_KEY=...    deno task eval --provider openai    --model <model> --price-in <$/M in> --price-out <$/M out>
```
It prints each case and a scorecard (cases passed, tasks kept in their original
language, field accuracy, retries, latency, cost per dump). Reports are saved
in `_eval/brainDump/results/` (git-ignored).

**Deploy:**
```bash
npx supabase db push                                  # brain_dump migration
npx supabase secrets set AI_PROVIDER=anthropic AI_MODEL_BRAIN_DUMP=<model> ANTHROPIC_API_KEY=<key>
npx supabase secrets set BRAIN_DUMP_DAILY_LIMIT=30    # optional, default 30 per user per day
npx supabase functions deploy brain-dump
```
Switching vendor or model later is only a `secrets set` — no code change or
redeploy. API keys live only in Supabase secrets, never in the app.

**Try it** with a signed-in user's access token (e.g. log `session.access_token` once in the app):
```bash
curl -X POST "$EXPO_PUBLIC_SUPABASE_URL/functions/v1/brain-dump" \
  -H "Authorization: Bearer <access_token>" -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text": "domani chiamare il veterinario e comprare lo shampoo", "timeZone": "Europe/Rome"}'
```
Request: `text` (≤2000 chars), `timeZone` (the phone's IANA zone), optional
`locale`, `channel` (`app` | `siri` | `shortcut`), `mode` (`propose` | `auto`).
Response: `sessionId`, `status`, `needsReview`, `reviewReasons`, `candidates`
(each with the exact `draft` that will be created, `issues`, `confidence`),
`unparsedFragments`, `createdTasks`. Errors are `{ error: { code, message, retryable } }`.

Privacy: raw brain dump text is deleted after 30 days by a nightly `pg_cron`
job; function logs never contain the text.

## 4. Install and run

Requires Node 18+ and the free **Expo Go** app on your phone (App Store /
Play Store). Expo Go tracks the current Expo SDK (57 as of this build) — if
Expo Go on your phone ever auto-updates past what this project targets,
see Troubleshooting below.

```bash
npm install
npx expo start -c
```

Scan the QR code shown in the terminal with your phone's camera (iOS) or the
Expo Go app (Android). The `-c` clears Metro's cache, which matters after
this update since dependencies changed (svg removed, linear-gradient and
haptics added).

To run in a simulator instead: press `i` (iOS, requires Xcode) or `a`
(Android, requires Android Studio) after `npx expo start`.

### Web demo (no Supabase needed)

```bash
npm run web:demo
```

Runs the app in the browser with `EXPO_PUBLIC_DEMO_MODE=1`: `src/lib/demo/`
replaces the Supabase client with in-memory tables seeded with six weeks of
history. Brain Dump runs the real `runBrainDump` service and review policy;
only the language model is swapped for a small rule-based parser
(`demoBrainDumpAI.ts`), so no AI key or network call is involved. Data resets
on reload. To export a static build: `EXPO_PUBLIC_DEMO_MODE=1 npx expo export --platform web`.

## 5. Publish to GitHub

From inside the `pacetasks` folder:

```bash
git init
git add .
git commit -m "Initial commit: PaceTasks"
gh repo create pacetasks --private --source=. --remote=origin --push
```

Use `--public` instead of `--private` if you want it visible on your GitHub
profile. `node_modules` and `.env` are already excluded via `.gitignore` —
your Supabase keys are never committed.

## Troubleshooting

- **"Project is incompatible with this version of Expo Go"** — Expo Go
  auto-updates itself on your phone to the newest Expo SDK. To self-fix:
  edit `package.json`, bump `"expo"` to `"~<new SDK>.0.0"`, delete
  `node_modules` and `package-lock.json`, run `npm install`, then run
  `npx expo install --fix` to auto-align every other dependency.
- **"[runtime not ready]" / syntax errors on load** — usually a stale cache.
  Run `npm install && npx expo start -c` (the `-c` clears Metro's cache).
- **"Invalid supabaseUrl" / env values not picking up** — env vars are only
  read when the dev server *starts*. After editing `.env`, fully stop the
  server (Ctrl+C) and run `npx expo start -c` again.
- **"Could not find the function public.create_task"** or a missing column
  such as `due_date` or `postponed_count` — the database is behind the app. Run
  `npx supabase db push` (see step 1).
- **Tasks added elsewhere don't appear live** — check that Realtime is enabled
  for the `tasks` table (Dashboard → Database → Publications →
  `supabase_realtime`); the task foundation migration adds it automatically.
- **Focus badge doesn't show on a task** — it only appears once a task has a
  fixed time set via the 4th quick-add pill ("No fixed time" by default). A
  task with no fixed time gets the range timer instead (tap its minutes pill).

## Notes

- Reminders use `expo-notifications` scheduled locally on-device.
- Haptics use `expo-haptics`; the background gradient uses
  `expo-linear-gradient` — both first-party Expo modules, no extra native
  setup needed beyond the usual `npm install`.
- Every screen reads/writes through `src/lib/tasksApi.ts` and
  `src/lib/settingsApi.ts`. Tasks are always created through the
  `public.create_task` database function, the single creation path that
  Brain Dump and Siri will also use. Schema changes go in a new file under
  `supabase/migrations/` plus the matching types in
  `supabase/functions/_shared/domain/task.ts`.
- Color accents live in `theme.colors` — add new ones there rather than
  hardcoding a hex value in a component.

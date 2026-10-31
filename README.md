# PaceTasks

> Tell me what I need to do. PaceTasks figures out how to fit it into my life.

PaceTasks is a task app for iPhone for people who work a fixed schedule and want
to capture personal tasks the moment they think of them, then get them done
before or after work. It plans around the time and energy you really have, and
you compete only with your own past pace.

- **App:** Expo SDK 57 (React Native 0.86, TypeScript)
- **Backend:** Supabase (Postgres with row-level security, Auth, Realtime, one Edge Function)
- **Status:** ready for the first TestFlight build; iPhone only for v1

## Contents

1. [What the app does](#what-the-app-does)
2. [Quick start](#quick-start)
3. [Set up Supabase](#set-up-supabase)
4. [Brain Dump backend](#brain-dump-backend)
5. [Tests](#tests)
6. [Web demo](#web-demo)
7. [Build for TestFlight and the App Store](#build-for-testflight-and-the-app-store)
8. [Privacy policy and support page](#privacy-policy-and-support-page)
9. [Project structure](#project-structure)
10. [Working together](#working-together)
11. [Troubleshooting](#troubleshooting)

## What the app does

### Today

- **Hero card** — an encouraging line taken from the real state of your day
  ("2 tasks take 5 minutes or less. One is a great start."), the totals, and
  one button: **Pick my next task**.
- **Pick my next task** — opens two helpers. Neither uses AI.
  - **Decide for me** shows a single task: a quick win while there is one, then
    whatever matters most.
    **Done** logs how long it took and offers the next one; **Not now** skips it.
  - **Fit my time** asks how much time (5 min to 1 hour) and energy (low, normal,
    high) you have, then lists the tasks that fit back to back.
- **Week strip** — this week at a glance, with a dot under each day that has
  tasks due.
- **Carried over** — when earlier tasks are still open, one slim row
  ("4 tasks carried over · Review") proposes where each should go: Today,
  Tomorrow, the Weekend or Someday. Change any of them, then apply.
- **Quick filters** — All, Quick wins, Due today. The filter button next to
  them groups the list by size, place, category or time of day.
- **Add a task** — the bar at the bottom opens a short sheet: one card with
  the name and a row of pills (**day**, **duration**, **time**, and a small
  options pill for part of the day, category and energy). Each pill opens its
  own panel under the card, one at a time. With the name still empty, **your
  usuals** sit underneath: tasks you have done before, one tap to add (with
  Undo). A name you have used before fills in its usual details.
- **When** — pick a day from the next seven, or open **Whole month** for any
  later date. Or choose no exact day: **Any day** (stays on Today until done),
  **This week** or **Next week** (a deadline on that week's Sunday). A task set
  for one exact later day stays out of Today until that day; a task with a
  deadline shows on Today right away, because it can be done any day before it.
- **Start time and reminder** — the time pill sets an hour (arrows in
  5-minute steps, or one tap: In 1 hour, 09:00, 12:30, 18:00, 20:30) and a
  nudge before it starts (Off, at start, 5, 10, 15, 30 minutes or 1 hour; 10
  minutes by default). The time also places the task before or after work, and
  turns on its Focus session. iOS asks for notification permission the first
  time a reminder is picked.
- **Brain Dump** — the microphone button. Type or dictate everything on your
  mind in English, Italian, Turkish or a mix; PaceTasks shows the tasks it
  understood before anything is added.

### Getting tasks done

- **Range timer** — tap a task's minutes pill to count down from its usual
  longest time; it turns green once you pass its usual shortest time.
- **Focus sessions** — a task with a fixed start time gets a **Focus** pill
  that opens a Pomodoro countdown. Finishing logs the real minutes.
- **Quick wins** — tasks at or under your limit (5 minutes by default) get a
  highlighted pill.
- **Weekly Reset** — a link at the foot of Today, shown when tasks need a
  decision (overdue, moved twice or more, or undated for two weeks). It walks
  through them one at a time.
- **Someday** — park a task from its menu to take it out of your daily lists
  without deleting it.
- **Day cleared card** — appears once nothing is left, with today's count,
  minutes and streak.

### Pace

- **Your pace** — done today, minutes today, current and best streak, best day,
  estimate accuracy, a 13-week heatmap and a per-day history.
- **My Pace** — plain sentences about your own history: the hours in which you
  finish most, your strongest weekday, whether tasks take longer than you
  estimate. It stays quiet until you have completed 10 tasks.

### Settings

- **Account (optional)** — the app works with no login. Creating an account
  asks for first name, last name and email, then for the code emailed
  to you: no password. On iPhone, **Continue with Apple** does the same in one tap. Your existing tasks stay. Email tips are a separate
  switch that starts off.
- **Look** — theme (Match phone, Light, Dark) and colour theme (Sage, Pastel
  Night, Sunny). Sage also lets you pick an accent. These are saved on the phone.
- **Reminders** — a **daily check-in** at the time you choose, sent only when
  tasks are still open and without a sound, and **task reminders**: the nudge
  picked on each task with a start time (one switch turns them all off). Both
  are scheduled on the phone and planned a few days ahead, so they stop by
  themselves if the app stays closed.
- **Work schedule, timer chime, haptics, Pomodoro length.**
- **Your data** — privacy policy, help and support, and **Delete account**
  (or **Delete my data** before sign-up), which erases everything on the server.

### Behind the scenes

- **New version prompt** — when the app opens (and when it comes back, at most
  every 6 hours), it asks Apple's public App Store lookup which version is
  live. If it's newer than the one installed, a prompt shows what's new with
  **Update now** (opens the App Store page) and **Later** (quiet for 3 days for
  that version; a newer one shows at once). It needs no setup: it follows each
  release as soon as Apple approves it. TestFlight builds ahead of the store,
  the web demo and Expo Go never see it.
- **Live sync** — changes made elsewhere appear immediately through Supabase
  Realtime, and the list reloads when the app returns to the foreground.
- **When a task reminder fires** — a task set for a later day is reminded on
  that day; one with no day, a deadline or overdue on the next time its hour
  comes (today, or tomorrow once today's moment has passed), never after a
  deadline that is still ahead. Done or parked tasks are never reminded. The
  rule lives in `@domain/reminders`.
- **"Today" comes from the phone** — its local calendar day, never the server's.

## Quick start

Requires Node 18+ and the free **Expo Go** app on your phone.

```bash
npm install
cp .env.example .env      # then fill in the two values below
npx expo start -c
```

`.env` holds your Supabase project URL and publishable key:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

No quotes, no trailing slash on the URL. Scan the QR code with your phone's
camera (iOS) or the Expo Go app (Android). To run in a simulator instead, press
`i` (iOS, needs Xcode) or `a` (Android, needs Android Studio).

No Supabase project yet? The [web demo](#web-demo) runs without one.

## Set up Supabase

The free tier is enough. The database is managed with Supabase CLI migrations
in `supabase/migrations/`; the CLI is a dev dependency, so `npx supabase` works
after `npm install`.

1. Create a project at https://supabase.com.
2. Link this folder to it and apply the migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   Run `npx supabase db push` again whenever you pull new migrations.
3. **Authentication → Sign In / Providers**: enable **Anonymous sign-ins**. The
   app signs each phone in anonymously, so there is no login wall.
4. **Settings → API Keys**: copy the **Project URL** and the **Publishable key**
   (`sb_publishable_...`) into `.env`. Never put the secret key in the app.

### Accounts (sign-up by email code)

1. **Authentication → Sign In / Providers → Email**: keep the Email provider
   and **Confirm email** on.
2. **Authentication → Emails → Templates**: PaceTasks asks for a code, so the
   code must be in the email. In both **Change Email Address** (sign-up) and
   **Magic Link** (sign-in), put `{{ .Token }}` in the body, for example
   `Your PaceTasks code: {{ .Token }}`. The default templates contain only a link.
   The emails PaceTasks uses are kept in `supabase/templates/` (`sign_up_code.html`
   and `sign_in_code.html`, each with its subject line on top): paste them in.
3. **Authentication → SMTP Settings**: Supabase's built-in sender is for testing
   only. Set a mail service before real users sign up.
4. **Authentication → Sign In / Providers → Email → Email OTP Length**: any
   value works (the app accepts 6 to 10 digits); 6 is the easiest to type.

### Sign in with Apple

Shown on iPhone only, under the email form. The app asks iOS for an Apple ID
token and Supabase verifies it; nothing is stored on the phone.

1. **Authentication → Sign In / Providers → Apple**: enable it and fill only
   **Client IDs** with `com.pacetasks.app,host.exp.Exponent`. The first is the
   app, the second is Expo Go (for testing; remove it before the App Store
   release). The secret key field stays empty: it is only for sign-in on the web.
2. **Authentication → Sign In / Providers → User Signups**: turn on **Allow
   manual linking**. It lets the Apple ID attach to the anonymous user the phone
   already has, which is what keeps the tasks made before signing up.

It works in Expo Go without an Apple Developer Program membership. A real build
needs the membership, with the **Sign in with Apple** capability on the app ID
(`app.json` already asks for it).

## Brain Dump backend

Brain Dump turns messy text ("domani chiamare il veterinario, finish the
presentation before Friday, belki spora giderim") into task proposals. Whatever
reads the text only *proposes*: the result is schema-validated, normalized with
PaceTasks' own rules (dates from the phone's today, durations from your
history), and tasks are created only through the `create_task` database function.

```
app → POST /functions/v1/brain-dump
  → quota → AIProvider.parseBrainDump → validation (1 retry)
  → normalizeBrainDump → review policy → brain_dump_sessions (proposal)
  → nothing to review and auto-create on → commit_brain_dump → create_task
```

**Deploy in free mode (no AI key):**

```bash
npx supabase secrets set AI_PROVIDER=rules
npx supabase functions deploy brain-dump
```

`AI_PROVIDER=rules` runs PaceTasks' own rule-based parser: no model, no cost,
and nothing leaves Supabase. It reads simple lists in English, Italian and
Turkish. It cannot judge meaning, so rambling text and dates like "the 5th" are
where a real model does better.

**Use an AI model instead:**

```bash
npx supabase secrets set AI_PROVIDER=anthropic AI_MODEL_BRAIN_DUMP=<model> ANTHROPIC_API_KEY=<key>
npx supabase secrets set BRAIN_DUMP_DAILY_LIMIT=30    # optional, default 30 per user per day
```

Switching between free mode, a vendor or a model is only a `secrets set`: no
code change or redeploy. API keys live only in Supabase secrets, never in the
app. Update the [privacy policy](#privacy-policy-and-support-page) *before*
moving off `rules`, because it says the text is not sent to an AI company.

**Compare models** with the evaluation set (30 English, Italian, Turkish and
mixed cases). Needs [Deno 2](https://deno.com) and an API key:

```bash
cd supabase/functions
deno task eval --provider rules
ANTHROPIC_API_KEY=... deno task eval --provider anthropic --model <model> --price-in <$/M in> --price-out <$/M out>
OPENAI_API_KEY=...    deno task eval --provider openai    --model <model> --price-in <$/M in> --price-out <$/M out>
```

**API.** Request: `text` (up to 2000 characters), `timeZone` (the phone's IANA
zone), optional `locale`, `channel` (`app` | `siri` | `shortcut`), `mode`
(`propose` | `auto`). Response: `sessionId`, `status`, `needsReview`,
`reviewReasons`, `candidates`, `unparsedFragments`, `createdTasks`. Errors are
`{ error: { code, message, retryable } }`.

**Privacy.** Raw Brain Dump text is erased after 30 days by a nightly `pg_cron`
job, and function logs never contain the text.

## Tests

```bash
npm test            # Jest: domain logic, reducers, copy, stats (pinned to Europe/Rome time)
npm run typecheck   # TypeScript
npm run db:test     # pgTAP database tests; needs Docker and `npx supabase start`
cd supabase/functions && deno task test    # Edge Function and AI layer tests (needs Deno 2)
cd supabase/functions && deno task check   # type-check the Edge Function
npm run e2e         # simulated journey through the web demo, filmed
npm run verify      # typecheck + Jest + the simulated journey, in one go
```

### Simulated journey

`npm run e2e` exports the [web demo](#web-demo), opens it in a headless browser
at iPhone size and plays one day as a person would: finish a task, add one,
"Decide for me", a Brain Dump in three languages, Pace, Settings and dark mode.
The clock is fixed to a Monday morning in Europe/Rome, so every run sees the
same day. It writes a film (`e2e/output/today-journey.webm`) and a screenshot
per step (`e2e/output/shots/`), and fails on a broken step or a console error.

First run on a new machine: `npx playwright install chromium`.

It runs against the demo backend, in a browser. What only a real iPhone has
(notifications, haptics, the keyboard, safe areas) is still checked by hand.

GitHub runs `typecheck`, `npm test` and the journey on every pull request and
on `main` (`.github/workflows/verify.yml`); the film and screenshots are
attached to the run as the `simulated-journey` artifact.

## Web demo

```bash
npm run web:demo
```

Runs the app in the browser with no Supabase project: `src/lib/demo/` replaces
the Supabase client with in-memory tables seeded with six weeks of history.
Brain Dump runs the real service with the rule-based parser. Data resets on
reload. To export a static build:

```bash
EXPO_PUBLIC_DEMO_MODE=1 npx expo export --platform web
```

## Build for TestFlight and the App Store

Builds run on Expo's servers (EAS), so no Xcode is needed. Needs the Apple
Developer Program membership and a free Expo account.

### One-time setup

The npm build scripts run EAS through `npx`, so no global install is needed.
For the one-off commands below, either install it (`npm install -g eas-cli`)
or prefix each with `npx eas-cli@latest` instead of `eas`.

```bash
eas login
eas init                       # links this folder to an Expo project (writes the project id)
# The app's Supabase address and publishable key, for builds made on EAS (.env is not uploaded):
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://<your-project-ref>.supabase.co --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value sb_publishable_... --visibility plaintext
```

`app.config.js` stops an EAS build at its first step when either value is
missing (or when demo mode is set), so a broken build never reaches a phone.

### Put the app on your iPhone (TestFlight)

```bash
npm run ios:testflight         # builds, then uploads to App Store Connect by itself
```

The first run asks you to sign in with your Apple ID and lets EAS create the
certificate, the profile and the App Store Connect app for `com.pacetasks.app`.
About 15–30 minutes later the build appears in **App Store Connect → TestFlight**.
Add yourself under **Internal Testing**, install the **TestFlight** app on the
phone and accept the invite. Internal builds need no review.

### Send it to friends

1. Publish the privacy policy first (next section): Apple asks for its link.
2. App Store Connect → TestFlight → **External Testing** → create a group, add
   the build, and fill in the test info (what to test, feedback email).
3. The first build goes through a short Beta App Review (usually under a day).
4. Turn on **Public Link** for the group and send the link. Friends install
   TestFlight, open the link, and get every new build automatically.

Each build expires after 90 days; `npm run ios:testflight` again replaces it.

### Accounts for testers

The app works without an account (every phone gets an anonymous session). For
friends to create one, Supabase needs a custom SMTP server: the built-in email
sender only delivers to members of the Supabase team. Set it in Supabase →
**Authentication → Emails → SMTP Settings**, then name the service in
`docs/privacy.html`.

### Notes

- `npm run ios:preview` builds the `preview` profile instead: it installs
  straight from a link, but only on phones registered with
  `eas device:create`. Repeat the two `eas env:create` lines with
  `--environment preview` to use it.
- The version shown in the store is `version` in `app.json`; raise it for each
  release (1.0.0 → 1.0.1 → 1.1.0). Build numbers are kept by EAS and go up by
  themselves. The new version prompt compares this version, so a release that
  keeps the same one is never offered to people.
- The app is iPhone-only for now (`supportsTablet: false`): no iPad layout has
  been designed, and Apple does not let iPad support be removed once shipped.
- The icon and splash images live in `assets/`. They are drawn by
  `design/icon/build_icon_svgs.py` and rendered by
  `design/icon/render_icon_pngs.py` (needs Python with Playwright).

### Store listing and screenshots

- `store.config.json` holds the App Store listing in English, Italian and
  Turkish: name, subtitle, promo text, description, keywords and the support
  and privacy links. `eas metadata:push` uploads it to App Store Connect.
  `storeListing.test.ts` keeps every field within Apple's character limits.
- `design/store/screenshots/<locale>/` holds five 1320x2868 screenshots per
  language (iPhone 6.9", the only size App Store Connect requires). They are
  built from the web demo by `design/store/build_store_screenshots.py`; its
  header has the three commands. Rebuild them when a screen changes.
- The interface is English-only in v1, so the Italian and Turkish listings say
  so and keep the feature names in English.

## Privacy policy and support page

`docs/` holds the public pages the app and the App Store listing link to:
`privacy.html`, `support.html` and a small `index.html`, served for free by
GitHub Pages.

1. The pages name Bilge Ozcanbaz as the developer and `pacetasks@bilgalog.dev`
   as the contact address (forwarded by Cloudflare Email Routing); update both
   files if either changes.
2. On GitHub: **Settings → Pages → Deploy from a branch**, branch `main`,
   folder `/docs`.
3. The pages appear at `https://bilgaaaaa.github.io/pacetasks/`. The app's links
   (`src/lib/links.ts`) already point there.

When what the app stores changes (a new table, an AI provider, analytics),
update `docs/privacy.html` in the same pull request.

## Project structure

```
App.tsx                    Root: theme provider, session, the three tabs
app.json, eas.json         Expo config and EAS build profiles
app.config.js              stops an EAS build that has no Supabase settings
store.config.json          App Store listing (EN, IT, TR) for `eas metadata:push`
assets/                    App icon, splash images, notification icon, favicon
design/icon/               Scripts and SVG sources for the icon set
design/store/              App Store screenshots and the script that builds them
docs/                      Public pages (privacy policy, support) for GitHub Pages
src/screens/               TaskListScreen (Today), StatsScreen (Pace), SettingsScreen
src/components/            Presentational pieces: sheets, cards, rows, buttons
src/hooks/                 One hook per feature; all data access for a screen goes through these
src/lib/                   Supabase client and API files, pure logic, UI copy, theme
src/lib/demo/              In-memory backend for the web demo
e2e/                       Simulated journey: `harness.mjs` (browser, film, steps) and the journeys
supabase/migrations/       Database schema, security policies and functions
supabase/templates/        The sign-up and sign-in emails, pasted into the Supabase dashboard
supabase/tests/database/   pgTAP tests for the database
supabase/functions/_shared/domain/   Pure TypeScript shared by the app and Edge Functions (`@domain/...`)
supabase/functions/_shared/server/   Deno-only server code: AI layer, Brain Dump service
supabase/functions/brain-dump/       The Brain Dump Edge Function
supabase/functions/_eval/            AI evaluation set and runner (never deployed)
```

How the code is organised:

- **Screens stay dumb.** Fetching and saving live in `src/hooks/` and the
  `src/lib/*Api.ts` files, which are the only callers of Supabase.
- **Rules are pure and tested.** What Today shows, the ranking behind "Pick my
  next task", rollover and Weekly Reset live in `@domain/`. Each sheet's steps
  live in a pure reducer (`src/lib/*State.ts`).
- **Wording is separate.** User-facing text lives in `src/lib/*Copy.ts`, so it
  can be translated without touching logic.
- **One creation path.** Tasks are created only through the `create_task`
  database function, which Brain Dump shares and Siri will too.
- **Colours come from the theme.** `src/lib/theme.ts` holds every colour theme
  in light and dark; components read it through `useTheme()` and `makeStyles()`
  and never hardcode a colour.
- **Schema changes** go in a new file under `supabase/migrations/`, with the
  matching types in `supabase/functions/_shared/domain/task.ts`. A new table
  with user data must reference `auth.users (id) on delete cascade`, so
  deleting an account removes it.

The full conventions are in `.cursor/rules/pacetasks.mdc`.

## Working together

- `main` is the version that gets built and released.
- `ui-design-w/Meltem` is the long-lived design branch. Design work happens
  there and reaches `main` through a pull request; the branch stays after each
  merge. Pull `main` into it before starting new work, so it never falls behind.
- Other changes use a short-lived branch (`feature/...`, `fix/...`) that is
  deleted once its pull request is merged.
- Before opening a pull request, run `npm test` and `npm run typecheck`.

## Troubleshooting

- **"Project is incompatible with this version of Expo Go"** — Expo Go updates
  itself to the newest Expo SDK. Bump `"expo"` in `package.json` to the new SDK,
  delete `node_modules` and `package-lock.json`, run `npm install`, then
  `npx expo install --fix`.
- **"[runtime not ready]" or syntax errors on load** — usually a stale cache.
  Run `npm install && npx expo start -c`.
- **"Invalid supabaseUrl", or `.env` values not picked up** — env vars are read
  only when the dev server starts. Stop it and run `npx expo start -c` again.
- **"Could not find the function public.create_task"** (or `delete_account`),
  or a missing column such as `due_date` — the database is behind the app. Run
  `npx supabase db push`.
- **Brain Dump fails on the phone** — the Edge Function is not deployed or has
  no provider set. See [Brain Dump backend](#brain-dump-backend).
- **No sign-in code arrives** — check the email templates and SMTP settings in
  [Accounts](#accounts-sign-up-by-email-code).
- **Tasks added elsewhere don't appear live** — check that Realtime is enabled
  for the `tasks` table (Dashboard → Database → Publications →
  `supabase_realtime`).
- **EAS build fails at "Read app config" with "Missing EXPO_PUBLIC_SUPABASE_…"**
  — the EAS environment for that profile has no Supabase values. Run the two
  `eas env:create` lines from [Build for TestFlight](#build-for-testflight-and-the-app-store)
  with that profile's `--environment`.
- **The privacy or support link opens "not found"** — GitHub Pages is not
  enabled yet. See [Privacy policy and support page](#privacy-policy-and-support-page).

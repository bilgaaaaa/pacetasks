# PaceTasks

A mobile task app for people who work a fixed schedule (e.g. 8 hours in an
office) and want to capture personal tasks the instant they think of them,
then knock them out before or after work — competing only against their own
past pace, not anyone else's.

Built with Expo (React Native + TypeScript) and Supabase.

## Features

- **Quick add** — type a task and hit Add. No required fields beyond the title.
- **Minute estimate** — tag each task with how long you think it'll take (3/5/15/30/60m presets).
- **Before work / After work / Anytime** — sort tasks around your work schedule.
- **Work schedule** — set your work start/end hour once in Settings.
- **One daily reminder** — a single configurable local notification, no complicated setup.
- **Compete with yourself** — a stats tab showing your current streak, best streak,
  best day, and how close your time estimates land versus what tasks actually took.

## Project structure

```
App.tsx                  Root component, tab navigation, session bootstrap
src/screens/              TaskListScreen, SettingsScreen, StatsScreen
src/components/           QuickAddBar, TaskItem, Stepper, StatCard
src/hooks/                useSession, useTasks, useSettings
src/lib/                  supabase client, tasksApi, settingsApi, notifications, stats, theme, types
supabase/schema.sql        Database schema + row-level security policies
```

## 1. Set up Supabase (free tier is enough)

1. Create a project at https://supabase.com.
2. In the dashboard, go to **SQL Editor** → **New query**, paste the contents
   of `supabase/schema.sql`, and run it. This creates the `tasks` and
   `user_settings` tables with row-level security so each device's data stays
   private.
3. Go to **Authentication → Sign In / Providers** and make sure **Anonymous
   sign-ins** is enabled (the app signs each device in anonymously — no
   login screen needed).
4. Go to **Settings → API** and copy the **Project URL** and **anon public** key.

## 2. Configure the app

```bash
cp .env.example .env
```

Edit `.env` and paste in your Supabase URL and anon key.

## 3. Install and run

Requires Node 18+ and the free **Expo Go** app on your phone (App Store /
Play Store).

```bash
npm install
npx expo start
```

Scan the QR code shown in the terminal with your phone's camera (iOS) or the
Expo Go app (Android). The app opens live on your device — no build step, no
Xcode/Android Studio required for day-to-day use.

To later build a real installable binary (TestFlight / Play Store), use
[EAS Build](https://docs.expo.dev/build/introduction/) — not needed for
personal use via Expo Go.

## 4. Publish to GitHub

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

## Notes

- Reminders use `expo-notifications` scheduled locally on-device; they fire
  even if the app isn't open, as long as the phone has been opened recently
  enough for iOS/Android to keep the schedule (standard OS behavior for local
  notifications).
- Every screen reads/writes through `src/lib/tasksApi.ts` and
  `src/lib/settingsApi.ts` — if you change the schema, that's the only place
  to update.

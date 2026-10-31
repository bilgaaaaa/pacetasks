// When to offer an App Store update. Pure and clock-free, so the rule is the
// same in the app and the tests: a newer store version is offered once, and
// "Later" keeps that version quiet for a few days. A newer one is offered at once.

// How long "Later" keeps the same version from being offered again.
export const UPDATE_SNOOZE_DAYS = 3;

// The least time between two store checks while the app stays open.
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export interface StoreRelease {
  version: string; // marketing version on the App Store, e.g. "1.2.0"
  storeUrl: string; // the app's App Store page
  releaseNotes: string | null; // "What's New" text of that version
}

export interface UpdateSnooze {
  version: string; // the version the user said "Later" to
  until: number; // epoch ms after which it may be offered again
}

// "1.10.0" → [1, 10, 0]; null for anything that is not dotted whole numbers.
function parseVersion(version: string): number[] | null {
  const trimmed = version.trim();
  if (!/^\d+(\.\d+)*$/.test(trimmed)) return null;
  return trimmed.split(".").map(Number);
}

// Negative when a < b, 0 when equal, positive when a > b; missing parts count as 0 ("1.2" = "1.2.0").
// null when either version can't be read, so a malformed store answer never triggers a prompt.
export function compareVersions(a: string, b: string): number | null {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return null;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// True when the store has a newer version than the one installed and the user
// hasn't put that exact version off with "Later".
export function shouldOfferUpdate(
  installedVersion: string,
  release: StoreRelease,
  snooze: UpdateSnooze | null,
  now: number
): boolean {
  const comparison = compareVersions(release.version, installedVersion);
  if (comparison === null || comparison <= 0) return false;
  const snoozed = snooze !== null && snooze.version === release.version && now < snooze.until;
  return !snoozed;
}

// The snooze stored when the user taps "Later".
export function snoozeFor(release: StoreRelease, now: number): UpdateSnooze {
  return { version: release.version, until: now + UPDATE_SNOOZE_DAYS * 24 * 60 * 60 * 1000 };
}

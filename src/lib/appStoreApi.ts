import { z } from "zod";
import { StoreRelease } from "./appUpdate";

// Reads what the App Store currently offers for this app through Apple's public
// lookup service: no key, no backend, and it follows a release by itself once
// Apple approves it. It answers per storefront, so the phone's region is asked first.

const LOOKUP_URL = "https://itunes.apple.com/lookup";
const REQUEST_TIMEOUT_MS = 8000;

const lookupSchema = z.object({
  resultCount: z.number(),
  results: z.array(
    z.object({
      version: z.string(),
      trackViewUrl: z.string().url(),
      releaseNotes: z.string().optional(),
    })
  ),
});

// "it-IT" → "it"; null when the locale names no region.
function storefrontOf(locale: string | null): string | null {
  const region = locale?.split(/[-_]/)[1];
  return region && /^[A-Za-z]{2}$/.test(region) ? region.toLowerCase() : null;
}

async function lookup(bundleId: string, country: string | null): Promise<StoreRelease | null> {
  const params = new URLSearchParams({ bundleId, ...(country ? { country } : {}) });
  // A fresh answer every time: Apple's CDN may otherwise hand back yesterday's version.
  params.set("_", String(Date.now()));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${LOOKUP_URL}?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error(`App Store lookup answered ${response.status}`);
    const parsed = lookupSchema.parse(await response.json());
    const first = parsed.results[0];
    if (!first) return null;
    return { version: first.version, storeUrl: first.trackViewUrl, releaseNotes: first.releaseNotes?.trim() || null };
  } finally {
    clearTimeout(timer);
  }
}

// The app's current App Store release, or null while it isn't on the store
// (before launch, or not sold in this region). Network problems throw.
export async function fetchStoreRelease(bundleId: string, locale: string | null): Promise<StoreRelease | null> {
  const country = storefrontOf(locale);
  const release = await lookup(bundleId, country);
  if (release || !country) return release;
  return lookup(bundleId, null); // the US storefront, Apple's default
}

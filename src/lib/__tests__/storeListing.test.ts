import { readFileSync } from "fs";
import { join } from "path";
import { PRIVACY_POLICY_URL, SITE_URL, SUPPORT_URL } from "../links";

// App Store Connect rejects a listing field that is over its limit, so the
// limits are checked here instead of at upload time.
const APPLE_LIMITS = { title: 30, subtitle: 30, promoText: 170, keywords: 100, description: 4000 };
const STORE_LOCALES = ["en-US", "it", "tr"];

type StoreListing = {
  title: string;
  subtitle: string;
  promoText: string;
  description: string;
  keywords: string[];
  marketingUrl: string;
  supportUrl: string;
  privacyPolicyUrl: string;
};

const storeConfig = JSON.parse(readFileSync(join(__dirname, "../../../store.config.json"), "utf8"));
const listings: Record<string, StoreListing> = storeConfig.apple.info;

describe("store listing", () => {
  it("covers English, Italian and Turkish", () => {
    expect(Object.keys(listings).sort()).toEqual([...STORE_LOCALES].sort());
  });

  it.each(STORE_LOCALES)("keeps every %s field within Apple's limits", (locale) => {
    const listing = listings[locale];
    expect(listing.title.length).toBeLessThanOrEqual(APPLE_LIMITS.title);
    expect(listing.subtitle.length).toBeLessThanOrEqual(APPLE_LIMITS.subtitle);
    expect(listing.promoText.length).toBeLessThanOrEqual(APPLE_LIMITS.promoText);
    expect(listing.description.length).toBeLessThanOrEqual(APPLE_LIMITS.description);
    // Apple counts the keywords as one comma-separated string.
    expect(listing.keywords.join(",").length).toBeLessThanOrEqual(APPLE_LIMITS.keywords);
  });

  // A first version cannot carry "What's New" text; add releaseNotes from the first update on.
  it.each(STORE_LOCALES)("does not repeat a %s keyword", (locale) => {
    const keywords = listings[locale].keywords.map((keyword) => keyword.toLowerCase());
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  it.each(STORE_LOCALES)("points %s at the same pages the app links to", (locale) => {
    expect(listings[locale].marketingUrl).toBe(`${SITE_URL}/`);
    expect(listings[locale].supportUrl).toBe(SUPPORT_URL);
    expect(listings[locale].privacyPolicyUrl).toBe(PRIVACY_POLICY_URL);
  });
});

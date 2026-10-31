import { compareVersions, shouldOfferUpdate, snoozeFor, StoreRelease, UPDATE_SNOOZE_DAYS } from "../appUpdate";

const NOW = Date.UTC(2026, 9, 31, 18, 0);
const DAY = 24 * 60 * 60 * 1000;
const release = (version: string): StoreRelease => ({
  version,
  storeUrl: "https://apps.apple.com/app/id1",
  releaseNotes: null,
});

describe("compareVersions", () => {
  it.each([
    ["1.0.1", "1.0.0", 1],
    ["1.0.0", "1.0.1", -1],
    ["1.10.0", "1.9.9", 1],
    ["1.2", "1.2.0", 0],
    ["2", "1.99.99", 1],
  ])("%s vs %s", (a, b, sign) => {
    expect(Math.sign(compareVersions(a, b)!)).toBe(sign);
  });

  it("refuses versions it can't read", () => {
    expect(compareVersions("1.0.0-beta", "1.0.0")).toBeNull();
    expect(compareVersions("", "1.0.0")).toBeNull();
  });
});

describe("shouldOfferUpdate", () => {
  it("offers a newer store version", () => {
    expect(shouldOfferUpdate("1.0.0", release("1.0.1"), null, NOW)).toBe(true);
  });

  it("stays quiet when the phone is up to date, ahead (TestFlight), or the store answer is odd", () => {
    expect(shouldOfferUpdate("1.0.1", release("1.0.1"), null, NOW)).toBe(false);
    expect(shouldOfferUpdate("1.1.0", release("1.0.1"), null, NOW)).toBe(false);
    expect(shouldOfferUpdate("1.0.0", release("next"), null, NOW)).toBe(false);
  });

  it("keeps a version put off with Later quiet until the snooze ends", () => {
    const snooze = snoozeFor(release("1.0.1"), NOW);
    expect(snooze.until).toBe(NOW + UPDATE_SNOOZE_DAYS * DAY);
    expect(shouldOfferUpdate("1.0.0", release("1.0.1"), snooze, NOW + DAY)).toBe(false);
    expect(shouldOfferUpdate("1.0.0", release("1.0.1"), snooze, snooze.until)).toBe(true);
  });

  it("offers an even newer version at once, whatever was snoozed", () => {
    const snooze = snoozeFor(release("1.0.1"), NOW);
    expect(shouldOfferUpdate("1.0.0", release("1.0.2"), snooze, NOW + DAY)).toBe(true);
  });
});

import {
  effectiveProStatus,
  FREE_STATUS,
  freeTrialDays,
  OFFLINE_GRACE_MS,
  planIdOf,
  ProStatus,
  sortPlans,
} from "../pro";

const NOW = Date.UTC(2026, 10, 8, 21, 0);
const DAY = 24 * 60 * 60 * 1000;
const monthly: ProStatus = { active: true, lifetime: false, expiresAt: NOW + 10 * DAY };
const lifetime: ProStatus = { active: true, lifetime: true, expiresAt: null };

describe("effectiveProStatus", () => {
  it("follows the store whenever it answered", () => {
    expect(effectiveProStatus(FREE_STATUS, monthly, NOW)).toEqual(FREE_STATUS);
    expect(effectiveProStatus(monthly, null, NOW)).toEqual(monthly);
  });

  it("keeps a saved subscription while offline, a few days past its renewal", () => {
    const lapsed = { ...monthly, expiresAt: NOW - DAY };
    expect(effectiveProStatus(null, lapsed, NOW)).toEqual(lapsed);
    expect(effectiveProStatus(null, lapsed, NOW - DAY + OFFLINE_GRACE_MS + 1)).toEqual(FREE_STATUS);
  });

  it("never drops a saved lifetime purchase", () => {
    expect(effectiveProStatus(null, lifetime, NOW + 1000 * DAY)).toEqual(lifetime);
  });

  it("is free with nothing saved", () => {
    expect(effectiveProStatus(null, null, NOW)).toEqual(FREE_STATUS);
    expect(effectiveProStatus(null, FREE_STATUS, NOW)).toEqual(FREE_STATUS);
  });
});

describe("planIdOf", () => {
  it("knows the three plans and ignores other products", () => {
    expect(planIdOf("pro_yearly")).toBe("pro_yearly");
    expect(planIdOf("pro_weekly")).toBeNull();
  });
});

describe("freeTrialDays", () => {
  it("reads a free intro offer as a trial", () => {
    expect(freeTrialDays({ price: 0, periodUnit: "DAY", periodNumberOfUnits: 7, cycles: 1 })).toBe(7);
    expect(freeTrialDays({ price: 0, periodUnit: "WEEK", periodNumberOfUnits: 1, cycles: 1 })).toBe(7);
  });

  it("is not a trial when the intro costs money or is missing", () => {
    expect(freeTrialDays({ price: 0.99, periodUnit: "MONTH", periodNumberOfUnits: 1, cycles: 1 })).toBeNull();
    expect(freeTrialDays(null)).toBeNull();
  });
});

describe("sortPlans", () => {
  it("shows monthly, yearly, then lifetime", () => {
    const plans = sortPlans([
      { id: "pro_lifetime", price: "€39.99", trialDays: null },
      { id: "pro_monthly", price: "€2.99", trialDays: null },
      { id: "pro_yearly", price: "€19.99", trialDays: 7 },
    ]);
    expect(plans.map((plan) => plan.id)).toEqual(["pro_monthly", "pro_yearly", "pro_lifetime"]);
  });
});

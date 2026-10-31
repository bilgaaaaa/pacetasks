import { isEntitlementActive, PRO_PRODUCT_IDS } from "@domain/pro";
import type { ProEntitlement } from "@domain/pro";
import {
  planPriceLabel,
  proFeatures,
  proFreeCardSubtitle,
  proStatusLine,
  purchaseButtonLabel,
  purchaseFinePrint,
  savingsBadge,
} from "../proCopy";
import { buildProPlans, freeTrialDays, yearlySavingsPercent } from "../proPlans";
import type { StoreProductInfo } from "../proPlans";
import { entitlementFromCustomerInfo } from "../proStoreMapping";

const MONTHLY: StoreProductInfo = {
  productId: PRO_PRODUCT_IDS.monthly,
  price: 3.99,
  priceString: "€3.99",
  pricePerMonthString: "€3.99",
  introOffer: { price: 0, unit: "WEEK", count: 1 },
};
const YEARLY: StoreProductInfo = {
  productId: PRO_PRODUCT_IDS.yearly,
  price: 29.99,
  priceString: "€29.99",
  pricePerMonthString: "€2.49",
  introOffer: { price: 0, unit: "DAY", count: 7 },
};
const BOTH_ELIGIBLE = new Set([MONTHLY.productId, YEARLY.productId]);

describe("buildProPlans", () => {
  it("puts yearly first with its savings, monthly price and trial", () => {
    expect(buildProPlans([MONTHLY, YEARLY], BOTH_ELIGIBLE)).toEqual([
      {
        id: "yearly",
        productId: YEARLY.productId,
        priceString: "€29.99",
        perMonthString: "€2.49",
        savingsPercent: 37,
        trialDays: 7,
      },
      {
        id: "monthly",
        productId: MONTHLY.productId,
        priceString: "€3.99",
        perMonthString: null,
        savingsPercent: null,
        trialDays: 7,
      },
    ]);
  });

  it("hides the trial from users who already had it and skips unknown products", () => {
    const plans = buildProPlans([YEARLY, { ...MONTHLY, productId: "something_else" }], new Set());
    expect(plans.map((plan) => [plan.id, plan.trialDays, plan.savingsPercent])).toEqual([["yearly", null, null]]);
  });
});

describe("trial and savings math", () => {
  it("counts only free intro offers as trials", () => {
    expect(freeTrialDays(MONTHLY)).toBe(7);
    expect(freeTrialDays({ ...MONTHLY, introOffer: { price: 0.99, unit: "MONTH", count: 1 } })).toBeNull();
    expect(freeTrialDays({ ...MONTHLY, introOffer: null })).toBeNull();
  });

  it("never claims a saving that isn't there", () => {
    expect(yearlySavingsPercent(3.99, 29.99)).toBe(37);
    expect(yearlySavingsPercent(2.5, 30)).toBeNull();
    expect(yearlySavingsPercent(0, 30)).toBeNull();
  });
});

describe("paywall copy", () => {
  const [yearly, monthly] = buildProPlans([MONTHLY, YEARLY], BOTH_ELIGIBLE);

  it("names the trial on the button and its terms next to it", () => {
    expect(purchaseButtonLabel(yearly)).toBe("Start my 7-day free trial");
    expect(purchaseFinePrint(yearly)).toMatch(/^Free for 7 days, then €29\.99 a year\. Renews automatically\./);
    expect(purchaseButtonLabel({ ...monthly, trialDays: null })).toBe("Subscribe");
    expect(purchaseFinePrint({ ...monthly, trialDays: null })).toMatch(/^€3\.99 a month, renewed automatically\./);
    expect(purchaseFinePrint(null)).toBe("");
  });

  it("labels prices and savings", () => {
    expect(planPriceLabel(yearly)).toBe("€29.99 / year");
    expect(savingsBadge(yearly)).toBe("Save 37%");
    expect(savingsBadge(monthly)).toBeNull();
  });

  it("lists the AI feature only when the server offers it", () => {
    expect(proFeatures(false).map((f) => f.title)).not.toContain("Smarter Brain Dump");
    expect(proFeatures(true).map((f) => f.title)).toContain("Smarter Brain Dump");
  });

  it("mentions the free days only to users who can still take them", () => {
    expect(proFreeCardSubtitle(7)).toBe("Add tasks and hear your day with Siri. The first 7 days are free.");
    expect(proFreeCardSubtitle(null)).toBe("Add tasks and hear your day with Siri.");
  });
});

describe("proStatusLine", () => {
  const NOW = new Date("2026-11-01T10:00:00Z");
  const trial: ProEntitlement = {
    productId: PRO_PRODUCT_IDS.yearly,
    periodType: "trial",
    expiresAt: "2026-11-08T10:00:00Z",
    willRenew: true,
  };

  it("tells trial users how long is left and what happens next", () => {
    expect(proStatusLine(trial, NOW)).toBe("Free trial · 7 days left, renews on 8 November");
    expect(proStatusLine({ ...trial, willRenew: false }, NOW)).toBe("Free trial · ends on 8 November");
  });

  it("tells subscribers when it renews or ends", () => {
    expect(proStatusLine({ ...trial, periodType: "normal" }, NOW)).toBe("Renews on 8 November");
    expect(proStatusLine({ ...trial, periodType: "normal", willRenew: false }, NOW)).toBe("Ends on 8 November");
    expect(proStatusLine(null, NOW)).toBe("Pro is on.");
  });
});

describe("entitlements", () => {
  it("reads RevenueCat's active pro entitlement", () => {
    const info = {
      entitlements: {
        all: {},
        active: {
          pro: {
            productIdentifier: PRO_PRODUCT_IDS.monthly,
            periodType: "TRIAL",
            expirationDate: "2026-11-08T10:00:00Z",
            willRenew: true,
          },
        },
      },
    } as any;
    expect(entitlementFromCustomerInfo(info)).toEqual({
      productId: PRO_PRODUCT_IDS.monthly,
      periodType: "trial",
      expiresAt: "2026-11-08T10:00:00Z",
      willRenew: true,
    });
    expect(entitlementFromCustomerInfo({ entitlements: { all: {}, active: {} } } as any)).toBeNull();
  });

  it("is active until it expires, or forever without an expiry", () => {
    const entitlement: ProEntitlement = { productId: "x", periodType: "normal", expiresAt: "2026-11-01T10:00:00Z", willRenew: true };
    expect(isEntitlementActive(entitlement, new Date("2026-11-01T09:59:59Z"))).toBe(true);
    expect(isEntitlementActive(entitlement, new Date("2026-11-01T10:00:00Z"))).toBe(false);
    expect(isEntitlementActive({ ...entitlement, expiresAt: null }, new Date("2099-01-01T00:00:00Z"))).toBe(true);
    expect(isEntitlementActive(null, new Date())).toBe(false);
  });
});

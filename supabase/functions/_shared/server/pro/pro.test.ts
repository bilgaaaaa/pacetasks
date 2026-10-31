import assert from "node:assert/strict";
import type { ProEntitlement, ProStatus } from "../../domain/pro.ts";
import { fakeFetch } from "../testing/fakeFetch.ts";
import { affectedUserIds, handleProSyncHttp, handleRevenueCatWebhookHttp } from "./proHttp.ts";
import type { ProEntitlementStore } from "./proEntitlementStore.ts";
import { createRevenueCatClient, RevenueCatError } from "./revenueCatClient.ts";
import type { RevenueCatClient } from "./revenueCatClient.ts";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER_USER = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-11-01T10:00:00Z");

const TRIAL: ProEntitlement = {
  productId: "pacetasks_pro_yearly",
  periodType: "trial",
  expiresAt: "2026-11-08T10:00:00Z",
  willRenew: true,
};

// A RevenueCat subscriber as GET /v1/subscribers returns it, trimmed to what PaceTasks reads.
function subscriber(entitlements: Record<string, unknown>, subscriptions: Record<string, unknown> = {}) {
  return { request_date: NOW.toISOString(), subscriber: { entitlements, subscriptions, original_app_user_id: USER } };
}

class MemoryStore implements ProEntitlementStore {
  rows = new Map<string, ProEntitlement>();
  read(userId: string) {
    return Promise.resolve(this.rows.get(userId) ?? null);
  }
  save(userId: string, entitlement: ProEntitlement | null) {
    if (entitlement) this.rows.set(userId, entitlement);
    else this.rows.delete(userId);
    return Promise.resolve();
  }
}

function scriptedRevenueCat(byUser: Record<string, ProEntitlement | null | Error>): RevenueCatClient & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    fetchProEntitlement(appUserId) {
      asked.push(appUserId);
      const answer = byUser[appUserId] ?? null;
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  };
}

function post(url: string, body: unknown, headers: Record<string, string>): Request {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
}

Deno.test("revenueCat: reads the pro entitlement, its trial and whether it renews", async () => {
  const { fetchFn, calls } = fakeFetch([
    {
      status: 200,
      body: subscriber(
        { pro: { expires_date: TRIAL.expiresAt, product_identifier: "pacetasks_pro_yearly", purchase_date: "2026-11-01T10:00:00Z" } },
        { pacetasks_pro_yearly: { period_type: "trial", unsubscribe_detected_at: null, store: "app_store" } }
      ),
    },
  ]);
  const entitlement = await createRevenueCatClient("sk_test", fetchFn).fetchProEntitlement(USER);
  assert.deepEqual(entitlement, TRIAL);
  assert.equal(calls[0].url, `https://api.revenuecat.com/v1/subscribers/${USER}`);
  assert.equal(calls[0].headers.authorization, "Bearer sk_test");
});

Deno.test("revenueCat: a cancelled plan still counts until it ends, and no entitlement is null", async () => {
  const { fetchFn } = fakeFetch([
    {
      status: 200,
      body: subscriber(
        { pro: { expires_date: TRIAL.expiresAt, product_identifier: "pacetasks_pro_monthly" } },
        { pacetasks_pro_monthly: { period_type: "normal", unsubscribe_detected_at: "2026-11-02T08:00:00Z" } }
      ),
    },
    { status: 200, body: subscriber({}) },
  ]);
  const client = createRevenueCatClient("sk_test", fetchFn);
  assert.deepEqual(await client.fetchProEntitlement(USER), {
    productId: "pacetasks_pro_monthly",
    periodType: "normal",
    expiresAt: TRIAL.expiresAt,
    willRenew: false,
  });
  assert.equal(await client.fetchProEntitlement(USER), null);
});

Deno.test("revenueCat: errors and odd answers become RevenueCatError", async () => {
  const { fetchFn } = fakeFetch([{ status: 500, body: "boom" }, { status: 200, body: { nope: true } }]);
  const client = createRevenueCatClient("sk_test", fetchFn);
  await assert.rejects(client.fetchProEntitlement(USER), RevenueCatError);
  await assert.rejects(client.fetchProEntitlement(USER), RevenueCatError);
  await assert.rejects(client.fetchProEntitlement(USER), RevenueCatError); // network down: the queue is empty
});

Deno.test("pro-sync: stores the caller's state and reports it with the AI flag", async () => {
  const store = new MemoryStore();
  const response = await handleProSyncHttp(post("http://localhost/pro-sync", {}, { authorization: "Bearer jwt" }), {
    store,
    revenueCat: scriptedRevenueCat({ [USER]: TRIAL }),
    authenticate: () => Promise.resolve(USER),
    aiBrainDump: () => false,
    now: () => NOW,
  });
  const status = (await response.json()) as ProStatus;
  assert.equal(response.status, 200);
  assert.deepEqual(status, { isPro: true, entitlement: TRIAL, aiBrainDump: false });
  assert.deepEqual(store.rows.get(USER), TRIAL);
});

Deno.test("pro-sync: an expired plan is not Pro; without RevenueCat the stored row is used", async () => {
  const store = new MemoryStore();
  store.rows.set(USER, { ...TRIAL, expiresAt: "2026-10-01T00:00:00Z" });
  const response = await handleProSyncHttp(post("http://localhost/pro-sync", {}, { authorization: "Bearer jwt" }), {
    store,
    revenueCat: null,
    authenticate: () => Promise.resolve(USER),
    aiBrainDump: () => true,
    now: () => NOW,
  });
  const status = (await response.json()) as ProStatus;
  assert.equal(status.isPro, false);
  assert.equal(status.aiBrainDump, true);
});

Deno.test("pro-sync: needs a signed-in caller", async () => {
  const response = await handleProSyncHttp(post("http://localhost/pro-sync", {}, {}), {
    store: new MemoryStore(),
    revenueCat: null,
    authenticate: () => Promise.resolve(null),
    aiBrainDump: () => false,
    now: () => NOW,
  });
  assert.equal(response.status, 401);
});

Deno.test("webhook: rejects a wrong secret and re-syncs the user on a right one", async () => {
  const store = new MemoryStore();
  const revenueCat = scriptedRevenueCat({ [USER]: TRIAL });
  const deps = { store, revenueCat, expectedAuthorization: "Bearer hook-secret" };
  const event = { event: { id: "evt_1", type: "INITIAL_PURCHASE", app_user_id: USER } };

  const wrong = await handleRevenueCatWebhookHttp(post("http://localhost/hook", event, { authorization: "Bearer nope" }), deps);
  assert.equal(wrong.status, 401);
  assert.equal(revenueCat.asked.length, 0);

  const right = await handleRevenueCatWebhookHttp(post("http://localhost/hook", event, { authorization: "Bearer hook-secret" }), deps);
  assert.equal(right.status, 200);
  assert.deepEqual(store.rows.get(USER), TRIAL);
});

Deno.test("webhook: an expiry removes Pro, and a failed user asks RevenueCat to retry", async () => {
  const store = new MemoryStore();
  store.rows.set(USER, TRIAL);
  const ok = await handleRevenueCatWebhookHttp(
    post("http://localhost/hook", { event: { type: "EXPIRATION", app_user_id: USER } }, { authorization: "s" }),
    { store, revenueCat: scriptedRevenueCat({ [USER]: null }), expectedAuthorization: "s" }
  );
  assert.equal(ok.status, 200);
  assert.equal(store.rows.has(USER), false);

  const failed = await handleRevenueCatWebhookHttp(
    post("http://localhost/hook", { event: { type: "RENEWAL", app_user_id: USER } }, { authorization: "s" }),
    { store, revenueCat: scriptedRevenueCat({ [USER]: new RevenueCatError("down", 503) }), expectedAuthorization: "s" }
  );
  assert.equal(failed.status, 500);
});

Deno.test("webhook: refuses everything until its secret is configured", async () => {
  const response = await handleRevenueCatWebhookHttp(
    post("http://localhost/hook", { event: { type: "TEST" } }, { authorization: "" }),
    { store: new MemoryStore(), revenueCat: null, expectedAuthorization: null }
  );
  assert.equal(response.status, 500);
});

Deno.test("webhook: a transfer refreshes both sides and ignores RevenueCat's anonymous ids", () => {
  assert.deepEqual(
    affectedUserIds({ type: "TRANSFER", transferred_from: [USER, "$RCAnonymousID:abc"], transferred_to: [OTHER_USER] }),
    [USER, OTHER_USER]
  );
  assert.deepEqual(affectedUserIds({ type: "TEST", app_user_id: "$RCAnonymousID:abc" }), []);
});

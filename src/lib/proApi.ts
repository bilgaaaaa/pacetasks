import type { ProSyncStatus } from "@domain/pro";
import { supabase } from "./supabase";

// Asks the server to refresh this user's Pro state from RevenueCat, so Siri sees a
// new purchase, restore or renewal at once instead of waiting for the webhook.
export async function syncProWithServer(): Promise<ProSyncStatus> {
  const { data, error } = await supabase.functions.invoke<ProSyncStatus>("pro-sync", { body: {} });
  if (error || !data) {
    console.warn("[proApi] pro-sync failed", error);
    throw new Error("Couldn't sync PaceTasks Pro with the server");
  }
  console.log(`[proApi] server sees ${data.isPro ? "Pro" : "free"}`);
  return data;
}

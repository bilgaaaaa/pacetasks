import type { ProStatus } from "@domain/pro";
import { supabase } from "./supabase";

// Asks the server to refresh this user's Pro state from RevenueCat, so Siri and
// Brain Dump see a new purchase at once. Also says which Pro features the server offers.
export async function syncProStatus(): Promise<ProStatus> {
  const { data, error } = await supabase.functions.invoke<ProStatus>("pro-sync", { body: {} });
  if (error || !data) {
    console.warn("[proApi] pro-sync failed", error);
    throw new Error("Couldn't check PaceTasks Pro");
  }
  return data;
}

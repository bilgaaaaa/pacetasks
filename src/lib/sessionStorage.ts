import AsyncStorage from "@react-native-async-storage/async-storage";
import { PaceSessionStore } from "../../modules/pace-session-store";

// Where supabase-js keeps the session. On an iPhone build it is the Keychain, so
// PaceTasks' Siri intents act as the same user; everywhere else AsyncStorage.

export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

// Reads from `primary`, moving a value still left in `legacy` over the first time,
// so a phone updating from an AsyncStorage build keeps its user and tasks.
// Reads of the same key share one attempt, so two overlapping reads can never see
// the value half-moved and report no session (which would sign the phone in anew).
export function createMigratingStore(primary: KeyValueStore, legacy: KeyValueStore): KeyValueStore {
  const readsInFlight = new Map<string, Promise<string | null>>();

  async function readAndMigrate(key: string): Promise<string | null> {
    const current = await primary.getItem(key);
    if (current !== null) return current;
    const old = await legacy.getItem(key);
    if (old === null) return null;
    await primary.setItem(key, old);
    await legacy.removeItem(key);
    console.log("[sessionStorage] moved the saved session to the Keychain");
    return old;
  }

  return {
    getItem(key) {
      const inFlight = readsInFlight.get(key);
      if (inFlight) return inFlight;
      const read = readAndMigrate(key).finally(() => readsInFlight.delete(key));
      readsInFlight.set(key, read);
      return read;
    },
    setItem: (key, value) => primary.setItem(key, value),
    async removeItem(key) {
      await Promise.all([primary.removeItem(key), legacy.removeItem(key)]);
    },
  };
}

export const authSessionStorage: KeyValueStore = PaceSessionStore
  ? createMigratingStore(PaceSessionStore, AsyncStorage)
  : AsyncStorage;

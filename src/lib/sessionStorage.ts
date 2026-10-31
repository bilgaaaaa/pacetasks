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
export function createMigratingStore(primary: KeyValueStore, legacy: KeyValueStore): KeyValueStore {
  return {
    async getItem(key) {
      const current = await primary.getItem(key);
      if (current !== null) return current;
      const old = await legacy.getItem(key);
      if (old === null) return null;
      await primary.setItem(key, old);
      await legacy.removeItem(key);
      console.log("[sessionStorage] moved the saved session to the Keychain");
      return old;
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

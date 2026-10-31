// The real AsyncStorage needs its native module; these tests pass their own stores.
jest.mock("@react-native-async-storage/async-storage", () => ({}));

import { createMigratingStore } from "../sessionStorage";
import type { KeyValueStore } from "../sessionStorage";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
    removeItem: async (key) => {
      data.delete(key);
    },
  };
}

const KEY = "sb-project-auth-token";

describe("createMigratingStore", () => {
  it("moves a session saved by an older build into the new store once", async () => {
    const keychain = memoryStore();
    const asyncStorage = memoryStore({ [KEY]: "old-session" });
    const store = createMigratingStore(keychain, asyncStorage);

    expect(await store.getItem(KEY)).toBe("old-session");
    expect(keychain.data.get(KEY)).toBe("old-session");
    expect(asyncStorage.data.has(KEY)).toBe(false);
  });

  it("prefers the new store and writes only there", async () => {
    const keychain = memoryStore({ [KEY]: "current" });
    const asyncStorage = memoryStore({ [KEY]: "stale" });
    const store = createMigratingStore(keychain, asyncStorage);

    expect(await store.getItem(KEY)).toBe("current");
    await store.setItem(KEY, "refreshed");
    expect(keychain.data.get(KEY)).toBe("refreshed");
    expect(asyncStorage.data.get(KEY)).toBe("stale");
  });

  it("signs out everywhere and reports nothing when there is no session", async () => {
    const keychain = memoryStore({ [KEY]: "a" });
    const asyncStorage = memoryStore({ [KEY]: "b" });
    const store = createMigratingStore(keychain, asyncStorage);

    await store.removeItem(KEY);
    expect(await store.getItem(KEY)).toBeNull();
    expect(keychain.data.size + asyncStorage.data.size).toBe(0);
  });
});

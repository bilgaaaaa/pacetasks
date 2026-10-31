import { requireOptionalNativeModule } from "expo";

// The Keychain store from ios/PaceSessionStoreModule.swift. Null where the native
// module isn't built in: the web, Android, Expo Go and Jest.
export interface PaceSessionStoreModule {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const PaceSessionStore = requireOptionalNativeModule<PaceSessionStoreModule>("PaceSessionStore");

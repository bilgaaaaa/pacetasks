import AsyncStorage from "@react-native-async-storage/async-storage";
import { ProStatus } from "./pro";

// The last Pro status the store confirmed, on this phone, so Pro keeps working offline (see effectiveProStatus).
const STATUS_KEY = "pacetasks.pro.status";

function isProStatus(value: unknown): value is ProStatus {
  const status = value as ProStatus | null;
  return (
    !!status &&
    typeof status.active === "boolean" &&
    typeof status.lifetime === "boolean" &&
    (status.expiresAt === null || typeof status.expiresAt === "number")
  );
}

// Returns the saved status, or null. Storage problems or old data are logged and treated as "none".
export async function loadProStatus(): Promise<ProStatus | null> {
  try {
    const raw = await AsyncStorage.getItem(STATUS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isProStatus(parsed) ? parsed : null;
  } catch (e) {
    console.warn("[proStorage] load failed", e);
    return null;
  }
}

export async function saveProStatus(status: ProStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(STATUS_KEY, JSON.stringify(status));
  } catch (e) {
    console.warn("[proStorage] save failed", e);
  }
}

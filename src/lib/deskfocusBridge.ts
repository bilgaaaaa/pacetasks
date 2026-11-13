// The only caller of the DeskfocusBridge native module (modules/deskfocus-bridge), which runs Focus through the same
// session the DeskFocus widget uses. Only iOS builds have it: elsewhere `isFocusBridgeAvailable()` is false and
// the Focus screen keeps its own countdown.
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import type { LanguageChoice } from "./appearance";
import { FocusReply, parseFocusReply } from "./focusSession";

export type FocusBridgeAction = "state" | "start" | "pause" | "resume" | "extend" | "end" | "reconcile";

// Field names match FocusBridgeCommand in targets/deskfocus/_shared/DeskfocusBridgeHandler.swift.
interface FocusBridgeCommand {
  action: FocusBridgeAction;
  paceTaskId?: string;
  minutes?: number;
  timerSoundEnabled?: boolean;
  language?: LanguageChoice; // the app's language choice, so the widget reads in the same language
}

interface FocusBridgeSubscription {
  remove(): void;
}

interface DeskfocusBridgeModule {
  isAvailable(): boolean;
  send(command: string): Promise<string>;
  addListener(eventName: "onFocusChange", listener: () => void): FocusBridgeSubscription;
}

// Looked up once; null off iOS, in builds made before the module existed and when the app target lacks its handler.
function loadBridge(): DeskfocusBridgeModule | null {
  if (Platform.OS !== "ios") return null;
  const module = requireOptionalNativeModule<DeskfocusBridgeModule>("DeskfocusBridge");
  if (!module) return null;
  try {
    if (module.isAvailable()) return module;
  } catch (e) {
    console.warn("[deskfocusBridge] availability check failed", e);
  }
  console.warn("[deskfocusBridge] focus handler missing, using the app's own timer");
  return null;
}

const bridge = loadBridge();

// Whether Focus runs through the shared native session on this phone.
export function isFocusBridgeAvailable(): boolean {
  return bridge !== null;
}

// Sends one command and returns the session afterwards; a failed call reports an error instead of throwing.
export async function sendFocusCommand(command: FocusBridgeCommand): Promise<FocusReply> {
  if (!bridge) return { focus: null, error: "unavailable" };
  try {
    const reply = parseFocusReply(await bridge.send(JSON.stringify(command)));
    if (reply.error) console.warn(`[deskfocusBridge] ${command.action} answered ${reply.error}`);
    return reply;
  } catch (e) {
    console.warn(`[deskfocusBridge] ${command.action} failed`, e);
    return { focus: null, error: "failed" };
  }
}

// Calls `listener` whenever the app, the widget or the Live Activity changed the shared session or its list.
export function onFocusBridgeChange(listener: () => void): () => void {
  if (!bridge) return () => {};
  const subscription = bridge.addListener("onFocusChange", listener);
  return () => subscription.remove();
}


// Tells the DeskFocus widget which language the app is in; it switches the next time iOS reloads it.
export async function syncWidgetLanguage(language: LanguageChoice): Promise<void> {
  if (!bridge) return;
  const reply = await sendFocusCommand({ action: "state", language });
  if (!reply.error) console.log("[deskfocusBridge] widget language", language);
}

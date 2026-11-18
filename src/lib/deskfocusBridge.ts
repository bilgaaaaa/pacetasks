// The only caller of the DeskfocusBridge native module (modules/deskfocus-bridge), which runs Focus through the same
// session the DeskFocus widget uses and reads and changes the widget's settings. Only iOS builds have it: elsewhere
// `isFocusBridgeAvailable()` is false, the Focus screen keeps its own countdown and there are no widget settings.
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import type { LanguageChoice } from "./appearance";
import { FocusReply, parseFocusReply } from "./focusSession";
import { parseWidgetSettings, WidgetSettings, WidgetSettingsPatch } from "./widgetSettings";
import { CalendarItem, parseCalendarItems } from "./calendarItems";
import { CalendarAccess, parseCalendarAccess } from "./calendarAccess";

export type FocusBridgeAction =
  | "state"
  | "start"
  | "pause"
  | "resume"
  | "extend"
  | "end"
  | "reconcile"
  | "widgetSettings"
  | "updateWidgetSettings"
  | "calendarItems"
  | "completeReminder"
  | "calendarAccess"
  | "requestCalendarAccess";

// Field names match FocusBridgeCommand in targets/deskfocus/_shared/DeskfocusBridgeHandler.swift.
interface FocusBridgeCommand {
  action: FocusBridgeAction;
  paceTaskId?: string;
  minutes?: number;
  timerSoundEnabled?: boolean;
  language?: LanguageChoice; // the app's language choice, so the widget reads in the same language
  widgetSettings?: WidgetSettingsPatch; // the change for "updateWidgetSettings"
  dayKey?: string; // "YYYY-MM-DD" for "calendarItems"
  reminderId?: string; // the reminder "completeReminder" checks off
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

interface BridgeReply {
  error?: unknown;
  widget?: unknown;
  calendarItems?: unknown;
  calendarAccess?: unknown;
}

// Sends a command that is not about Focus and returns its reply; null off iOS, when the call failed or when the
// handler answered with an error.
async function sendCommand(command: FocusBridgeCommand): Promise<BridgeReply | null> {
  if (!bridge) return null;
  try {
    const reply = JSON.parse(await bridge.send(JSON.stringify(command))) as BridgeReply;
    if (typeof reply.error !== "string") return reply;
    console.warn(`[deskfocusBridge] ${command.action} answered ${reply.error}`);
  } catch (e) {
    console.warn(`[deskfocusBridge] ${command.action} failed`, e);
  }
  return null;
}

// The widget's colors, focus length and every calendar and list on the phone with its switch.
export async function fetchWidgetSettings(): Promise<WidgetSettings | null> {
  return parseWidgetSettings((await sendCommand({ action: "widgetSettings" }))?.widget);
}

// Saves one change for the widget, which redraws with it, and returns the settings as saved.
export async function updateWidgetSettings(patch: WidgetSettingsPatch): Promise<WidgetSettings | null> {
  return parseWidgetSettings((await sendCommand({ action: "updateWidgetSettings", widgetSettings: patch }))?.widget);
}

// A day's events and reminders from the calendars switched on for the widget; null when they can't be read.
export async function fetchCalendarItems(dayKey: string): Promise<CalendarItem[] | null> {
  return parseCalendarItems((await sendCommand({ action: "calendarItems", dayKey }))?.calendarItems);
}

// Checks a reminder off in Reminders (and in the widget); false when it could not be saved.
export async function completeCalendarReminder(reminderId: string): Promise<boolean> {
  return (await sendCommand({ action: "completeReminder", reminderId })) !== null;
}

// Calendar and Reminders access as iOS reports it to EventKit; "unavailable" off iOS or when it can't be read.
export async function fetchCalendarAccess(): Promise<CalendarAccess> {
  if (!bridge) return "unavailable";
  return parseCalendarAccess((await sendCommand({ action: "calendarAccess" }))?.calendarAccess);
}

// Shows iOS' Calendar and Reminders prompts for whatever was never asked, and returns the access afterwards.
export async function requestCalendarAccessFromBridge(): Promise<CalendarAccess> {
  if (!bridge) return "unavailable";
  return parseCalendarAccess((await sendCommand({ action: "requestCalendarAccess" }))?.calendarAccess);
}

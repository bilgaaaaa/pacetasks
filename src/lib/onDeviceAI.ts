import { requireOptionalNativeModule } from "expo";
import type { BrainDumpAiResult } from "@domain/brainDump/aiResult";
import { toLocalDateKey } from "@domain/dates";
import {
  buildOnDevicePrompt,
  ON_DEVICE_INSTRUCTIONS,
  ON_DEVICE_MODEL_NAME,
  ON_DEVICE_PROMPT_VERSION,
  toBrainDumpAiResult,
} from "./onDeviceBrainDump";

// Why the on-device model can or cannot run on this phone (see OnDeviceAIModule.swift).
export type OnDeviceAvailability =
  | "available"
  | "os_too_old"
  | "device_not_eligible"
  | "apple_intelligence_off"
  | "model_not_ready"
  | "unavailable"
  | "not_ios";

// What the brain-dump function accepts as `interpretation` (deviceInterpretationSchema on the server).
export interface DeviceInterpretation {
  model: string;
  promptVersion: string;
  result: BrainDumpAiResult;
}

interface OnDeviceAIModule {
  availability(): Exclude<OnDeviceAvailability, "not_ios">;
  interpretBrainDump(instructions: string, prompt: string): Promise<string>;
}

// Longer than this and the server's reading is used instead, so the user never waits on a stuck model.
const ON_DEVICE_TIMEOUT_MS = 20_000;

// Null outside an iPhone build (web demo, tests): nothing runs on device there.
const native = requireOptionalNativeModule<OnDeviceAIModule>("OnDeviceAI");

export function onDeviceAvailability(): OnDeviceAvailability {
  try {
    return native ? native.availability() : "not_ios";
  } catch (e) {
    console.warn("[onDeviceAI] availability check failed", e);
    return "unavailable";
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`on-device model took longer than ${ms} ms`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

// Reads a brain dump with Apple's on-device model: free, private, offline. Null
// when the phone can't (older iPhone, Apple Intelligence off, a language it
// doesn't know) or the answer isn't usable; the server's own reading then applies.
export async function interpretBrainDumpOnDevice(text: string, now: Date = new Date()): Promise<DeviceInterpretation | null> {
  const availability = onDeviceAvailability();
  if (availability !== "available" || !native) {
    console.log("[onDeviceAI] not used:", availability);
    return null;
  }
  const startedAt = Date.now();
  try {
    const answer = await withTimeout(
      native.interpretBrainDump(ON_DEVICE_INSTRUCTIONS, buildOnDevicePrompt(text, toLocalDateKey(now))),
      ON_DEVICE_TIMEOUT_MS
    );
    const result = toBrainDumpAiResult(answer);
    console.log(
      "[onDeviceAI]",
      result ? `${result.candidates.length} task(s)` : "answer not usable",
      `in ${Date.now() - startedAt} ms`
    );
    return result ? { model: ON_DEVICE_MODEL_NAME, promptVersion: ON_DEVICE_PROMPT_VERSION, result } : null;
  } catch (e) {
    console.warn("[onDeviceAI] failed, the server reads the text instead", e);
    return null;
  }
}

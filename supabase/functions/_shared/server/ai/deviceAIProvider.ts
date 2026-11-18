import type { BrainDumpAiResult } from "../../domain/brainDump/aiResult.ts";
import { DEVICE_PROVIDER_NAME } from "./AIProvider.ts";
import type { AIInterpretation, AIProvider, BrainDumpInterpretationRequest } from "./AIProvider.ts";

// What the app sends when the phone's own model already read the text.
export interface DeviceInterpretation {
  result: BrainDumpAiResult; // already checked against brainDumpAiResultSchema by the request schema
  model: string;
  promptVersion: string;
}

// Uses the phone's answer when there is one, and the server's own provider
// otherwise. Everything after it (normalization, review, saving) is the same
// either way, so an answer from the phone gets no more trust than one from a vendor.
export function withDeviceInterpretation(fallback: AIProvider, device: DeviceInterpretation | undefined): AIProvider {
  if (!device) return fallback;
  return {
    parseBrainDump(_request: BrainDumpInterpretationRequest): Promise<AIInterpretation<BrainDumpAiResult>> {
      console.log(
        `[deviceAI] using the phone's interpretation: ${device.result.candidates.length} candidate(s), ${device.model}`
      );
      return Promise.resolve({
        result: device.result,
        provider: DEVICE_PROVIDER_NAME,
        model: device.model,
        promptVersion: device.promptVersion,
        usage: { inputTokens: 0, outputTokens: 0 },
        attempts: 1,
      });
    },
  };
}

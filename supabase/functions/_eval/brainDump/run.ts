import { normalizeBrainDump } from "../../_shared/domain/brainDump/normalize.ts";
import { RULES_PROVIDER_NAME } from "../../_shared/server/ai/AIProvider.ts";
import { readAIConfig } from "../../_shared/server/ai/clientFactory.ts";
import { AIError } from "../../_shared/server/ai/errors.ts";
import { createAIProvider, usesRulesProvider } from "../../_shared/server/ai/providerFactory.ts";
import { RULES_PARSER_VERSION } from "../../_shared/domain/brainDump/rulesParser.ts";
import { EVAL_CASES, EVAL_TIME_ZONE, EVAL_TODAY } from "./cases.ts";
import { scoreCase } from "./score.ts";
import type { CaseScore } from "./score.ts";

// Runs the Brain Dump evaluation set against one provider/model (or the free
// rule-based parser) and prints a scorecard, so the choice is made on measured results.
//
//   deno task eval --provider rules
//   ANTHROPIC_API_KEY=... deno task eval --provider anthropic --model <model> --price-in 1 --price-out 5
//   OPENAI_API_KEY=...    deno task eval --provider openai --model <model> --only it-
//
// --price-in / --price-out are USD per million tokens (check the vendor's current pricing).

interface CaseRun {
  score: CaseScore | null;
  error: string | null;
  attempts: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
}

const args = parseArgs(Deno.args);
const env = (name: string) =>
  ({ AI_PROVIDER: args.provider, AI_MODEL_BRAIN_DUMP: args.model } as Record<string, string | undefined>)[name] ??
  Deno.env.get(name);
// What is being evaluated, for the header and the report file name.
const config = usesRulesProvider(env)
  ? { provider: RULES_PROVIDER_NAME, model: RULES_PARSER_VERSION }
  : readAIConfig(env, "BRAIN_DUMP");
const ai = createAIProvider(env, "BRAIN_DUMP");
const cases = EVAL_CASES.filter((c) => !args.only || c.id.startsWith(args.only));

console.log(`Brain Dump eval · ${config.provider} · ${config.model} · ${cases.length} cases · today ${EVAL_TODAY}\n`);

const runs: CaseRun[] = [];
for (const testCase of cases) {
  const startedAt = performance.now();
  try {
    const interpretation = await ai.parseBrainDump({
      text: testCase.text,
      todayKey: EVAL_TODAY,
      timeZone: EVAL_TIME_ZONE,
      localeHint: "en-IT",
    });
    const { candidates } = normalizeBrainDump(interpretation.result, {
      todayKey: EVAL_TODAY,
      source: "brain_dump",
      workStartHour: 9,
      workEndHour: 17,
      tasks: [],
    });
    const score = scoreCase(testCase, candidates);
    runs.push({
      score,
      error: null,
      attempts: interpretation.attempts,
      latencyMs: performance.now() - startedAt,
      inputTokens: interpretation.usage.inputTokens,
      outputTokens: interpretation.usage.outputTokens,
    });
    printCase(score, candidates.map((c) => c.draft.title));
  } catch (error) {
    const message = error instanceof AIError ? `${error.kind}: ${error.message}` : String(error);
    runs.push({ score: null, error: message, attempts: 0, latencyMs: performance.now() - startedAt, inputTokens: 0, outputTokens: 0 });
    console.log(`✗ ${testCase.id.padEnd(18)} ERROR ${message}`);
  }
}

printSummary(runs);
await saveReport(runs);

function printCase(score: CaseScore, titles: string[]): void {
  console.log(`${score.passed ? "✓" : "✗"} ${score.id.padEnd(18)} ${score.actualCount}/${score.expectedCount} tasks  ${titles.join(" | ")}`);
  if (score.passed) return;
  for (const task of score.tasks) {
    if (task.matchedTitle === null) console.log(`    missing or translated: [${task.keywords.join(", ")}]`);
    for (const field of task.fields.filter((f) => !f.ok)) {
      console.log(`    ${task.matchedTitle} → ${field.field}: expected ${field.expected}, got ${field.actual}`);
    }
  }
}

function printSummary(all: CaseRun[]): void {
  const scored = all.filter((r) => r.score);
  const tasks = scored.flatMap((r) => r.score!.tasks);
  const fields = tasks.flatMap((t) => t.fields);
  const matched = tasks.filter((t) => t.matchedTitle !== null);
  const inputTokens = sum(all.map((r) => r.inputTokens));
  const outputTokens = sum(all.map((r) => r.outputTokens));
  const cost = (inputTokens * args.priceIn + outputTokens * args.priceOut) / 1_000_000;

  console.log("\n── Summary ─────────────────────────────");
  console.log(`Cases passed           ${scored.filter((r) => r.score!.passed).length}/${all.length}`);
  console.log(`Errors                 ${all.length - scored.length}`);
  console.log(`Tasks found (original language)  ${matched.length}/${tasks.length}`);
  console.log(`Language tag correct   ${matched.filter((t) => t.languageTagOk).length}/${matched.length}`);
  console.log(`Field accuracy         ${fields.filter((f) => f.ok).length}/${fields.length}`);
  console.log(`Needed a retry         ${scored.filter((r) => r.attempts > 1).length}`);
  console.log(`Avg latency            ${Math.round(sum(all.map((r) => r.latencyMs)) / Math.max(1, all.length))} ms`);
  console.log(`Tokens                 ${inputTokens} in / ${outputTokens} out`);
  if (args.priceIn || args.priceOut) {
    console.log(`Est. cost              $${cost.toFixed(4)} total · $${(cost / Math.max(1, all.length)).toFixed(5)} per dump`);
  }
}

async function saveReport(all: CaseRun[]): Promise<void> {
  const dir = new URL("./results/", import.meta.url);
  await Deno.mkdir(dir, { recursive: true });
  const file = new URL(`${config.provider}-${config.model.replace(/[^\w.-]/g, "_")}-${Date.now()}.json`, dir);
  await Deno.writeTextFile(file, JSON.stringify({ provider: config.provider, model: config.model, runs: all }, null, 2));
  console.log(`\nReport saved to ${file.pathname}`);
}

function parseArgs(argv: string[]) {
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    provider: value("--provider"),
    model: value("--model"),
    only: value("--only"),
    priceIn: Number(value("--price-in") ?? 0),
    priceOut: Number(value("--price-out") ?? 0),
  };
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}

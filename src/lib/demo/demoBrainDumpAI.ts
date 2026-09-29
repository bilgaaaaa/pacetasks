import { brainDumpAiResultSchema } from "@domain/brainDump/aiResult";
import type { AiTaskCandidate, BrainDumpAiResult, DateExpression, TimeOfDay } from "@domain/brainDump/aiResult";
import { CATEGORY_IDS } from "@domain/categories";
import type {
  AIInterpretation,
  AIProvider,
  BrainDumpInterpretationRequest,
} from "@server/ai/AIProvider";

// Rule-based stand-in for the LLM in demo mode. It fills the same
// BrainDumpAiResult contract the real provider returns, so everything after it
// (normalize, review policy, commit) runs your production code unchanged.

type Language = "en" | "it" | "tr";

const SPLIT_PATTERN = /\n|;|,|\s+(?:and then|then|and|poi|e poi|e|sonra|ve)\s+/i;

const WEEKDAYS: Array<[number, RegExp]> = [
  [1, /\b(monday|luned[iì]|pazartesi)\b/i],
  [2, /\b(tuesday|marted[iì]|sal[ıi])\b/i],
  [3, /\b(wednesday|mercoled[iì]|[çc]ar[şs]amba)\b/i],
  [4, /\b(thursday|gioved[iì]|per[şs]embe)\b/i],
  [5, /\b(friday|venerd[iì]|cuma)\b/i],
  [6, /\b(saturday|sabato|cumartesi)\b/i],
  [7, /\b(sunday|domenica|pazar)\b/i],
];

const RELATIVE_DAYS: Array<[number, RegExp]> = [
  [2, /\b(day after tomorrow|dopodomani|[öo]b[üu]r g[üu]n)\b/i],
  [1, /\b(tomorrow|domani|yar[ıi]n)\b/i],
  [0, /\b(today|tonight|oggi|stasera|bug[üu]n|bu ak[şs]am)\b/i],
];

const VAGUE_DATE = /\b(someday|sometime|soon|one of these days|prima o poi|presto|bir ara|yak[ıi]nda)\b/i;
const DEADLINE_WORD = /\b(by|before|entro|prima di)\b|(?:'?[ae] kadar)/i;
const NEXT_WORD = /\b(next|prossimo|prossima|gelecek)\b/i;

const TIME_PATTERN = /\b(?:at|alle|ore|saat)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b|\b(\d{1,2})[:.](\d{2})\b|\b(\d{1,2})\s*(am|pm)\b/i;
const MINUTES_PATTERN = /\b(\d{1,3})\s*(?:min|mins|minutes|minuti|dk|dakika)\b/i;
const HOURS_PATTERN = /\b(\d(?:[.,]5)?)\s*(?:h|hr|hrs|hours?|or[ae]|saat)\b(?!\s*\d)/i;

const TIME_OF_DAY: Array<[TimeOfDay, RegExp]> = [
  ["morning", /\b(morning|mattina|stamattina|sabah)\b/i],
  ["afternoon", /\b(afternoon|pomeriggio|[öo][ğg]leden sonra)\b/i],
  ["evening", /\b(evening|tonight|sera|stasera|ak[şs]am)\b/i],
];

const HIGH_PRIORITY = /\b(urgent|asap|important|urgente|importante|acil|[öo]nemli)\b|!{1,}/i;

const CATEGORY_KEYWORDS: Record<(typeof CATEGORY_IDS)[number], RegExp> = {
  work: /\b(email|emails|mail|meeting|report|client|boss|deploy|review|lavoro|riunione|cliente|toplant[ıi]|i[şs])\b/i,
  shopping: /\b(buy|groceries|shop|order|comprare|compra|spesa|al|market|sipari[şs])\b/i,
  home: /\b(clean|laundry|dishes|fix|vacuum|pulire|bucato|lavatrice|piatti|temizle|[çc]ama[şs][ıi]r|bula[şs][ıi]k)\b/i,
  health: /\b(doctor|dentist|gym|run|workout|pharmacy|medico|dentista|palestra|farmacia|doktor|di[şs][çc]i|spor|eczane)\b/i,
  personal: /\b(call|mom|dad|birthday|gift|read|chiamare|mamma|pap[àa]|compleanno|regalo|ara|annem|babam|do[ğg]um g[üu]n[üu])\b/i,
};

// Words that only carried the date/time; trimmed from the title's edges only,
// so "Turn on the heating" or "Chiamare la mamma" keep their words.
const FILLER_WORD = "(?:by|before|at|on|entro|prima di|alle|ore|saat|i[çc]in|next|prossimo|prossima|gelecek)";
const LEADING_FILLER = new RegExp(`^(?:${FILLER_WORD}\\s+)+`, "i");
const TRAILING_FILLER = new RegExp(`(?:\\s+${FILLER_WORD})+$`, "i");
const PRIORITY_MARKERS = /\b(urgent|asap|important|urgente|importante|acil|[öo]nemli)\b|!+/gi;

export function createDemoAIProvider(): AIProvider {
  return {
    async parseBrainDump(request: BrainDumpInterpretationRequest): Promise<AIInterpretation<BrainDumpAiResult>> {
      const result = parseText(request.text);
      // Same contract check as the real provider: an invalid shape fails here, not in normalize.
      const validated = brainDumpAiResultSchema.parse(result);
      console.log(`[demoBrainDumpAI] ${validated.candidates.length} candidate(s), ${validated.unparsedFragments.length} unparsed`);
      return {
        result: validated,
        provider: "anthropic", // stored on the demo session only; no request leaves the browser
        model: "demo-rules",
        promptVersion: "demo-1",
        usage: { inputTokens: 0, outputTokens: 0 },
        attempts: 1,
      };
    },
  };
}

function parseText(text: string): BrainDumpAiResult {
  const segments = text.split(SPLIT_PATTERN).map((s) => s.trim()).filter(Boolean);
  const candidates: AiTaskCandidate[] = [];
  const unparsedFragments: string[] = [];

  for (const segment of segments.slice(0, 25)) {
    const candidate = parseSegment(segment);
    if (candidate) candidates.push(candidate);
    else unparsedFragments.push(segment);
  }

  const detectedLanguages = [...new Set(candidates.map((c) => c.language))];
  return { schemaVersion: 1, detectedLanguages, candidates, unparsedFragments };
}

// Returns null when a segment has too little left to be a task (e.g. "ok").
function parseSegment(segment: string): AiTaskCandidate | null {
  let rest = segment;
  const ambiguities: AiTaskCandidate["ambiguities"] = [];

  const when = extractDate(segment);
  if (when) rest = rest.replace(new RegExp(escapeRegExp(when.text), "i"), " ");

  const time = extractTime(rest);
  if (time) rest = rest.replace(time.matched, " ");

  const duration = extractDuration(rest);
  if (duration) rest = rest.replace(duration.matched, " ");

  const timeOfDay = TIME_OF_DAY.find(([, pattern]) => pattern.test(segment))?.[0] ?? null;
  for (const [, pattern] of TIME_OF_DAY) rest = rest.replace(pattern, " ");

  const cleaned = rest.replace(PRIORITY_MARKERS, " ").replace(/\s+/g, " ").trim();
  const title = capitalize(cleaned.replace(LEADING_FILLER, "").replace(TRAILING_FILLER, "").trim());
  if (title.length < 3) return null;

  const category = (Object.entries(CATEGORY_KEYWORDS).find(([, pattern]) => pattern.test(segment))?.[0] ?? null) as
    | (typeof CATEGORY_IDS)[number]
    | null;

  // One-word tasks ("dentist") are plausible but thin, so they get a second look.
  const wordCount = title.split(" ").length;
  let confidence = wordCount >= 2 ? 0.9 : 0.7;
  if (when?.kind === "vague") {
    confidence = Math.min(confidence, 0.8);
    ambiguities.push({ field: "due_date", reason: `"${when.text}" isn't a specific day` });
  }

  return {
    title,
    sourceSpan: segment,
    language: detectLanguage(segment),
    notes: null,
    when,
    dueTime: time?.value ?? null,
    timeOfDay,
    estimatedDurationMinutes: duration?.minutes ?? null,
    priority: HIGH_PRIORITY.test(segment) ? "high" : null,
    energyRequired: null,
    flexible: when?.kind === "vague",
    context: [],
    category,
    confidence,
    ambiguities,
  };
}

function extractDate(segment: string): DateExpression | null {
  const isDeadline = DEADLINE_WORD.test(segment);

  for (const [offsetDays, pattern] of RELATIVE_DAYS) {
    const match = segment.match(pattern);
    if (match) return { kind: "relative_day", offsetDays, relation: isDeadline ? "by" : "on", text: match[0] };
  }

  for (const [weekday, pattern] of WEEKDAYS) {
    const match = segment.match(pattern);
    if (match) {
      const relation = NEXT_WORD.test(segment) ? "next" : isDeadline ? "by" : "on";
      return { kind: "weekday", weekday, relation, text: match[0] };
    }
  }

  const vague = segment.match(VAGUE_DATE);
  if (vague) return { kind: "vague", text: vague[0] };
  return null;
}

function extractTime(text: string): { value: string; matched: string } | null {
  const match = text.match(TIME_PATTERN);
  if (!match) return null;

  const hourText = match[1] ?? match[4] ?? match[6];
  const minuteText = match[2] ?? match[5] ?? "00";
  const meridiem = (match[3] ?? match[7] ?? "").toLowerCase();

  let hour = Number(hourText);
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  const minute = Number(minuteText);
  if (hour > 23 || minute > 59) return null;

  return { value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, matched: match[0] };
}

function extractDuration(text: string): { minutes: number; matched: string } | null {
  const minutesMatch = text.match(MINUTES_PATTERN);
  if (minutesMatch) return { minutes: Math.max(1, Number(minutesMatch[1])), matched: minutesMatch[0] };

  const hoursMatch = text.match(HOURS_PATTERN);
  if (hoursMatch) {
    return { minutes: Math.round(Number(hoursMatch[1].replace(",", ".")) * 60), matched: hoursMatch[0] };
  }
  return null;
}

function detectLanguage(text: string): Language {
  if (/[ğışİ]|\b(yar[ıi]n|bug[üu]n|ara|al|i[çc]in|ve|sonra)\b/i.test(text)) return "tr";
  if (/\b(domani|oggi|chiamare|comprare|entro|alle|della|il|la|e|poi|stasera)\b/i.test(text)) return "it";
  return "en";
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

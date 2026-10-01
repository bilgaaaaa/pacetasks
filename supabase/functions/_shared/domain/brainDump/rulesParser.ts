import type { CategoryId } from "../categories.ts";
import { AI_RESULT_LIMITS, BRAIN_DUMP_MAX_CANDIDATES, BRAIN_DUMP_SCHEMA_VERSION } from "./aiResult.ts";
import type { AiTaskCandidate, BrainDumpAiResult, DateExpression, TimeOfDay } from "./aiResult.ts";

// Rule-based Brain Dump parser: no AI model, no network, no cost. It understands
// simple English, Italian and Turkish lists (separators, days, times, durations,
// a few keywords) and is what Brain Dump runs on when AI_PROVIDER=rules and in
// the web demo. It cannot judge meaning, so free-form text is where a real model
// does better; `deno task eval --provider rules` measures the gap.
//
// Two rules it never breaks: text it doesn't turn into a task is reported as
// unparsed (never dropped), and a word is cut from a title only when it clearly
// was a date, time or duration.

// Stored with each session in place of a model name; bump when the rules change.
export const RULES_PARSER_VERSION = "rules-3";

type Language = "en" | "it" | "tr";

// "\b" only knows ASCII letters, so it breaks on "venerdì" or "yarın". These
// boundaries treat every Unicode letter and digit as part of a word.
const WORD_START = "(?<![\\p{L}\\p{N}])";
const WORD_END = "(?![\\p{L}\\p{N}])";

function words(alternatives: string, flags = "iu"): RegExp {
  return new RegExp(`${WORD_START}(?:${alternatives})${WORD_END}`, flags);
}

// Stands in for text that was cut out as a date, time or duration, so later
// rules can tell "next to a date" ("tomorrow morning") from "part of the name"
// ("Morning run"). A private-use character that never appears in real text.
const CUT = "";

// Turkish case endings that attach to a day or a time: "cumaya", "pazartesi'ye", "10:00'da".
const TR_CASE_SUFFIX = "(?:'?(?:y?[ae]|[dt][ae]))?";

// Sentence ends, list separators and "and/then" words in the three languages.
// Not separators: a decimal comma ("1,5 ore"), the dot of an abbreviation
// ("Dr. Smith"), and phrases that merely contain a joining word: "prima o poi"
// (sooner or later), "yarından sonra", "öğleden sonra", "işten sonra", "3 gün sonra".
const ABBREVIATION = "dr|mr|mrs|ms|prof|sig|dott|vs|etc";
const SPLIT_PATTERN = new RegExp(
  `\\n|;|(?<!\\d),|,(?!\\d)` +
    `|(?<=[.!?])(?<!${WORD_START}(?:${ABBREVIATION})\\.)\\s+` + // the mark stays with its sentence ("taxes!!")
    `|(?<!prima o|yar[ıi]ndan|[öo][ğg]leden|i[şs]ten|g[üu]n)\\s+(?:and then|and also|then|and|e poi|poi|e|sonra|ve)\\s+`,
  "iu"
);

// English possessive on a day name ("Thursday's demo"), matched together with the day.
const EN_POSSESSIVE = "(?:'s)?";

// Two Turkish day names are also everyday words, so they need more context:
// "sali" without its dotless ı only counts before "günü" (Italian "sali" = salts),
// and "pazara" (to the market) only before "kadar" (by Sunday).
const WEEKDAYS: Array<[number, RegExp]> = [
  [1, words(`monday${EN_POSSESSIVE}|luned[iì]|pazartesi${TR_CASE_SUFFIX}`)],
  [2, words(`tuesday${EN_POSSESSIVE}|marted[iì]|salı${TR_CASE_SUFFIX}|sali(?=\\s+g[üu]n[üu])`)],
  [3, words(`wednesday${EN_POSSESSIVE}|mercoled[iì]|[çc]ar[şs]amba${TR_CASE_SUFFIX}`)],
  [4, words(`thursday${EN_POSSESSIVE}|gioved[iì]|per[şs]embe${TR_CASE_SUFFIX}`)],
  [5, words(`friday${EN_POSSESSIVE}|venerd[iì]|cuma${TR_CASE_SUFFIX}`)],
  [6, words(`saturday${EN_POSSESSIVE}|sabato|cumartesi${TR_CASE_SUFFIX}`)],
  [7, words(`sunday${EN_POSSESSIVE}|domenica|pazar|pazara(?=\\s+kadar)`)],
];
const SATURDAY = 6;

// Longest phrases first, so "day after tomorrow" never reads as "tomorrow".
// "akşam" alone means tonight, except in "akşam yemeği" (dinner).
const RELATIVE_DAYS: Array<[number, RegExp]> = [
  [2, words("the day after tomorrow|day after tomorrow|dopodomani|[öo]b[üu]r g[üu]n|yar[ıi]ndan sonra")],
  [1, words("tomorrow|domani|yar[ıi]n")],
  [
    0,
    words(
      "today|tonight|this (?:morning|afternoon|evening)|oggi|stasera|stamattina|stanotte|bug[üu]n|" +
        "bu (?:sabah|ak[şs]am|gece)|ak[şs]am(?!\\s+yeme)"
    ),
  ],
];

// "within 3 days", "entro 3 giorni", "3 gün içinde": a deadline N days from today.
const WITHIN_DAYS = words(
  "(?:within|in the next|entro|nei prossimi)\\s+(\\d{1,3})\\s+(?:days?|giorn[oi])|(\\d{1,3})\\s+g[üu]n\\s+i[çc]inde"
);
// "in 3 days", "tra 3 giorni", "3 gün sonra": that day, N days from today.
const IN_DAYS = words("(?:in|tra|fra)\\s+(\\d{1,3})\\s+(?:days?|giorn[oi])|(\\d{1,3})\\s+g[üu]n\\s+sonra");
const MAX_DAYS_AHEAD = 365;

const WEEKEND = words(
  "(?:this |next |at the |on the )?weekend|(?:nel |questo |il )?fine settimana|(?:bu )?hafta sonu(?:nda)?"
);
// No exact day. "Someday" wording also makes the task a maybe; "soon" and
// "next week" wording doesn't: the task is firm, only its day is open.
const SOMEDAY_DATE = words(
  "someday|some day|sometime|eventually|one of these days|prima o poi|un giorno|bir ara|bir g[üu]n"
);
const SOON_DATE = words(
  "soon|next week|presto|la prossima settimana|settimana prossima|yak[ıi]nda|gelecek hafta|haftaya"
);
const NEXT_WORD = words("next|prossim[oa]|haftaya|gelecek|[öo]n[üu]m[üu]zdeki");

// A date is a deadline only when the deadline word touches it: "by Friday",
// "entro venerdì", "cumaya kadar"; a stray "before" elsewhere doesn't count.
const DEADLINE_BEFORE_DATE = new RegExp(`${WORD_START}(?:by|before|until|entro|prima di)\\s+(?:the\\s+)?$`, "iu");
const DEADLINE_AFTER_DATE = new RegExp(`^\\s*(?:kadar|dek)${WORD_END}`, "iu");
// The same word left behind once its date is cut ("kirayı cumaya kadar öde").
const DEADLINE_AFTER_CUT = new RegExp(`${CUT}\\s*(?:kadar|dek)${WORD_END}`, "iu");

// A day name is cut from the title when it stands alone: at either end of the
// text, or led in by one of these words. Mid-sentence it may be part of the
// name ("watch Monday night football"), so it stays; the date is still set.
const DAY_LEAD_IN = new RegExp(
  `${WORD_START}(?:on|by|before|until|this|next|for|entro|prima di|di|il|per|questo|bu|haftaya|gelecek|[öo]n[üu]m[üu]zdeki)\\s*$`,
  "iu"
);

// Clock times. A dot only counts as a time separator with a lead-in word or a
// Turkish case ending ("alle 18.30", "9.30'da"): a bare "12.50" is usually money.
const TIME_PATTERN = new RegExp(
  `${WORD_START}(?:at|alle ore|alle|ore|saat)\\s*(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm)?${TR_CASE_SUFFIX}${WORD_END}` +
    `|${WORD_START}(\\d{1,2}):(\\d{2})${TR_CASE_SUFFIX}${WORD_END}` +
    `|${WORD_START}(\\d{1,2})\\.(\\d{2})'[dt][ae]${WORD_END}` +
    `|${WORD_START}(\\d{1,2})\\s*(am|pm)${WORD_END}` +
    `|${WORD_START}(\\d{1,2})'[dt][ae]${WORD_END}`, // Turkish "7'de"
  "iu"
);
// "at 7 in the evening" means 19:00: hours below this are moved to the later half of the day.
const NOON_HOUR = 12;

const MINUTES_PATTERN = words("(\\d{1,3})\\s*(?:min|mins|minutes?|minut[oi]|dk|dakika)");
// Not followed by "&" ("2 H&M shirts") or by a number (Turkish "saat 10" means "at 10").
const HOURS_PATTERN = new RegExp(
  `${WORD_START}(\\d(?:[.,]5)?)\\s*(?:h|hr|hrs|hours?|or[ae]|saat)(?![&\\p{L}\\p{N}])(?!\\s*\\d)`,
  "iu"
);

// "before/after work" count as morning/evening, which normalize.ts turns into the work-hour timing.
const TIME_OF_DAY: Array<[TimeOfDay, RegExp]> = [
  ["morning", words("morning|mattina|stamattina|sabah|before work|prima del lavoro|i[şs]ten [öo]nce")],
  ["afternoon", words("afternoon|pomeriggio|[öo][ğg]leden sonra")],
  ["evening", words("evening|night|tonight|sera|stasera|notte|ak[şs]am|gece|after work|dopo il lavoro|i[şs]ten sonra")],
];
// Phrases that are only about when, never part of a task's name.
const TIME_OF_DAY_PHRASE = new RegExp(
  `${WORD_START}(?:(?:in the|at|di|la|al|nel) (?:morning|afternoon|evening|night|mattina|pomeriggio|sera|notte)|` +
    `before work|after work|prima del lavoro|dopo il lavoro|i[şs]ten [öo]nce|i[şs]ten sonra)${WORD_END}`,
  "giu"
);
// A bare "morning" is cut only right next to a cut date ("tomorrow morning"), so "Morning run" keeps its name.
const BARE_TIME_OF_DAY = "morning|afternoon|evening|night|mattina|pomeriggio|sera|notte|sabah|ak[şs]am|gece";
const TIME_OF_DAY_BESIDE_CUT = new RegExp(
  `${CUT}\\s*(?:${BARE_TIME_OF_DAY})${WORD_END}|${WORD_START}(?:${BARE_TIME_OF_DAY})\\s*${CUT}`,
  "giu"
);

// High priority: a word that means it, or more than one "!". Words that are
// ordinary adjectives too ("important documents") only count at the edges of the text.
const PRIORITY_WORD = words("urgent|asap|urgente|acil");
const PRIORITY_EDGE_WORD = new RegExp(
  `^(?:important|importante|[öo]nemli)${WORD_END}[\\s:,-]*|[\\s:,-]*${WORD_START}(?:important|importante|[öo]nemli)[.!]*$`,
  "iu"
);
const PRIORITY_MARK = /!{2,}/u;
const EDGE_PRIORITY_WORD = new RegExp(
  `^(?:urgent|asap|urgente|acil)${WORD_END}[\\s:,-]*|[\\s:,-]*${WORD_START}(?:urgent|asap|urgente|acil)[.!]*$`,
  "iu"
);

// "maybe" tasks: planning may move or skip them.
const MAYBE_WORD = words("maybe|perhaps|possibly|magari|forse|belki");
// A clause that states a condition ("if I'm not too tired", "çok yorgun olmazsam").
// It makes the task before it a "maybe" and is shown as unparsed, since it may
// also hold a task of its own ("if there is time call Anna").
const CONDITION_CLAUSE = new RegExp(
  `^(?:if|unless|se|e[ğg]er)\\s|(?:m[ae]zs[ae]|olurs[ae]|kal[ıi]rs[ae])(?:m|n|k|n[ıi]z)?[.!?]*$`,
  "iu"
);
const INLINE_CONDITION = words("if i|if it|if there|unless|se non|se ho|se riesco|se c'[èe]");

// Statements about how the user feels or how the day went. They are reported as
// unparsed text rather than becoming tasks.
const REMARK_OPENING = new RegExp(
  `^(?:i'm|i am|i was|i feel|it's|it is|it was|that was|ugh|oh|wow|sono|ero|che giornata|non ho voglia)${WORD_END}`,
  "iu"
);
// Turkish "çok" + past tense ("çok yoğundu", "çok yoruldum"): how it went, not what to do.
// Past tense alone is not enough: "toplantı" and "kahvaltı" end the same way.
const TURKISH_REMARK = words("[çc]ok\\s+\\p{L}+(?:d[ıiuü]|t[ıiuü])(?:m|k)?");

const CATEGORY_KEYWORDS: Record<CategoryId, RegExp> = {
  work: words("emails?|mail|meeting|report|client|boss|deploy|review|lavoro|riunione|cliente|toplant[ıi]\\p{L}*|iş\\p{L}*|sunum\\p{L}*"),
  shopping: words("buy|groceries|shop|order|comprare|compra|spesa|market|sipari[şs]\\p{L}*|al[ıi][şs]veri[şs]\\p{L}*|sat[ıi]n al"),
  home: words("clean|laundry|dishes|vacuum|pulire|bucato|lavatrice|piatti|temizle\\p{L}*|[çc]ama[şs][ıi]r\\p{L}*|bula[şs][ıi]k\\p{L}*"),
  health: words("doctor|dentist|gym|run|workout|pharmacy|medico|dentista|palestra|farmacia|doktor\\p{L}*|di[şs][çc]i\\p{L}*|spor\\p{L}*|eczane\\p{L}*"),
  personal: words("call|mom|dad|birthday|gift|read|chiamare|mamma|pap[àa]|compleanno|regalo|ara|anne\\p{L}*|baba\\p{L}*|do[ğg]um g[üu]n[üu]"),
};
// Which category wins when a task mentions several ("call the dentist" is health, not personal).
const CATEGORY_PRIORITY: CategoryId[] = ["work", "shopping", "home", "health", "personal"];

// Joining words left at the start of a segment ("also renew…", "e pagare…"); always trimmed.
const LEADING_JOINER = new RegExp(
  `^(?:(?:also|plus|and|then|anche|inoltre|e|poi|ayr[ıi]ca|bir de|ve|sonra)${WORD_END}[\\s,]*)+`,
  "iu"
);
// Words that only pointed at a date, time or duration. Trimmed from the title's
// edges, and only when something was actually cut out, so "put the washing
// machine on" and "Turn on the heating" keep their words.
const DATE_PREPOSITION = "by|before|until|at|on|entro|prima di|alle|ore|saat|i[çc]in|kadar|g[üu]n[üu]";
const LEADING_PREPOSITION = new RegExp(`^(?:(?:${DATE_PREPOSITION})${WORD_END}[\\s,]*)+`, "iu");
const TRAILING_PREPOSITION = new RegExp(`(?:[\\s,]*${WORD_START}(?:${DATE_PREPOSITION}|for|per|in))+$`, "iu");

// Distinctive everyday words per language, used to tag a task's language.
const LANGUAGE_WORDS: Record<Language, RegExp> = {
  en: new RegExp(
    `${WORD_START}(?:the|an|to|for|my|of|with|need|buy|call|pay|send|book|clean|finish|email|pick|return|` +
      `renew|submit|water|reply|go|take|remember)${WORD_END}`,
    "giu"
  ),
  it: new RegExp(
    `${WORD_START}(?:il|lo|la|gli|le|un|una|del|della|dal|per|che|non|sono|devo|poi|mia|mio|` +
      `chiamare|comprare|pagare|finire|pulire|prenotare|rispondere|ritirare|portare|andare|sistemare|vado)${WORD_END}|[àèéìòù]`,
    "giu"
  ),
  tr: new RegExp(
    `${WORD_START}(?:bir|ve|i[çc]in|laz[ıi]m|gerekiyor|ara|[öo]de|yap|bitir|temizle|d[üu]zenle|belki|[çc]ok|mesaj)${WORD_END}`,
    "giu"
  ),
};
// Letters only Turkish uses among the three languages. One alone may just be a
// name ("Ayşe") in an English or Italian task, so it takes two to count.
const TURKISH_LETTERS = /[ğışİçöü]/gu;
const MIN_TURKISH_LETTERS = 2;

// Turns a brain dump into task candidates with pattern rules only. The result
// has the same shape an AI model must return, so normalize.ts, the review policy
// and commit treat it exactly like an AI proposal.
export function parseBrainDumpWithRules(text: string): BrainDumpAiResult {
  const segments = text.split(SPLIT_PATTERN).map((s) => s.trim()).filter(Boolean);
  const candidates: AiTaskCandidate[] = [];
  const languages: Array<Language | null> = []; // per candidate; null = no clue in that segment
  const unparsed: string[] = [];

  for (const segment of segments) {
    const previous = candidates[candidates.length - 1];
    if (previous && CONDITION_CLAUSE.test(segment)) {
      previous.flexible = true;
      unparsed.push(segment);
      continue;
    }

    // Text past the task limit is reported as unparsed too.
    const outcome: SegmentOutcome =
      candidates.length < BRAIN_DUMP_MAX_CANDIDATES ? parseSegment(segment) : { kind: "unparsed" };
    if (outcome.kind === "task") {
      candidates.push(outcome.candidate);
      languages.push(outcome.language);
    } else if (outcome.kind === "detail" && previous) {
      // "email the landlord, 15 min": the detail completes the task before it, never overwriting it.
      previous.when ??= outcome.when;
      previous.dueTime ??= outcome.dueTime;
      previous.estimatedDurationMinutes ??= outcome.estimatedDurationMinutes;
    } else if (outcome.kind !== "empty") {
      unparsed.push(segment);
    }
  }

  // A task with no language clue of its own takes the dump's most common language.
  const fallbackLanguage = mostCommonLanguage(languages) ?? "en";
  candidates.forEach((candidate, i) => {
    candidate.language = languages[i] ?? fallbackLanguage;
    candidate.title = capitalize(candidate.title, candidate.language as Language);
  });

  return {
    schemaVersion: BRAIN_DUMP_SCHEMA_VERSION,
    detectedLanguages: [...new Set(candidates.map((c) => c.language))],
    candidates,
    unparsedFragments: fitUnparsedFragments(unparsed),
  };
}

// What one piece of the dump turned out to be.
type SegmentOutcome =
  // `language` is null when neither the title nor the segment gives a clue.
  | { kind: "task"; candidate: AiTaskCandidate; language: Language | null }
  // Only a date, time or duration ("15 min"): it belongs to the task before it.
  | ({ kind: "detail" } & Pick<AiTaskCandidate, "when" | "dueTime" | "estimatedDurationMinutes">)
  // Only joining words were left ("also").
  | { kind: "empty" }
  // Not a task: a remark, or too little to act on.
  | { kind: "unparsed" };

function parseSegment(segment: string): SegmentOutcome {
  if (isRemark(segment)) return { kind: "unparsed" };

  const ambiguities: AiTaskCandidate["ambiguities"] = [];
  const timeOfDay = TIME_OF_DAY.find(([, pattern]) => pattern.test(segment))?.[0] ?? null;
  let rest = segment;

  const time = extractTime(rest, timeOfDay);
  if (time) rest = rest.replace(time.matched, CUT);

  const duration = extractDuration(rest);
  if (duration) rest = rest.replace(duration.matched, CUT);

  const date = extractDate(segment);
  for (const piece of date?.cutAlways ?? []) rest = rest.replace(piece, CUT);
  if (date?.dayName && standsAlone(rest, date.dayName)) rest = rest.replace(date.dayName, CUT);
  rest = rest.replace(DEADLINE_AFTER_CUT, CUT);

  rest = rest.replace(TIME_OF_DAY_PHRASE, CUT).replace(TIME_OF_DAY_BESIDE_CUT, CUT);

  const somethingCut = rest.includes(CUT);
  const cleaned = rest
    .replaceAll(CUT, " ")
    .replace(MAYBE_WORD, " ")
    .replace(/!+/gu, " ")
    .replace(/[.?…\s]+$/u, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(EDGE_PRIORITY_WORD, "")
    .replace(PRIORITY_EDGE_WORD, "")
    .replace(LEADING_JOINER, "");
  const trimmed = somethingCut
    ? cleaned.replace(LEADING_PREPOSITION, "").replace(TRAILING_PREPOSITION, "")
    : cleaned;
  const title = truncate(trimmed.trim(), AI_RESULT_LIMITS.titleMaxLength);

  const when = date?.expression ?? null;
  const dueTime = time?.value ?? null;
  const estimatedDurationMinutes = duration?.minutes ?? null;
  if (title.length === 0) {
    return date || time || duration ? { kind: "detail", when, dueTime, estimatedDurationMinutes } : { kind: "empty" };
  }
  // The title is checked too: "çok yoruldum bugün" only reads as a remark once the date is cut.
  if (title.length < 3 || isRemark(title)) return { kind: "unparsed" };

  // One-word tasks ("dentist") are plausible but thin, so they get a second look.
  let confidence = title.includes(" ") ? 0.9 : 0.7;
  if (when?.kind === "vague") {
    confidence = Math.min(confidence, 0.8);
    ambiguities.push({ field: "due_date", reason: `"${when.text}" isn't a specific day` });
  }

  const language = detectLanguage(title) ?? detectLanguage(segment);
  const candidate: AiTaskCandidate = {
    title, // capitalized by the caller, once its language is settled
    sourceSpan: truncate(segment, AI_RESULT_LIMITS.sourceSpanMaxLength),
    language: language ?? "en", // settled by the caller once the whole dump is known
    notes: null,
    when,
    dueTime,
    timeOfDay,
    estimatedDurationMinutes,
    priority: isHighPriority(segment) ? "high" : null,
    energyRequired: null,
    flexible: MAYBE_WORD.test(segment) || INLINE_CONDITION.test(segment) || SOMEDAY_DATE.test(segment),
    context: [],
    category: CATEGORY_PRIORITY.find((categoryId) => CATEGORY_KEYWORDS[categoryId].test(segment)) ?? null,
    confidence,
    ambiguities,
  };
  return { kind: "task", candidate, language };
}

function isRemark(text: string): boolean {
  return REMARK_OPENING.test(text) || TURKISH_REMARK.test(text);
}

function isHighPriority(segment: string): boolean {
  return PRIORITY_WORD.test(segment) || PRIORITY_EDGE_WORD.test(segment.trim()) || PRIORITY_MARK.test(segment);
}

// True when `dayName` is at either end of `text` or led in by a word like "on",
// ignoring whatever was already cut around it.
function standsAlone(text: string, dayName: string): boolean {
  const start = text.indexOf(dayName);
  if (start === -1) return false;
  const outside = new RegExp(`[${CUT}\\s.,!?…]+`, "gu");
  const before = text.slice(0, start).replace(new RegExp(`[${CUT}\\s]+$`, "u"), "");
  const after = text.slice(start + dayName.length);
  return (
    before.replace(outside, "") === "" ||
    after.replace(outside, "") === "" ||
    DAY_LEAD_IN.test(before) ||
    DEADLINE_AFTER_DATE.test(after)
  );
}

interface ExtractedDate {
  expression: DateExpression;
  cutAlways: string[]; // pieces that can only be a date ("tomorrow", "within 3 days", "next")
  dayName: string | null; // a weekday name, cut only when it stands alone (see standsAlone)
}

// True when a deadline word sits right before the date or "kadar" right after it.
function isDeadline(segment: string, match: RegExpMatchArray): boolean {
  const start = match.index ?? 0;
  return (
    DEADLINE_BEFORE_DATE.test(segment.slice(0, start)) ||
    DEADLINE_AFTER_DATE.test(segment.slice(start + match[0].length))
  );
}

function extractDate(segment: string): ExtractedDate | null {
  const within = segment.match(WITHIN_DAYS);
  if (within) return daysAhead(within, "by");
  const inDays = segment.match(IN_DAYS);
  if (inDays) return daysAhead(inDays, "on");

  for (const [offsetDays, pattern] of RELATIVE_DAYS) {
    const match = segment.match(pattern);
    if (match) {
      return {
        expression: {
          kind: "relative_day",
          offsetDays,
          relation: isDeadline(segment, match) ? "by" : "on",
          text: match[0],
        },
        cutAlways: [match[0]],
        dayName: null,
      };
    }
  }

  for (const [weekday, pattern] of WEEKDAYS) {
    const match = segment.match(pattern);
    if (!match) continue;
    const nextWord = segment.match(NEXT_WORD)?.[0];
    const relation = nextWord ? "next" : isDeadline(segment, match) ? "by" : "on";
    return {
      expression: { kind: "weekday", weekday, relation, text: match[0] },
      cutAlways: nextWord ? [nextWord] : [],
      dayName: match[0],
    };
  }

  const weekend = segment.match(WEEKEND);
  if (weekend) {
    return {
      expression: {
        kind: "weekday",
        weekday: SATURDAY,
        relation: isDeadline(segment, weekend) ? "by" : "on",
        text: weekend[0],
      },
      cutAlways: [weekend[0]],
      dayName: null,
    };
  }

  const vague = segment.match(SOMEDAY_DATE) ?? segment.match(SOON_DATE);
  if (vague) return { expression: { kind: "vague", text: vague[0] }, cutAlways: [vague[0]], dayName: null };
  return null;
}

// Builds "N days from today" from a match whose first or second group holds N.
function daysAhead(match: RegExpMatchArray, relation: "on" | "by"): ExtractedDate {
  const offsetDays = Math.min(MAX_DAYS_AHEAD, Number(match[1] ?? match[2]));
  return {
    expression: { kind: "relative_day", offsetDays, relation, text: match[0] },
    cutAlways: [match[0]],
    dayName: null,
  };
}

// `timeOfDay` settles a bare hour: "7" with "evening" or "afternoon" is 19:00.
function extractTime(text: string, timeOfDay: TimeOfDay | null): { value: string; matched: string } | null {
  const match = text.match(TIME_PATTERN);
  if (!match) return null;

  const hourText = match[1] ?? match[4] ?? match[6] ?? match[8] ?? match[10];
  const minuteText = match[2] ?? match[5] ?? match[7] ?? "00";
  const meridiem = (match[3] ?? match[9] ?? "").toLowerCase();
  const isLaterHalf =
    meridiem === "pm" || (meridiem === "" && (timeOfDay === "evening" || timeOfDay === "afternoon"));

  let hour = Number(hourText);
  if (isLaterHalf && hour < NOON_HOUR) hour += NOON_HOUR;
  if (meridiem === "am" && hour === NOON_HOUR) hour = 0;
  const minute = Number(minuteText);
  if (hour > 23 || minute > 59) return null;

  return { value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, matched: match[0] };
}

function extractDuration(text: string): { minutes: number; matched: string } | null {
  const minutesMatch = text.match(MINUTES_PATTERN);
  if (minutesMatch) return { minutes: clampDuration(Number(minutesMatch[1])), matched: minutesMatch[0] };

  const hoursMatch = text.match(HOURS_PATTERN);
  if (hoursMatch) {
    return { minutes: clampDuration(Number(hoursMatch[1].replace(",", ".")) * 60), matched: hoursMatch[0] };
  }
  return null;
}

// Keeps a written duration ("0h", "999 min") inside what the contract accepts.
function clampDuration(minutes: number): number {
  return Math.min(AI_RESULT_LIMITS.maxDurationMinutes, Math.max(1, Math.round(minutes)));
}

// The language with the most distinctive words in the text, or null when it holds
// no clue. Ties go to English, so one foreign name doesn't decide it. Tried on the
// title first, so a date word in another language ("domani call the bank") doesn't either.
function detectLanguage(text: string): Language | null {
  const count = (language: Language) => text.match(LANGUAGE_WORDS[language])?.length ?? 0;
  const english = count("en");
  const italian = count("it");
  const turkishLetters = text.match(TURKISH_LETTERS)?.length ?? 0;
  const turkish = count("tr") + (turkishLetters >= MIN_TURKISH_LETTERS ? turkishLetters : 0);
  if (english === 0 && italian === 0 && turkish === 0) return null;
  if (turkish > english && turkish >= italian) return "tr";
  if (italian > english) return "it";
  return "en";
}

function mostCommonLanguage(languages: Array<Language | null>): Language | null {
  const counts = new Map<Language, number>();
  for (const language of languages) {
    if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

// Uppercases the first letter by the task's own language, not the server's
// locale: Turkish "ilaç" becomes "İlaç", English "ice" stays "Ice".
function capitalize(value: string, language: Language): string {
  return value.charAt(0).toLocaleUpperCase(language) + value.slice(1);
}

// Cuts text to a length without leaving half of a two-part character (an emoji) at the end.
function truncate(text: string, maxLength: number): string {
  return text.slice(0, maxLength).replace(/[\uD800-\uDBFF]$/u, "").trim();
}

// Fits the unparsed text into the contract's limits. When there are too many
// pieces, the last slot holds the rest joined together, so nothing is dropped
// short of the contract's own length limit.
function fitUnparsedFragments(fragments: string[]): string[] {
  const { maxUnparsedFragments, unparsedFragmentMaxLength } = AI_RESULT_LIMITS;
  const fitted =
    fragments.length <= maxUnparsedFragments
      ? fragments
      : [...fragments.slice(0, maxUnparsedFragments - 1), fragments.slice(maxUnparsedFragments - 1).join(", ")];
  return fitted.map((fragment) => truncate(fragment, unparsedFragmentMaxLength));
}

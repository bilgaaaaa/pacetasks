import type { CategoryId } from "../categories.ts";
import { AI_RESULT_LIMITS, BRAIN_DUMP_MAX_CANDIDATES, BRAIN_DUMP_SCHEMA_VERSION, TIMES_OF_DAY } from "./aiResult.ts";
import type { AiTaskCandidate, BrainDumpAiResult, DateExpression, TimeOfDay } from "./aiResult.ts";
import {
  CATEGORY_WORDS,
  FUNCTION_WORDS,
  LANGUAGES,
  MODAL_WORDS,
  MONTH_NAMES,
  VERBS,
  WEEKDAY_NAMES,
} from "./rulesLexicon.ts";
import type { CategoryWords, Language } from "./rulesLexicon.ts";

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
export const RULES_PARSER_VERSION = "rules-4";

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

// Phone keyboards type the curly apostrophe, so "7’de" must read like "7'de".
const APOSTROPHE = "['’]";

// Turkish case endings that attach to a day or a time: "cumaya", "pazartesi'ye", "10:00'da".
const TR_CASE_SUFFIX = `(?:${APOSTROPHE}?(?:y?[ae]|[dt][ae]))?`;

// Sentence ends, list separators and words that always start a new task. Not
// separators: a decimal comma ("1,5 ore"), the dot of an abbreviation
// ("Dr. Smith") and "prima o poi" (sooner or later).
const ABBREVIATION = "dr|mr|mrs|ms|prof|sig|dott|vs|etc";
const SPLIT_PATTERN = new RegExp(
  `\\n|;|(?<!\\d),|,(?!\\d)` +
    `|(?<=[.!?])(?<!${WORD_START}(?:${ABBREVIATION})\\.)\\s+` + // the mark stays with its sentence ("taxes!!")
    `|(?<!prima o)\\s+(?:and then|and also|then|e poi|poi|ve sonra)\\s+`,
  "iu"
);
// Words that join two tasks ("call mom and email the boss") as often as two
// parts of one ("buy bread and milk"), so startsNewTask decides each time.
const JOINER_PATTERN = /(\s+(?:and|e|ve|sonra)\s+)/iu;

// English possessive on a day name ("Thursday's demo"), matched together with the day.
const EN_POSSESSIVE = `(?:${APOSTROPHE}s)?`;

// Two Turkish day names are also everyday words, so they need more context:
// "sali" without its dotless ı only counts before "günü" (Italian "sali" = salts),
// and "pazara" (to the market) only before "kadar" (by Sunday).
const TURKISH_DAY_FORMS: Record<number, string> = {
  2: `salı${TR_CASE_SUFFIX}|sali(?=\\s+g[üu]n[üu])`,
  7: "pazar|pazara(?=\\s+kadar)",
};
const WEEKDAYS: Array<[number, RegExp]> = WEEKDAY_NAMES.en.map((english, index) => {
  const weekday = index + 1;
  const turkish = TURKISH_DAY_FORMS[weekday] ?? `${WEEKDAY_NAMES.tr[index]}${TR_CASE_SUFFIX}`;
  return [weekday, words(`${english}${EN_POSSESSIVE}|${WEEKDAY_NAMES.it[index]}|${turkish}`)];
});
const SATURDAY = 6;
// "cuma günü": with this word after it a day name is a date, never part of the task's name.
const TR_DAY_WORD = new RegExp(`^\\s+g[üu]n[üu](?:n[ae]|nde)?${WORD_END}`, "iu");

// Longest phrases first, so "day after tomorrow" never reads as "tomorrow".
const RELATIVE_DAYS: Array<[number, RegExp]> = [
  [2, words("the day after tomorrow|day after tomorrow|dopodomani|[öo]b[üu]r g[üu]n|yar[ıi]ndan sonra")],
  [1, words("tomorrow|domani|yar[ıi]n")],
  [
    0,
    words(
      "today|tonight|this (?:morning|afternoon|evening)|oggi|stasera|stamattina|stanotte|bug[üu]n|" +
        "bu (?:sabah|ak[şs]am|gece)"
    ),
  ],
];
// "akşam" alone means tonight, except in "akşam yemeği" (dinner). Read after
// the day names, so "çarşamba akşamı" stays Wednesday.
const IMPLIED_TODAY = words("ak[şs]ama?(?!\\s+yeme)");

// "within 3 days", "entro 3 giorni", "3 gün içinde": a deadline N days from today.
const WITHIN_DAYS = words(
  "(?:within|in the next|entro|nei prossimi)\\s+(\\d{1,3})\\s+(?:days?|giorn[oi])|(\\d{1,3})\\s+g[üu]n\\s+i[çc]inde"
);
// "in 3 days", "tra 3 giorni", "3 gün sonra": that day, N days from today.
const IN_DAYS = words("(?:in|tra|fra)\\s+(\\d{1,3})\\s+(?:days?|giorn[oi])|(\\d{1,3})\\s+g[üu]n\\s+sonra");
const MAX_DAYS_AHEAD = 365;

// With a day name it is that day of next week; alone it only says "not this week".
const NEXT_WEEK =
  "next week|(?:la\\s+)?(?:prossima settimana|settimana prossima)|" +
  "(?:gelecek|[öo]n[üu]m[üu]zdeki) hafta(?:ya|da)?(?!\\s+son)|haftaya";
const NEXT_WEEK_PATTERN = words(NEXT_WEEK);
// "next Friday", "gelecek cuma", "venerdì prossimo": the word touches the day name.
const NEXT_WORD = "next|prossim[oa]|gelecek|[öo]n[üu]m[üu]zdeki";
const NEXT_BEFORE_DAY = new RegExp(`${WORD_START}(?:${NEXT_WORD})\\s+$`, "iu");
const NEXT_AFTER_DAY = new RegExp(`^\\s+prossim[oa]${WORD_END}`, "iu");

const WEEKEND = words(
  `(?:(?:(?<next>il prossimo|${NEXT_WORD})|this|at the|on the|over the|the|questo|nel|il|bu)\\s+)?` +
    "(?:weekend|fine settimana|hafta sonu(?:n[ae]|nda)?)(?<nextAfter>\\s+prossimo)?"
);

const DAY_NUMBER = "(?<day>\\d{1,2})";
const ORDINAL = "(?:st|nd|rd|th)";
const ANY_MONTH = `(?<month>${LANGUAGES.flatMap((language) => MONTH_NAMES[language]).join("|")})`;
const MONTHS: RegExp[] = MONTH_NAMES.en.map((english, index) =>
  words(`${english}|${MONTH_NAMES.it[index]}|${MONTH_NAMES.tr[index]}`)
);
// What an ordinal counts when it is not a day of the month ("on the 3rd floor").
const ORDINAL_NOUN = "floor|grade|place|street|avenue|birthday|anniversary|time|draft|edition|chapter|page|row|step";
// A day of the month, with its month ("15 ekim'de", "il 15 ottobre", "october 15")
// or without ("by the 15th", "entro il 20", "ayın 15'inde", "15'ine kadar"). A bare
// Italian "il 15" counts only at either end of the text: mid-sentence it may be "il 3 in 1".
const DAY_OF_MONTH: RegExp[] = [
  words(
    `(?:the\\s+|il\\s+|l${APOSTROPHE})?${DAY_NUMBER}(?:${ORDINAL}|°)?\\s+(?:of\\s+)?${ANY_MONTH}${TR_CASE_SUFFIX}`
  ),
  words(`${ANY_MONTH}\\s+(?:the\\s+)?${DAY_NUMBER}${ORDINAL}?`),
  words(`(?<=(?:on|by|before|until)\\s+)the\\s+${DAY_NUMBER}${ORDINAL}(?!\\s+(?:${ORDINAL_NOUN}))`),
  words(`(?<=^\\s*|(?:entro|per)\\s+)il\\s+${DAY_NUMBER}(?![:.,]?\\d|\\s*[°º%])`),
  words(`il\\s+${DAY_NUMBER}(?=[\\s.!]*$)`),
  words(`ay[ıi]n\\s+${DAY_NUMBER}(?:${APOSTROPHE}?\\p{L}+)?`),
  words(`${DAY_NUMBER}${APOSTROPHE}(?:s[ıiuü]|[ıiuü])n(?:d[ae]|[ae])`),
];
const MAX_DAY_OF_MONTH = 31;
const END_OF_MONTH = words(
  "(?:at\\s+)?(?:the\\s+)?end of (?:the |this )?month|(?:a |alla |la )?fine (?:del |di questo )?mese|" +
    "ay(?:[ıi]n)? sonu(?:n[ae]|nda)?"
);

// "every Monday" repeats, which a task cannot: the words stay in the title and no date is set.
const RECURRING_BEFORE_DATE = new RegExp(`${WORD_START}(?:every|each|ogni|tutt[ie] (?:i|le)|her)\\s+$`, "iu");

// No exact day. "Someday" wording also makes the task a maybe; "soon" and
// "next week" wording doesn't: the task is firm, only its day is open.
const SOMEDAY_DATE = words(
  "someday|some day|sometime|eventually|one of these days|prima o poi|un giorno|bir ara|bir g[üu]n"
);
const SOON_DATE = words(`soon|presto|yak[ıi]nda|${NEXT_WEEK}`);

// A date is a deadline only when the deadline word touches it: "by Friday",
// "entro venerdì", "cumaya kadar"; a stray "before" elsewhere doesn't count.
const DEADLINE_BEFORE_DATE = new RegExp(`${WORD_START}(?:by|before|until|entro|prima di)\\s+(?:the\\s+)?$`, "iu");
const DEADLINE_AFTER_DATE = new RegExp(`^\\s*(?:kadar|dek)${WORD_END}`, "iu");
// The same word left behind once its date is cut ("kirayı cumaya kadar öde").
const DEADLINE_AFTER_CUT = new RegExp(`${CUT}\\s*(?:kadar|dek)${WORD_END}`, "iu");

// A day name is cut from the title when it stands alone: at either end of the
// text, beside something already cut, or led in by one of these words. Mid-sentence
// it may be part of the name ("watch Monday night football"), so it stays; the date is still set.
const DAY_LEAD_IN = new RegExp(
  `${WORD_START}(?:on|by|before|until|this|for|entro|prima di|di|il|per|questo|bu)\\s*$`,
  "iu"
);
// Words that can only have pointed at the date that was cut right after them
// ("call the bank on ␣ about the loan"), wherever they are in the title.
const LEAD_IN_BEFORE_CUT = new RegExp(
  `${WORD_START}(?:(?:on|by|before|until|this|entro|prima di|per|il|quest[oa]|bu)\\s+)+(?=${CUT})`,
  "giu"
);

const HOUR = "(?<hour>\\d{1,2})";
const MINUTE = "(?<minute>\\d{2})";
const MERIDIEM = "(?<meridiem>am|pm)";
// "saat 3 gibi", "alle 3 circa": about that time, which is as exact as a task gets.
const ROUGHLY = "(?:\\s+(?:gibi|civar[ıi](?:nda)?|circa))?";
const CURRENCY = "[€$£₺]|euros?|eur|dollars?|usd|lira|tl|pounds?";
// Clock times, most explicit first. A dot counts as a time separator with a
// lead-in word or a Turkish case ending ("alle 18.30", "9.30'da"); a bare one only
// where it cannot be a price: a quarter past a two-digit hour ("14.30", not "4.30" or "12.50 euros").
const TIME_PATTERNS: RegExp[] = [
  words(
    `(?:at around|at about|at|alle ore|alle|ore|verso le|intorno alle|saat)\\s*${HOUR}` +
      `(?:(?:[:.]|\\s+e\\s+)${MINUTE}|(?<half>\\s+e\\s+mezz[ao]|\\s+bu[çc]uk))?\\s*${MERIDIEM}?${TR_CASE_SUFFIX}${ROUGHLY}`
  ),
  words(`${HOUR}:${MINUTE}${TR_CASE_SUFFIX}${ROUGHLY}`),
  words(`${HOUR}\\.${MINUTE}${APOSTROPHE}[dt][ae]`),
  words(`${HOUR}\\s*${MERIDIEM}`),
  words(`${HOUR}${APOSTROPHE}[dt][ae]${ROUGHLY}`), // Turkish "7'de"
  new RegExp(
    `(?<![\\p{L}\\p{N}.,€$£₺])(?<hour>1\\d|2[0-3])\\.(?<minute>00|15|30|45)(?![\\p{L}\\p{N}]|[.,]\\d)` +
      `(?!\\s*(?:${CURRENCY}))`,
    "iu"
  ),
];
// "at 7 in the evening" means 19:00: hours below this are moved to the later half of the day.
const NOON_HOUR = 12;
// "meeting at 3" is never 03:00: with nothing saying morning, hours up to this one
// are afternoon. A time written with minutes is as often a morning train ("6:45"), so it turns earlier.
const LAST_ASSUMED_PM_HOUR = 7;
const LAST_ASSUMED_PM_HOUR_WITH_MINUTES = 5;
const HALF_HOUR_MINUTES = 30;

// "in 2 hours", "2 saat sonra", "bir saat içinde" name a moment, not how long
// the task takes; the parser has no clock to place it, so the words stay in the title.
const NOT_FROM_NOW = `(?<!${WORD_START}(?:in|within|tra|fra|entro)\\s+)`;
const NOT_UNTIL_LATER = "(?!\\s+(?:sonra|i[çc]inde))";

function durationWords(alternatives: string): RegExp {
  return new RegExp(`${NOT_FROM_NOW}${WORD_START}(?:${alternatives})${NOT_UNTIL_LATER}`, "iu");
}

const MINUTES_PATTERN = durationWords(`(\\d{1,3})\\s*(?:min|mins|minutes?|minut[oi]|dk|dakika)${WORD_END}`);
// Not followed by "&" ("2 H&M shirts") or by a number (Turkish "saat 10" means "at 10").
const HOURS_PATTERN = durationWords(
  "(\\d(?:[.,]5)?)\\s*(?:h|hr|hrs|hours?|or[ae]|saat)(?![&\\p{L}\\p{N}])(?!\\s*\\d)"
);
// Durations written in words, longest first so "an hour and a half" never reads as "an hour".
const DURATION_PHRASES: Array<[number, RegExp]> = (
  [
    [90, `an hour and a half|un${APOSTROPHE}ora e mezz[ao]|bir bu[çc]uk saat`],
    [30, `half an hour|half hour|mezz${APOSTROPHE}?ora|yar[ıi]m saat`],
    [60, `(?<!half )an hour|one hour|un${APOSTROPHE}ora|bir saat`],
  ] as Array<[number, string]>
).map(([minutes, phrase]) => [minutes, durationWords(`(?:${phrase})${WORD_END}`)]);

// `bare` words are cut only right next to a cut date ("tomorrow morning"), so
// "Morning run" keeps its name; `phrase`s are only ever about when. "Before/after
// work" count as morning/evening, which normalize.ts turns into the work-hour timing.
const TIME_OF_DAY_WORDS: Record<TimeOfDay, { bare: string; phrase: string }> = {
  morning: {
    bare: "morning|mattina|stamattina|sabah(?:[ıi]|a)?",
    phrase: "before work|prima del lavoro|i[şs]ten [öo]nce",
  },
  afternoon: { bare: "afternoon|pomeriggio|[öo][ğg]len", phrase: "[öo][ğg]leden sonra" },
  evening: {
    bare: "evening|night|tonight|sera|stasera|notte|ak[şs]am(?:[ıi]|a)?|gece",
    phrase: "after work|dopo il lavoro|i[şs]ten sonra",
  },
};
const TIME_OF_DAY: Array<[TimeOfDay, RegExp]> = TIMES_OF_DAY.map((timeOfDay) => [
  timeOfDay,
  words(`${TIME_OF_DAY_WORDS[timeOfDay].bare}|${TIME_OF_DAY_WORDS[timeOfDay].phrase}`),
]);
const BARE_TIME_OF_DAY = TIMES_OF_DAY.map((timeOfDay) => TIME_OF_DAY_WORDS[timeOfDay].bare).join("|");
const TIME_OF_DAY_PHRASE = words(
  `(?:in the|at|di|la|al|nel) (?:${BARE_TIME_OF_DAY})|` +
    TIMES_OF_DAY.map((timeOfDay) => TIME_OF_DAY_WORDS[timeOfDay].phrase).join("|"),
  "giu"
);
const TIME_OF_DAY_BESIDE_CUT = new RegExp(
  `${CUT}\\s*(?:${BARE_TIME_OF_DAY})${WORD_END}|${WORD_START}(?:${BARE_TIME_OF_DAY})\\s*${CUT}`,
  "giu"
);
// "pay the bill friday morning": the day name ends the text once this is set aside.
const TIME_OF_DAY_AFTER_DAY = new RegExp(`^\\s+(?:${BARE_TIME_OF_DAY})${WORD_END}`, "iu");

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

// English adds -s/-es; Italian changes the last vowel ("riunione" → "riunioni", "ufficio" → "uffici").
const ITALIAN_PLURAL_ENDING: Record<string, string> = { a: "[ae]", e: "[ei]", o: "[oi]" };

function italianWithPlural(word: string): string {
  if (word.endsWith("io")) return `${word.slice(0, -1)}o?`;
  const ending = ITALIAN_PLURAL_ENDING[word.slice(-1)];
  return ending ? `${word.slice(0, -1)}${ending}` : word;
}

function categoryPattern({ en, it, exact, trStems }: CategoryWords): RegExp {
  return words(
    [
      ...en.map((word) => `${word}(?:e?s)?`),
      ...it.map(italianWithPlural),
      ...exact,
      ...trStems.map((stem) => `${stem}\\p{L}*`),
    ].join("|")
  );
}

// Which category wins when a task mentions several ("call the dentist" is health, not personal).
const CATEGORY_PRIORITY: CategoryId[] = ["work", "shopping", "home", "health", "personal"];
const CATEGORY_KEYWORDS: Array<[CategoryId, RegExp]> = CATEGORY_PRIORITY.map((categoryId) => [
  categoryId,
  categoryPattern(CATEGORY_WORDS[categoryId]),
]);

// Joining words left at the start of a segment ("also renew…", "e pagare…"); always
// trimmed. Only whole words count: the "e" of "e-mail" is not one.
const LEADING_JOINER = new RegExp(
  `^(?:(?:also|plus|and|then|anche|inoltre|e|poi|ayr[ıi]ca|bir de|ve|sonra)(?:[\\s,]+|$))+`,
  "iu"
);
// Punctuation that led in from a cut date ("domani: palestra").
const LEADING_PUNCTUATION = /^[\s:,–-]+/u;
// Words that only pointed at a date, time or duration. Trimmed from the title's
// edges, and only when something was actually cut out, so "put the washing
// machine on" and "Turn on the heating" keep their words.
const DATE_PREPOSITION = "by|before|until|at|on|entro|prima di|alle|ore|saat|i[çc]in|kadar";
const LEADING_PREPOSITION = new RegExp(`^(?:(?:${DATE_PREPOSITION}|di|of)${WORD_END}[\\s,]*)+`, "iu");
const TRAILING_PREPOSITION = new RegExp(`(?:[\\s,]*${WORD_START}(?:${DATE_PREPOSITION}|for|per|in))+$`, "iu");

// A joining word starts a new task when what follows opens like one: with a verb
// in English and Italian ("…and email the boss", "…e comprare il pane").
const ITALIAN_INFINITIVE = "\\p{L}{2,}(?:[aei]re|rre)(?:si|l[aoie]|gli|mi|ti|ci)?";
const CLAUSE_START: Record<"en" | "it", RegExp> = {
  en: new RegExp(`^(?:${[...MODAL_WORDS.en, ...VERBS.en].join("|")})${WORD_END}\\s+\\S`, "iu"),
  it: new RegExp(
    `^(?:${[...MODAL_WORDS.it, ...VERBS.it].join("|")}|${ITALIAN_INFINITIVE})${WORD_END}\\s+\\S`,
    "iu"
  ),
};
// Turkish puts the verb last, so the question is whether the text before the
// joiner already ended a task: "annemi ara ve…" did, "ekmek ve…" did not.
const TURKISH_CLAUSE_END = new RegExp(
  `${WORD_START}(?:${[...VERBS.tr, ...MODAL_WORDS.tr].join("|")}|` +
    `\\p{L}+(?:[ae]c[ae][ğg][ıi]m|m[ae]l[ıi]y[ıi]m|[ıiuü]yorum))[.!?…]*\\s*$`,
  "iu"
);
const STARTS_OWN_TASK: Record<string, (left: string, right: string) => boolean> = {
  and: (_left, right) => CLAUSE_START.en.test(right),
  e: (_left, right) => CLAUSE_START.it.test(right),
  ve: (left) => TURKISH_CLAUSE_END.test(left),
  // "Ali'yi sonra ara" (call Ali later) is one task: a lone verb after "sonra" is not a second one.
  sonra: (left, right) => TURKISH_CLAUSE_END.test(left) && /\s/u.test(right.trim()),
};

// Distinctive everyday words per language, used to tag a task's language.
function languageWords(language: Language, verbs: string[]): string {
  const tables = [FUNCTION_WORDS, MODAL_WORDS, WEEKDAY_NAMES, MONTH_NAMES];
  return words([...tables.flatMap((table) => table[language]), ...verbs].join("|")).source;
}
// An article fused to its noun ("l'aspirapolvere", "un'amica") is Italian on its own.
const ITALIAN_ELISION = `${WORD_START}(?:l|un|d|dell|all|nell|sull|dall)${APOSTROPHE}(?=\\p{L})`;
// Turkish verbs count only where Turkish puts them, at the end (see
// TURKISH_CLAUSE_END): "al", "at" and "git" are other words in "pane al forno" or "git push".
const LANGUAGE_WORDS: Record<Language, RegExp> = {
  en: new RegExp(languageWords("en", VERBS.en), "giu"),
  it: new RegExp(`${languageWords("it", VERBS.it)}|${ITALIAN_ELISION}|[àèéìòù]`, "giu"),
  tr: new RegExp(languageWords("tr", []), "giu"),
};
// Letters only Turkish uses among the three languages. One ı, ğ, ş or İ is
// enough; ç, ö and ü also appear in foreign names, so they count from two letters up.
const TURKISH_ONLY_LETTERS = /[ığşİ]/giu;
const TURKISH_SHARED_LETTERS = /[çöü]/giu;
const MIN_TURKISH_LETTERS = 2;

// Turns a brain dump into task candidates with pattern rules only. The result
// has the same shape an AI model must return, so normalize.ts, the review policy
// and commit treat it exactly like an AI proposal. `localeHint` is the phone's
// locale: it settles the language only when the text itself gives no clue.
export function parseBrainDumpWithRules(text: string, localeHint: string | null = null): BrainDumpAiResult {
  const segments = text
    .split(SPLIT_PATTERN)
    .flatMap(splitAtJoiners)
    .map((s) => s.trim())
    .filter(Boolean);
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
  const fallbackLanguage = mostCommonLanguage(languages) ?? languageOfLocale(localeHint) ?? "en";
  candidates.forEach((candidate, i) => {
    const language = languages[i] ?? fallbackLanguage;
    candidate.language = language;
    candidate.title = capitalize(candidate.title, language);
  });

  return {
    schemaVersion: BRAIN_DUMP_SCHEMA_VERSION,
    detectedLanguages: [...new Set(candidates.map((c) => c.language))],
    candidates,
    unparsedFragments: fitUnparsedFragments(unparsed),
  };
}

// Splits at "and / e / ve / sonra" only where a new task starts; a list of
// things ("bread and milk") stays one task.
function splitAtJoiners(text: string): string[] {
  const [first, ...rest] = text.split(JOINER_PATTERN); // text, joiner, text, joiner, …
  const tasks = [first];
  for (let i = 0; i < rest.length; i += 2) {
    const [joiner, right] = [rest[i], rest[i + 1]];
    const left = tasks[tasks.length - 1];
    if (startsNewTask(left, joiner.trim().toLowerCase(), right)) tasks.push(right);
    else tasks[tasks.length - 1] = `${left}${joiner}${right}`;
  }
  return tasks;
}

// True when `right` is its own task: a condition, something with its own verb,
// or something with its own day or time when `left` has one too ("Marco e Anna
// cena sabato" shares one day, "dentist at 5 and gym at 7" does not).
function startsNewTask(left: string, joiner: string, right: string): boolean {
  if (CONDITION_CLAUSE.test(right.trim())) return true;
  if (hasDetail(left) && hasDetail(right)) return true;
  const opening = withoutLeadingDate(right).replace(MAYBE_WORD, "").trim().replace(LEADING_JOINER, "");
  return STARTS_OWN_TASK[joiner](left, opening);
}

function hasDetail(text: string): boolean {
  return (
    extractDate(text) !== null ||
    extractTime(text, null) !== null ||
    extractDuration(text) !== null ||
    TIME_OF_DAY.some(([, pattern]) => pattern.test(text))
  );
}

// "…e sabato andare al mercato": the verb comes right after the day.
function withoutLeadingDate(text: string): string {
  const date = extractDate(text);
  const opening = text.trimStart();
  const lead = [date?.dayName, ...(date?.cutAlways ?? [])].find((piece) => piece && opening.startsWith(piece));
  return lead ? opening.slice(lead.length) : opening;
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

  rest = rest.replace(TIME_OF_DAY_PHRASE, CUT);

  const date = extractDate(segment);
  for (const piece of date?.cutAlways ?? []) rest = rest.replace(piece, CUT);
  if (date?.dayName && standsAlone(rest, date.dayName)) rest = rest.replace(date.dayName, CUT);
  rest = rest.replace(DEADLINE_AFTER_CUT, CUT).replace(TIME_OF_DAY_BESIDE_CUT, CUT).replace(LEAD_IN_BEFORE_CUT, "");

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
    ? cleaned.replace(LEADING_PUNCTUATION, "").replace(LEADING_PREPOSITION, "").replace(TRAILING_PREPOSITION, "")
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
    category: CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(segment))?.[0] ?? null,
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

// True when `dayName` is at either end of `text`, touches something already
// cut, or is led in by a word like "on".
function standsAlone(text: string, dayName: string): boolean {
  const start = text.indexOf(dayName);
  if (start === -1) return false;
  const outside = new RegExp(`[${CUT}\\s.,!?…]+`, "gu");
  const isBlank = (piece: string) => piece.replace(outside, "") === "";
  const before = text.slice(0, start);
  const after = text.slice(start + dayName.length);
  return (
    isBlank(before) ||
    isBlank(after.replace(TIME_OF_DAY_AFTER_DAY, "")) ||
    before.trimEnd().endsWith(CUT) ||
    after.trimStart().startsWith(CUT) ||
    DAY_LEAD_IN.test(before) ||
    DEADLINE_AFTER_DATE.test(after)
  );
}

interface ExtractedDate {
  expression: DateExpression;
  cutAlways: string[]; // pieces that can only be a date ("tomorrow", "within 3 days", "next friday")
  dayName: string | null; // a weekday name, cut only when it stands alone (see standsAlone)
}

// Where a date sits in its segment: [start, end).
type Span = [number, number];

function spanOf(match: RegExpMatchArray): Span {
  const start = match.index ?? 0;
  return [start, start + match[0].length];
}

// True when a deadline word sits right before the date or "kadar" right after it.
function isDeadline(segment: string, [start, end]: Span): boolean {
  return DEADLINE_BEFORE_DATE.test(segment.slice(0, start)) || DEADLINE_AFTER_DATE.test(segment.slice(end));
}

function relationOf(segment: string, span: Span): "on" | "by" {
  return isDeadline(segment, span) ? "by" : "on";
}

function isRecurring(segment: string, [start]: Span): boolean {
  return RECURRING_BEFORE_DATE.test(segment.slice(0, start));
}

function findWeekday(segment: string): { weekday: number; match: RegExpMatchArray } | null {
  for (const [weekday, pattern] of WEEKDAYS) {
    const match = segment.match(pattern);
    if (match && !isRecurring(segment, spanOf(match))) return { weekday, match };
  }
  return null;
}

function extractDate(segment: string): ExtractedDate | null {
  const within = segment.match(WITHIN_DAYS);
  if (within) return daysAhead(within, "by");
  const inDays = segment.match(IN_DAYS);
  if (inDays) return daysAhead(inDays, "on");

  for (const [offsetDays, pattern] of RELATIVE_DAYS) {
    const match = segment.match(pattern);
    if (match) return relativeDay(segment, match, offsetDays);
  }

  const monthDate = extractMonthDate(segment);
  if (monthDate) return monthDate;

  const day = findWeekday(segment);
  if (day) return weekdayDate(segment, day.weekday, day.match);

  const weekend = segment.match(WEEKEND);
  if (weekend && !isRecurring(segment, spanOf(weekend))) {
    const isNext = Boolean(weekend.groups?.next ?? weekend.groups?.nextAfter);
    const relation = relationOf(segment, spanOf(weekend));
    return {
      expression: isNext
        ? { kind: "weekday", weekday: SATURDAY, relation: "next", text: weekend[0] }
        : { kind: "weekend", relation, text: weekend[0] },
      cutAlways: [weekend[0]],
      dayName: null,
    };
  }

  const impliedToday = segment.match(IMPLIED_TODAY);
  if (impliedToday) return relativeDay(segment, impliedToday, 0);

  const vague = segment.match(SOMEDAY_DATE) ?? segment.match(SOON_DATE);
  if (vague) return { expression: { kind: "vague", text: vague[0] }, cutAlways: [vague[0]], dayName: null };
  return null;
}

function relativeDay(segment: string, match: RegExpMatchArray, offsetDays: number): ExtractedDate {
  return {
    expression: { kind: "relative_day", offsetDays, relation: relationOf(segment, spanOf(match)), text: match[0] },
    cutAlways: [match[0]],
    dayName: null,
  };
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

// A day name with the words that pin it down: "cuma günü", "next friday",
// "haftaya cuma". Those can only be a date, so the whole phrase is always cut.
function weekdayDate(segment: string, weekday: number, match: RegExpMatchArray): ExtractedDate {
  let [start, end] = spanOf(match);
  const dayWord = segment.slice(end).match(TR_DAY_WORD);
  end += dayWord?.[0].length ?? 0;

  const nextWeek = segment.match(NEXT_WEEK_PATTERN);
  const nextBefore = nextWeek ? null : segment.slice(0, start).match(NEXT_BEFORE_DAY);
  const nextAfter = nextWeek ? null : segment.slice(end).match(NEXT_AFTER_DAY);
  start -= nextBefore?.[0].length ?? 0;
  end += nextAfter?.[0].length ?? 0;

  const isNext = Boolean(nextBefore ?? nextAfter);
  const relation = nextWeek ? "next_week" : isNext ? "next" : relationOf(segment, [start, end]);
  const isOnlyADate = Boolean(nextWeek ?? dayWord) || isNext;
  return {
    expression: { kind: "weekday", weekday, relation, text: match[0] },
    cutAlways: [...(nextWeek ? [nextWeek[0]] : []), ...(isOnlyADate ? [segment.slice(start, end)] : [])],
    dayName: isOnlyADate ? null : match[0],
  };
}

// A day of the month or the month's end. A day name beside it ("Friday 16
// October") is cut like any other, but the written date decides the day.
function extractMonthDate(segment: string): ExtractedDate | null {
  const dayName = findWeekday(segment)?.match[0] ?? null;

  for (const pattern of DAY_OF_MONTH) {
    const match = segment.match(pattern);
    const day = Number(match?.groups?.day);
    if (!match || day < 1 || day > MAX_DAY_OF_MONTH) continue;
    const monthName = match.groups?.month;
    const month = monthName ? MONTHS.findIndex((monthPattern) => monthPattern.test(monthName)) + 1 : null;
    const relation = relationOf(segment, spanOf(match));
    return { expression: { kind: "month_day", month, day, relation, text: match[0] }, cutAlways: [match[0]], dayName };
  }

  const monthEnd = segment.match(END_OF_MONTH);
  if (!monthEnd) return null;
  const relation = relationOf(segment, spanOf(monthEnd));
  return { expression: { kind: "month_end", relation, text: monthEnd[0] }, cutAlways: [monthEnd[0]], dayName };
}

// `timeOfDay` settles a bare hour: "7" with "evening" or "afternoon" is 19:00,
// with "morning" 07:00, and with nothing an early hour is taken as afternoon.
function extractTime(text: string, timeOfDay: TimeOfDay | null): { value: string; matched: string } | null {
  for (const pattern of TIME_PATTERNS) {
    const match = text.match(pattern);
    if (!match?.groups) continue;

    const { hour: hourText, minute: minuteText, meridiem: meridiemText, half } = match.groups;
    const meridiem = (meridiemText ?? "").toLowerCase();
    let hour = Number(hourText);
    // A leading zero ("07:30") is 24-hour notation, which already says morning.
    const lastPmHour = minuteText || half ? LAST_ASSUMED_PM_HOUR_WITH_MINUTES : LAST_ASSUMED_PM_HOUR;
    const isAssumedPm = timeOfDay === null && !hourText.startsWith("0") && hour >= 1 && hour <= lastPmHour;
    const isLaterHalf =
      meridiem === "pm" || (meridiem === "" && (timeOfDay === "evening" || timeOfDay === "afternoon" || isAssumedPm));

    if (isLaterHalf && hour < NOON_HOUR) hour += NOON_HOUR;
    if (meridiem === "am" && hour === NOON_HOUR) hour = 0;
    const minute = half ? HALF_HOUR_MINUTES : Number(minuteText ?? 0);
    if (hour > 23 || minute > 59) continue;

    return { value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`, matched: match[0] };
  }
  return null;
}

function extractDuration(text: string): { minutes: number; matched: string } | null {
  const minutesMatch = text.match(MINUTES_PATTERN);
  if (minutesMatch) return { minutes: clampDuration(Number(minutesMatch[1])), matched: minutesMatch[0] };

  for (const [minutes, pattern] of DURATION_PHRASES) {
    const phrase = text.match(pattern);
    if (phrase) return { minutes, matched: phrase[0] };
  }

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
  const count = (pattern: RegExp) => text.match(pattern)?.length ?? 0;
  const english = count(LANGUAGE_WORDS.en);
  const italian = count(LANGUAGE_WORDS.it);
  const turkishOnly = count(TURKISH_ONLY_LETTERS);
  const turkishShared = count(TURKISH_SHARED_LETTERS);
  const turkish =
    count(LANGUAGE_WORDS.tr) +
    (TURKISH_CLAUSE_END.test(text) ? 1 : 0) +
    turkishOnly +
    (turkishOnly + turkishShared >= MIN_TURKISH_LETTERS ? turkishShared : 0);
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

// "tr-TR" → "tr"; null for a locale in none of the three languages.
function languageOfLocale(locale: string | null): Language | null {
  const tag = locale?.split(/[-_]/u)[0].toLowerCase();
  return LANGUAGES.find((language) => language === tag) ?? null;
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

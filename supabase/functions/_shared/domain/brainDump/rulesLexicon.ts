import type { CategoryId } from "../categories.ts";

// Word tables of the rule-based Brain Dump parser, one list per language, kept
// apart from the rules so a missing word is added here without touching them.
// Entries are regex fragments: "luned[iì]" also accepts the unaccented spelling.

export const LANGUAGES = ["en", "it", "tr"] as const;
export type Language = (typeof LANGUAGES)[number];

// Monday first, so a name's position + 1 is its ISO weekday number.
export const WEEKDAY_NAMES: Record<Language, string[]> = {
  en: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
  it: ["luned[iì]", "marted[iì]", "mercoled[iì]", "gioved[iì]", "venerd[iì]", "sabato", "domenica"],
  tr: ["pazartesi", "salı", "[çc]ar[şs]amba", "per[şs]embe", "cuma", "cumartesi", "pazar"],
};

// January first, so a name's position + 1 is its month number.
export const MONTH_NAMES: Record<Language, string[]> = {
  en: [
    "jan(?:uary)?",
    "feb(?:ruary)?",
    "mar(?:ch)?",
    "apr(?:il)?",
    "may",
    "june?",
    "july?",
    "aug(?:ust)?",
    "sep(?:t(?:ember)?)?",
    "oct(?:ober)?",
    "nov(?:ember)?",
    "dec(?:ember)?",
  ],
  it: [
    "gennaio",
    "febbraio",
    "marzo",
    "aprile",
    "maggio",
    "giugno",
    "luglio",
    "agosto",
    "settembre",
    "ottobre",
    "novembre",
    "dicembre",
  ],
  tr: [
    "ocak",
    "[şs]ubat",
    "mart",
    "nisan",
    "may[ıi]s",
    "haziran",
    "temmuz",
    "a[ğg]ustos",
    "eyl[üu]l",
    "ekim",
    "kas[ıi]m",
    "aral[ıi]k",
  ],
};

// Verbs people start (English, Italian) or end (Turkish) a task with. They tell
// "call mom and email the boss" (two tasks) from "buy bread and milk" (one),
// and tag a task's language. Turkish ones are imperative stems.
export const VERBS: Record<Language, string[]> = {
  en: [
    "add", "apply", "arrange", "ask", "attend", "bake", "book", "bring", "build", "buy", "call", "cancel",
    "change", "charge", "check", "choose", "clean", "close", "collect", "complete", "confirm", "contact",
    "cook", "create", "cut", "delete", "deliver", "do", "donate", "download", "draft", "drive", "drop", "eat",
    "edit", "email", "empty", "feed", "fill", "find", "finish", "fix", "fold", "follow", "get", "give", "go",
    "grab", "hang", "hire", "install", "invite", "iron", "join", "learn", "look", "make", "meet", "message",
    "mop", "move", "mow", "open", "order", "organize", "pack", "pay", "pick", "plan", "practice", "prepare",
    "print", "put", "read", "register", "remind", "remove", "renew", "repair", "replace", "reply", "research",
    "reschedule", "reset", "respond", "return", "review", "run", "scan", "schedule", "search", "sell", "send",
    "set", "share", "ship", "sign", "sort", "start", "study", "submit", "sweep", "switch", "take", "talk",
    "text", "throw", "tidy", "transfer", "turn", "unpack", "update", "upload", "vacuum", "visit", "wait",
    "wake", "walk", "wash", "watch", "water", "wipe", "work", "wrap", "write",
  ],
  it: [
    "acquistare", "andare", "chiamare", "comprare", "controllare", "correre", "fare", "finire", "inviare",
    "lavare", "leggere", "mandare", "ordinare", "pagare", "portare", "prendere", "prenotare", "preparare",
    "pulire", "rispondere", "ritirare", "scrivere", "sistemare", "stirare", "studiare", "telefonare",
    "chiama", "chiamo", "compra", "compro", "fai", "manda", "paga", "pago", "prendi", "prenota", "pulisci",
    "scrivi", "vado", "vai",
  ],
  tr: [
    "a[çc]", "al", "ara", "ara[şs]t[ıi]r", "as", "at", "ayarla", "bak", "ba[şs]la", "bekle", "bitir", "bul",
    "bulu[şs]", "cevapla", "[çc]al[ıi][şs]", "[çc][ıi]k", "de[ğg]i[şs]tir", "dene", "dinle", "d[üu]zenle",
    "ekle", "et", "gel", "getir", "git", "g[öo]nder", "g[öo]r[üu][şs]", "g[öo]t[üu]r", "haz[ıi]rla", "i[çc]",
    "ilet", "imzala", "indir", "iste", "izle", "kald[ıi]r", "kapat", "kes", "konu[şs]", "ko[şs]", "kur", "oku",
    "onayla", "[öo]de", "[öo][ğg]ren", "payla[şs]", "pi[şs]ir", "planla", "sat", "se[çc]", "sil", "sor",
    "s[öo]yle", "sula", "s[üu]p[üu]r", "tak", "tamamla", "ta[şs][ıi]", "temizle", "topla", "u[ğg]ra", "ver",
    "yan[ıi]tla", "yap", "yat[ıi]r", "yaz", "ye", "yenile", "y[ıi]ka", "y[üu]kle", "y[üu]r[üu]", "[üu]t[üu]le",
  ],
};

// Words that frame an action without naming it: "I need to…", "devo…", "…lazım".
export const MODAL_WORDS: Record<Language, string[]> = {
  en: ["i['’]ll", "need", "have", "must", "should", "remember", "don['’]?t", "please", "try"],
  it: ["devo", "devi", "dobbiamo", "bisogna", "ricordati", "ricordarsi"],
  tr: ["laz[ıi]m", "gerek", "gerekiyor"],
};

// Everyday words only one of the three languages uses, for tagging a task's language.
export const FUNCTION_WORDS: Record<Language, string[]> = {
  en: [
    "the", "an", "to", "for", "my", "of", "with", "at", "on", "by", "and", "from", "this", "about", "up", "out",
    "tomorrow", "today", "tonight", "morning", "afternoon", "evening", "week", "month", "every", "maybe",
  ],
  it: [
    "il", "lo", "la", "gli", "le", "un", "una", "del", "della", "dello", "dei", "delle", "dal", "al", "alla",
    "alle", "nel", "nella", "di", "con", "per", "che", "non", "sono", "poi", "mia", "mio", "domani", "oggi",
    "dopodomani", "stasera", "stamattina", "mattina", "pomeriggio", "sera", "settimana", "mese", "ore", "ogni",
    "entro", "dopo", "prima", "questo", "questa", "anche", "forse", "magari", "e(?![-.])",
  ],
  tr: [
    "bir", "ve", "ile", "bu", "i[çc]in", "belki", "[çc]ok", "mesaj", "yar[ıi]n", "bug[üu]n", "sabah",
    "ak[şs]am", "hafta", "haftaya", "saat", "kadar", "sonra", "[öo]nce", "g[üu]n[üu]",
  ],
};

// `en` and `it` words also match their simple plural ("bill(s)", "riunione/riunioni").
// `exact` ones match only as written: verbs, and words that are a different word
// in another form. `trStems` take any Turkish suffix ("fatura" → "faturayı").
export interface CategoryWords {
  en: string[];
  it: string[];
  exact: string[];
  trStems: string[];
}

export const CATEGORY_WORDS: Record<CategoryId, CategoryWords> = {
  work: {
    en: ["email", "mail", "meeting", "report", "client", "boss", "deploy", "review"],
    it: ["riunione", "cliente", "capo", "ufficio", "relazione"],
    // "prima del lavoro" and "işten sonra" (before/after work) are about when, not what.
    exact: ["(?<!(?:prima del|dopo il)\\s+)lavor[oi]"],
    trStems: [
      "toplant[ıi]",
      "[iİ]ş(?!ten\\s+(?:sonra|[öo]nce))",
      "sunum",
      "rapor",
      "mail",
      "e-?posta",
      "m[üu][şs]teri",
      "patron",
      "m[üu]d[üu]r",
    ],
  },
  shopping: {
    en: ["buy", "groceries", "shop", "order"],
    it: ["spesa", "supermercato", "negozio"],
    exact: ["comprare", "compra", "ordinare", "acquistare"],
    trStems: ["market(?!ing)", "ma[ğg]aza", "sipari[şs]", "al[ıi][şs]veri[şs]", "sat[ıi]n al"],
  },
  // Bills, rent and taxes live here too: the app has no finance category.
  home: {
    en: ["clean", "laundry", "dish", "vacuum", "bill", "rent", "invoice", "tax"],
    it: ["bucato", "lavatrice", "piatto", "aspirapolvere", "bolletta", "affitto", "fattura", "tassa"],
    // "kira" takes only its own endings: a free suffix would match "kiraz" (cherry).
    exact: ["pulire", "lavare", "stirare", "kira", "kiray[ıi]\\p{L}*", "kiras[ıi]\\p{L}*"],
    trStems: [
      "temizl",
      "[çc]ama[şs][ıi]r",
      "bula[şs][ıi]k",
      "s[üu]p[üu]r",
      "ütü",
      "çöp",
      "fatura",
      "aidat",
      "vergi",
    ],
  },
  health: {
    en: ["doctor", "dentist", "gym", "run", "workout", "pharmacy"],
    it: ["medico", "dentista", "palestra", "farmacia", "corsa", "dottore", "dottoressa", "allenamento"],
    exact: ["correre"],
    trStems: [
      "doktor",
      "di[şs][çc]i",
      "spor",
      "eczane",
      "koş",
      "ila[çc]",
      "hastane",
      "antrenman",
      "egzersiz",
    ],
  },
  personal: {
    en: ["call", "mom", "dad", "birthday", "gift", "read"],
    it: ["mamma", "compleanno", "regalo"],
    // "bir ara" means "sometime", not "call".
    exact: ["chiamare", "chiama", "pap[àa]", "leggere", "telefonare", "(?<!bir\\s+)ara"],
    trStems: ["anne", "baba", "do[ğg]um g[üu]n", "hediye", "oku(?!l)", "kita[pb]"],
  },
};

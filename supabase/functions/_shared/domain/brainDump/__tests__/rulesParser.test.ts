import { brainDumpAiResultSchema } from "../aiResult";
import { resolveDate } from "../resolveDate";
import { parseBrainDumpWithRules } from "../rulesParser";

const MONDAY = "2026-10-12";

// Title, resolved day and clock time of each task, with today a Monday.
function summarize(text: string, todayKey = MONDAY): Array<[string, string | null, string | null]> {
  return parseBrainDumpWithRules(text).candidates.map((candidate) => {
    const resolution = candidate.when ? resolveDate(candidate.when, todayKey) : null;
    return [candidate.title, resolution?.ok ? resolution.dueDate : null, candidate.dueTime];
  });
}

function categoriesOf(lines: string[]): Array<string | null> {
  return parseBrainDumpWithRules(lines.join("\n")).candidates.map((candidate) => candidate.category);
}

describe("parseBrainDumpWithRules", () => {
  it("splits a dump into tasks with dates, times and durations", () => {
    const result = parseBrainDumpWithRules("call mom tomorrow at 6pm, buy groceries 30 min and finish report by friday");

    expect(result.candidates.map((c) => c.title)).toEqual(["Call mom", "Buy groceries", "Finish report"]);
    expect(result.candidates[0].when).toMatchObject({ kind: "relative_day", offsetDays: 1, relation: "on" });
    expect(result.candidates[0].dueTime).toBe("18:00");
    expect(result.candidates[1].estimatedDurationMinutes).toBe(30);
    expect(result.candidates[1].category).toBe("shopping");
    expect(result.candidates[2].when).toMatchObject({ kind: "weekday", weekday: 5, relation: "by" });
  });

  it("keeps words inside the title and tags Italian and Turkish input", () => {
    const result = parseBrainDumpWithRules("chiamare la mamma domani\nyarın dişçiyi ara");

    expect(result.candidates[0]).toMatchObject({ title: "Chiamare la mamma", language: "it" });
    expect(result.candidates[1]).toMatchObject({ language: "tr" });
    expect(result.candidates[1].when).toMatchObject({ kind: "relative_day", offsetDays: 1 });
  });

  it("flags vague dates and leaves too-short fragments unparsed", () => {
    const result = parseBrainDumpWithRules("fix the bike someday; ok");

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].when).toMatchObject({ kind: "vague" });
    expect(result.candidates[0].ambiguities).toHaveLength(1);
    expect(result.unparsedFragments).toEqual(["ok"]);
  });

  it("understands accented and suffixed day names and deadlines", () => {
    const result = parseBrainDumpWithRules("entro venerdì finire la presentazione\nCumaya kadar sunumu bitir\nprep slides for Thursday's demo");

    expect(result.candidates.map((c) => [c.title, c.when])).toEqual([
      ["Finire la presentazione", { kind: "weekday", weekday: 5, relation: "by", text: "venerdì" }],
      ["Sunumu bitir", { kind: "weekday", weekday: 5, relation: "by", text: "Cumaya" }],
      ["Prep slides for demo", { kind: "weekday", weekday: 4, relation: "on", text: "Thursday's" }],
    ]);
  });

  it("treats a date as a deadline only when the deadline word touches it", () => {
    const [dentist] = parseBrainDumpWithRules("dentist Friday, remind me before").candidates;

    expect(dentist.when).toMatchObject({ kind: "weekday", weekday: 5, relation: "on" });
  });

  it("reads day counts, weekends and next-week wording", () => {
    const result = parseBrainDumpWithRules(
      "send the contract within 3 days; clean the bathroom this weekend; haftaya pazartesi kirayı öde; book the vet next week"
    );

    expect(result.candidates.map((c) => c.when)).toEqual([
      { kind: "relative_day", offsetDays: 3, relation: "by", text: "within 3 days" },
      { kind: "weekend", relation: "on", text: "this weekend" },
      { kind: "weekday", weekday: 1, relation: "next_week", text: "pazartesi" },
      { kind: "vague", text: "next week" },
    ]);
    expect(result.candidates[3].flexible).toBe(false);
  });

  it("marks maybe tasks, folding a condition clause into the task before it", () => {
    const result = parseBrainDumpWithRules("belki akşam spora giderim, çok yorgun olmazsam\nmaybe paint the fence\ncall the nurse");

    expect(result.candidates.map((c) => [c.title, c.flexible])).toEqual([
      ["Spora giderim", true],
      ["Paint the fence", true],
      ["Call the nurse", false],
    ]);
  });

  it("shows a condition clause as unparsed, since it may hold a task of its own", () => {
    const result = parseBrainDumpWithRules("buy bread and if there is time call Anna");

    expect(result.candidates.map((c) => [c.title, c.flexible])).toEqual([["Buy bread", true]]);
    expect(result.unparsedFragments).toEqual(["if there is time call Anna"]);
  });

  it("does not mistake everyday words for dates, times or remarks", () => {
    const result = parseBrainDumpWithRules(
      [
        "comprare sali da bagno",
        "pazara git",
        "akşam yemeği hazırla",
        "watch Monday night football",
        "pay 12.50 euros to Luca",
        "yarın saat 10'da toplantı",
        "send important documents to the bank",
        "buy 2 H&M shirts",
        "call Dr. Smith tomorrow",
        "happy birthday card for mom!",
      ].join("\n")
    );

    expect(result.unparsedFragments).toEqual([]);
    expect(result.candidates.map((c) => [c.title, c.when?.kind ?? null, c.dueTime, c.priority])).toEqual([
      ["Comprare sali da bagno", null, null, null],
      ["Pazara git", null, null, null],
      ["Akşam yemeği hazırla", null, null, null],
      ["Watch Monday night football", "weekday", null, null],
      ["Pay 12.50 euros to Luca", null, null, null],
      ["Toplantı", "relative_day", "10:00", null],
      ["Send important documents to the bank", null, null, null],
      ["Buy 2 H&M shirts", null, null, null],
      ["Call Dr. Smith", "relative_day", null, null],
      ["Happy birthday card for mom", null, null, null],
    ]);
    expect(result.candidates[7].estimatedDurationMinutes).toBeNull();
  });

  it("keeps decimal durations whole and trims what pointed at a duration", () => {
    const result = parseBrainDumpWithRules("studiare 1,5 ore, work on thesis for 2 hours, riunione alle ore 10 con Marco");

    expect(result.candidates.map((c) => [c.title, c.estimatedDurationMinutes, c.dueTime])).toEqual([
      ["Studiare", 90, null],
      ["Work on thesis", 120, null],
      ["Riunione con Marco", null, "10:00"],
    ]);
  });

  it("reads priority from urgent wording or repeated exclamation marks", () => {
    const result = parseBrainDumpWithRules("urgent: call the bank\ntaxes!!\nimportante: pagare l'affitto");

    expect(result.candidates.map((c) => [c.title, c.priority])).toEqual([
      ["Call the bank", "high"],
      ["Taxes", "high"],
      ["Pagare l'affitto", "high"],
    ]);
  });

  it("capitalizes by the task's own language", () => {
    const result = parseBrainDumpWithRules("ilaç al ve faturayı öde\nice the cake for my mom");

    expect(result.candidates.map((c) => c.title)).toEqual(["İlaç al", "Faturayı öde", "Ice the cake for my mom"]);
  });

  it("reports remarks as unparsed instead of turning them into tasks", () => {
    const result = parseBrainDumpWithRules(
      "I'm so tired today, ugh. Bugün çok yoğundu. çok yoruldum bugün. Reply to Marco"
    );

    expect(result.candidates.map((c) => c.title)).toEqual(["Reply to Marco"]);
    expect(result.unparsedFragments).toEqual([
      "I'm so tired today",
      "ugh.",
      "Bugün çok yoğundu.",
      "çok yoruldum bugün.",
    ]);
  });

  it("adds a detail that stands alone to the task before it, without overwriting", () => {
    const result = parseBrainDumpWithRules("email the landlord, 15 min, tomorrow; water plants 5 min, 30 min; 20 min");

    expect(result.candidates.map((c) => [c.title, c.estimatedDurationMinutes, c.when?.text ?? null])).toEqual([
      ["Email the landlord", 15, "tomorrow"],
      ["Water plants", 5, null],
    ]);
    expect(parseBrainDumpWithRules("20 min").unparsedFragments).toEqual(["20 min"]);
  });

  it("cuts every word of a date out of the title", () => {
    const result = parseBrainDumpWithRules("kirayı cumaya kadar öde\nbu hafta sonu dolabı topla");

    expect(result.candidates.map((c) => c.title)).toEqual(["Kirayı öde", "Dolabı topla"]);
    expect(result.candidates[0].when).toMatchObject({ weekday: 5, relation: "by" });
  });

  it("keeps a task's own words: time-of-day names, phrasal verbs and 'prima o poi'", () => {
    const result = parseBrainDumpWithRules(
      "Morning run, put the washing machine on, prima o poi devo sistemare l'armadio, gym 45 min after work"
    );

    expect(result.candidates.map((c) => [c.title, c.timeOfDay])).toEqual([
      ["Morning run", "morning"],
      ["Put the washing machine on", null],
      ["Devo sistemare l'armadio", null],
      ["Gym", "evening"],
    ]);
  });

  it("reads Turkish times and moves evening hours past noon", () => {
    const result = parseBrainDumpWithRules("öbür gün saat 10:00'da dişçiye git\nyarın akşam 7'de koşuya çık");

    expect(result.candidates.map((c) => [c.title, c.dueTime])).toEqual([
      ["Dişçiye git", "10:00"],
      ["Koşuya çık", "19:00"],
    ]);
  });

  it("tags each task's language, ignoring foreign date words and names", () => {
    const result = parseBrainDumpWithRules("domani call the bank, poi comprare il pane, buy a gift for Ayşe, markete git");

    expect(result.candidates.map((c) => c.language)).toEqual(["en", "it", "en", "tr"]);
    expect(parseBrainDumpWithRules("yarın markete git, faturayı öde").candidates.map((c) => c.language)).toEqual([
      "tr",
      "tr",
    ]);
  });

  it("tags short tasks by one Turkish letter, a final Turkish verb or an Italian marker", () => {
    const result = parseBrainDumpWithRules("ilaç al\nişe git\nriunione alle 15\ninsalata al tonno\ncall Ayşe");

    expect(result.candidates.map((c) => [c.title, c.language])).toEqual([
      ["İlaç al", "tr"],
      ["İşe git", "tr"],
      ["Riunione", "it"],
      ["Insalata al tonno", "it"],
      ["Call Ayşe", "en"],
    ]);
  });

  it("falls back to the phone's locale only when the text gives no clue", () => {
    expect(parseBrainDumpWithRules("sinema", "tr-TR").candidates[0]).toMatchObject({ title: "Sinema", language: "tr" });
    expect(parseBrainDumpWithRules("sinema", "de-DE").candidates[0].language).toBe("en");
    expect(parseBrainDumpWithRules("call the bank", "tr-TR").candidates[0].language).toBe("en");
  });

  it("files bills, rent and taxes under home in every language", () => {
    expect(
      categoriesOf([
        "pay the bill on friday",
        "pagare la bolletta venerdì",
        "cuma günü faturayı öde",
        "kirayı öde",
        "aidatı yatır",
        "pagare le tasse",
        "send the invoices",
      ])
    ).toEqual(["home", "home", "home", "home", "home", "home", "home"]);
    expect(categoriesOf(["kiraz al"])).toEqual([null]);
  });

  it("knows everyday category words, their plurals and Turkish suffixes", () => {
    expect(
      categoriesOf([
        "raporu müdüre gönder",
        "e-postaları yanıtla",
        "riunioni con i clienti",
        "prepare the reports",
        "marketten süt al",
        "andare al supermercato",
        "evi temizlik yap",
        "passare l'aspirapolvere",
        "koşuya çık",
        "ilaç al",
        "chiama il dottore",
        "kitap oku",
        "telefonare a Luca",
      ])
    ).toEqual([
      "work",
      "work",
      "work",
      "work",
      "shopping",
      "shopping",
      "home",
      "home",
      "health",
      "health",
      "health",
      "personal",
      "personal",
    ]);
  });

  it("does not read 'after work' or 'sometime' wording as a category", () => {
    expect(
      categoriesOf(["işten sonra spor", "prima del lavoro passare in farmacia", "bir ara dolabı düzenle", "okuldan çocukları al"])
    ).toEqual(["health", "health", null, null]);
  });

  it("keeps the 'e' of e-mail and e-posta", () => {
    expect(summarize("e-mail the boss\ne-postaları yanıtla").map(([title]) => title)).toEqual([
      "E-mail the boss",
      "E-postaları yanıtla",
    ]);
  });

  it("keeps a list of things joined by and / e / ve as one task", () => {
    expect(
      summarize("buy bread and milk\ncomprare pane e latte\nekmek ve süt al\nMarco e Anna cena sabato").map(
        ([title]) => title
      )
    ).toEqual(["Buy bread and milk", "Comprare pane e latte", "Ekmek ve süt al", "Marco e Anna cena"]);
  });

  it("splits at and / e / ve when the next part is a task of its own", () => {
    expect(summarize("call mom and email the boss").map(([title]) => title)).toEqual(["Call mom", "Email the boss"]);
    expect(summarize("chiamare Luca e comprare il pane").map(([title]) => title)).toEqual([
      "Chiamare Luca",
      "Comprare il pane",
    ]);
    expect(summarize("annemi ara ve faturayı öde").map(([title]) => title)).toEqual(["Annemi ara", "Faturayı öde"]);
    expect(summarize("call mom at 5pm and dad at 6")).toEqual([
      ["Call mom", null, "17:00"],
      ["Dad", null, "18:00"],
    ]);
  });

  it("splits at 'sonra' only between two finished Turkish tasks", () => {
    expect(
      summarize(
        "toplantıdan sonra Ali'yi ara\nAli'yi sonra ara\n2 saat sonra annemi ara\nmarkete git sonra eczaneye uğra"
      ).map(([title]) => title)
    ).toEqual([
      "Toplantıdan sonra Ali'yi ara",
      "Ali'yi sonra ara",
      "2 saat sonra annemi ara",
      "Markete git",
      "Eczaneye uğra",
    ]);
  });

  it("resolves a day of next week inside next week and cuts the whole phrase", () => {
    expect(
      summarize(
        "haftaya cuma toplantı\ngelecek hafta salı toplantı\nnext week friday call bank\nsettimana prossima martedì riunione"
      )
    ).toEqual([
      ["Toplantı", "2026-10-23", null],
      ["Toplantı", "2026-10-20", null],
      ["Call bank", "2026-10-23", null],
      ["Riunione", "2026-10-20", null],
    ]);
    expect(summarize("next friday dentist\nvenerdì prossimo dentista")).toEqual([
      ["Dentist", "2026-10-16", null],
      ["Dentista", "2026-10-16", null],
    ]);
  });

  it("reads 'this weekend' as today once the weekend has started", () => {
    const sunday = "2026-10-18";
    const text = "this weekend clean the garage\nbu hafta sonu dolabı topla\npulire casa questo weekend";

    expect(summarize(text, sunday).map(([, day]) => day)).toEqual([sunday, sunday, sunday]);
    expect(summarize(text).map(([, day]) => day)).toEqual(["2026-10-17", "2026-10-17", "2026-10-17"]);
    expect(summarize("pulire casa questo weekend\nby the weekend finish taxes").map(([title]) => title)).toEqual([
      "Pulire casa",
      "Finish taxes",
    ]);
    expect(parseBrainDumpWithRules("by the weekend finish taxes").candidates[0].when).toMatchObject({ relation: "by" });
  });

  it("takes an early hour as afternoon unless something says morning", () => {
    expect(
      summarize(
        "meeting at 3\ncall mom at 5\ncena alle 7\nsaat 5'te annemi ara\ndomani mattina alle 7 palestra\nwake up at 6am\ndoctor at 07:30\ntreno alle 6.45\nstandup at 9"
      ).map(([, , time]) => time)
    ).toEqual(["15:00", "17:00", "19:00", "17:00", "07:00", "06:00", "07:30", "06:45", "09:00"]);
  });

  it("reads dotted, spoken and approximate times", () => {
    expect(
      summarize("dentista 16.30 martedì\ncena alle 19 e 30\nriunione alle 9 e mezza\nsaat 3 gibi toplantı\nyarın akşam 7’de koşu")
    ).toEqual([
      ["Dentista", "2026-10-13", "16:30"],
      ["Cena", null, "19:30"],
      ["Riunione", null, "09:30"],
      ["Toplantı", null, "15:00"],
      ["Koşu", "2026-10-13", "19:00"],
    ]);
    expect(
      summarize("pay 4.30 for coffee\npay 15.00 euros to Marco\npagare bolletta 18.30").map(([, , time]) => time)
    ).toEqual([null, null, null]);
  });

  it("leaves 'in 2 hours' in the title instead of reading it as a duration", () => {
    const result = parseBrainDumpWithRules("call mom in 2 hours\ntra 2 ore chiamare Luca\n20 dakika sonra ocağı kapat");

    expect(result.candidates.map((c) => [c.title, c.estimatedDurationMinutes])).toEqual([
      ["Call mom in 2 hours", null],
      ["Tra 2 ore chiamare Luca", null],
      ["20 dakika sonra ocağı kapat", null],
    ]);
  });

  it("reads durations written in words", () => {
    const result = parseBrainDumpWithRules(
      "walk the dog half an hour\nmezz'ora di yoga\nyarım saat yürüyüş\nstudiare un'ora\nread for an hour\nbir saat kitap oku\nwork on thesis for an hour and a half"
    );

    expect(result.candidates.map((c) => [c.title, c.estimatedDurationMinutes])).toEqual([
      ["Walk the dog", 30],
      ["Yoga", 30],
      ["Yürüyüş", 30],
      ["Studiare", 60],
      ["Read", 60],
      ["Kitap oku", 60],
      ["Work on thesis", 90],
    ]);
  });

  it("recognises inflected Turkish times of day", () => {
    const result = parseBrainDumpWithRules("çarşamba akşamı sinema\nöğleden sonra 3'te toplantı");

    expect(result.candidates.map((c) => [c.title, c.timeOfDay, c.dueTime])).toEqual([
      ["Sinema", "evening", null],
      ["Toplantı", "afternoon", "15:00"],
    ]);
    expect(result.candidates[0].when).toMatchObject({ kind: "weekday", weekday: 3 });
  });

  it("cuts a day that can only be a date, wherever it stands", () => {
    expect(
      summarize(
        "faturayı cuma günü öde\npay the bill friday morning\ncall the bank on october 15 about the loan\ndentist friday 3pm with mom"
      )
    ).toEqual([
      ["Faturayı öde", "2026-10-16", null],
      ["Pay the bill", "2026-10-16", null],
      ["Call the bank about the loan", "2026-10-15", null],
      ["Dentist with mom", "2026-10-16", "15:00"],
    ]);
  });

  it("reads days of the month and the end of the month", () => {
    expect(
      summarize(
        "15 ekim'de doktor randevusu\nil 15 ottobre dentista\non march 3rd renew passport\nby the 15th submit report\nentro il 20 pagare le tasse\nayın 15'inde kira öde\nFriday 16 October dentist checkup"
      )
    ).toEqual([
      ["Doktor randevusu", "2026-10-15", null],
      ["Dentista", "2026-10-15", null],
      ["Renew passport", "2027-03-03", null],
      ["Submit report", "2026-10-15", null],
      ["Pagare le tasse", "2026-10-20", null],
      ["Kira öde", "2026-10-15", null],
      ["Dentist checkup", "2026-10-16", null],
    ]);
    expect(summarize("finish report by end of month\npagare affitto entro fine mese\nay sonuna kadar raporu bitir")).toEqual([
      ["Finish report", "2026-10-31", null],
      ["Pagare affitto", "2026-10-31", null],
      ["Raporu bitir", "2026-10-31", null],
    ]);
    expect(parseBrainDumpWithRules("by the 15th submit report").candidates[0].when).toEqual({
      kind: "month_day",
      month: null,
      day: 15,
      relation: "by",
      text: "the 15th",
    });
  });

  it("does not mistake ordinals and counts for a day of the month", () => {
    expect(
      summarize("meeting on the 3rd floor\nplan the 21st birthday party\ncomprare il 3 in 1 per la lavatrice").map(
        ([title, day]) => [title, day]
      )
    ).toEqual([
      ["Meeting on the 3rd floor", null],
      ["Plan the 21st birthday party", null],
      ["Comprare il 3 in 1 per la lavatrice", null],
    ]);
  });

  it("leaves a repeating day in the title and sets no date", () => {
    expect(summarize("water plants every monday\nogni lunedì palestra\nher pazartesi spor")).toEqual([
      ["Water plants every monday", null, null],
      ["Ogni lunedì palestra", null, null],
      ["Her pazartesi spor", null, null],
    ]);
  });

  it("decides the half of the day from context words before guessing", () => {
    expect(
      summarize(
        "wake up at 6\nsveglia alle 6\nsaat 6'da kalk\ntrain at 5:30\ndinner at 8\ncena alle 8\nparty at 10\ngym at 7\npick up kids at 3:30"
      ).map(([, , time]) => time)
    ).toEqual(["06:00", "06:00", "06:00", "05:30", "20:00", "20:00", "22:00", "07:00", "03:30"]);
  });

  it("asks for a check when the half of the day was a guess", () => {
    const result = parseBrainDumpWithRules("meeting at 3\npick up kids at 3:30\nmeeting at 3pm\nwake up at 6\nstandup at 9");

    expect(result.candidates.map((c) => c.ambiguities)).toEqual([
      [{ field: "scheduled_time", reason: '"at 3" could be morning or afternoon' }],
      [{ field: "scheduled_time", reason: '"at 3:30" could be morning or afternoon' }],
      [],
      [],
      [],
    ]);
  });

  it("reads 'at N' as a time only where a time can stand", () => {
    expect(summarize("look at 3 apartments\ndrop package at 12 Main Street\ntomorrow at 5 pick up kids\ndinner at 8 with Sara")).toEqual([
      ["Look at 3 apartments", null, null],
      ["Drop package at 12 Main Street", null, null],
      ["Pick up kids", "2026-10-13", "17:00"],
      ["Dinner with Sara", null, "20:00"],
    ]);
  });

  it("reads deadlines written with 'prima del', 'before the' and '…dan önce'", () => {
    const result = parseBrainDumpWithRules(
      "pagare le tasse prima del 15 aprile\nconsegnare prima dell'8 marzo\nfinish report before the 15th\n15 nisandan önce vergiyi öde\nyarına kadar ödevi bitir\ncumadan önce raporu gönder"
    );

    expect(result.candidates.map((c) => [c.title, c.when?.kind === "vague" ? null : c.when?.relation])).toEqual([
      ["Pagare le tasse", "by"],
      ["Consegnare", "by"],
      ["Finish report", "by"],
      ["Vergiyi öde", "by"],
      ["Ödevi bitir", "by"],
      ["Raporu gönder", "by"],
    ]);
    expect(summarize("yarın önce süt al")).toEqual([["Önce süt al", "2026-10-13", null]]);
  });

  it("cuts the 'di' that led in a day", () => {
    expect(
      summarize("guardare la partita di domenica sera\ncomprare biglietti per il concerto di venerdì prossimo").map(
        ([title]) => title
      )
    ).toEqual(["Guardare la partita", "Comprare biglietti per il concerto"]);
  });

  it("keeps the Turkish verb 'at' at the end of a title", () => {
    const result = parseBrainDumpWithRules("yarın Ali'ye mail at\nbugün 3 mail at");

    expect(result.candidates.map((c) => [c.title, c.language])).toEqual([
      ["Ali'ye mail at", "tr"],
      ["3 mail at", "tr"],
    ]);
  });

  it("starts a new task at 'and I should…'", () => {
    expect(summarize("I need to call the bank and I should buy milk").map(([title]) => title)).toEqual([
      "I need to call the bank",
      "I should buy milk",
    ]);
  });

  it("reads rules through Turkish capitals and keeps them in the title", () => {
    const result = parseBrainDumpWithRules("ACİL: faturayı gönder\nÖNEMLİ: sunumu bitir\nİSTANBUL bileti al PAZARTESİ");

    expect(result.candidates.map((c) => [c.title, c.priority, c.when?.text ?? null])).toEqual([
      ["Faturayı gönder", "high", null],
      ["Sunumu bitir", "high", null],
      ["İSTANBUL bileti al", null, "PAZARTESİ"],
    ]);
  });

  it("drops list markers but keeps ordinals and 'p.m.' inside a sentence", () => {
    const result = parseBrainDumpWithRules(
      "1. buy milk\n2) call mom\n- water plants\n• pay rent\n[ ] book flights\nmeeting at 5 p.m. with Bob"
    );

    expect(result.unparsedFragments).toEqual([]);
    expect(result.candidates.map((c) => [c.title, c.dueTime])).toEqual([
      ["Buy milk", null],
      ["Call mom", null],
      ["Water plants", null],
      ["Pay rent", null],
      ["Book flights", null],
      ["Meeting with Bob", "17:00"],
    ]);
    expect(summarize("5. bölümü oku")).toEqual([["5. bölümü oku", null, null]]);
  });

  it("adds up durations written in two parts", () => {
    const result = parseBrainDumpWithRules(
      "study 2 hours 30 min\n1 saat 30 dakika ders çalış\nstudiare 1 ora e 30 minuti\nrun 1h30\nwrite 1.5 hours\nlavorare 2 ore 15 minuti"
    );

    expect(result.candidates.map((c) => [c.title, c.estimatedDurationMinutes, c.dueTime])).toEqual([
      ["Study", 150, null],
      ["Ders çalış", 90, null],
      ["Studiare", 90, null],
      ["Run", 90, null],
      ["Write", 90, null],
      ["Lavorare", 135, null],
    ]);
  });

  it("keeps a day name that is part of what the task is called", () => {
    expect(summarize("cuma namazı\npazar kahvaltısı hazırla\nsunday roast with family\npranzo della domenica\ncuma toplantı")).toEqual([
      ["Cuma namazı", "2026-10-16", null],
      ["Pazar kahvaltısı hazırla", "2026-10-18", null],
      ["Sunday roast with family", "2026-10-18", null],
      ["Pranzo della domenica", "2026-10-18", null],
      ["Toplantı", "2026-10-16", null],
    ]);
  });

  it("always produces a result the AI contract accepts", () => {
    const manyTasks = Array.from({ length: 60 }, (_, i) => `task number ${i}`).join("; ");
    for (const text of ["", "ok", "a, b, c", "nap 0h", "call mom tomorrow at 25:99 for 999 min!!!", "x".repeat(2000), manyTasks]) {
      expect(brainDumpAiResultSchema.safeParse(parseBrainDumpWithRules(text)).success).toBe(true);
    }
  });

  it("reports text past the task limit as unparsed instead of dropping it", () => {
    const result = parseBrainDumpWithRules(Array.from({ length: 27 }, (_, i) => `task number ${i}`).join("; "));

    expect(result.candidates).toHaveLength(25);
    expect(result.unparsedFragments).toEqual(["task number 25", "task number 26"]);
  });

  it("keeps every leftover piece even when there are more than the contract's slots", () => {
    const result = parseBrainDumpWithRules(Array.from({ length: 50 }, (_, i) => `task number ${i}`).join("; "));

    expect(result.unparsedFragments).toHaveLength(20);
    expect(result.unparsedFragments[19]).toBe(
      Array.from({ length: 6 }, (_, i) => `task number ${i + 44}`).join(", ")
    );
  });
});

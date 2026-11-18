// What Siri says for PaceTasks, in English, Italian and Turkish. Composed on the
// server so the phone stays thin and every sentence is unit-tested here.

export const SIRI_LANGUAGES = ["en", "it", "tr"] as const;
export type SiriLanguage = (typeof SIRI_LANGUAGES)[number];

// Picks the reply language from the phone's Siri locale ("it-IT", "tr", "en-GB"); English otherwise.
export function siriLanguage(locale: string | null | undefined): SiriLanguage {
  const prefix = (locale ?? "").slice(0, 2).toLowerCase();
  return (SIRI_LANGUAGES as readonly string[]).includes(prefix) ? (prefix as SiriLanguage) : "en";
}

const AND: Record<SiriLanguage, string> = { en: "and", it: "e", tr: "ve" };

// "A", "A and B", "A, B and C" in the reply language.
export function joinTitles(language: SiriLanguage, titles: string[]): string {
  if (titles.length <= 1) return titles[0] ?? "";
  return `${titles.slice(0, -1).join(", ")} ${AND[language]} ${titles[titles.length - 1]}`;
}

// "10 minutes", "1 hour", "1 hour 20 minutes" (and the Italian/Turkish equivalents).
export function formatDuration(language: SiriLanguage, totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (language === "en") {
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
    if (minutes > 0 || hours === 0) parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
    return parts.join(" ");
  }
  if (language === "it") {
    if (hours > 0) parts.push(`${hours} ${hours === 1 ? "ora" : "ore"}`);
    if (minutes > 0 || hours === 0) parts.push(`${minutes} ${minutes === 1 ? "minuto" : "minuti"}`);
    return parts.join(" e ");
  }
  if (hours > 0) parts.push(`${hours} saat`);
  if (minutes > 0 || hours === 0) parts.push(`${minutes} dakika`);
  return parts.join(" ");
}

// After adding by voice: what was added, and a nudge to check the app when part of it wasn't understood.
export function addedSpeech(language: SiriLanguage, titles: string[], unparsedCount: number): string {
  if (titles.length === 0) return nothingUnderstoodSpeech(language);
  const list = joinTitles(language, titles);
  const added = {
    en: titles.length === 1 ? `Added ${list}.` : `Added ${titles.length} tasks: ${list}.`,
    it: titles.length === 1 ? `Ho aggiunto ${list}.` : `Ho aggiunto ${titles.length} attività: ${list}.`,
    tr: titles.length === 1 ? `${list} eklendi.` : `${titles.length} görev eklendi: ${list}.`,
  }[language];
  if (unparsedCount === 0) return added;
  const missed = {
    en: "I didn't catch part of it, so have a look in the app.",
    it: "Una parte non l'ho capita: dai un'occhiata nell'app.",
    tr: "Bir kısmını anlayamadım, uygulamadan bir bak.",
  }[language];
  return `${added} ${missed}`;
}

export function nothingUnderstoodSpeech(language: SiriLanguage): string {
  return {
    en: "I couldn't find a task in that. Try saying it a little differently.",
    it: "Non ho trovato attività in quello che hai detto. Prova a dirlo in un altro modo.",
    tr: "Söylediklerinde bir görev bulamadım. Biraz farklı söylemeyi dene.",
  }[language];
}

// "What should I do next?" with a task that can be started right now.
export function nextNowSpeech(language: SiriLanguage, title: string, minutes: number): string {
  const duration = formatDuration(language, minutes);
  return {
    en: `Next up: ${title}. It takes about ${duration}.`,
    it: `Ora tocca a: ${title}. Ci vogliono circa ${duration}.`,
    tr: `Sıradaki: ${title}. Yaklaşık ${duration} sürer.`,
  }[language];
}

// "What should I do next?" when only tasks with a fixed start time are left.
export function nextAtSpeech(language: SiriLanguage, title: string, time: string): string {
  return {
    en: `Next is ${title} at ${time}.`,
    it: `La prossima è ${title} alle ${time}.`,
    tr: `Sıradaki ${title}, saat ${time}.`,
  }[language];
}

export function allClearSpeech(language: SiriLanguage): string {
  return {
    en: "You're all clear for today. Nice work!",
    it: "Per oggi hai finito tutto. Ottimo lavoro!",
    tr: "Bugünlük her şey bitti. Harika iş!",
  }[language];
}

// "What's on today?": how many tasks are left, how long they take, and the first few by name.
export function todaySpeech(language: SiriLanguage, count: number, totalMinutes: number, firstTitles: string[]): string {
  if (count === 0) {
    return {
      en: "Nothing left for today.",
      it: "Per oggi non ti resta niente.",
      tr: "Bugün için kalan görev yok.",
    }[language];
  }
  const duration = formatDuration(language, totalMinutes);
  const list = joinTitles(language, firstTitles);
  if (count === 1) {
    return {
      en: `You have 1 task left today: ${list}, about ${duration}.`,
      it: `Oggi ti resta 1 attività: ${list}, circa ${duration}.`,
      tr: `Bugün 1 görevin kaldı: ${list}, yaklaşık ${duration}.`,
    }[language];
  }
  return {
    en: `You have ${count} tasks left today, about ${duration} in all. First up: ${list}.`,
    it: `Oggi ti restano ${count} attività, circa ${duration} in tutto. Per prime: ${list}.`,
    tr: `Bugün ${count} görevin kaldı, toplam yaklaşık ${duration}. İlk sırada: ${list}.`,
  }[language];
}

export function proRequiredSpeech(language: SiriLanguage): string {
  return {
    en: "Siri is part of PaceTasks Pro. Open PaceTasks to start your free week.",
    it: "Siri fa parte di PaceTasks Pro. Apri PaceTasks per iniziare la tua settimana gratuita.",
    tr: "Siri, PaceTasks Pro'nun bir parçası. Ücretsiz haftanı başlatmak için PaceTasks'ı aç.",
  }[language];
}

// Siri reached the server without a valid session: opening the app signs the phone in again.
export function openAppSpeech(language: SiriLanguage): string {
  return {
    en: "Open PaceTasks once so Siri can reach your tasks.",
    it: "Apri PaceTasks una volta, così Siri può raggiungere le tue attività.",
    tr: "Siri'nin görevlerine ulaşabilmesi için PaceTasks'ı bir kez aç.",
  }[language];
}

export function quotaSpeech(language: SiriLanguage): string {
  return {
    en: "You've reached today's Brain Dump limit. Try again tomorrow.",
    it: "Hai raggiunto il limite di Brain Dump di oggi. Riprova domani.",
    tr: "Bugünkü Brain Dump sınırına ulaştın. Yarın tekrar dene.",
  }[language];
}

export function failedSpeech(language: SiriLanguage): string {
  return {
    en: "PaceTasks couldn't do that right now. Try again in a moment.",
    it: "Al momento non è stato possibile. Riprova tra poco.",
    tr: "Şu anda bunu yapamadım. Birazdan tekrar dene.",
  }[language];
}

import fs from "fs";
import path from "path";
import ts from "typescript";
import { getLanguage, languageFor, localized, msg, setLanguage, t, tn } from "../index";
import { it as italian } from "../it";

const ROOT = path.resolve(__dirname, "../../..");
const SKIPPED_FOLDERS = ["__tests__", "demo", "i18n", "node_modules"];

function sourceFiles(folder: string): string[] {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return SKIPPED_FOLDERS.includes(entry.name) ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

// Every text the code can show: the literal arguments of t(), tn() and msg().
function textsInCode(): Set<string> {
  const texts = new Set<string>();
  const literal = (node: ts.Node | undefined) =>
    node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
  for (const file of [...sourceFiles(path.join(ROOT, "src")), path.join(ROOT, "App.tsx")]) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        const found =
          name === "t" || name === "msg"
            ? [literal(node.arguments[0])]
            : name === "tn"
            ? [literal(node.arguments[1]), literal(node.arguments[2])]
            : [];
        found.forEach((text) => text !== null && texts.add(text));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return texts;
}

const placeholders = (text: string) => [...text.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort();

describe("Italian", () => {
  const texts = textsInCode();

  it("has every text the code can show", () => {
    expect([...texts].filter((text) => !(text in italian))).toEqual([]);
  });

  it("has no entry the code no longer uses", () => {
    expect(Object.keys(italian).filter((text) => !texts.has(text))).toEqual([]);
  });

  it("keeps each text's values", () => {
    const broken = Object.entries(italian).filter(
      ([english, translated]) => placeholders(english).join() !== placeholders(translated).join()
    );
    expect(broken).toEqual([]);
  });
});

describe("t", () => {
  afterEach(() => setLanguage("en"));

  it("shows English as written, with its values", () => {
    expect(getLanguage()).toBe("en");
    expect(t("Starts in {0}, at {1}.", "1 hour", "18:00")).toBe("Starts in 1 hour, at 18:00.");
    expect(t("May|full month")).toBe("May");
  });

  it("shows Italian once chosen, and lets values move", () => {
    setLanguage("it");
    expect(t("Edit task")).toBe("Modifica attività");
    expect(t("We'll nudge you at {0} on {1}.", "14:45", "Ven")).toBe("Ti avvisiamo Ven alle 14:45.");
    expect(t("May|full month")).toBe("Maggio");
    expect(t("May")).toBe("Mag");
  });

  it("falls back to English for a text without a translation", () => {
    setLanguage("it");
    expect(t("Not translated yet {0}", 3)).toBe("Not translated yet 3");
  });

  it("counts with tn", () => {
    expect(tn(1, "1 day overdue", "{0} days overdue")).toBe("1 day overdue");
    setLanguage("it");
    expect(tn(4, "1 day overdue", "{0} days overdue")).toBe("In ritardo di 4 giorni");
  });

  it("reads constants in the current language without rebuilding them", () => {
    const labels = localized({ timing: { after: msg("After work") }, days: [msg("Mon")] });
    expect(labels.timing.after).toBe("After work");
    setLanguage("it");
    expect(labels.timing.after).toBe("Dopo il lavoro");
    expect(labels.days.map((day) => day)).toEqual(["Lun"]);
  });

  it("maps a phone language to one the app has", () => {
    expect(languageFor("it")).toBe("it");
    expect(languageFor("IT")).toBe("it");
    expect(languageFor("tr")).toBe("en");
    expect(languageFor(null)).toBe("en");
  });
});

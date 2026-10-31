const fs = require("fs");
const os = require("os");
const path = require("path");
const xcode = require("xcode");
const { addSiriFilesToProject, applySiriInfoPlist } = require("../withPaceSiri");

// A fresh `expo prebuild` project for PaceTasks, before this plugin runs.
const FIXTURE = path.join(__dirname, "fixtures", "project.pbxproj");

function loadProject() {
  const copy = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pace-siri-")), "project.pbxproj");
  fs.copyFileSync(FIXTURE, copy);
  const project = xcode.project(copy);
  project.parseSync();
  return project;
}

// Files listed in the app target's build phase, by name.
function phaseFiles(project, phase) {
  return Object.values(project.hash.project.objects[phase])
    .filter((entry) => typeof entry === "object")
    .flatMap((entry) => entry.files.map((file) => file.comment));
}

describe("addSiriFilesToProject", () => {
  it("compiles the intents and the string catalogs into the app target", () => {
    const project = addSiriFilesToProject(loadProject(), "PaceTasks");

    expect(phaseFiles(project, "PBXSourcesBuildPhase")).toEqual(
      expect.arrayContaining(["PaceIntents.swift in Sources", "PaceShortcuts.swift in Sources"])
    );
    expect(phaseFiles(project, "PBXResourcesBuildPhase")).toEqual(
      expect.arrayContaining(["AppShortcuts.xcstrings in Resources", "Localizable.xcstrings in Resources"])
    );

    const written = project.writeSync();
    expect(written).toContain('path = "PaceTasks/Siri/AppShortcuts.xcstrings"');
    expect(written).toMatch(/AppShortcuts\.xcstrings"; sourceTree = "<group>"; lastKnownFileType = text\.json\.xcstrings;/);
    expect(written).not.toContain("undefined");
    expect(project.getFirstProject().firstProject.knownRegions).toEqual(expect.arrayContaining(["en", "it", "tr"]));
  });

  it("adds nothing twice when prebuild runs again", () => {
    const project = addSiriFilesToProject(addSiriFilesToProject(loadProject(), "PaceTasks"), "PaceTasks");
    const sources = phaseFiles(project, "PBXSourcesBuildPhase").filter((name) => name.startsWith("PaceIntents"));
    expect(sources).toHaveLength(1);
  });
});

describe("applySiriInfoPlist", () => {
  beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("writes the Supabase address and the Siri languages", () => {
    const plist = applySiriInfoPlist(
      { CFBundleLocalizations: ["en"], CFBundleName: "PaceTasks" },
      { EXPO_PUBLIC_SUPABASE_URL: "https://ref.supabase.co", EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_x" }
    );
    expect(plist).toEqual({
      CFBundleName: "PaceTasks",
      CFBundleLocalizations: ["en", "it", "tr"],
      PaceSupabaseURL: "https://ref.supabase.co",
      PaceSupabaseAnonKey: "sb_publishable_x",
    });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("warns, without failing, when the build has no Supabase settings", () => {
    const plist = applySiriInfoPlist({}, {});
    expect(plist.PaceSupabaseURL).toBe("");
    expect(console.warn).toHaveBeenCalled();
  });
});

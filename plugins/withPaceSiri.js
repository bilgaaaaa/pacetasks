// Expo config plugin for PaceTasks' Siri support. At prebuild it copies the App
// Intents in native/siri into the iOS app target, adds their EN/IT/TR string
// catalogs, and writes the Supabase address Siri calls into Info.plist.
const fs = require("fs");
const path = require("path");
const { IOSConfig, withInfoPlist, withXcodeProject } = require("expo/config-plugins");

const SIRI_SOURCE_DIR = path.join(__dirname, "..", "native", "siri");
const SIRI_GROUP = "Siri";
const SWIFT_FILES = ["PaceIntents.swift", "PaceShortcuts.swift"];
const STRING_CATALOGS = ["AppShortcuts.xcstrings", "Localizable.xcstrings"];
const SIRI_LANGUAGES = ["en", "it", "tr"];
const XCSTRINGS_FILE_TYPE = "text.json.xcstrings";

// Info.plist keys PaceSupabaseConfig.swift reads; the anon key is public, like in the JS bundle.
function applySiriInfoPlist(infoPlist, env) {
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("[withPaceSiri] EXPO_PUBLIC_SUPABASE_URL or _ANON_KEY is missing: Siri won't reach the server in this build");
  }
  return {
    ...infoPlist,
    PaceSupabaseURL: supabaseUrl ?? "",
    PaceSupabaseAnonKey: supabaseAnonKey ?? "",
    // Lets iOS pick the Italian or Turkish Siri phrases and replies.
    CFBundleLocalizations: [...new Set([...(infoPlist.CFBundleLocalizations ?? []), ...SIRI_LANGUAGES])],
  };
}

// Adds the Siri files to the app target under a "Siri" group; safe to run twice.
function addSiriFilesToProject(project, projectName) {
  const groupPath = `${projectName}/${SIRI_GROUP}`;
  IOSConfig.XcodeUtils.ensureGroupRecursively(project, groupPath);

  for (const file of SWIFT_FILES) {
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath: `${groupPath}/${file}`, groupName: groupPath, project });
  }
  for (const file of STRING_CATALOGS) {
    IOSConfig.XcodeUtils.addResourceFileToGroup({
      filepath: `${groupPath}/${file}`,
      groupName: groupPath,
      project,
      isBuildFile: true,
    });
  }

  // The xcode library doesn't know string catalogs (Xcode would copy them uncompiled)
  // and writes unset fields as "undefined"; both are fixed on our own files only.
  const references = project.pbxFileReferenceSection();
  for (const [key, reference] of Object.entries(references)) {
    if (key.endsWith("_comment") || typeof reference !== "object") continue;
    const filePath = String(reference.path ?? "").replace(/"/g, "");
    if (!filePath.startsWith(`${groupPath}/`)) continue;
    if (filePath.endsWith(".xcstrings")) reference.lastKnownFileType = XCSTRINGS_FILE_TYPE;
    for (const field of ["fileEncoding", "explicitFileType"]) {
      if (reference[field] === undefined) delete reference[field];
    }
  }

  const projectObject = project.getFirstProject().firstProject;
  const knownRegions = new Set(projectObject.knownRegions ?? []);
  SIRI_LANGUAGES.forEach((language) => knownRegions.add(language));
  projectObject.knownRegions = [...knownRegions];
  return project;
}

function copySiriFiles(platformProjectRoot, projectName) {
  const destination = path.join(platformProjectRoot, projectName, SIRI_GROUP);
  fs.mkdirSync(destination, { recursive: true });
  for (const file of [...SWIFT_FILES, ...STRING_CATALOGS]) {
    fs.copyFileSync(path.join(SIRI_SOURCE_DIR, file), path.join(destination, file));
  }
}

const withPaceSiri = (config) => {
  config = withInfoPlist(config, (plistConfig) => {
    plistConfig.modResults = applySiriInfoPlist(plistConfig.modResults, process.env);
    return plistConfig;
  });

  return withXcodeProject(config, (xcodeConfig) => {
    const { platformProjectRoot, projectName } = xcodeConfig.modRequest;
    copySiriFiles(platformProjectRoot, projectName);
    addSiriFilesToProject(xcodeConfig.modResults, projectName);
    console.log(`[withPaceSiri] added ${SWIFT_FILES.length} intents files and ${STRING_CATALOGS.length} string catalogs`);
    return xcodeConfig;
  });
};

module.exports = withPaceSiri;
module.exports.applySiriInfoPlist = applySiriInfoPlist;
module.exports.addSiriFilesToProject = addSiriFilesToProject;

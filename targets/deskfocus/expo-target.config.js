// Deskfocus widget and focus Live Activity, generated into ios/ by @bacons/apple-targets on prebuild.
// Files in _shared/ are compiled into PaceTasks too, so the widget's buttons can run in the app's process.
// Keep _shared/ flat: the plugin links only its top-level files to the app, not files in subfolders.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "DeskfocusWidget",
  displayName: "Deskfocus",
  bundleIdentifier: ".deskfocus",
  // Interactive widget buttons and Live Activity intents need iOS 17.
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit", "AppIntents", "EventKit"],
  entitlements: {
    // The same App Group as the app, so both read the shared state and today's PaceTasks list.
    "com.apple.security.application-groups": config.ios.entitlements["com.apple.security.application-groups"],
  },
});

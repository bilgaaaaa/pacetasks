// Extends app.json. On EAS build servers it stops the build at its first step when
// the app could not reach Supabase, instead of shipping a build that fails on every request.
const REQUIRED_BUILD_ENV = ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY"];

function assertBuildEnv(env) {
  const missing = REQUIRED_BUILD_ENV.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `[app.config] Missing ${missing.join(", ")} for this EAS build. ` +
        `Add them with: eas env:create --environment ${env.EAS_BUILD_PROFILE ?? "<profile>"} --name <NAME> --value <VALUE> --visibility plaintext`
    );
  }
  // Demo mode replaces Supabase with an in-memory backend; it must never reach a phone build.
  if (env.EXPO_PUBLIC_DEMO_MODE === "1") {
    throw new Error("[app.config] EXPO_PUBLIC_DEMO_MODE=1 is set for an EAS build; remove it from the EAS environment.");
  }
  console.log(`[app.config] Supabase settings found for the "${env.EAS_BUILD_PROFILE}" build.`);
}

module.exports = ({ config }) => {
  if (process.env.EAS_BUILD === "true") assertBuildEnv(process.env);
  return config;
};

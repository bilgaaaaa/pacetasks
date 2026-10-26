// Extends app.json. WEB_BASE_URL serves the web export from a subpath: the website
// (bilgaaaaa/PaceTasksWebsite) builds the demo for its /demo/ path. Native builds
// and local runs leave it unset.
module.exports = ({ config }) => {
  const baseUrl = process.env.WEB_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};

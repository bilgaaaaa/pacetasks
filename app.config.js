// Extends app.json. WEB_BASE_URL serves the web export from a subpath: the website
// builds the demo for /pacetasks/demo/. Native builds and local runs leave it unset.
module.exports = ({ config }) => {
  const baseUrl = process.env.WEB_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};

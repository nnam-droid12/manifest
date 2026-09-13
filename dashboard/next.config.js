const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  images: { unoptimized: true },
  webpack: (config) => {
    // bedrock-agentcore's BrowserLiveView imports the NICE DCV Web Client SDK
    // as bare specifiers ("dcv", "dcv-ui"). The real SDK isn't published to
    // npm under those names -- it ships vendored inside the package itself
    // and has to be aliased in. The matching worker/codec files are copied
    // into public/nice-dcv-web-client-sdk (see BrowserLiveView.js's hardcoded
    // baseUrl) so the browser can fetch them at runtime.
    const dcvRoot = path.resolve(
      __dirname,
      "node_modules/bedrock-agentcore/dist/src/tools/browser/live-view/nice-dcv-web-client-sdk"
    );
    config.resolve.alias["dcv"] = path.join(dcvRoot, "dcvjs-esm/dcv.js");
    config.resolve.alias["dcv-ui"] = path.join(dcvRoot, "dcv-ui/dcv-ui.js");
    return config;
  },
};

module.exports = nextConfig;

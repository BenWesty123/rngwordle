import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // The gloss file is served as a static asset. Keep it out of the server trace so it is not inlined into the Worker script.
  outputFileTracingExcludes: {
    "*": ["./src/data/definitions.json", "./public/definitions.json"],
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

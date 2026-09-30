import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // The gloss shards are served as static assets. Keep them out of the server trace so they are not inlined into the Worker script.
  outputFileTracingExcludes: {
    "*": ["./src/data/definitions.json", "./public/definitions/**"],
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

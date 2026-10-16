import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Prerendered pages (home, privacy, login) are served from the build as static assets
// instead of being rendered again on every visit. Nothing in the app revalidates, so a read-only cache fits.
// Cache interception stays off: it answers Next 16 segment prefetches with the whole page, and the router refetches forever.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});

/** True inside the Cloudflare Worker. `next dev` stays on Node and uses the local SQLite file. */
export function inCloudflareWorker(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers"
}

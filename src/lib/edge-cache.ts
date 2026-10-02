import { inCloudflareWorker } from "@/lib/runtime"

type EdgeCache = {
  match: (request: Request) => Promise<Response | undefined>
  put: (request: Request, response: Response) => Promise<void>
}

/**
 * Keep a result at this Cloudflare location for a few seconds, so a busy
 * leaderboard costs one database query per location per refresh, not one per visit.
 * Off the Worker (next dev, tests) it just runs the query.
 */
export async function cachedJson<T>(key: string, seconds: number, compute: () => Promise<T>): Promise<T> {
  const cache = inCloudflareWorker() ? (globalThis as { caches?: { default?: EdgeCache } }).caches?.default : undefined
  if (!cache) return compute()
  const request = new Request(`https://rwgdle.app/__cache/${encodeURIComponent(key)}`)
  try {
    const hit = await cache.match(request)
    if (hit) return (await hit.json()) as T
  } catch {
    // A cache miss or hiccup falls through to the database.
  }
  const value = await compute()
  try {
    await cache.put(
      request,
      new Response(JSON.stringify(value), {
        headers: { "content-type": "application/json", "Cache-Control": `public, max-age=${seconds}` },
      }),
    )
  } catch {
    // Not cached this time; the next visit queries again.
  }
  return value
}

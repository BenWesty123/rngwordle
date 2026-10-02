import { inCloudflareWorker } from "@/lib/runtime"

type Limiter = { limit: (input: { key: string }) => Promise<{ success: boolean }> }

/** Who's asking, for rate limits: the visitor's IP as Cloudflare saw it. */
export function visitorKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  )
}

/**
 * Cloudflare's built-in rate limiter (wrangler.jsonc "ratelimits"). It counts per
 * location without touching the database. If the binding is missing, such as in
 * next dev, requests go through.
 */
export async function allowRequest(name: "ROLL_LIMITER" | "LOGIN_LIMITER", key: string): Promise<boolean> {
  if (!inCloudflareWorker()) return true
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    const { env } = await getCloudflareContext({ async: true })
    const limiter = (env as Record<string, unknown>)[name] as Limiter | undefined
    if (!limiter || typeof limiter.limit !== "function") return true
    const { success } = await limiter.limit({ key })
    return success
  } catch {
    return true
  }
}

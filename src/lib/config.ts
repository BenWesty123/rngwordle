import { inCloudflareWorker } from "@/lib/runtime"

/** A plain setting: wrangler.jsonc "vars" on the Worker, process.env under next dev. */
export async function configVar(name: string): Promise<string | undefined> {
  if (!inCloudflareWorker()) return process.env[name]
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    const { env } = await getCloudflareContext({ async: true })
    const value = (env as Record<string, unknown>)[name]
    return typeof value === "string" ? value : undefined
  } catch {
    return undefined
  }
}

/** Usernames allowed to see /stats (STATS_USERNAMES, comma-separated, any case). */
export async function canSeeStats(username: string | null | undefined): Promise<boolean> {
  if (!username) return false
  const allowed = ((await configVar("STATS_USERNAMES")) ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean)
  return allowed.includes(username.toLowerCase())
}

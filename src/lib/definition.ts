import { readFileSync } from "node:fs"
import { join } from "node:path"
import { inCloudflareWorker } from "@/lib/runtime"

type GlossMap = Record<string, string | undefined>

let glosses: GlossMap | null = null

function remember(parsed: unknown): GlossMap {
  const map = Object.assign(Object.create(null), parsed) as GlossMap
  glosses = map
  return map
}

function glossesFromFile(): GlossMap {
  const text = readFileSync(join(process.cwd(), "src", "data", "definitions.json"), "utf8")
  return remember(JSON.parse(text) as unknown)
}

async function glossesFromAssets(): Promise<GlossMap> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare")
  const { env } = await getCloudflareContext({ async: true })
  const assets = (env as { ASSETS?: { fetch: (input: Request | string) => Promise<Response> } }).ASSETS
  if (!assets) throw new Error("Definitions asset is missing")
  const response = await assets.fetch("http://127.0.0.1/definitions.json")
  if (!response.ok) throw new Error("Definitions asset is missing")
  return remember((await response.json()) as unknown)
}

async function loadGlosses(): Promise<GlossMap> {
  if (glosses) return glosses
  if (inCloudflareWorker()) return glossesFromAssets()
  return glossesFromFile()
}

export async function definitionFor(word: string): Promise<string | null> {
  const key = word.toLowerCase()
  if (!/^[a-z]+$/.test(key)) return null
  const gloss = (await loadGlosses())[key]
  return typeof gloss === "string" ? gloss : null
}

export function plainDefinition(html: string): string {
  const text = html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
  const stop = text.search(/[.!?](?:\s|$)/)
  const sentence = stop === -1 ? text : text.slice(0, stop + 1)
  return sentence.length > 180 ? `${sentence.slice(0, 177).trimEnd()}…` : sentence
}

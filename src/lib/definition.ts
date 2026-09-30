import { readFileSync } from "node:fs"
import { join } from "node:path"
import { inCloudflareWorker } from "@/lib/runtime"

type GlossMap = Record<string, string | undefined>

/** Glosses ship as public/definitions/<first two letters>.json, built by scripts/split-definitions.ts. */
const shards = new Map<string, Promise<GlossMap>>()

export function definitionShard(word: string): string | null {
  return /^[a-z]+$/.test(word) ? word.slice(0, 2) : null
}

function parse(parsed: unknown): GlossMap {
  return Object.assign(Object.create(null), parsed) as GlossMap
}

async function shardFromFile(shard: string): Promise<GlossMap> {
  try {
    return parse(JSON.parse(readFileSync(join(process.cwd(), "public", "definitions", `${shard}.json`), "utf8")))
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return parse({})
    throw error
  }
}

async function shardFromAssets(shard: string): Promise<GlossMap> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare")
  const { env } = await getCloudflareContext({ async: true })
  const assets = (env as { ASSETS?: { fetch: (input: Request | string) => Promise<Response> } }).ASSETS
  if (!assets) throw new Error("Definitions asset is missing")
  const response = await assets.fetch(`http://127.0.0.1/definitions/${shard}.json`)
  if (response.status === 404) return parse({})
  if (!response.ok) throw new Error("Definitions asset is missing")
  return parse(await response.json())
}

function loadShard(shard: string): Promise<GlossMap> {
  let pending = shards.get(shard)
  if (!pending) {
    pending = (inCloudflareWorker() ? shardFromAssets(shard) : shardFromFile(shard)).catch((error: unknown) => {
      shards.delete(shard)
      throw error
    })
    shards.set(shard, pending)
  }
  return pending
}

export async function definitionFor(word: string): Promise<string | null> {
  const key = word.toLowerCase()
  const shard = definitionShard(key)
  if (!shard) return null
  const gloss = (await loadShard(shard))[key]
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

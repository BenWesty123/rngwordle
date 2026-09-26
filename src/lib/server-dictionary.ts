import { readFileSync } from "node:fs"
import { join } from "node:path"
import { inCloudflareWorker } from "@/lib/runtime"

let words: string[] | null = null

function parseWordList(text: string): string[] {
  const list = text
    .trim()
    .split(/\n/)
    .map((word) => word.trim())
    .filter((word) => /^[a-z]+$/.test(word))
  if (list.length === 0) throw new Error("Dictionary was empty")
  words = list
  return list
}

async function wordListFromAssets(): Promise<string[]> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare")
  const { env } = await getCloudflareContext({ async: true })
  const assets = (env as { ASSETS?: { fetch: (input: Request | string) => Promise<Response> } }).ASSETS
  if (!assets) throw new Error("Word list asset is missing")
  const response = await assets.fetch("http://127.0.0.1/words.txt")
  if (!response.ok) throw new Error("Word list asset is missing")
  return parseWordList(await response.text())
}

/** The Worker has no app working directory, so the list is the static /words.txt asset. */
export async function serverDictionary(): Promise<string[]> {
  if (words) return words
  if (inCloudflareWorker()) return wordListFromAssets()
  return parseWordList(readFileSync(join(process.cwd(), "public", "words.txt"), "utf8"))
}

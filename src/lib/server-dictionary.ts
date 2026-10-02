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

let wordSet: Set<string> | null = null

/** True when the word is in the dictionary, so a shared link can't show a made-up word. */
export async function isDictionaryWord(word: string): Promise<boolean> {
  if (!/^[a-z]{1,40}$/.test(word)) return false
  wordSet ??= new Set(await serverDictionary())
  return wordSet.has(word)
}

/**
 * Split src/data/definitions.json into public/definitions/<first two letters>.json.
 *
 * A Worker isolate then fetches and parses a ~15 KB shard for one gloss
 * instead of the whole 9.5 MB file. Rerun after scripts/build-definitions.py.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { definitionShard } from "../src/lib/definition"

const root = join(import.meta.dirname, "..")
const glosses = JSON.parse(readFileSync(join(root, "src", "data", "definitions.json"), "utf8")) as Record<string, string>
const outDir = join(root, "public", "definitions")

const shards = new Map<string, Record<string, string>>()
for (const word of Object.keys(glosses).sort()) {
  const shard = definitionShard(word)
  if (!shard) continue
  let entries = shards.get(shard)
  if (!entries) shards.set(shard, (entries = {}))
  entries[word] = glosses[word]!
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
for (const [shard, entries] of shards) {
  writeFileSync(join(outDir, `${shard}.json`), JSON.stringify(entries))
}
console.log(`definitions ${Object.keys(glosses).length} shards ${shards.size}`)

import { databaseFromD1, type D1Binding } from "@/lib/d1"
import { inCloudflareWorker } from "@/lib/runtime"
import type { AppDatabase } from "@/lib/sql"

const slot = globalThis as unknown as { rngworldeAppDb?: AppDatabase }

/** D1 on the Worker. The local SQLite file everywhere else, including `next dev`. */
export async function appDb(): Promise<AppDatabase> {
  if (inCloudflareWorker()) {
    const binding = await d1Binding()
    if (!binding) throw new Error("D1 binding DB is not configured")
    return databaseFromD1(binding)
  }
  if (!slot.rngworldeAppDb) {
    const { databaseFromSqlite, getDb } = await import("@/lib/db")
    slot.rngworldeAppDb = databaseFromSqlite(getDb())
  }
  return slot.rngworldeAppDb
}

async function d1Binding(): Promise<D1Binding | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare")
    const { env } = await getCloudflareContext({ async: true })
    const db = (env as { DB?: D1Binding }).DB
    if (db && typeof db.prepare === "function" && typeof db.batch === "function") return db
  } catch {
    return null
  }
  return null
}

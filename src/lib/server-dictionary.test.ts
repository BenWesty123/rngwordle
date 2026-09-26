import assert from "node:assert/strict"
import { test } from "node:test"
import { serverDictionary } from "./server-dictionary"

test("the server dictionary is the shipped word list", async () => {
  const words = await serverDictionary()
  assert.ok(words.includes("book"))
  assert.ok(words.length > 100_000)
})

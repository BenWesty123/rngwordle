import assert from "node:assert/strict"
import { test } from "node:test"
import { LOGIN_FROM, loginEmail } from "./login-mail"

test("a login email has one link and does not invite a reply", () => {
  const url = "https://rwgdle.app/auth/verify?token=abc_def-123"
  const message = loginEmail({ to: "ada@example.com", url })
  assert.equal(message.from, LOGIN_FROM)
  assert.equal(message.to, "ada@example.com")
  assert.equal(message.subject, "Your RWGdle login link")
  assert.match(message.text, /works once, then expires/)
  assert.match(message.text, /If you did not ask for this, ignore it/)
  assert.equal(message.text.split(url).length, 2)
  const hrefs = message.html.match(/href="/g)
  assert.equal(hrefs?.length, 1)
  assert.match(message.html, /href="https:\/\/rwgdle\.app\/auth\/verify\?token=abc_def-123"/)
  assert.equal(message.html.split(url).length, 2)
})

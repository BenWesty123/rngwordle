import assert from "node:assert/strict"
import { test } from "node:test"
import { LOGIN_FROM, loginEmail } from "./login-mail"

test("a login email has one link and does not invite a reply", () => {
  const url = "https://rwgdle.app/login/abc_def-123"
  const message = loginEmail({ to: "ada@example.com", url })
  assert.equal(message.from, LOGIN_FROM)
  assert.equal(message.to, "ada@example.com")
  assert.equal(message.subject, "Log in to RWGdle")
  assert.match(message.text, /works once and expires in 30 minutes/)
  assert.match(message.text, /Didn't ask to log in\? Ignore this email/)
  assert.equal(message.text.split(url).length, 2)
  // One clickable link: the button. The address is also written out, unlinked, for copying.
  const hrefs = message.html.match(/href="/g)
  assert.equal(hrefs?.length, 1)
  assert.match(message.html, /href="https:\/\/rwgdle\.app\/login\/abc_def-123"/)
  assert.equal(message.html.split(url).length, 3)
})

test("a login email escapes the link and works without images or styles", () => {
  const message = loginEmail({ to: "ada@example.com", url: 'https://rwgdle.app/login/a"b<c' })
  assert.equal(message.html.includes('a"b<c'), false)
  assert.match(message.html, /a&quot;b&lt;c/)
  assert.equal(/<img|<link|<style/.test(message.html), false)
  assert.match(message.html, /Log in to RWGdle<\/a>/)
})

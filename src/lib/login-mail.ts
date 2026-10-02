export const LOGIN_FROM = "login@rwgdle.app"
/** Shown beside the address in the inbox: RWGdle <login@rwgdle.app>. */
export const LOGIN_FROM_NAME = "RWGdle"

export type LoginEmail = {
  to: string
  from: string
  subject: string
  html: string
  text: string
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;")
}

/** The Daylight theme, as plain colours: email clients ignore CSS variables. */
const PAPER = "#f5eedf"
const CARD = "#fffaf0"
const INK = "#2a2118"
const MUTED = "#6b5c48"
const ACCENT = "#c2410c"
const TILE = "#f3e4c4"
const TILE_EDGE = "#a07a45"
const SERIF = "Georgia, 'Times New Roman', serif"
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

/** RWGdle spelled in Scrabble tiles. A table, so every mail app lays it out the same. */
function tileRow(): string {
  const cells = [..."RWGDLE"]
    .map(
      (letter) =>
        `<td style="padding:0 2px;"><div style="width:34px;height:38px;line-height:38px;background:${TILE};border-radius:5px;border-bottom:3px solid ${TILE_EDGE};text-align:center;font-family:${SERIF};font-style:italic;font-size:21px;color:${INK};">${letter}</div></td>`,
    )
    .join("")
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr>${cells}</tr></table>`
}

/** One login link: a button, the same address written out, and what to do if you didn't ask. */
export function loginEmail(input: { to: string; url: string }): LoginEmail {
  const url = escapeHtml(input.url)
  const preheader = "Tap to log in. The link works once and expires in 30 minutes."
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Log in to RWGdle</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${PAPER};">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:${CARD};border-radius:16px;border:1px solid #e6d8bb;">
<tr><td align="center" style="padding:36px 32px 8px;">
${tileRow()}
<p style="margin:10px 0 0;font-family:${SANS};font-size:10px;letter-spacing:3px;text-transform:uppercase;color:${MUTED};">Random Word Generator</p>
</td></tr>
<tr><td style="padding:24px 32px 0;">
<h1 style="margin:0;font-family:${SERIF};font-style:italic;font-weight:normal;font-size:30px;line-height:1.15;color:${INK};text-align:center;">Log in to RWGdle</h1>
<p style="margin:14px 0 0;font-family:${SANS};font-size:16px;line-height:1.55;color:${INK};text-align:center;">Tap the button to log in. The link works once and expires in 30&nbsp;minutes.</p>
</td></tr>
<tr><td align="center" style="padding:28px 32px 8px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="${ACCENT}" style="border-radius:10px;">
<a href="${url}" style="display:inline-block;padding:15px 34px;font-family:${SANS};font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Log in to RWGdle</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:16px 32px 0;">
<p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.5;color:${MUTED};text-align:center;">Reading this on another device? That's fine: the device where you asked logs in too.</p>
</td></tr>
<tr><td style="padding:24px 32px 0;">
<p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.5;color:${MUTED};">Button not working? Copy this address into your browser:</p>
<p style="margin:6px 0 0;padding:10px 12px;background:${PAPER};border-radius:8px;font-family:Menlo,Consolas,monospace;font-size:12px;line-height:1.45;color:${INK};word-break:break-all;">${url}</p>
</td></tr>
<tr><td style="padding:28px 32px 32px;">
<p style="margin:0;padding-top:18px;border-top:1px solid #ece2cc;font-family:${SANS};font-size:12px;line-height:1.5;color:${MUTED};text-align:center;">Didn't ask to log in? Ignore this email. Nobody can log in without this link.</p>
</td></tr>
</table>
<p style="margin:18px 0 0;font-family:${SANS};font-size:11px;color:${MUTED};">RWGdle · Random Word Generator</p>
</td></tr>
</table>
</body>
</html>`

  const text = [
    "Log in to RWGdle",
    "",
    "Open this link to log in. It works once and expires in 30 minutes.",
    "",
    input.url,
    "",
    "Reading this on another device? That's fine: the device where you asked logs in too.",
    "",
    "Didn't ask to log in? Ignore this email. Nobody can log in without this link.",
    "",
    "RWGdle · Random Word Generator",
    "",
  ].join("\n")

  return { to: input.to, from: LOGIN_FROM, subject: "Log in to RWGdle", html, text }
}

type Sender = string | { email: string; name: string }

type EmailBinding = {
  send: (message: Omit<LoginEmail, "from"> & { from: Sender }) => Promise<unknown>
}

export async function sendLoginEmail(message: LoginEmail): Promise<void> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare")
  const { env } = await getCloudflareContext({ async: true })
  const binding = (env as { EMAIL?: EmailBinding }).EMAIL
  if (!binding || typeof binding.send !== "function") throw new Error("EMAIL binding is not configured")
  const body = { to: message.to, subject: message.subject, html: message.html, text: message.text }
  try {
    await binding.send({ ...body, from: { email: message.from, name: LOGIN_FROM_NAME } })
  } catch {
    // If the named sender is ever refused, the plain address still gets the link out.
    await binding.send({ ...body, from: message.from })
  }
}

export const LOGIN_FROM = "login@rwgdle.app"

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

/** One verify link. The plain text says it logs you in, works once, then expires. */
export function loginEmail(input: { to: string; url: string }): LoginEmail {
  const url = input.url
  return {
    to: input.to,
    from: LOGIN_FROM,
    subject: "Your RWGdle login link",
    text: `This link logs you in to RWGdle. It works once, then expires.\n\n${url}\n\nIf you did not ask for this, ignore it.\n`,
    html: `<p>This link logs you in to RWGdle. It works once, then expires.</p><p><a href="${escapeHtml(url)}">Log in to RWGdle</a></p><p>If you did not ask for this, ignore it.</p>`,
  }
}

type EmailBinding = {
  send: (message: LoginEmail) => Promise<unknown>
}

export async function sendLoginEmail(message: LoginEmail): Promise<void> {
  const { getCloudflareContext } = await import("@opennextjs/cloudflare")
  const { env } = await getCloudflareContext({ async: true })
  const binding = (env as { EMAIL?: EmailBinding }).EMAIL
  if (!binding || typeof binding.send !== "function") throw new Error("EMAIL binding is not configured")
  await binding.send({
    to: message.to,
    from: message.from,
    subject: message.subject,
    html: message.html,
    text: message.text,
  })
}

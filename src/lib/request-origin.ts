/** Public origin for links and redirects. The dev server binds 0.0.0.0, so request.url is not the host the browser used. */
export function publicOrigin(request: Request) {
  const current = new URL(request.url)
  const forwarded = request.headers.get("x-forwarded-host") ?? request.headers.get("host")
  const host = forwarded?.split(",")[0]?.trim() ?? ""
  const proto = (request.headers.get("x-forwarded-proto") ?? current.protocol.replace(":", "")).split(",")[0]?.trim()
  if (host && !host.startsWith("0.0.0.0")) return `${proto}://${host}`
  return current.origin
}

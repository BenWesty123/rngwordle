import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { appDb } from "@/lib/app-db"
import { isOwnLoginWait, LOGIN_WAIT_COOKIE, loginLinkState, loginWaitFor } from "@/lib/accounts"

function ago(createdAt: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - createdAt) / 60000))
  if (minutes < 1) return "just now"
  return minutes === 1 ? "1 minute ago" : `${minutes} minutes ago`
}

/** The page a login link opens. Shared by /login/<token> and the older /auth/verify?token= links. */
export async function VerifyLogin({ token }: { token: string }) {
  const db = await appDb()
  const state = await loginLinkState(db, token)
  if (state !== "ok") {
    const params = new URLSearchParams({ login: "1", error: state })
    redirect(`/?${params.toString()}`)
  }
  // The browser that asked for this link logs straight in. Any other browser
  // confirms first, so a link nobody asked for can't log in someone else's device.
  const own = await isOwnLoginWait(db, token, (await cookies()).get(LOGIN_WAIT_COOKIE)?.value)
  const asker = own ? null : await loginWaitFor(db, token)

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
      <SiteHeader />
      <div className="flex flex-1 flex-col justify-center py-16">
        <h1 className="max-w-md font-display text-5xl leading-[0.95] tracking-tight text-balance italic sm:text-6xl">
          {own ? "Logging you in…" : "Finish logging in."}
        </h1>
        {own ? null : (
          <p className="mt-6 max-w-md text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
            {asker
              ? `This logs in here and on the device that asked: ${asker.device}, ${ago(asker.createdAt)}. Only continue if that was you.`
              : "This link stays unused until you press Log in."}
          </p>
        )}
        <form id="verify-login" method="post" action="/api/auth/verify" className="mt-8 max-w-md">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-medium text-primary-foreground hover:bg-primary/80"
          >
            Log in
          </button>
        </form>
        {own ? (
          // Same browser: submit straight away. Mail scanners don't run this, so they can't use up the link.
          <script dangerouslySetInnerHTML={{ __html: `document.getElementById("verify-login").requestSubmit()` }} />
        ) : null}
      </div>
    </div>
  )
}

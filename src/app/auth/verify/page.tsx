import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site-header"
import { appDb } from "@/lib/app-db"
import { loginLinkState } from "@/lib/accounts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function VerifyLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = "" } = await searchParams
  const state = await loginLinkState(await appDb(), token)
  if (state !== "ok") redirect(`/login?error=${state}`)

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-10">
      <SiteHeader />
      <div className="flex flex-1 flex-col justify-center py-16">
        <h1 className="max-w-md font-display text-5xl leading-[0.95] tracking-tight text-balance italic sm:text-6xl">
          Finish logging in.
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          This link stays unused until you press Log in.
        </p>
        <form method="post" action="/api/auth/verify" className="mt-8 max-w-md">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary text-base font-medium text-primary-foreground hover:bg-primary/80"
          >
            Log in
          </button>
        </form>
      </div>
    </div>
  )
}

import Link from "next/link"
import { LoginPrompt } from "@/components/login-dialog"
import { FriendsPanel } from "@/components/friends-panel"
import { SiteHeader } from "@/components/site-header"
import { appDb } from "@/lib/app-db"
import { currentAccount } from "@/lib/current-account"
import { listFriendships } from "@/lib/friends"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function FriendsPage() {
  const account = await currentAccount()

  return (
    <div className="relative mx-auto flex min-h-dvh w-full flex-col px-5 pt-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl">
        <h1 className="mt-10 text-center font-display text-5xl leading-[0.95] tracking-tight italic sm:text-6xl">Friends</h1>
        {!account ? (
          <p className="mx-auto mt-6 max-w-md text-center text-base text-muted-foreground">
            <LoginPrompt className="cursor-pointer text-foreground underline-offset-4 hover:underline">
              Log in
            </LoginPrompt>{" "}
            and pick a username before you add a friend.
          </p>
        ) : !account.username ? (
          <p className="mx-auto mt-6 max-w-md text-center text-base text-muted-foreground">
            Pick a username on the{" "}
            <Link href="/" className="text-foreground underline-offset-4 hover:underline">
              home page
            </Link>{" "}
            before you add a friend.
          </p>
        ) : (
          <>
            <p className="mx-auto mt-4 max-w-md text-center text-sm leading-relaxed text-muted-foreground">
              Add a player by their exact username. They accept before the two of you share a leaderboard. No email is sent.
            </p>
            <FriendsPanel list={await listFriendships(await appDb(), account.id)} />
          </>
        )}
      </main>
    </div>
  )
}

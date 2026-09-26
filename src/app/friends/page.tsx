import Link from "next/link"
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
    <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-10">
      <SiteHeader />
      <h1 className="mt-12 font-display text-5xl leading-[0.95] tracking-tight italic sm:text-6xl">Friends</h1>
      {!account ? (
        <p className="mt-6 max-w-md text-base text-muted-foreground">
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline">
            Log in
          </Link>{" "}
          and pick a username before you add a friend.
        </p>
      ) : !account.username ? (
        <p className="mt-6 max-w-md text-base text-muted-foreground">
          Pick a username on the{" "}
          <Link href="/" className="text-foreground underline-offset-4 hover:underline">
            home page
          </Link>{" "}
          before you add a friend.
        </p>
      ) : (
        <>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            Add a player by their exact username. They accept before the two of you share a board. No email is sent.
          </p>
          <FriendsPanel list={await listFriendships(await appDb(), account.id)} />
        </>
      )}
    </div>
  )
}

"use client"

import { useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FriendEntry, FriendList } from "@/lib/friends"

export function FriendsPanel({ list }: { list: FriendList }) {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const empty = list.friends.length === 0 && list.incoming.length === 0 && list.outgoing.length === 0

  async function onRequest(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(body.error ?? "That request could not be sent.")
        return
      }
      setUsername("")
      router.refresh()
    } catch {
      setError("That request could not be sent.")
    } finally {
      setPending(false)
    }
  }

  async function respond(id: string, action: "accept" | "decline" | "cancel" | "remove") {
    setError(null)
    const response = await fetch("/api/friends/respond", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, action }),
    })
    const body = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(body.error ?? "That change could not be saved.")
      return
    }
    router.refresh()
  }

  return (
    <>
      <form className="mt-8 max-w-md" onSubmit={(event) => void onRequest(event)}>
        <label className="block text-sm text-foreground" htmlFor="friend-username">
          Username
        </label>
        <Input
          id="friend-username"
          className="mt-2"
          autoComplete="off"
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]{3,20}"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="tile_witch"
        />
        <Button type="submit" className="mt-4 h-12 w-full text-base sm:w-auto sm:px-6" disabled={pending}>
          {pending ? "Sending…" : "Send request"}
        </Button>
      </form>
      {error ? (
        <p className="mt-4 max-w-md text-sm text-foreground" role="alert">
          {error}
        </p>
      ) : null}
      {empty ? (
        <p className="mt-10 max-w-md text-base text-muted-foreground" role="status">
          No friends yet. Send a request with their exact username. They accept before you share a board.
        </p>
      ) : (
        <div className="mt-10 flex flex-col gap-8">
          <RequestList title="Requests for you" rows={list.incoming} empty="">
            {(row) => (
              <div className="flex flex-wrap gap-2">
                <Button type="button" className="h-9" onClick={() => void respond(row.id, "accept")}>
                  Accept
                </Button>
                <Button type="button" variant="outline" className="h-9" onClick={() => void respond(row.id, "decline")}>
                  Decline
                </Button>
              </div>
            )}
          </RequestList>
          <RequestList title="Waiting on them" rows={list.outgoing} empty="">
            {(row) => (
              <Button type="button" variant="ghost" className="h-9 px-2.5" onClick={() => void respond(row.id, "cancel")}>
                Cancel
              </Button>
            )}
          </RequestList>
          <RequestList
            title="Friends"
            rows={list.friends}
            empty="No accepted friends yet."
          >
            {(row) => (
              <Button type="button" variant="ghost" className="h-9 px-2.5" onClick={() => void respond(row.id, "remove")}>
                Remove
              </Button>
            )}
          </RequestList>
        </div>
      )}
      <p className="mt-8 text-sm text-muted-foreground">
        Accepted friends show on the{" "}
        <Link href="/leaderboard?scope=friends" className="text-foreground underline-offset-4 hover:underline">
          friends board
        </Link>
        .
      </p>
    </>
  )
}

function RequestList({
  title,
  rows,
  empty,
  children,
}: {
  title: string
  rows: FriendEntry[]
  empty: string
  children: (row: FriendEntry) => ReactNode
}) {
  if (rows.length === 0 && !empty) return null
  return (
    <section>
      <h2 className="text-sm text-muted-foreground">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-3">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3">
              <span className="text-sm text-foreground">{row.username}</span>
              {children(row)}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

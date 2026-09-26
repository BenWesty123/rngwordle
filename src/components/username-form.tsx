"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAccount } from "@/components/account-provider"

export function UsernameForm() {
  const { account, refresh } = useAccount()
  const [username, setUsername] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/account/username", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      })
      const body = (await response.json()) as { error?: string }
      if (!response.ok) {
        setError(body.error ?? "That name could not be saved.")
        return
      }
      await refresh()
    } catch {
      setError("That name could not be saved.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center py-16">
      <h1 className="max-w-md font-display text-5xl leading-[0.95] tracking-tight text-balance italic sm:text-6xl">
        Pick a username.
      </h1>
      <p className="mt-6 max-w-md text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
        {account.status === "needs-name" ? `${account.email} is logged in. ` : null}
        Three to twenty characters: letters, numbers, and underscores. The name shows on the board.
      </p>
      <form className="mt-8 max-w-md" onSubmit={(event) => void onSubmit(event)}>
        <label className="block text-sm text-foreground" htmlFor="username">
          Username
        </label>
        <Input
          id="username"
          className="mt-2"
          autoComplete="username"
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]{3,20}"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="tile_witch"
        />
        <Button type="submit" className="mt-4 h-12 w-full text-base" disabled={pending}>
          {pending ? "Saving…" : "Save username"}
        </Button>
      </form>
      {error ? (
        <p className="mt-4 max-w-md text-sm text-foreground" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const ERRORS: Record<string, string> = {
  missing: "That link does not match a login.",
  used: "That link was already used. Ask for a new one.",
  expired: "That link expired. Ask for a new one.",
}

export function LoginScreen({ errorCode }: { errorCode?: string }) {
  const [email, setEmail] = useState("")
  const [link, setLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(errorCode ? (ERRORS[errorCode] ?? "That link did not work.") : null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setLink(null)
    try {
      const response = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const body = (await response.json()) as { link?: string; error?: string }
      if (!response.ok || !body.link) {
        setError(body.error ?? "Could not start login.")
        return
      }
      setLink(body.link)
    } catch {
      setError("Could not start login.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-10">
      <SiteHeader />
      <div className="flex flex-1 flex-col justify-center py-16">
        <h1 className="max-w-md font-display text-5xl leading-[0.95] tracking-tight text-balance italic sm:text-6xl">
          Log in with a link.
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          No password. Enter an email and the game makes a one-time link. Mail is not sent yet, so the link shows up here.
        </p>
        <form className="mt-8 max-w-md" onSubmit={(event) => void onSubmit(event)}>
          <label className="block text-sm text-foreground" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            className="mt-2"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
          <Button type="submit" className="mt-4 h-12 w-full text-base" disabled={pending}>
            {pending ? "Making the link…" : "Make a login link"}
          </Button>
        </form>
        {error ? (
          <p className="mt-4 max-w-md text-sm text-foreground" role="alert">
            {error}
          </p>
        ) : null}
        {link ? (
          <div className="mt-6 max-w-md rounded-2xl border border-border bg-card px-4 py-4">
            <p className="text-sm text-foreground">Open this link to log in. It works once, for 30 minutes.</p>
            <a className="mt-3 block text-sm break-all text-amber-100 underline-offset-4 hover:underline" href={link}>
              {link}
            </a>
            <p className="mt-3 text-sm text-muted-foreground">
              After it logs you in, pick a username. One saved roll per UTC day goes on the{" "}
              <Link href="/leaderboard" className="underline-offset-4 hover:underline">
                board
              </Link>
              .
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

"use client"

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAccount } from "@/components/account-provider"

/** How often the waiting tab checks whether its link was tapped. */
const WAIT_POLL_MS = 2000

const LINK_ERRORS: Record<string, string> = {
  missing: "That link does not match a login.",
  used: "That link was already used. Ask for a new one.",
  expired: "That link expired. Ask for a new one.",
}

type Phase = "form" | "sending" | "sent" | "done"

type LoginDialogContextValue = {
  openLogin: (errorCode?: string) => void
}

const LoginDialogContext = createContext<LoginDialogContextValue | null>(null)

function linkErrorMessage(errorCode: string | undefined): string | null {
  if (!errorCode) return null
  return LINK_ERRORS[errorCode] ?? "That link did not work."
}

export function LoginDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [phase, setPhase] = useState<Phase>("form")
  const [sent, setSent] = useState<"email" | "dev" | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Secrets for the links this tab has asked for. Tapping any of them logs this tab in.
  const [waits, setWaits] = useState<string[]>([])
  const [resendAt, setResendAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const { refresh } = useAccount()
  const router = useRouter()
  const requestId = useRef(0)
  const clearQueryRef = useRef<() => void>(() => {})
  const rememberClear = useCallback((clear: () => void) => {
    clearQueryRef.current = clear
  }, [])

  const openLogin = useCallback((errorCode?: string) => {
    requestId.current += 1
    setEmail("")
    setPhase("form")
    setSent(null)
    setError(linkErrorMessage(errorCode))
    setOpen(true)
  }, [])

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) clearQueryRef.current()
  }

  // Wait for the link to be tapped, in this browser, another app, or another device.
  useEffect(() => {
    if (waits.length === 0) return
    let stopped = false
    async function check() {
      const results = await Promise.all(
        waits.map(async (wait) => {
          try {
            const response = await fetch("/api/auth/wait", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ wait }),
            })
            const body = (await response.json()) as { status?: string }
            return { wait, status: body.status ?? "waiting" }
          } catch {
            return { wait, status: "waiting" }
          }
        }),
      )
      if (stopped) return
      if (results.some((result) => result.status === "done")) {
        setWaits([])
        setPhase("done")
        await refresh()
        router.refresh()
        window.setTimeout(() => setOpen(false), 1400)
        return
      }
      const expired = new Set(results.filter((result) => result.status === "expired").map((result) => result.wait))
      if (expired.size > 0) setWaits((current) => current.filter((wait) => !expired.has(wait)))
    }
    const id = window.setInterval(() => void check(), WAIT_POLL_MS)
    // Coming back from the email app: check straight away.
    const onVisible = () => {
      if (document.visibilityState === "visible") void check()
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    return () => {
      stopped = true
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
    }
  }, [waits, refresh, router])

  // Tick the resend countdown.
  useEffect(() => {
    if (resendAt === null) return
    const id = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= resendAt) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [resendAt])

  const resendIn = resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000))

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await sendLink()
  }

  async function sendLink() {
    const trimmed = email.trim()
    if (trimmed.length < 3 || trimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter an email address.")
      setPhase("form")
      return
    }
    const id = ++requestId.current
    setPhase("sending")
    setError(null)
    setSent(null)
    try {
      const response = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      const body = (await response.json()) as {
        ok?: boolean
        dev?: boolean
        limited?: boolean
        retryAfter?: number
        wait?: string
        error?: string
      }
      if (id !== requestId.current) return
      const startedAt = Date.now()
      setNow(startedAt)
      if (typeof body.retryAfter === "number") setResendAt(startedAt + body.retryAfter * 1000)
      if (body.limited) {
        // A link is already on its way; keep waiting for it.
        setSent((current) => current ?? "email")
        setPhase("sent")
        return
      }
      if (!response.ok || !body.ok) {
        setError(body.error ?? "Could not send the login email.")
        setPhase("form")
        return
      }
      if (body.wait) setWaits((current) => [...current, body.wait!])
      setSent(body.dev ? "dev" : "email")
      setPhase("sent")
    } catch {
      if (id !== requestId.current) return
      setError("Could not send the login email.")
      setPhase("form")
    }
  }

  return (
    <LoginDialogContext.Provider value={{ openLogin }}>
      {children}
      <Suspense fallback={null}>
        <LoginQueryBridge openLogin={openLogin} onReady={rememberClear} />
      </Suspense>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:p-6">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-display text-3xl leading-none tracking-tight italic">Log in</DialogTitle>
            {phase === "form" ? (
              <DialogDescription className="text-pretty">
                No password. Enter an email and RWGdle sends a one-time link. It logs you in, works once, then expires.
              </DialogDescription>
            ) : (
              <DialogDescription className="sr-only">Login link status</DialogDescription>
            )}
          </DialogHeader>
          {phase === "sending" ? (
            <p className="py-6 text-sm text-foreground" role="status">
              Sending the login link…
            </p>
          ) : phase === "done" ? (
            <p className="py-6 text-base text-foreground" role="status">
              You&apos;re logged in.
            </p>
          ) : phase === "sent" && sent ? (
            <div role="status">
              <p className="text-sm text-pretty text-foreground">
                {sent === "dev"
                  ? "This dev server does not send mail. The login link is in the server log, not in this popup."
                  : `We sent a link to ${email.trim()}. Tap it on any device and this page logs in by itself.`}
              </p>
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
                Waiting for you to tap the link…
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 text-base"
                  disabled={resendIn > 0}
                  onClick={() => void sendLink()}
                >
                  {resendIn > 0 ? `Resend in ${Math.floor(resendIn / 60)}:${String(resendIn % 60).padStart(2, "0")}` : "Resend email"}
                </Button>
                <DialogClose render={<Button variant="outline" className="h-12 text-base" />}>Close</DialogClose>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Not there? Check spam, or resend. You can close this; it still logs in.</p>
            </div>
          ) : (
            <form className="grid gap-4" noValidate onSubmit={(event) => void onSubmit(event)}>
              <div>
                <label className="block text-sm text-foreground" htmlFor="login-email">
                  Email
                </label>
                <Input
                  id="login-email"
                  className="mt-2"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  aria-invalid={error ? true : undefined}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              {error ? (
                <p className="text-sm text-foreground" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="h-12 w-full text-base">
                Email me a link
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Your email is only used to log you in.{" "}
                <a href="/privacy" className="underline underline-offset-4 hover:text-foreground">
                  Privacy
                </a>
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </LoginDialogContext.Provider>
  )
}

function LoginQueryBridge({
  openLogin,
  onReady,
}: {
  openLogin: (errorCode?: string) => void
  onReady: (clear: () => void) => void
}) {
  const search = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const opened = useRef<string | null>(null)

  useEffect(() => {
    onReady(() => {
      const params = new URLSearchParams(search.toString())
      if (params.get("login") !== "1") return
      params.delete("login")
      params.delete("error")
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    })
  }, [onReady, pathname, router, search])

  useEffect(() => {
    if (search.get("login") !== "1") {
      opened.current = null
      return
    }
    const key = search.toString()
    if (opened.current === key) return
    opened.current = key
    openLogin(search.get("error") ?? undefined)
  }, [openLogin, search])

  return null
}

export function useLoginDialog(): LoginDialogContextValue {
  const value = useContext(LoginDialogContext)
  if (!value) throw new Error("LoginDialogProvider is missing")
  return value
}

export function LoginPrompt({ children, className }: { children: ReactNode; className?: string }) {
  const { openLogin } = useLoginDialog()
  return (
    <button type="button" className={className} onClick={() => openLogin()}>
      {children}
    </button>
  )
}

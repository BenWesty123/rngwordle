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

const LINK_ERRORS: Record<string, string> = {
  missing: "That link does not match a login.",
  used: "That link was already used. Ask for a new one.",
  expired: "That link expired. Ask for a new one.",
}

type Phase = "form" | "sending" | "sent"

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

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
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
      const body = (await response.json()) as { ok?: boolean; dev?: boolean; limited?: boolean; error?: string }
      if (id !== requestId.current) return
      if (body.limited) {
        setError("Wait a few minutes before asking for another link.")
        setPhase("form")
        return
      }
      if (!response.ok || !body.ok) {
        setError(body.error ?? "Could not send the login email.")
        setPhase("form")
        return
      }
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
          ) : phase === "sent" && sent ? (
            <div role="status">
              <p className="text-sm text-pretty text-foreground">
                {sent === "dev"
                  ? "This dev server does not send mail. The login link is in the server log, not in this popup."
                  : "Check your inbox for a login link. It works once, then expires. If you did not get it, wait a few minutes before asking again."}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">After it logs you in, pick a username.</p>
              <DialogClose render={<Button variant="outline" className="mt-5 h-12 w-full text-base" />}>
                Close
              </DialogClose>
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

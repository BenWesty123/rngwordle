"use client"

import { useSyncExternalStore } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Must match the key read by the inline script in app/layout.tsx. */
const THEME_KEY = "rwgdle.theme"

const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function isDark(): boolean {
  return document.documentElement.classList.contains("dark")
}

function setDark(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark)
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light")
  } catch {
    // Private mode: the choice lasts until the page reloads.
  }
  for (const listener of listeners) listener()
}

/** Daylight in light mode, Card Table in dark mode. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => true)
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9"
      onClick={() => setDark(!dark)}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

"use client";

import type { ClientCounter } from "@/lib/counters";

/** Count an anonymous event for the stats page. Fire and forget; it survives the page closing. */
export function track(name: ClientCounter): void {
  try {
    const body = JSON.stringify({ name });
    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  } catch {
    // Counting is best-effort.
  }
}

/** Set when someone arrives from a friend's shared link, so their first roll counts as a share that worked. */
const FROM_SHARE_KEY = "rwgdle.from-share";
const FROM_SHARE_MS = 24 * 60 * 60 * 1000;

export function markFromShare(): void {
  try {
    localStorage.setItem(FROM_SHARE_KEY, String(Date.now()));
  } catch {
    // Private mode: the roll just won't be attributed.
  }
}

/** True once, for a roll made within a day of arriving from a shared link. */
export function takeFromShare(): boolean {
  try {
    const at = Number(localStorage.getItem(FROM_SHARE_KEY));
    localStorage.removeItem(FROM_SHARE_KEY);
    return Number.isFinite(at) && at > 0 && Date.now() - at < FROM_SHARE_MS;
  } catch {
    return false;
  }
}

"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, MessageCircle, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function subscribeNothing(): () => void {
  return () => {};
}

/** The phone's own share sheet, when the browser has one. It reaches every messaging app. */
function useNativeShare(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false,
  );
}

const LINK_BUTTON =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-medium text-white transition-opacity hover:opacity-90";

/**
 * Send a roll to friends. WhatsApp, X, and Telegram open with the message filled in.
 * Discord has no share link, so its button copies the message to paste in.
 */
export function ShareBar({
  message,
  messageWithoutLink,
  link,
  onCopy,
  copied,
  copyError,
}: {
  message: string;
  messageWithoutLink: string;
  link: string;
  onCopy: (text: string) => void;
  copied: boolean;
  copyError: boolean;
}) {
  const native = useNativeShare();
  const [copiedFor, setCopiedFor] = useState<"discord" | "copy" | null>(null);

  async function shareNatively() {
    try {
      await navigator.share({ text: message });
    } catch {
      // Closing the share sheet throws; there's nothing to do.
    }
  }

  function copyFor(target: "discord" | "copy") {
    setCopiedFor(target);
    onCopy(message);
  }

  const encoded = encodeURIComponent(message);
  return (
    <section className="row-in mx-auto mt-6 w-full max-w-xl rounded-2xl border border-border bg-card/70 p-4" aria-label="Share">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl tracking-tight italic">Challenge your friends</h2>
        {native ? (
          <Button type="button" className="h-10 px-4" onClick={() => void shareNatively()}>
            <Share2 />
            Share
          </Button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a className={cn(LINK_BUTTON, "bg-[#1fa855]")} href={`https://wa.me/?text=${encoded}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="size-4" aria-hidden />
          WhatsApp
        </a>
        <button type="button" className={cn(LINK_BUTTON, "bg-[#5865f2]")} onClick={() => copyFor("discord")}>
          <MessageCircle className="size-4" aria-hidden />
          Discord
        </button>
        <a
          className={cn(LINK_BUTTON, "bg-[#0f1419] dark:bg-[#2a2f35]")}
          href={`https://x.com/intent/post?text=${encoded}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span aria-hidden className="text-base leading-none font-bold">𝕏</span>
          Post
        </a>
        <a
          className={cn(LINK_BUTTON, "bg-[#2a9fd8]")}
          href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(messageWithoutLink)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Send className="size-4" aria-hidden />
          Telegram
        </a>
        <Button type="button" variant="outline" className="h-10" onClick={() => copyFor("copy")}>
          {copied && copiedFor === "copy" ? <Check /> : <Copy />}
          {copied && copiedFor === "copy" ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-2 min-h-5 text-xs text-muted-foreground" role="status">
        {copyError
          ? "Your browser blocked copying. Select the message below and copy it yourself."
          : copied && copiedFor === "discord"
            ? "Copied! Paste it into any Discord chat."
            : ""}
      </p>
      <pre className="mt-1 overflow-x-auto rounded-lg border border-border bg-background/60 px-3 py-2.5 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/90">
        {message}
      </pre>
    </section>
  );
}

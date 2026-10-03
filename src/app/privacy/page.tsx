import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"
import { SiteHeader } from "@/components/site-header"

export const metadata: Metadata = {
  title: "Privacy · RWGdle",
  description: "What RWGdle stores about you, why, and how to have it deleted.",
}

/** Where privacy questions and deletion requests go. It forwards to the person who runs the game. */
const CONTACT = "login@rwgdle.app"

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-2xl tracking-tight italic">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-pretty text-muted-foreground">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(ellipse_at_top,var(--glow),transparent_60%)]" />
      <div className="relative mx-auto flex min-h-dvh w-full flex-col px-5 pt-3 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-6">
        <SiteHeader />
        <main className="mx-auto w-full max-w-2xl">
          <div className="mt-10 text-center">
            <p className="text-[11px] tracking-[0.28em] text-muted-foreground uppercase">Last updated 2 October 2026</p>
            <h1 className="mt-2 font-display text-5xl leading-[0.95] tracking-tight italic sm:text-6xl">Privacy</h1>
            <p className="mx-auto mt-4 max-w-md text-sm text-pretty text-muted-foreground">
              The short version: RWGdle keeps the least it can to run the game. No ads, no trackers, and nothing is sold or shared.
            </p>
          </div>

          <Section title="If you play without logging in">
            <p>
              No account is made. Your browser keeps today&apos;s word, the cards you&apos;ve found, and your light or dark
              choice in its own storage, on your device.
            </p>
            <p>
              One cookie marks your browser so it gets one leaderboard roll a day. The server stores only a scrambled
              version of it, with the day, and can&apos;t turn that back into anything about you. Your leaderboard roll is
              saved as &ldquo;Anonymous&rdquo;: the word, its score, and the time.
            </p>
          </Section>

          <Section title="If you log in">
            <p>
              RWGdle stores your <strong className="text-foreground">email address</strong>, used only to send you login
              links, and the <strong className="text-foreground">username</strong> you pick, which is shown publicly on
              leaderboards. Your email is never shown to other players.
            </p>
            <p>
              It also stores your daily rolls (the word, score, and time), your friend requests and friends, and a login
              cookie that keeps you signed in for up to a year. Your card collection is worked out from your saved rolls.
            </p>
          </Section>

          <Section title="Login emails and abuse limits">
            <p>
              Login links expire after 30 minutes and work once. To stop the login form being used to send spam, the server
              counts login requests per network address per day. It keeps only a scrambled version of the address, never
              the address itself.
            </p>
          </Section>

          <Section title="Who else is involved">
            <p>
              The game runs on Cloudflare, which hosts the site, stores the database, and sends the login emails. Like any
              web host, Cloudflare processes your network address to deliver pages and block attacks. There is no
              advertising and no tracking across other sites.
            </p>
          </Section>

          <Section title="How we see how the game is doing">
            <p>
              RWGdle counts some things anonymously each day: how many rolls there were, how many shares went out by app
              (WhatsApp, Discord and so on), and how many people opened a shared link. These are plain daily totals. They
              aren&apos;t linked to you, your account, or your device, and no cookies are used for them.
            </p>
          </Section>

          <Section title="Sharing">
            <p>
              When you share a roll, the link holds only the word. It opens a page showing that word and its score; it
              doesn&apos;t say who shared it.
            </p>
          </Section>

          <Section title="Your choices">
            <p>
              You can ask for a copy of what&apos;s stored about you, or to have your account and everything linked to it
              deleted. Email{" "}
              <a className="text-foreground underline underline-offset-4" href={`mailto:${CONTACT}`}>
                {CONTACT}
              </a>{" "}
              from the address you log in with. To clear what a logged-out browser holds, clear this site&apos;s data in
              your browser settings.
            </p>
            <p>
              RWGdle is run from the United Kingdom, and UK data protection law applies. If you have a concern that
              isn&apos;t resolved, you can contact the Information Commissioner&apos;s Office (ico.org.uk).
            </p>
          </Section>

          <p className="mt-12 text-center text-sm">
            <Link href="/" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Back to the game
            </Link>
          </p>
        </main>
      </div>
    </div>
  )
}

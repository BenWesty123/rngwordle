import Link from "next/link"
import { cn } from "@/lib/utils"

export function PlayerLink({ username, className }: { username: string; className?: string }) {
  if (username.toLowerCase() === "anonymous" || username === "Hidden player") {
    return <span className={className}>{username}</span>
  }
  return (
    <Link
      href={`/players/${encodeURIComponent(username)}`}
      prefetch={false}
      className={cn("underline decoration-border underline-offset-4 hover:decoration-current", className)}
    >
      {username}
    </Link>
  )
}

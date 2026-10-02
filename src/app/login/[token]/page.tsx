import type { Metadata } from "next"
import { VerifyLogin } from "@/components/verify-login"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: "Log in · RWGdle", robots: { index: false } }

/** The link in a login email: rwgdle.app/login/<token>. */
export default async function LoginLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <VerifyLogin token={token} />
}

import { VerifyLogin } from "@/components/verify-login"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Older login links. New emails use /login/<token>. */
export default async function VerifyLoginPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams
  return <VerifyLogin token={token} />
}

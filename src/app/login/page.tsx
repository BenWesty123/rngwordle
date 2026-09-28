import { redirect } from "next/navigation"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const params = new URLSearchParams({ login: "1" })
  if (error) params.set("error", error)
  redirect(`/?${params.toString()}`)
}

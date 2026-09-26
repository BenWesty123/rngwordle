import { LoginScreen } from "@/components/login-screen"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return <LoginScreen errorCode={error} />
}

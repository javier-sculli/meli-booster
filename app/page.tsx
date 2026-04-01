import { getTokens } from '@/lib/tokens'
import Dashboard from '@/components/Dashboard'
import LoginPage from '@/components/LoginPage'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const tokenData = await getTokens()
  const isLoggedIn = !!tokenData

  if (!isLoggedIn) {
    return <LoginPage error={params.error} />
  }

  return <Dashboard />
}

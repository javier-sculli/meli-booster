import { cookies } from 'next/headers'
import type { TokenData } from './meli'
import { refreshAccessToken } from './meli'

const COOKIE_NAME = 'meli_tokens'

export async function saveTokens(data: {
  access_token: string
  refresh_token: string
  user_id: number
  expires_in: number
}): Promise<TokenData> {
  const tokenData: TokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user_id,
    expires_at: Date.now() + data.expires_in * 1000,
  }
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, JSON.stringify(tokenData), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return tokenData
}

export async function getTokens(): Promise<TokenData | null> {
  try {
    const cookieStore = await cookies()
    const raw = cookieStore.get(COOKIE_NAME)?.value
    if (!raw) return null
    return JSON.parse(raw) as TokenData
  } catch {
    return null
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokenData = await getTokens()
  if (!tokenData) return null

  if (tokenData.expires_at - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(tokenData.refresh_token)
      await saveTokens({
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        user_id: refreshed.user_id,
        expires_in: refreshed.expires_in,
      })
      return refreshed.access_token
    } catch {
      return null
    }
  }

  return tokenData.access_token
}

export async function clearTokens() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

import { cookies } from 'next/headers'
import type { TokenData } from './meli'
import { refreshAccessToken, getUserInfo } from './meli'
import redis from './redis'

const COOKIE_NAME = 'meli_tokens'
const REDIS_KEY = 'owner_token'
const REDIS_USER_KEY = 'owner_user'

// --- Cookie helpers (session) ---

export async function saveTokensToCookie(data: {
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

export async function getTokensFromCookie(): Promise<TokenData | null> {
  try {
    const cookieStore = await cookies()
    const raw = cookieStore.get(COOKIE_NAME)?.value
    if (!raw) return null
    return JSON.parse(raw) as TokenData
  } catch {
    return null
  }
}

// --- Redis helpers (owner token) ---

export async function saveOwnerToken(data: TokenData): Promise<void> {
  await redis.set(REDIS_KEY, JSON.stringify(data))
}

export async function getOwnerToken(): Promise<TokenData | null> {
  try {
    const raw = await redis.get(REDIS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TokenData
  } catch {
    return null
  }
}

// --- Main API ---

export async function saveTokens(data: {
  access_token: string
  refresh_token: string
  user_id: number
  expires_in: number
}): Promise<TokenData> {
  const tokenData = await saveTokensToCookie(data)

  // Verify the token works before persisting as owner token
  try {
    const userInfo = await getUserInfo(tokenData.access_token)
    await saveOwnerToken(tokenData)
    await redis.set(REDIS_USER_KEY, JSON.stringify({
      id: userInfo.id,
      nickname: userInfo.nickname,
      first_name: userInfo.first_name,
      last_name: userInfo.last_name,
      email: userInfo.email,
      saved_at: new Date().toISOString(),
    }))
    console.log('Owner token saved to Redis for user:', userInfo.nickname)
  } catch {
    console.log('Token validation failed, not saving as owner token')
  }

  return tokenData
}

export async function getTokens(): Promise<TokenData | null> {
  // Always use owner token from Redis if available
  const owner = await getOwnerToken()
  if (owner) return owner
  // Fall back to cookie (e.g. first login before owner token is set)
  return getTokensFromCookie()
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokenData = await getTokens()
  if (!tokenData) return null

  if (tokenData.expires_at - Date.now() < 5 * 60 * 1000) {
    try {
      const refreshed = await refreshAccessToken(tokenData.refresh_token)
      const newData: TokenData = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        user_id: refreshed.user_id,
        expires_at: Date.now() + refreshed.expires_in * 1000,
      }
      // Update Redis owner token if this was the owner token
      const owner = await getOwnerToken()
      if (owner?.user_id === newData.user_id) {
        await saveOwnerToken(newData)
      }
      await saveTokensToCookie({ ...refreshed })
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
  await redis.del(REDIS_KEY)
  await redis.del(REDIS_USER_KEY)
}

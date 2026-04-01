import fs from 'fs/promises'
import path from 'path'
import type { TokenData } from './meli'
import { refreshAccessToken } from './meli'

const TOKEN_FILE = path.join(process.cwd(), '.token.json')

export async function saveTokens(data: {
  access_token: string
  refresh_token: string
  user_id: number
  expires_in: number
}) {
  const tokenData: TokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user_id,
    expires_at: Date.now() + data.expires_in * 1000,
  }
  
  await fs.writeFile(TOKEN_FILE, JSON.stringify(tokenData, null, 2), 'utf-8')
  return tokenData
}

export async function getTokens(): Promise<TokenData | null> {
  try {
    const raw = await fs.readFile(TOKEN_FILE, 'utf-8')
    return JSON.parse(raw) as TokenData
  } catch {
    return null
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const tokenData = await getTokens()
  if (!tokenData) return null

  // If token expires in less than 5 minutes, refresh it
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
  try {
    await fs.unlink(TOKEN_FILE)
  } catch {
    // Ignore if file doesn't exist
  }
}

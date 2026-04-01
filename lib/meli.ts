const MELI_AUTH_URL = 'https://auth.mercadolibre.com.ar/authorization'
const MELI_API_URL = 'https://api.mercadolibre.com'

export interface TokenData {
  access_token: string
  refresh_token: string
  user_id: number
  expires_at: number
}

export interface MeliCollection {
  id: number
  status: 'approved' | 'pending' | 'cancelled' | 'in_process' | 'rejected'
  status_detail: string
  date_created: string
  date_approved: string | null
  last_modified: string
  total_paid_amount: number
  net_received_amount: number
  marketplace_fee: number
  currency_id: string
  reason: string
  order_id: number
  payment_method_id: string
  payment_type: string
  installments: number
  buyer: {
    id: number
    nickname: string
  }
}

export interface CollectionsResponse {
  paging: { total: number; offset: number; limit: number }
  results: Array<{ collection: MeliCollection }>
}

export function buildAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.MELI_APP_ID!,
    redirect_uri: process.env.MELI_REDIRECT_URI!,
    scope: 'read offline_access',
  })
  return `${MELI_AUTH_URL}?${params}`
}

export function buildImplicitAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: 'token',
    client_id: process.env.MELI_APP_ID!,
    redirect_uri: redirectUri,
  })
  return `${MELI_AUTH_URL}?${params}`
}

export async function exchangeCode(code: string): Promise<TokenData & { expires_in: number }> {
  const res = await fetch(`${MELI_API_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.MELI_APP_ID!,
      client_secret: process.env.MELI_APP_SECRET!,
      code,
      redirect_uri: process.env.MELI_REDIRECT_URI!,
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`)
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenData & { expires_in: number }> {
  const res = await fetch(`${MELI_API_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.MELI_APP_ID!,
      client_secret: process.env.MELI_APP_SECRET!,
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  return res.json()
}

export async function getUserInfo(accessToken: string) {
  const res = await fetch(`${MELI_API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to get user info')
  return res.json()
}

function getTodayRangeAR() {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const todayAR = formatter.format(now) // "YYYY-MM-DD"
  return {
    from: `${todayAR}T00:00:00.000-03:00`,
    to: `${todayAR}T23:59:59.999-03:00`,
  }
}

export async function getTodayCollections(
  accessToken: string,
  offset = 0,
  limit = 50
): Promise<CollectionsResponse> {
  const { from, to } = getTodayRangeAR()
  const params = new URLSearchParams({
    'date_created.from': from,
    'date_created.to': to,
    limit: String(limit),
    offset: String(offset),
    sort: 'date_created',
    criteria: 'desc',
  })
  const res = await fetch(`${MELI_API_URL}/collections/search?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Collections fetch failed: ${res.status}`)
  return res.json()
}

export async function getAllTodayCollections(accessToken: string): Promise<MeliCollection[]> {
  const first = await getTodayCollections(accessToken, 0, 50)
  const total = first.paging.total
  const collections = first.results.map((r) => r.collection)

  if (total <= 50) return collections

  // Fetch remaining pages in parallel
  const pages = Math.ceil((total - 50) / 50)
  const promises = Array.from({ length: pages }, (_, i) =>
    getTodayCollections(accessToken, (i + 1) * 50, 50)
  )
  const results = await Promise.all(promises)
  for (const page of results) {
    collections.push(...page.results.map((r) => r.collection))
  }
  return collections
}

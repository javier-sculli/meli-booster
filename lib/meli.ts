const MELI_AUTH_URL = 'https://auth.mercadolibre.com.ar/authorization'
const MELI_API_URL = 'https://api.mercadolibre.com'
const MP_API_URL = 'https://api.mercadopago.com'

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

interface MPPaymentRaw {
  id: number
  status: string
  status_detail: string
  date_created: string
  date_approved: string | null
  date_last_updated: string
  transaction_amount: number
  transaction_details: {
    net_received_amount: number
    total_paid_amount: number
  }
  fee_details: Array<{ amount: number }>
  currency_id: string
  description: string
  order?: { id: number }
  payment_method_id: string
  payment_type_id: string
  installments: number
  payer: {
    id: number
    email: string
    first_name?: string
    last_name?: string
  }
}

interface MPPaymentsResponse {
  paging: { total: number; offset: number; limit: number }
  results: MPPaymentRaw[]
}

export function mpPaymentToCollection(p: MPPaymentRaw): MeliCollection {
  const fee = (p.fee_details ?? []).reduce((sum, f) => sum + (f?.amount ?? 0), 0)
  return {
    id: p.id,
    status: p.status as MeliCollection['status'],
    status_detail: p.status_detail ?? '',
    date_created: p.date_created,
    date_approved: p.date_approved,
    last_modified: p.date_last_updated,
    total_paid_amount: p.transaction_amount ?? 0,
    net_received_amount: p.transaction_details?.net_received_amount ?? (p.transaction_amount ?? 0) - fee,
    marketplace_fee: fee,
    currency_id: p.currency_id ?? 'ARS',
    reason: p.description ?? '',
    order_id: p.order?.id ?? 0,
    payment_method_id: p.payment_method_id ?? '',
    payment_type: p.payment_type_id ?? '',
    installments: p.installments ?? 1,
    buyer: {
      id: p.payer?.id ?? 0,
      nickname: p.payer?.first_name
        ? `${p.payer.first_name} ${p.payer.last_name ?? ''}`.trim()
        : (p.payer?.email ?? ''),
    },
  }
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

export function getTodayAR(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

function buildDateRange(fromDate: string, toDate: string) {
  return {
    from: `${fromDate}T00:00:00.000-03:00`,
    to: `${toDate}T23:59:59.999-03:00`,
  }
}

async function fetchPaymentsPage(
  accessToken: string,
  fromDate: string,
  toDate: string,
  offset = 0,
  limit = 50
): Promise<MPPaymentsResponse> {
  const { from, to } = buildDateRange(fromDate, toDate)
  const params = new URLSearchParams({
    begin_date: from,
    end_date: to,
    limit: String(limit),
    offset: String(offset),
    sort: 'date_created',
    criteria: 'desc',
  })
  const res = await fetch(`${MP_API_URL}/v1/payments/search?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Payments fetch failed: ${res.status}`)
  return res.json()
}

export async function getAllCollections(
  accessToken: string,
  fromDate: string,
  toDate: string
): Promise<MeliCollection[]> {
  const first = await fetchPaymentsPage(accessToken, fromDate, toDate, 0, 50)
  const total = first.paging.total
  const payments = first.results.filter(Boolean).map(mpPaymentToCollection)

  if (total <= 50) return payments

  const pages = Math.ceil((total - 50) / 50)
  const promises = Array.from({ length: pages }, (_, i) =>
    fetchPaymentsPage(accessToken, fromDate, toDate, (i + 1) * 50, 50)
  )
  const results = await Promise.all(promises)
  for (const page of results) {
    payments.push(...page.results.filter(Boolean).map(mpPaymentToCollection))
  }
  return payments
}

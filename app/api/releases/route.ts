import { NextResponse } from 'next/server'
import { getValidAccessToken } from '@/lib/tokens'
import { mpPaymentToCollection } from '@/lib/meli'

const MP_API_URL = 'https://api.mercadopago.com'

interface MPPaymentRaw {
  id: number
  status: string
  date_created: string
  date_approved: string | null
  money_release_date: string | null
  money_release_status: string | null
  transaction_amount: number
  transaction_details: { net_received_amount: number; total_paid_amount: number }
  fee_details: Array<{ amount: number }>
  currency_id: string
  description: string
  order?: { id: number }
  payment_method_id: string
  payment_type_id: string
  installments: number
  payer: { id: number; email: string; first_name?: string; last_name?: string }
  status_detail: string
  date_last_updated: string
}

async function fetchPage(accessToken: string, offset: number, begin: string) {
  const params = new URLSearchParams({
    begin_date: `${begin}T00:00:00.000-03:00`,
    limit: '50',
    offset: String(offset),
    sort: 'date_created',
    criteria: 'desc',
  })
  const res = await fetch(`${MP_API_URL}/v1/payments/search?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Payments fetch failed: ${res.status}`)
  return res.json() as Promise<{ paging: { total: number }; results: MPPaymentRaw[] }>
}

export async function GET() {
  const accessToken = await getValidAccessToken()
  if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch approved payments from the last 60 days (release window is ~30 days)
  const begin = new Date()
  begin.setDate(begin.getDate() - 60)
  const beginStr = begin.toISOString().split('T')[0]

  const first = await fetchPage(accessToken, 0, beginStr)
  const total = first.paging.total
  let all = [...first.results]

  if (total > 50) {
    const pages = Math.ceil((total - 50) / 50)
    const rest = await Promise.all(
      Array.from({ length: pages }, (_, i) => fetchPage(accessToken, (i + 1) * 50, beginStr))
    )
    for (const page of rest) all.push(...page.results)
  }

  const nowStr = new Date().toISOString()

  // Filter: approved payments with future release date not yet released
  const pending = all.filter(
    (p) =>
      p.status === 'approved' &&
      p.money_release_date !== null &&
      p.money_release_date > nowStr &&
      p.money_release_status !== 'released'
  )

  // Group by release date (YYYY-MM-DD in AR timezone)
  const byDate = new Map<string, { net: number; gross: number; count: number; payments: typeof pending }>()

  for (const p of pending) {
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(p.money_release_date!))

    if (!byDate.has(dateStr)) byDate.set(dateStr, { net: 0, gross: 0, count: 0, payments: [] })
    const entry = byDate.get(dateStr)!
    const fee = p.fee_details.reduce((s, f) => s + f.amount, 0)
    const net = p.transaction_details?.net_received_amount ?? (p.transaction_amount - fee)
    entry.net += net
    entry.gross += p.transaction_amount
    entry.count += 1
    entry.payments.push(p)
  }

  const releases = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      net: data.net,
      gross: data.gross,
      count: data.count,
      payments: data.payments.map((p) => ({
        id: p.id,
        date_approved: p.date_approved,
        money_release_date: p.money_release_date,
        net: p.transaction_details?.net_received_amount ?? (p.transaction_amount - p.fee_details.reduce((s, f) => s + f.amount, 0)),
        gross: p.transaction_amount,
        description: p.description,
        payment_method_id: p.payment_method_id,
        installments: p.installments,
        payer_name: p.payer.first_name ? `${p.payer.first_name} ${p.payer.last_name ?? ''}`.trim() : p.payer.email,
      })),
    }))

  const totalNet = releases.reduce((s, r) => s + r.net, 0)
  const totalGross = releases.reduce((s, r) => s + r.gross, 0)

  return NextResponse.json({
    releases,
    summary: {
      total_net: totalNet,
      total_gross: totalGross,
      total_payments: pending.length,
      currency: 'ARS',
    },
    fetched_at: new Date().toISOString(),
  })
}

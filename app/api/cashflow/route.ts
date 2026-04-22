import { NextResponse } from 'next/server'
import { getValidAccessToken } from '@/lib/tokens'
import { getDisponible, getEgresos, getAportes } from '@/lib/cashflow'
import { getTodayAR } from '@/lib/meli'

const MP_API_URL = 'https://api.mercadopago.com'

interface MPPaymentRaw {
  id: number
  status: string
  money_release_date: string | null
  money_release_status: string | null
  transaction_amount: number
  transaction_details: { net_received_amount: number } | null
  fee_details: Array<{ amount: number }> | null
  date_created: string
  description: string
  payer: { id: number; email: string; first_name?: string; last_name?: string } | null
  installments: number
}

async function fetchAllReleasePayments(accessToken: string, daysBack: number): Promise<MPPaymentRaw[]> {
  const begin = new Date()
  begin.setDate(begin.getDate() - daysBack)
  const beginStr = begin.toISOString().split('T')[0]

  const first = await fetch(
    `${MP_API_URL}/v1/payments/search?begin_date=${beginStr}T00:00:00.000-03:00&limit=50&offset=0&sort=date_created&criteria=desc`,
    { headers: { Authorization: `Bearer ${accessToken}` }, next: { revalidate: 0 } }
  ).then((r) => r.json()) as { paging: { total: number }; results: MPPaymentRaw[] }

  let all = (first.results ?? []).filter(Boolean)
  const total = first.paging.total

  if (total > 50) {
    const pages = Math.ceil((total - 50) / 50)
    const rest = await Promise.all(
      Array.from({ length: pages }, (_, i) =>
        fetch(
          `${MP_API_URL}/v1/payments/search?begin_date=${beginStr}T00:00:00.000-03:00&limit=50&offset=${(i + 1) * 50}&sort=date_created&criteria=desc`,
          { headers: { Authorization: `Bearer ${accessToken}` }, next: { revalidate: 0 } }
        ).then((r) => r.json()) as Promise<{ results: MPPaymentRaw[] }>
      )
    )
    for (const page of rest) all.push(...(page.results ?? []).filter(Boolean))
  }

  return all
}

async function getMPBalance(accessToken: string): Promise<number | null> {
  try {
    const res = await fetch(`${MP_API_URL}/v1/account/balance`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      next: { revalidate: 0 },
    })
    if (!res.ok) return null
    const data = await res.json()
    // available_balance or total_amount depending on API version
    return data.available_balance ?? data.total_amount ?? null
  } catch {
    return null
  }
}

function toARDate(isoStr: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(isoStr))
}

export async function GET() {
  const accessToken = await getValidAccessToken()
  if (!accessToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const DAYS_BACK = 30
  const DAYS_FORWARD = 30

  const [disponibleManual, mpBalance, egresos, aportes, payments] = await Promise.all([
    getDisponible(),
    getMPBalance(accessToken),
    getEgresos(),
    getAportes(),
    fetchAllReleasePayments(accessToken, DAYS_BACK + 5),
  ])

  // Use MP balance if available, fall back to manual
  const disponible = mpBalance ?? disponibleManual

  const today = getTodayAR()

  // Build MELI income by date from money_release_date
  const meliByDate = new Map<string, number>()
  for (const p of payments) {
    if (!p.money_release_date) continue
    if (p.status !== 'approved') continue
    const date = toARDate(p.money_release_date)
    const fee = (p.fee_details ?? []).reduce((s, f) => s + (f?.amount ?? 0), 0)
    const net = p.transaction_details?.net_received_amount ?? (p.transaction_amount - fee)
    meliByDate.set(date, (meliByDate.get(date) ?? 0) + net)
  }

  // Build date list: DAYS_BACK ago → today → DAYS_FORWARD ahead
  const totalDays = DAYS_BACK + DAYS_FORWARD + 1
  const startOffset = -DAYS_BACK

  const dateList: string[] = []
  for (let i = startOffset; i <= DAYS_FORWARD; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    dateList.push(toARDate(d.toISOString()))
  }

  // Compute caja starting from DAYS_BACK ago.
  // "disponible" = today's balance, so back-calculate the starting caja:
  // caja_start = disponible - sum(ingresos_meli[past] + aportes[past] - egresos[past]) for days from start to yesterday
  let cajaStart = disponible
  for (let i = startOffset; i < 0; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const date = toARDate(d.toISOString())
    const meli = meliByDate.get(date) ?? 0
    const egr = egresos.filter((e) => e.date === date).reduce((s, e) => s + e.amount, 0)
    const apr = aportes.filter((a) => a.date === date).reduce((s, a) => s + a.amount, 0)
    cajaStart -= meli + apr - egr
  }

  const days: {
    date: string
    ingresos_meli: number
    egresos: number
    aportes: number
    caja: number
  }[] = []

  let caja = cajaStart

  for (const date of dateList) {
    const ingresos_meli = meliByDate.get(date) ?? 0
    const egresosDay = egresos.filter((e) => e.date === date).reduce((s, e) => s + e.amount, 0)
    const aportesDay = aportes.filter((a) => a.date === date).reduce((s, a) => s + a.amount, 0)
    caja = caja + ingresos_meli + aportesDay - egresosDay
    days.push({ date, ingresos_meli, egresos: egresosDay, aportes: aportesDay, caja })
  }

  return NextResponse.json({
    disponible,
    mp_balance: mpBalance,
    days,
    egresos,
    aportes,
    today,
    fetched_at: new Date().toISOString(),
  })
}

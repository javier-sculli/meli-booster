import { NextResponse } from 'next/server'
import { getAllTodayCollections, getUserInfo } from '@/lib/meli'
import { getValidAccessToken, getTokens } from '@/lib/tokens'

export async function GET() {
  const accessToken = await getValidAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tokenData = await getTokens()
    const [collections, userInfo] = await Promise.all([
      getAllTodayCollections(accessToken),
      getUserInfo(accessToken),
    ])

    // Sort by date_created descending (most recent first)
    collections.sort(
      (a, b) =>
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    )

    // Build cash flow: running total sorted ascending by time
    const sorted = [...collections].sort(
      (a, b) =>
        new Date(a.date_created).getTime() - new Date(b.date_created).getTime()
    )
    let cumulative = 0
    const withCumulative = sorted.map((c) => {
      cumulative += c.net_received_amount
      return { ...c, cumulative_total: cumulative }
    })

    // Map back to descending order preserving cumulative
    const cumulativeMap = new Map(
      withCumulative.map((c) => [c.id, c.cumulative_total])
    )
    const result = collections.map((c) => ({
      ...c,
      cumulative_total: cumulativeMap.get(c.id) ?? 0,
    }))

    const approvedCollections = collections.filter(
      (c) => c.status === 'approved'
    )
    const summary = {
      total_net: approvedCollections.reduce(
        (sum, c) => sum + c.net_received_amount,
        0
      ),
      total_gross: approvedCollections.reduce(
        (sum, c) => sum + c.total_paid_amount,
        0
      ),
      total_fees: approvedCollections.reduce(
        (sum, c) => sum + (c.marketplace_fee ?? 0),
        0
      ),
      count: approvedCollections.length,
      count_all: collections.length,
      avg_ticket:
        approvedCollections.length > 0
          ? approvedCollections.reduce(
              (sum, c) => sum + c.net_received_amount,
              0
            ) / approvedCollections.length
          : 0,
      pending_count: collections.filter((c) => c.status === 'in_process' || c.status === 'pending').length,
      pending_amount: collections
        .filter((c) => c.status === 'in_process' || c.status === 'pending')
        .reduce((sum, c) => sum + c.total_paid_amount, 0),
      currency: collections[0]?.currency_id ?? 'ARS',
    }

    return NextResponse.json({
      payments: result,
      summary,
      user: {
        id: userInfo.id,
        nickname: userInfo.nickname,
        first_name: userInfo.first_name,
      },
      fetched_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Payments fetch error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

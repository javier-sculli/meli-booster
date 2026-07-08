import { NextRequest, NextResponse } from 'next/server'
import { getAllCollections, getTodayAR, getUserInfo, getOrderSkus } from '@/lib/meli'
import { getValidAccessToken, getTokens } from '@/lib/tokens'
import redis from '@/lib/redis'

export async function GET(request: NextRequest) {
  const accessToken = await getValidAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const today = getTodayAR()
  const fromDate = searchParams.get('from') ?? today
  const toDate = searchParams.get('to') ?? today

  try {
    const tokenData = await getTokens()
    const [collections, userInfo] = await Promise.all([
      getAllCollections(accessToken, fromDate, toDate),
      getUserInfo(accessToken),
    ])

    // Fetch order SKUs in parallel and fetch costs from Redis
    const [paymentsWithSkus, rawCosts, itemToSku] = await Promise.all([
      Promise.all(
        collections.map(async (c) => {
          const skus = c.order_id ? await getOrderSkus(accessToken, c.order_id) : []
          return { ...c, skus }
        })
      ),
      redis.hgetall('sku_costs').then(res => res || {}),
      redis.hgetall('item_to_sku').then(res => res || {})
    ])

    const costsMap: Record<string, number> = {}
    for (const [sku, val] of Object.entries(rawCosts)) {
      costsMap[sku] = parseFloat(val) || 0
    }

    const decoratedCollections = paymentsWithSkus.map((c) => {
      let totalCost = 0
      let hasMissingCost = false
      const skusWithCost = c.skus.map((item) => {
        const customSku = itemToSku[item.sku]
        const skuCost = costsMap[item.sku] ?? (customSku ? costsMap[customSku] : 0) ?? 0
        if (skuCost === 0) {
          hasMissingCost = true
        } else {
          totalCost += item.quantity * skuCost
        }
        return { ...item, cost: skuCost }
      })
      const profit = c.net_received_amount - totalCost
      const isMissingCost = hasMissingCost || (c.order_id > 0 && c.skus.length === 0)
      return {
        ...c,
        skus: skusWithCost,
        total_cost: totalCost,
        profit,
        has_missing_cost: isMissingCost,
      }
    })

    // Sort by date_created descending (most recent first)
    decoratedCollections.sort(
      (a, b) =>
        new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
    )

    // Build cash flow: running total sorted ascending by time
    const sorted = [...decoratedCollections].sort(
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
    const result = decoratedCollections.map((c) => ({
      ...c,
      cumulative_total: cumulativeMap.get(c.id) ?? 0,
    }))

    const approvedCollections = result.filter(
      (c) => c.status === 'approved'
    )
    const approvedWithCost = approvedCollections.filter(
      (c) => !c.has_missing_cost
    )
    const totalCost = approvedWithCost.reduce(
      (sum, c) => sum + (c.total_cost ?? 0),
      0
    )
    const totalProfit = approvedWithCost.reduce(
      (sum, c) => sum + (c.profit ?? 0),
      0
    )
    const totalNetWithCost = approvedWithCost.reduce(
      (sum, c) => sum + c.net_received_amount,
      0
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
      total_cost: totalCost,
      total_profit: totalProfit,
      net_with_cost: totalNetWithCost,
      missing_costs_count: approvedCollections.filter((c) => c.has_missing_cost).length,
      count: approvedCollections.length,
      count_all: result.length,
      avg_ticket:
        approvedCollections.length > 0
          ? approvedCollections.reduce(
              (sum, c) => sum + c.net_received_amount,
              0
            ) / approvedCollections.length
          : 0,
      pending_count: result.filter((c) => c.status === 'in_process' || c.status === 'pending').length,
      pending_amount: result
        .filter((c) => c.status === 'in_process' || c.status === 'pending')
        .reduce((sum, c) => sum + c.total_paid_amount, 0),
      currency: result[0]?.currency_id ?? 'ARS',
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
    console.error('Payments fetch error:', err instanceof Error ? err.stack : err)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

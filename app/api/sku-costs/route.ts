import { NextRequest, NextResponse } from 'next/server'
import redis from '@/lib/redis'
import { getValidAccessToken } from '@/lib/tokens'

export async function GET(request: NextRequest) {
  const accessToken = await getValidAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rawCosts = await redis.hgetall('sku_costs') || {}
    const costs: Record<string, number> = {}
    for (const [sku, val] of Object.entries(rawCosts)) {
      costs[sku] = parseFloat(val) || 0
    }
    return NextResponse.json({ costs })
  } catch (err) {
    console.error('Failed to get SKU costs:', err)
    return NextResponse.json({ error: 'Failed to fetch costs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const accessToken = await getValidAccessToken()
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { sku, cost } = body

    if (!sku) {
      return NextResponse.json({ error: 'SKU is required' }, { status: 400 })
    }

    const parsedCost = parseFloat(cost)
    if (isNaN(parsedCost) || parsedCost < 0) {
      return NextResponse.json({ error: 'Cost must be a non-negative number' }, { status: 400 })
    }

    await redis.hset('sku_costs', sku, String(parsedCost))
    return NextResponse.json({ success: true, sku, cost: parsedCost })
  } catch (err) {
    console.error('Failed to save SKU cost:', err)
    return NextResponse.json({ error: 'Failed to save cost' }, { status: 500 })
  }
}

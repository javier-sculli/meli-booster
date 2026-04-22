import { NextRequest, NextResponse } from 'next/server'
import { getValidAccessToken } from '@/lib/tokens'
import { getDisponible, setDisponible } from '@/lib/cashflow'

export async function GET() {
  const token = await getValidAccessToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const amount = await getDisponible()
  return NextResponse.json({ amount })
}

export async function PUT(req: NextRequest) {
  const token = await getValidAccessToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { amount } = await req.json()
  if (amount === undefined) return NextResponse.json({ error: 'amount required' }, { status: 400 })

  await setDisponible(parseFloat(amount))
  return NextResponse.json({ amount: parseFloat(amount) })
}

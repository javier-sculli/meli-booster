import { NextRequest, NextResponse } from 'next/server'
import { getValidAccessToken } from '@/lib/tokens'
import { addAporte, deleteAporte } from '@/lib/cashflow'

export async function POST(req: NextRequest) {
  const token = await getValidAccessToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, amount, description } = await req.json()
  if (!date || !amount) return NextResponse.json({ error: 'date and amount required' }, { status: 400 })

  const entry = await addAporte({ date, amount: parseFloat(amount), description: description ?? '' })
  return NextResponse.json(entry)
}

export async function DELETE(req: NextRequest) {
  const token = await getValidAccessToken()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await deleteAporte(id)
  return NextResponse.json({ ok: true })
}

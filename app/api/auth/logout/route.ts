import { NextRequest, NextResponse } from 'next/server'
import { clearTokens } from '@/lib/tokens'

export async function GET(req: NextRequest) {
  await clearTokens()
  return NextResponse.redirect(new URL('/', req.url))
}

import { NextRequest, NextResponse } from 'next/server'
import { buildImplicitAuthUrl } from '@/lib/meli'

export function GET(req: NextRequest) {
  const host = req.headers.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const redirectUri = `${protocol}://${host}/auth/implicit`
  const url = buildImplicitAuthUrl(redirectUri)
  return NextResponse.redirect(url)
}

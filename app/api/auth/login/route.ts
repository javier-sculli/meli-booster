import { NextResponse } from 'next/server'
import { buildAuthUrl } from '@/lib/meli'

export function GET() {
  const authUrl = buildAuthUrl()
  return NextResponse.redirect(authUrl)
}

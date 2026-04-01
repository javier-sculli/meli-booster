import { NextRequest, NextResponse } from 'next/server'
import { getUserInfo } from '@/lib/meli'
import { saveTokens } from '@/lib/tokens'

export async function POST(req: NextRequest) {
  const { access_token } = await req.json()

  if (!access_token?.trim()) {
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
  }

  try {
    // Validate token by fetching user info
    const user = await getUserInfo(access_token.trim())
    if (!user?.id) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    await saveTokens({
      access_token: access_token.trim(),
      refresh_token: '',        // no refresh token in manual mode
      user_id: user.id,
      expires_in: 6 * 60 * 60, // MeLi tokens last 6 hours
    })

    return NextResponse.json({ ok: true, nickname: user.nickname })
  } catch {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 })
  }
}

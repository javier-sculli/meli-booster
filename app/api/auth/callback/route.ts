import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode } from '@/lib/meli'
import { saveTokens } from '@/lib/tokens'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  // Obtener la URL base correcta (ej. ngrok) para evitar https://localhost:3000
  const baseUrl = process.env.MELI_REDIRECT_URI
    ? new URL(process.env.MELI_REDIRECT_URI).origin
    : 'http://localhost:3000'

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/?error=${error ?? 'missing_code'}`, baseUrl)
    )
  }

  try {
    const tokenData = await exchangeCode(code)
    await saveTokens({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      user_id: tokenData.user_id,
      expires_in: tokenData.expires_in,
    })
    return NextResponse.redirect(new URL('/', baseUrl))
  } catch (err) {
    console.error('OAuth callback error:', err)
    return NextResponse.redirect(new URL('/?error=auth_failed', baseUrl))
  }
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: 'No se pudo completar la autenticación. Intentá de nuevo.',
  missing_code: 'No se recibió el código de autorización.',
  access_denied: 'Acceso denegado por el usuario.',
}

export default function LoginPage({ error }: { error?: string }) {
  const router = useRouter()
  const errorMsg = error ? ERROR_MESSAGES[error] ?? 'Error desconocido.' : null
  const [showTokenInput, setShowTokenInput] = useState(false)
  const [token, setToken] = useState('')
  const [tokenError, setTokenError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleTokenSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTokenError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: token }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTokenError(data.error ?? 'Token inválido')
      } else {
        router.push('/')
        router.refresh()
      }
    } catch {
      setTokenError('Error de red. Verificá la conexión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Logo */}
        <div className="space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-400 text-gray-900 font-black text-2xl shadow-lg shadow-yellow-400/20">
            ML
          </div>
          <h1 className="text-3xl font-bold text-white">MeLi Booster</h1>
          <p className="text-gray-400 text-sm">Cash flow diario de MercadoLibre</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">Conectá tu cuenta</h2>
            <p className="text-sm text-gray-400">
              Autorizá el acceso para ver los pagos recibidos hoy y tu cash flow en tiempo real.
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
              {errorMsg}
            </div>
          )}

          {!showTokenInput ? (
            <>
              <a
                href="/api/auth/login"
                className="block w-full bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold py-3 px-6 rounded-xl transition-colors text-center shadow-lg shadow-yellow-400/20"
              >
                Iniciar sesión con MercadoLibre
              </a>

              <a
                href="/api/auth/implicit-url"
                className="block w-full text-sm text-center bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium py-2.5 px-6 rounded-xl transition-colors border border-gray-700"
              >
                Login alternativo (sin callback)
              </a>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-800" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-gray-900 px-2 text-gray-600">o</span>
                </div>
              </div>

              <button
                onClick={() => setShowTokenInput(true)}
                className="w-full text-sm text-gray-400 hover:text-gray-200 transition-colors py-2 border border-gray-700 rounded-xl hover:border-gray-600"
              >
                Ingresar con Access Token
              </button>
            </>
          ) : (
            <form onSubmit={handleTokenSubmit} className="space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-xs font-medium text-gray-400">
                  Access Token de MercadoLibre
                </label>
                <textarea
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="APP_USR-..."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400 resize-none font-mono"
                />
                <p className="text-xs text-gray-600">
                  Obtené el token en{' '}
                  <span className="text-gray-400">
                    developers.mercadolibre.com.ar → tu app → Get credentials
                  </span>
                </p>
              </div>

              {tokenError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-400">
                  {tokenError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowTokenInput(false); setToken(''); setTokenError('') }}
                  className="flex-1 py-2.5 text-sm text-gray-400 border border-gray-700 rounded-xl hover:border-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!token.trim() || loading}
                  className="flex-1 py-2.5 text-sm font-bold bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 rounded-xl transition-colors"
                >
                  {loading ? 'Verificando...' : 'Conectar'}
                </button>
              </div>
            </form>
          )}

          <p className="text-xs text-gray-500">Solo lectura. No se realizan acciones en tu cuenta.</p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3 text-xs text-gray-500">
          <div className="bg-gray-900/50 rounded-lg p-3 space-y-1">
            <div className="text-gray-300 font-medium">Pagos del día</div>
            <div>Lista completa de cobros</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3 space-y-1">
            <div className="text-gray-300 font-medium">Cash Flow</div>
            <div>Acumulado en tiempo real</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3 space-y-1">
            <div className="text-gray-300 font-medium">Auto-refresh</div>
            <div>Actualización automática</div>
          </div>
        </div>
      </div>
    </div>
  )
}

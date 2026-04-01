'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ManualAuthPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/auth/callback?code=${encodeURIComponent(code.trim())}`)
      if (res.redirected || res.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError('Código inválido o expirado. Los códigos duran ~10 minutos.')
      }
    } catch {
      setError('Error de red.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-white">Código de autorización</h1>
          <p className="text-sm text-gray-400">
            Pegá el código que aparece en la URL después de autorizar la app
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-300 space-y-1 font-mono">
            <p className="text-gray-500">La URL de redirección se ve así:</p>
            <p className="text-yellow-400 break-all">
              https://tu-ngrok.ngrok-free.app/api/auth/callback<span className="text-white">?code=</span><span className="text-green-400">TU_CÓDIGO_ACÁ</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Código</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="TG-XXXXXXXXXXXXXXX"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-yellow-400"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!code.trim() || loading}
              className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-50 text-gray-900 font-bold py-2.5 rounded-xl transition-colors"
            >
              {loading ? 'Verificando...' : 'Conectar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-600">
          <a href="/" className="text-gray-400 hover:text-white">← Volver al inicio</a>
        </p>
      </div>
    </div>
  )
}

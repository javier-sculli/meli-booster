'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ImplicitCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Procesando autorización...')

  useEffect(() => {
    const fragment = window.location.hash.substring(1)
    const params = new URLSearchParams(fragment)
    const accessToken = params.get('access_token')
    const error = params.get('error')

    if (error || !accessToken) {
      setStatus('error')
      setMessage(error ?? 'No se recibió el token.')
      return
    }

    fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setStatus('success')
          setMessage(`Conectado como ${data.nickname}. Redirigiendo...`)
          setTimeout(() => {
            router.push('/')
            router.refresh()
          }, 1000)
        } else {
          setStatus('error')
          setMessage(data.error ?? 'Token inválido.')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Error de red.')
      })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <div className="w-10 h-10 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" />
        )}
        {status === 'success' && <div className="text-4xl">✓</div>}
        {status === 'error' && <div className="text-4xl">✗</div>}
        <p className={`text-sm ${status === 'error' ? 'text-red-400' : 'text-gray-300'}`}>
          {message}
        </p>
        {status === 'error' && (
          <a href="/" className="text-xs text-yellow-400 hover:underline">
            Volver al inicio
          </a>
        )}
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import SummaryCards from './SummaryCards'
import PaymentsTable from './PaymentsTable'
import type { MeliCollection } from '@/lib/meli'

interface PaymentWithCumulative extends MeliCollection {
  cumulative_total: number
}

interface PaymentsData {
  payments: PaymentWithCumulative[]
  summary: {
    total_net: number
    total_gross: number
    total_fees: number
    count: number
    count_all: number
    avg_ticket: number
    pending_count: number
    pending_amount: number
    currency: string
  }
  user: {
    id: number
    nickname: string
    first_name: string
  }
  fetched_at: string
}

const REFRESH_INTERVAL_MS = 30_000

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function fmtDate() {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

export default function Dashboard() {
  const [data, setData] = useState<PaymentsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000)

  const fetchPayments = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    setError(null)

    try {
      const res = await fetch('/api/payments', { cache: 'no-store' })
      if (res.status === 401) {
        window.location.href = '/'
        return
      }
      if (!res.ok) throw new Error('Error al obtener los pagos')
      const json: PaymentsData = await res.json()
      setData(json)
      setCountdown(REFRESH_INTERVAL_MS / 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  // Auto-refresh timer
  useEffect(() => {
    const interval = setInterval(() => fetchPayments(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchPayments])

  // Countdown display
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => (c <= 1 ? REFRESH_INTERVAL_MS / 1000 : c - 1))
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-400 text-gray-900 font-black text-sm flex items-center justify-center">
              ML
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">
                MeLi Booster
              </h1>
              {data?.user && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {data.user.nickname}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {data?.fetched_at && (
              <span className="text-xs text-gray-500 hidden sm:block">
                Actualizado: {fmtTime(data.fetched_at)}
              </span>
            )}

            <button
              onClick={() => fetchPayments(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors text-gray-300"
            >
              <span
                className={`inline-block ${refreshing ? 'animate-spin' : ''}`}
              >
                ↻
              </span>
              {refreshing ? 'Actualizando...' : `Refresh (${countdown}s)`}
            </button>

            <a
              href="/api/auth/logout"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors hidden sm:block"
            >
              Salir
            </a>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Date */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white capitalize">
            {fmtDate()}
          </h2>
          {data && (
            <span className="text-sm text-gray-500">
              {data.summary.count_all} transacciones
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
            <button
              onClick={() => fetchPayments(true)}
              className="ml-auto text-xs underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-24" />
              ))}
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl h-64 animate-pulse" />
          </>
        )}

        {/* Content */}
        {data && (
          <>
            <SummaryCards summary={data.summary} />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-300">
                  Transacciones
                </h3>
                <span className="text-xs text-gray-500">
                  Columna "Acumulado" muestra el cash flow corrido del día
                </span>
              </div>
              <PaymentsTable payments={data.payments} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import SummaryCards from './SummaryCards'
import PaymentsTable from './PaymentsTable'
import ListingsTable from './ListingsTable'
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

interface Item {
  id: string
  title: string
  price: number
  available_quantity: number
  sold_quantity: number
  status: string
  thumbnail: string
  permalink: string
  health: number | null
  condition: string
  listing_type_id: string
  category_name?: string
  group_key?: string
  variant_label?: string
  sale_conditions?: string
  sku?: string
  brand?: string
  units_per_pack?: string
}

interface ItemsData {
  items: Item[]
  total: number
  user: { id: number; nickname: string; first_name: string }
  fetched_at: string
}

type Tab = 'pagos' | 'publicaciones'

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

function fmtDate(dateStr?: string) {
  const d = dateStr ? new Date(dateStr + 'T12:00:00-03:00') : new Date()
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

function getARDate(daysAgo = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

type QuickFilter = 'hoy' | '3d' | '7d' | 'custom'

const QUICK_FILTERS: { key: QuickFilter; label: string; days: number }[] = [
  { key: 'hoy', label: 'Hoy', days: 0 },
  { key: '3d', label: 'Últimos 3 días', days: 2 },
  { key: '7d', label: 'Última semana', days: 6 },
]

export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('pagos')
  const [data, setData] = useState<PaymentsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL_MS / 1000)
  const [itemsData, setItemsData] = useState<ItemsData | null>(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('hoy')
  const [dateFrom, setDateFrom] = useState(getARDate(0))
  const [dateTo, setDateTo] = useState(getARDate(0))

  const fetchPayments = useCallback(async (isManual = false, from?: string, to?: string) => {
    if (isManual) setRefreshing(true)
    setError(null)

    const f = from ?? dateFrom
    const t = to ?? dateTo

    try {
      const res = await fetch(`/api/payments?from=${f}&to=${t}`, { cache: 'no-store' })
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
  }, [dateFrom, dateTo])

  const applyQuickFilter = useCallback((filter: QuickFilter) => {
    setQuickFilter(filter)
    if (filter === 'custom') return
    const days = QUICK_FILTERS.find((f) => f.key === filter)!.days
    const from = getARDate(days)
    const to = getARDate(0)
    setDateFrom(from)
    setDateTo(to)
    fetchPayments(false, from, to)
  }, [fetchPayments])

  const fetchItems = useCallback(async () => {
    setItemsLoading(true)
    setItemsError(null)
    try {
      const res = await fetch('/api/items', { cache: 'no-store' })
      if (!res.ok) throw new Error('Error al obtener las publicaciones')
      setItemsData(await res.json())
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setItemsLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  useEffect(() => {
    if (tab === 'publicaciones' && !itemsData && !itemsLoading) {
      fetchItems()
    }
  }, [tab, itemsData, itemsLoading, fetchItems])

  // Auto-refresh timer (only when viewing today)
  useEffect(() => {
    if (quickFilter !== 'hoy') return
    const interval = setInterval(() => fetchPayments(), REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchPayments, quickFilter])

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

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-800">
          {(['pagos', 'publicaciones'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-yellow-400 text-yellow-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'pagos' ? `Pagos del día` : `Publicaciones${itemsData ? ` (${itemsData.total})` : ''}`}
            </button>
          ))}
        </div>

        {/* PAGOS TAB */}
        {tab === 'pagos' && (
          <>
            {/* Filtros de fecha */}
            <div className="flex flex-wrap items-center gap-2">
              {QUICK_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => applyQuickFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    quickFilter === f.key
                      ? 'bg-yellow-400/10 border-yellow-400/40 text-yellow-400'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <div className="flex items-center gap-1.5 ml-1">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value)
                    setQuickFilter('custom')
                  }}
                  className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-yellow-400/50"
                />
                <span className="text-gray-600 text-xs">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value)
                    setQuickFilter('custom')
                  }}
                  className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-yellow-400/50"
                />
                {quickFilter === 'custom' && (
                  <button
                    onClick={() => fetchPayments(true, dateFrom, dateTo)}
                    disabled={refreshing}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-400/10 border border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/20 transition-colors disabled:opacity-50"
                  >
                    Buscar
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white capitalize">
                {quickFilter === 'hoy'
                  ? fmtDate()
                  : quickFilter === 'custom'
                  ? `${dateFrom} → ${dateTo}`
                  : `${fmtDate(dateFrom)} → ${fmtDate(dateTo)}`}
              </h2>
              {data && <span className="text-sm text-gray-500">{data.summary.count_all} transacciones</span>}
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center gap-2">
                <span>⚠</span>
                <span>{error}</span>
                <button onClick={() => fetchPayments(true)} className="ml-auto text-xs underline hover:no-underline">Reintentar</button>
              </div>
            )}

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

            {data && (
              <>
                <SummaryCards summary={data.summary} />
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-300">Transacciones</h3>
                    <span className="text-xs text-gray-500">Columna "Acumulado" muestra el cash flow corrido del día</span>
                  </div>
                  <PaymentsTable payments={data.payments} />
                </div>
              </>
            )}
          </>
        )}

        {/* PUBLICACIONES TAB */}
        {tab === 'publicaciones' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Publicaciones</h2>
              <button
                onClick={fetchItems}
                disabled={itemsLoading}
                className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors text-gray-300"
              >
                <span className={itemsLoading ? 'animate-spin inline-block' : ''}>↻</span>
                {itemsLoading ? 'Cargando...' : 'Actualizar'}
              </button>
            </div>

            {itemsError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center gap-2">
                <span>⚠</span>
                <span>{itemsError}</span>
                <button onClick={fetchItems} className="ml-auto text-xs underline hover:no-underline">Reintentar</button>
              </div>
            )}

            {itemsLoading && !itemsData && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl h-64 animate-pulse" />
            )}

            {itemsData && <ListingsTable items={itemsData.items} />}
          </>
        )}
      </main>
    </div>
  )
}

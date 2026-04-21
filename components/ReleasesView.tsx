'use client'

import { useState } from 'react'

interface ReleasePayment {
  id: number
  date_approved: string | null
  money_release_date: string | null
  net: number
  gross: number
  description: string
  payment_method_id: string
  installments: number
  payer_name: string
}

interface Release {
  date: string
  net: number
  gross: number
  count: number
  payments: ReleasePayment[]
}

interface Summary {
  total_net: number
  total_gross: number
  total_payments: number
  currency: string
}

interface ReleasesData {
  releases: Release[]
  summary: Summary
  fetched_at: string
}

function fmtARS(amount: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00-03:00')
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d)
}

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function isToday(dateStr: string) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date())
  return dateStr === today
}

function isTomorrow(dateStr: string) {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const tomorrow = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(d)
  return dateStr === tomorrow
}

function ReleaseDateRow({ release }: { release: Release }) {
  const [open, setOpen] = useState(false)
  const fee = release.gross - release.net
  const today = isToday(release.date)
  const tomorrow = isTomorrow(release.date)
  const label = today ? 'Hoy' : tomorrow ? 'Mañana' : fmtDate(release.date)

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${
      today ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-gray-800 bg-gray-900'
    }`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium capitalize ${today ? 'text-yellow-400' : 'text-gray-200'}`}>
                {label}
              </span>
              {(today || tomorrow) && (
                <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${
                  today
                    ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400'
                    : 'bg-blue-400/10 border-blue-400/30 text-blue-400'
                }`}>
                  {today ? 'hoy' : 'mañana'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{release.count} pagos · comisión {fmtARS(fee)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500">neto</p>
            <p className={`font-mono font-semibold text-sm ${today ? 'text-yellow-400' : 'text-green-400'}`}>
              {fmtARS(release.net)}
            </p>
          </div>
          <span className="text-gray-600 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-800 divide-y divide-gray-800/60">
          {release.payments.map((p) => (
            <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-gray-300 truncate">{p.description || `Pago #${p.id}`}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-600">{p.payer_name}</span>
                  {p.installments > 1 && (
                    <span className="text-xs text-purple-400/70">{p.installments} cuotas</span>
                  )}
                  {p.date_approved && (
                    <span className="text-xs text-gray-700">aprobado {fmtDateTime(p.date_approved)}</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-mono text-gray-300">{fmtARS(p.net)}</p>
                <p className="text-xs text-gray-600">{fmtARS(p.gross)} bruto</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ReleasesView({ data }: { data: ReleasesData }) {
  const { releases, summary } = data

  // Split upcoming week vs later
  const upcoming = releases.filter((r) => {
    const d = new Date(r.date + 'T12:00:00-03:00')
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + 7)
    return d <= cutoff
  })
  const later = releases.filter((r) => {
    const d = new Date(r.date + 'T12:00:00-03:00')
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() + 7)
    return d > cutoff
  })

  const upcomingNet = upcoming.reduce((s, r) => s + r.net, 0)
  const laterNet = later.reduce((s, r) => s + r.net, 0)

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total a acreditar</p>
          <p className="text-xl font-bold text-white font-mono mt-1">{fmtARS(summary.total_net)}</p>
          <p className="text-xs text-gray-600 mt-0.5">{summary.total_payments} pagos</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Esta semana</p>
          <p className="text-xl font-bold text-yellow-400 font-mono mt-1">{fmtARS(upcomingNet)}</p>
          <p className="text-xs text-gray-600 mt-0.5">{upcoming.reduce((s, r) => s + r.count, 0)} pagos</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Más adelante</p>
          <p className="text-xl font-bold text-gray-300 font-mono mt-1">{fmtARS(laterNet)}</p>
          <p className="text-xs text-gray-600 mt-0.5">{later.reduce((s, r) => s + r.count, 0)} pagos</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Comisiones totales</p>
          <p className="text-xl font-bold text-red-400/80 font-mono mt-1">{fmtARS(summary.total_gross - summary.total_net)}</p>
          <p className="text-xs text-gray-600 mt-0.5">{((1 - summary.total_net / summary.total_gross) * 100).toFixed(1)}% del bruto</p>
        </div>
      </div>

      {/* Upcoming releases */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1">Próximos 7 días</h3>
          {upcoming.map((r) => <ReleaseDateRow key={r.date} release={r} />)}
        </div>
      )}

      {/* Later releases */}
      {later.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-1">Más adelante</h3>
          {later.map((r) => <ReleaseDateRow key={r.date} release={r} />)}
        </div>
      )}

      {releases.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <p className="text-gray-400">Sin acreditaciones pendientes</p>
        </div>
      )}
    </div>
  )
}

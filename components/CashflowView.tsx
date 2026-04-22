'use client'

import { useState, useCallback } from 'react'
import type { CashflowEntry } from '@/lib/cashflow'

interface DayRow {
  date: string
  ingresos_meli: number
  egresos: number
  aportes: number
  caja: number
}

interface CashflowData {
  disponible: number
  mp_balance: number | null
  days: DayRow[]
  egresos: CashflowEntry[]
  aportes: CashflowEntry[]
  today: string
  fetched_at: string
}

interface Props {
  data: CashflowData
  onRefresh: () => void
  loading: boolean
}

type SubTab = 'flujo' | 'egresos' | 'aportes'

const ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

function fmt(n: number) {
  return ARS.format(n)
}

function fmtDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(y, m - 1, d)
  )
}

function EntryForm({ onAdd }: { onAdd: (entry: { date: string; amount: string; description: string }) => void }) {
  const [date, setDate] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!date || !amount) return
    onAdd({ date, amount, description })
    setDate('')
    setAmount('')
    setDescription('')
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Fecha</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-yellow-400/50"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Importe</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          required
          min="0"
          step="0.01"
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 w-36 focus:outline-none focus:border-yellow-400/50"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-500">Descripción</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej: Proveedor X"
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg px-3 py-2 w-52 focus:outline-none focus:border-yellow-400/50"
        />
      </div>
      <button
        type="submit"
        className="px-4 py-2 bg-yellow-400 text-gray-900 text-sm font-semibold rounded-lg hover:bg-yellow-300 transition-colors"
      >
        Agregar
      </button>
    </form>
  )
}

function EntryList({
  entries,
  onDelete,
  emptyText,
  color,
}: {
  entries: CashflowEntry[]
  onDelete: (id: string) => void
  emptyText: string
  color: 'red' | 'emerald'
}) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length === 0) {
    return <p className="text-sm text-gray-600 py-4">{emptyText}</p>
  }

  const colorClass = color === 'red' ? 'text-red-400' : 'text-emerald-400'

  return (
    <div className="space-y-1">
      {sorted.map((e) => (
        <div
          key={e.id}
          className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5"
        >
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 w-28 shrink-0">{fmtDate(e.date)}</span>
            <span className={`text-sm font-medium ${colorClass}`}>{fmt(e.amount)}</span>
            {e.description && <span className="text-sm text-gray-400">{e.description}</span>}
          </div>
          <button
            onClick={() => onDelete(e.id)}
            className="text-gray-600 hover:text-red-400 transition-colors text-xs px-2 py-1"
          >
            Eliminar
          </button>
        </div>
      ))}
    </div>
  )
}

export default function CashflowView({ data, onRefresh, loading }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('flujo')
  const [savingDisponible, setSavingDisponible] = useState(false)
  const [disponibleInput, setDisponibleInput] = useState('')
  const [editingDisponible, setEditingDisponible] = useState(false)

  const saveDisponible = useCallback(async () => {
    setSavingDisponible(true)
    await fetch('/api/cashflow/disponible', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(disponibleInput) }),
    })
    setSavingDisponible(false)
    setEditingDisponible(false)
    onRefresh()
  }, [disponibleInput, onRefresh])

  const addEgreso = useCallback(
    async (entry: { date: string; amount: string; description: string }) => {
      await fetch('/api/cashflow/egreso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      onRefresh()
    },
    [onRefresh]
  )

  const deleteEgreso = useCallback(
    async (id: string) => {
      await fetch(`/api/cashflow/egreso?id=${id}`, { method: 'DELETE' })
      onRefresh()
    },
    [onRefresh]
  )

  const addAporte = useCallback(
    async (entry: { date: string; amount: string; description: string }) => {
      await fetch('/api/cashflow/aporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      })
      onRefresh()
    },
    [onRefresh]
  )

  const deleteAporte = useCallback(
    async (id: string) => {
      await fetch(`/api/cashflow/aporte?id=${id}`, { method: 'DELETE' })
      onRefresh()
    },
    [onRefresh]
  )

  const SUB_TABS: { key: SubTab; label: string }[] = [
    { key: 'flujo', label: 'Flujo proyectado' },
    { key: 'egresos', label: `Egresos (${data.egresos.length})` },
    { key: 'aportes', label: `Aportes (${data.aportes.length})` },
  ]

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">
            Disponible actual
            {data.mp_balance !== null && (
              <span className="ml-1 text-emerald-500/70 text-[10px]">MP</span>
            )}
          </p>
          {editingDisponible ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                value={disponibleInput}
                onChange={(e) => setDisponibleInput(e.target.value)}
                className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1 w-28 focus:outline-none"
                autoFocus
              />
              <button
                onClick={saveDisponible}
                disabled={savingDisponible}
                className="text-xs text-yellow-400 hover:text-yellow-300"
              >
                {savingDisponible ? '...' : 'Ok'}
              </button>
              <button onClick={() => setEditingDisponible(false)} className="text-xs text-gray-500">
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setDisponibleInput(String(data.disponible))
                setEditingDisponible(true)
              }}
              className="text-left group"
            >
              <p className="text-xl font-bold text-white group-hover:text-yellow-400 transition-colors">
                {fmt(data.disponible)}
              </p>
              {data.mp_balance === null && (
                <p className="text-[10px] text-gray-600 mt-0.5">click para editar</p>
              )}
            </button>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Caja en 7 días</p>
          <p className="text-xl font-bold text-white">{fmt(data.days[6]?.caja ?? 0)}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Caja en 30 días</p>
          <p className="text-xl font-bold text-white">{fmt(data.days[29]?.caja ?? 0)}</p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Egresos próx. 30d</p>
          <p className="text-xl font-bold text-red-400">
            {fmt(data.egresos.reduce((s, e) => s + e.amount, 0))}
          </p>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              subTab === t.key
                ? 'border-yellow-400 text-yellow-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* FLUJO */}
      {subTab === 'flujo' && (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500">Fecha</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-emerald-500">Ingresos MELI</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-blue-400">Aportes</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-red-400">Egresos</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-400">Caja</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((row, i) => {
                const isToday = row.date === data.today
                const isPast = row.date < data.today
                const hasActivity = row.ingresos_meli !== 0 || row.egresos !== 0 || row.aportes !== 0

                return (
                  <tr
                    key={row.date}
                    className={`border-b border-gray-800/50 transition-colors ${
                      isToday
                        ? 'bg-yellow-400/5 border-yellow-400/20'
                        : isPast
                        ? 'opacity-60'
                        : hasActivity
                        ? 'bg-gray-900/30'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-2.5 text-gray-300">
                      <div className="flex items-center gap-2">
                        {isToday && (
                          <span className="text-[10px] bg-yellow-400/20 text-yellow-400 px-1.5 py-0.5 rounded font-medium">
                            HOY
                          </span>
                        )}
                        <span className={isToday ? 'text-yellow-400 font-medium' : ''}>
                          {fmtDate(row.date)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.ingresos_meli > 0 ? (
                        <span className="text-emerald-400 font-medium">{fmt(row.ingresos_meli)}</span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.aportes > 0 ? (
                        <span className="text-blue-400 font-medium">{fmt(row.aportes)}</span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.egresos > 0 ? (
                        <span className="text-red-400 font-medium">−{fmt(row.egresos)}</span>
                      ) : (
                        <span className="text-gray-700">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-white">
                      {fmt(row.caja)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* EGRESOS */}
      {subTab === 'egresos' && (
        <div className="space-y-4">
          <EntryForm onAdd={addEgreso} />
          <EntryList
            entries={data.egresos}
            onDelete={deleteEgreso}
            emptyText="No hay egresos cargados"
            color="red"
          />
        </div>
      )}

      {/* APORTES */}
      {subTab === 'aportes' && (
        <div className="space-y-4">
          <EntryForm onAdd={addAporte} />
          <EntryList
            entries={data.aportes}
            onDelete={deleteAporte}
            emptyText="No hay aportes cargados"
            color="emerald"
          />
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'

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
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/10 text-green-400 border-green-500/20',
  paused: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  closed: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  under_review: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  inactive: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activa',
  paused: 'Pausada',
  closed: 'Finalizada',
  under_review: 'En revisión',
  inactive: 'Inactiva',
}

const LISTING_LABELS: Record<string, string> = {
  gold_special: 'Clásica',
  gold_pro: 'Premium',
  gold: 'Oro',
  silver: 'Plata',
  bronze: 'Bronce',
  free: 'Gratis',
}

function fmtPrice(amount: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function HealthBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-600">—</span>
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-gray-700 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400">{pct}%</span>
    </div>
  )
}

const STATUS_OPTIONS = ['todos', 'active', 'paused', 'closed', 'under_review', 'inactive']

export default function ListingsTable({ items }: { items: Item[] }) {
  const [filter, setFilter] = useState('todos')

  const filtered = filter === 'todos' ? items : items.filter((i) => i.status === filter)

  if (items.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <p className="text-4xl mb-3">📦</p>
        <p className="text-gray-400 font-medium">Sin publicaciones</p>
      </div>
    )
  }

  const counts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = s === 'todos' ? items.length : items.filter((i) => i.status === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.filter((s) => s === 'todos' || counts[s] > 0).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              filter === s
                ? 'bg-yellow-400/10 border-yellow-400/40 text-yellow-400'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            {s === 'todos' ? 'Todos' : STATUS_LABELS[s] ?? s}
            <span className="ml-1.5 text-gray-500">{counts[s]}</span>
          </button>
        ))}
      </div>

    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Publicación
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Precio
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                Stock
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                Vendidos
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                Salud
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                Tipo
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={item.thumbnail?.replace('http://', 'https://')}
                      alt={item.title}
                      className="w-10 h-10 rounded object-cover bg-gray-800 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <a
                        href={item.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-200 hover:text-yellow-400 transition-colors line-clamp-2 leading-tight"
                      >
                        {item.title}
                      </a>
                      <p className="text-xs text-gray-600 mt-0.5 font-mono">{item.id}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-gray-200">
                  {fmtPrice(item.price)}
                </td>
                <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">
                  {item.available_quantity}
                </td>
                <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">
                  {item.sold_quantity}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <HealthBar value={item.health} />
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                  {LISTING_LABELS[item.listing_type_id] ?? item.listing_type_id}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${STATUS_STYLES[item.status] ?? STATUS_STYLES.inactive}`}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  )
}

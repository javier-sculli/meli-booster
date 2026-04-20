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
  category_name?: string
  group_key?: string
  variant_label?: string
  sale_conditions?: string
  sku?: string
  brand?: string
  units_per_pack?: string
}

interface Group {
  key: string
  items: Item[]
  thumbnail: string
  title: string
  permalink: string
  minPrice: number
  maxPrice: number
  totalStock: number
  totalSold: number
  brand?: string
  sku?: string
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

function SaleConditionsBadges({ conditions }: { conditions: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {conditions.split(' · ').map((c) => (
        <span
          key={c}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border ${
            c === 'Envío gratis'
              ? 'bg-green-500/10 text-green-400 border-green-500/20'
              : c === 'Retiro en local'
              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
              : 'bg-gray-700/50 text-gray-400 border-gray-600/30'
          }`}
        >
          {c}
        </span>
      ))}
    </div>
  )
}

const STATUS_OPTIONS = ['todos', 'active', 'paused', 'closed', 'under_review', 'inactive']

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

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
  return dp[m][n]
}

function fuzzyMergeKeys(keys: string[]): Map<string, string> {
  // Maps each key to its canonical (representative) key
  const canonical = new Map<string, string>()
  for (const key of keys) {
    let found = false
    for (const existing of canonical.values()) {
      const threshold = Math.max(2, Math.floor(existing.length * 0.08))
      if (levenshtein(key, existing) <= threshold) {
        canonical.set(key, existing)
        found = true
        break
      }
    }
    if (!found) canonical.set(key, key)
  }
  return canonical
}

function groupItems(items: Item[]): Group[] {
  const map = new Map<string, Item[]>()
  for (const item of items) {
    const key = item.group_key ?? `id:${item.id}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  const merged = map

  return Array.from(merged.entries()).map(([key, its]) => ({
    key,
    items: its,
    thumbnail: its[0].thumbnail,
    title: its[0].title,
    permalink: its[0].permalink,
    minPrice: Math.min(...its.map((i) => i.price)),
    maxPrice: Math.max(...its.map((i) => i.price)),
    totalStock: its.reduce((s, i) => s + i.available_quantity, 0),
    totalSold: its.reduce((s, i) => s + i.sold_quantity, 0),
    brand: its.find((i) => i.brand)?.brand,
    sku: its.find((i) => i.sku)?.sku,
  }))
}

function GroupRow({ group }: { group: Group }) {
  const [open, setOpen] = useState(false)
  const isVariant = group.items.length > 1
  const priceLabel =
    group.minPrice === group.maxPrice
      ? fmtPrice(group.minPrice)
      : `${fmtPrice(group.minPrice)} – ${fmtPrice(group.maxPrice)}`

  const statuses = [...new Set(group.items.map((i) => i.status))]
  const hasActive = statuses.includes('active')

  return (
    <>
      <tr
        className={`hover:bg-gray-800/50 transition-colors ${isVariant ? 'cursor-pointer' : ''}`}
        onClick={() => isVariant && setOpen((o) => !o)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <img
              src={group.thumbnail?.replace('http://', 'https://')}
              alt={group.title}
              className="w-10 h-10 rounded object-cover bg-gray-800 flex-shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <div>
                  <a
                    href={group.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-gray-200 hover:text-yellow-400 transition-colors line-clamp-2 leading-tight text-sm"
                  >
                    {group.title}
                  </a>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {group.brand && (
                      <span className="text-xs text-gray-500">{group.brand}</span>
                    )}
                    {group.sku && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        SKU {group.sku}
                      </span>
                    )}
                    {!isVariant && group.items[0]?.sale_conditions && (
                      <span className="text-xs text-gray-500">{group.items[0].sale_conditions}</span>
                    )}
                  </div>
                </div>
                {isVariant && (
                  <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium">
                    {group.items.length} variantes
                    <span className="text-[10px]">{open ? '▲' : '▼'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-right font-mono font-semibold text-gray-200 text-sm">
          {priceLabel}
        </td>
        <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">
          {group.totalStock}
        </td>
        <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">
          {group.totalSold}
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          {!isVariant && group.items[0]?.sale_conditions ? (
            <SaleConditionsBadges conditions={group.items[0].sale_conditions} />
          ) : isVariant ? (
            <span className="text-xs text-gray-600">—</span>
          ) : null}
        </td>
        <td className="px-4 py-3 text-center">
          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${STATUS_STYLES[hasActive ? 'active' : statuses[0]] ?? STATUS_STYLES.inactive}`}>
            {statuses.length > 1 ? 'Mixto' : STATUS_LABELS[statuses[0]] ?? statuses[0]}
          </span>
        </td>
      </tr>

      {/* Variantes expandidas */}
      {open && group.items.map((item) => (
        <tr key={item.id} className="bg-gray-800/30 border-l-2 border-blue-500/30">
          <td className="pl-4 pr-4 py-2">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={item.thumbnail?.replace('http://', 'https://')}
                alt={item.title}
                className="w-8 h-8 rounded object-cover bg-gray-800 flex-shrink-0 ml-8"
              />
              <div className="min-w-0">
                <a
                  href={item.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm text-gray-300 hover:text-yellow-400 transition-colors line-clamp-1"
                >
                  {item.title}
                </a>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.units_per_pack && (
                    <span className="text-xs text-gray-600">Pack {item.units_per_pack}u</span>
                  )}
                  {item.sku && (
                    <span className="text-xs text-gray-700 font-mono">SKU {item.sku}</span>
                  )}
                </div>
              </div>
            </div>
          </td>
          <td className="px-4 py-2 text-right font-mono text-sm text-gray-300">
            {fmtPrice(item.price)}
          </td>
          <td className="px-4 py-2 text-right text-gray-400 text-sm hidden sm:table-cell">
            {item.available_quantity}
          </td>
          <td className="px-4 py-2 text-right text-gray-400 text-sm hidden sm:table-cell">
            {item.sold_quantity}
          </td>
          <td className="px-4 py-2 hidden md:table-cell">
            {item.sale_conditions && <SaleConditionsBadges conditions={item.sale_conditions} />}
          </td>
          <td className="px-4 py-2 text-center">
            <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${STATUS_STYLES[item.status] ?? STATUS_STYLES.inactive}`}>
              {STATUS_LABELS[item.status] ?? item.status}
            </span>
          </td>
        </tr>
      ))}
    </>
  )
}

export default function ListingsTable({ items }: { items: Item[] }) {
  const [statusFilter, setStatusFilter] = useState('todos')
  const [categoryFilter, setCategoryFilter] = useState('todas')
  const [hideNoStock, setHideNoStock] = useState(true)

  if (items.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <p className="text-gray-400 font-medium">Sin publicaciones</p>
      </div>
    )
  }

  // Stock per category to filter empty ones
  const stockByCategory = items.reduce((acc, i) => {
    const cat = i.category_name ?? ''
    acc[cat] = (acc[cat] ?? 0) + i.available_quantity
    return acc
  }, {} as Record<string, number>)

  const categoriesWithStock = new Set(
    Object.entries(stockByCategory).filter(([, stock]) => stock > 0).map(([cat]) => cat)
  )

  const allCategories = Array.from(new Set(items.map((i) => i.category_name ?? '').filter(Boolean))).sort()
  const visibleCategories = hideNoStock ? allCategories.filter((c) => categoriesWithStock.has(c)) : allCategories
  const categories = ['todas', ...visibleCategories]

  const filtered = items
    .filter((i) => statusFilter === 'todos' || i.status === statusFilter)
    .filter((i) => categoryFilter === 'todas' || i.category_name === categoryFilter)
    .filter((i) => !hideNoStock || categoriesWithStock.has(i.category_name ?? ''))

  const groups = groupItems(filtered)

  const statusCounts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = s === 'todos' ? items.length : items.filter((i) => i.status === s).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-3">
      {/* Filtro estado */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.filter((s) => s === 'todos' || statusCounts[s] > 0).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              statusFilter === s
                ? 'bg-yellow-400/10 border-yellow-400/40 text-yellow-400'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            {s === 'todos' ? 'Todos los estados' : STATUS_LABELS[s] ?? s}
            <span className="ml-1.5 text-gray-500">{statusCounts[s]}</span>
          </button>
        ))}
      </div>

      {/* Filtro categoría */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 shrink-0">Categoría:</span>
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value)
          }}
          className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-400/50"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === 'todas' ? 'Todas las categorías' : c}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setHideNoStock((v) => !v)
            if (hideNoStock) setCategoryFilter('todas')
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            hideNoStock
              ? 'bg-yellow-400/10 border-yellow-400/40 text-yellow-400'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
          }`}
        >
          Solo con stock
        </button>
        <span className="text-xs text-gray-500">
          {groups.length} grupos · {filtered.length} publicaciones
          {(() => {
            const ungrouped = groups.filter((g) => g.items.length === 1).length
            return ungrouped > 0 ? (
              <span className="ml-1 text-orange-400/70">· {ungrouped} sin agrupar</span>
            ) : null
          })()}
        </span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Publicación</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Precio</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Stock</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Vendidos</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Envío</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {groups.map((group) => (
                <GroupRow key={group.key} group={group} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

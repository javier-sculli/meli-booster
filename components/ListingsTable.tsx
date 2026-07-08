'use client'

import { useState, useEffect } from 'react'

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
  cost?: number
  brand?: string
  units_per_pack?: string
  financing?: string
  visits?: number
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
  cost?: number
  totalVisits: number
  avgHealth: number | null
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

function groupItems(items: Item[]): Group[] {
  const map = new Map<string, Item[]>()
  for (const item of items) {
    const key = item.group_key ?? `id:${item.id}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  const merged = map

  return Array.from(merged.entries()).map(([key, its]) => {
    const healths = its.map((i) => i.health).filter((h) => h !== null && h !== undefined) as number[]
    return {
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
      cost: its.find((i) => i.cost !== undefined)?.cost,
      totalVisits: its.reduce((s, i) => s + (i.visits ?? 0), 0),
      avgHealth: healths.length > 0 ? healths.reduce((s, h) => s + h, 0) / healths.length : null,
    }
  })
}

function ConversionCell({ sold, visits }: { sold: number; visits: number }) {
  if (sold > 0 && visits === 0) {
    return (
      <span className="font-mono text-sm text-green-400 font-semibold cursor-help" title="Ventas sin visitas registradas (ej. ventas por Catálogo o compras en lote)">
        &gt;100%
      </span>
    )
  }

  const rate = visits > 0 ? (sold / visits) * 100 : 0
  if (rate === 0) {
    return <span className="font-mono text-sm text-gray-500">0.0%</span>
  }

  let colorClass = 'text-gray-400'
  if (rate >= 3) {
    colorClass = 'text-green-400 font-semibold'
  } else if (rate >= 1) {
    colorClass = 'text-gray-200'
  } else if (rate > 0 && visits > 100) {
    colorClass = 'text-yellow-500/80 font-medium'
  }

  if (rate > 100) {
    return (
      <span className={`font-mono text-sm ${colorClass} cursor-help`} title="La conversión supera el 100% debido a compras en lote (múltiples unidades por visita) o ventas de Catálogo (Buy Box)">
        &gt;100%
      </span>
    )
  }

  return (
    <span className={`font-mono text-sm ${colorClass}`}>
      {rate.toFixed(1)}%
    </span>
  )
}

function QualityCell({ health }: { health: number | null }) {
  if (health === null || health === undefined) return <span className="text-gray-600 font-mono">—</span>
  const pct = Math.round(health * 100)
  
  let badgeStyle = 'bg-red-500/10 text-red-400 border-red-500/20'
  if (pct >= 80) {
    badgeStyle = 'bg-green-500/10 text-green-400 border-green-500/20'
  } else if (pct >= 50) {
    badgeStyle = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
  }

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-xs font-mono font-medium ${badgeStyle}`}>
      {pct}%
    </span>
  )
}

function SkuCostInput({
  sku,
  initialCost,
  onCostUpdated,
}: {
  sku: string
  initialCost: number
  onCostUpdated?: () => void
}) {
  const [cost, setCost] = useState<string>(initialCost ? String(initialCost) : '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSave = async () => {
    const parsed = parseFloat(cost)
    if (isNaN(parsed) || parsed < 0) {
      if (cost === '') {
        setSaving(true)
        try {
          const res = await fetch('/api/sku-costs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sku, cost: 0 }),
          })
          if (res.ok) {
            setSuccess(true)
            setTimeout(() => setSuccess(false), 2000)
            onCostUpdated?.()
          }
        } catch (e) {
          console.error(e)
        } finally {
          setSaving(false)
        }
      }
      return
    }

    if (parsed === initialCost) return

    setSaving(true)
    try {
      const res = await fetch('/api/sku-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, cost: parsed }),
      })
      if (res.ok) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 2000)
        onCostUpdated?.()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
      <span className="text-gray-500 text-xs font-mono">$</span>
      <input
        type="number"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        disabled={saving}
        placeholder="0"
        className="w-20 bg-gray-800 border border-gray-700 text-right text-gray-200 font-mono text-xs rounded px-1.5 py-1 focus:outline-none focus:border-yellow-400/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      {saving && <span className="text-[10px] text-gray-500 animate-spin">↻</span>}
      {success && <span className="text-[10px] text-green-400">✓</span>}
    </div>
  )
}

function GroupRow({ group, onCostUpdated }: { group: Group; onCostUpdated?: () => void }) {
  const [open, setOpen] = useState(false)
  const isVariant = group.items.length > 1
  const priceLabel =
    group.minPrice === group.maxPrice
      ? fmtPrice(group.minPrice)
      : `${fmtPrice(group.minPrice)} – ${fmtPrice(group.maxPrice)}`

  const costs = group.items.map((i) => i.cost).filter((c) => c !== undefined && c !== null) as number[]
  const costLabel =
    costs.length === 0
      ? '—'
      : Math.min(...costs) === Math.max(...costs)
      ? fmtPrice(Math.min(...costs))
      : `${fmtPrice(Math.min(...costs))} – ${fmtPrice(Math.max(...costs))}`

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
                <div className="min-w-0">
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
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 truncate max-w-[150px]">
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
        <td className="px-4 py-3 text-right text-sm">
          {!isVariant && group.sku ? (
            <SkuCostInput sku={group.sku} initialCost={group.cost ?? 0} onCostUpdated={onCostUpdated} />
          ) : (
            <span className="font-mono text-gray-400 text-sm">{costLabel}</span>
          )}
        </td>
        <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">
          {group.totalStock}
        </td>
        <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">
          {group.totalSold}
        </td>
        <td className="px-4 py-3 text-right text-gray-300 hidden md:table-cell font-mono">
          {group.totalVisits.toLocaleString('es-AR')}
        </td>
        <td className="px-4 py-3 text-right hidden md:table-cell">
          <ConversionCell sold={group.totalSold} visits={group.totalVisits} />
        </td>
        <td className="px-4 py-3 text-center hidden lg:table-cell">
          <QualityCell health={group.avgHealth} />
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          <div className="flex flex-col gap-1">
            {!isVariant && group.items[0]?.sale_conditions && (
              <SaleConditionsBadges conditions={group.items[0].sale_conditions} />
            )}
            {(() => {
              const financings = [...new Set(group.items.map((i) => i.financing).filter(Boolean))]
              if (financings.length === 0) return null
              const label = financings.length === 1 ? financings[0]! : 'Mixto'
              const isMixed = financings.length > 1
              return (
                <span className={`inline-flex items-center self-start px-1.5 py-0.5 rounded text-xs font-mono font-medium border ${
                  isMixed
                    ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                }`}>
                  {label}
                </span>
              )
            })()}
          </div>
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
          <td className="px-4 py-2 text-right text-sm">
            {item.sku ? (
              <SkuCostInput sku={item.sku} initialCost={item.cost ?? 0} onCostUpdated={onCostUpdated} />
            ) : (
              <span className="text-gray-600 font-mono">—</span>
            )}
          </td>
          <td className="px-4 py-2 text-right text-gray-400 text-sm hidden sm:table-cell">
            {item.available_quantity}
          </td>
          <td className="px-4 py-2 text-right text-gray-400 text-sm hidden sm:table-cell">
            {item.sold_quantity}
          </td>
          <td className="px-4 py-2 text-right text-gray-400 text-sm hidden md:table-cell font-mono">
            {(item.visits ?? 0).toLocaleString('es-AR')}
          </td>
          <td className="px-4 py-2 text-right hidden md:table-cell">
            <ConversionCell sold={item.sold_quantity} visits={item.visits ?? 0} />
          </td>
          <td className="px-4 py-2 text-center hidden lg:table-cell">
            <QualityCell health={item.health} />
          </td>
          <td className="px-4 py-2 hidden md:table-cell">
            <div className="flex flex-col gap-1">
              {item.sale_conditions && <SaleConditionsBadges conditions={item.sale_conditions} />}
              {item.financing && (
                <span className="inline-flex items-center self-start px-1.5 py-0.5 rounded text-xs font-mono font-medium border bg-purple-500/10 text-purple-400 border-purple-500/20">
                  {item.financing}
                </span>
              )}
            </div>
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

type SortField = 'title' | 'price' | 'cost' | 'stock' | 'sold' | 'visits' | 'conversion' | 'quality' | 'status'
type SortOrder = 'desc' | 'asc'

export default function ListingsTable({
  items,
  onCostUpdated,
  initialSearch,
}: {
  items: Item[]
  onCostUpdated?: () => void
  initialSearch?: string
}) {
  const [statusFilter, setStatusFilter] = useState('todos')
  const [categoryFilter, setCategoryFilter] = useState('todas')
  const [hideNoStock, setHideNoStock] = useState(true)
  const [searchTerm, setSearchTerm] = useState(initialSearch || '')

  const [sortField, setSortField] = useState<SortField>('sold')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  useEffect(() => {
    if (initialSearch !== undefined) {
      setSearchTerm(initialSearch)
    }
  }, [initialSearch])

  if (items.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <p className="text-gray-400 font-medium">Sin publicaciones</p>
      </div>
    )
  }

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
    .filter((i) => {
      if (!searchTerm) return true
      const query = searchTerm.toLowerCase().trim()
      const titleMatch = i.title?.toLowerCase().includes(query)
      const skuMatch = i.sku?.toLowerCase().includes(query)
      const idMatch = i.id?.toLowerCase().includes(query)
      return titleMatch || skuMatch || idMatch
    })

  const groups = groupItems(filtered)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder(field === 'title' ? 'asc' : 'desc')
    }
  }

  const sortedGroups = [...groups].sort((a, b) => {
    let valA: any = 0
    let valB: any = 0

    switch (sortField) {
      case 'title':
        valA = a.title?.toLowerCase() ?? ''
        valB = b.title?.toLowerCase() ?? ''
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
      case 'price':
        valA = a.minPrice
        valB = b.minPrice
        break
      case 'cost':
        valA = a.cost ?? 0
        valB = b.cost ?? 0
        break
      case 'stock':
        valA = a.totalStock
        valB = b.totalStock
        break
      case 'sold':
        valA = a.totalSold
        valB = b.totalSold
        break
      case 'visits':
        valA = a.totalVisits
        valB = b.totalVisits
        break
      case 'conversion':
        valA = a.totalVisits > 0 ? a.totalSold / a.totalVisits : 0
        valB = b.totalVisits > 0 ? b.totalSold / b.totalVisits : 0
        break
      case 'quality':
        valA = a.avgHealth ?? 0
        valB = b.avgHealth ?? 0
        break
      case 'status':
        valA = a.items[0]?.status ?? ''
        valB = b.items[0]?.status ?? ''
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1
    return 0
  })

  const statusCounts = STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = s === 'todos' ? items.length : items.filter((i) => i.status === s).length
    return acc
  }, {} as Record<string, number>)

  const renderHeader = (field: SortField, label: string, alignClass = 'text-right', hiddenClass = '') => {
    const isSorted = sortField === field
    return (
      <th
        onClick={() => handleSort(field)}
        className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300 transition-colors select-none ${alignClass} ${hiddenClass}`}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {isSorted && (sortOrder === 'asc' ? ' ▲' : ' ▼')}
        </span>
      </th>
    )
  }

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

      {/* Filtro categoría & Búsqueda */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500 shrink-0">Buscar:</span>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Título, SKU o ID..."
          className="bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-yellow-400/50 min-w-[200px]"
        />

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
                {renderHeader('title', 'Publicación', 'text-left')}
                {renderHeader('price', 'Precio', 'text-right')}
                {renderHeader('cost', 'Costo', 'text-right')}
                {renderHeader('stock', 'Stock', 'text-right', 'hidden sm:table-cell')}
                {renderHeader('sold', 'Vendidos', 'text-right', 'hidden sm:table-cell')}
                {renderHeader('visits', 'Visitas', 'text-right', 'hidden md:table-cell')}
                {renderHeader('conversion', 'Conv.', 'text-right', 'hidden md:table-cell')}
                {renderHeader('quality', 'Calidad', 'text-center', 'hidden lg:table-cell')}
                {renderHeader('status', 'Estado', 'text-center')}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sortedGroups.map((group) => (
                <GroupRow key={group.key} group={group} onCostUpdated={onCostUpdated} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

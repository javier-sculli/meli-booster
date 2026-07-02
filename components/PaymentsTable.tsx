'use client'

import type { MeliCollection } from '@/lib/meli'

interface PaymentWithCumulative extends MeliCollection {
  cumulative_total: number
  skus?: Array<{ title: string; sku: string; quantity: number; unit_price: number; cost?: number }>
  total_cost?: number
  profit?: number
  has_missing_cost?: boolean
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function fmtDay(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso))
}

function fmtCurrency(amount: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function PaymentSkuBadge({
  sku,
  quantity,
  cost,
}: {
  sku: string
  quantity: number
  cost: number
}) {
  const hasCost = cost > 0

  return (
    <div className="flex items-center gap-1.5 mt-1 bg-gray-800 border border-gray-700/50 rounded px-1.5 py-0.5 w-fit" onClick={(e) => e.stopPropagation()}>
      <span className="text-[10px] text-gray-300 font-mono">
        {sku} ({quantity}u)
      </span>
      {hasCost ? (
        <span className="text-[9px] text-emerald-400 font-mono">
          ${cost.toLocaleString('es-AR')}
        </span>
      ) : (
        <span className="text-[9px] text-yellow-500/80 font-mono italic">
          sin costo
        </span>
      )}
    </div>
  )
}

export default function PaymentsTable({
  payments,
}: {
  payments: PaymentWithCumulative[]
}) {
  if (payments.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
        <p className="text-4xl mb-3">📭</p>
        <p className="text-gray-400 font-medium">Sin pagos por el momento</p>
        <p className="text-gray-600 text-sm mt-1">
          Los pagos recibidos hoy aparecerán aquí automáticamente.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Día
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Hora
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Orden
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cuotas
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bruto
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cargos por venta
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Envíos
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Impuestos
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Neto
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rentabilidad
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {payments.map((p) => {
              return (
                <tr
                  key={p.id}
                  className="hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-gray-300">
                    {fmtDay(p.date_created)}
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-300">
                    {fmtTime(p.date_created)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    <div>#{p.order_id || p.id}</div>
                    {p.skus && p.skus.length > 0 && (
                      <div className="mt-1 flex flex-col gap-0.5">
                        {p.skus.map((item, idx) => (
                          <PaymentSkuBadge
                            key={idx}
                            sku={item.sku}
                            quantity={item.quantity}
                            cost={item.cost ?? 0}
                          />
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-center font-mono">
                    {p.installments > 1 ? `${p.installments}x` : '1x'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 font-mono">
                    {fmtCurrency(p.total_paid_amount, p.currency_id)}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-400/90 font-mono">
                    {p.sale_fees > 0 ? `-${fmtCurrency(p.sale_fees, p.currency_id)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-400/90 font-mono">
                    {p.shipping_cost > 0 ? `-${fmtCurrency(p.shipping_cost, p.currency_id)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-400/90 font-mono">
                    {p.taxes > 0 ? `-${fmtCurrency(p.taxes, p.currency_id)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-400 font-mono">
                    {fmtCurrency(p.net_received_amount, p.currency_id)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {p.skus && p.skus.length > 0 ? (
                      p.has_missing_cost ? (
                        <span className="inline-flex items-center gap-1 text-xs text-yellow-400 font-semibold bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                          ⚠️ Falta costo
                        </span>
                      ) : (
                        <div>
                          <span className={`font-semibold text-sm ${(p.profit ?? 0) > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {fmtCurrency(p.profit ?? 0, p.currency_id)}
                          </span>
                          <div className="text-[10px] text-gray-500">
                            {p.net_received_amount > 0 ? `${Math.round(((p.profit ?? 0) / p.net_received_amount) * 100)}%` : '—'}
                          </div>
                        </div>
                      )
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

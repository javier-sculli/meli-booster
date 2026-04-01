'use client'

import type { MeliCollection } from '@/lib/meli'

interface PaymentWithCumulative extends MeliCollection {
  cumulative_total: number
}

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-green-500/10 text-green-400 border-green-500/20',
  in_process: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  pending: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

const STATUS_LABELS: Record<string, string> = {
  approved: 'Acreditado',
  in_process: 'En proceso',
  pending: 'Pendiente',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  visa: 'Visa',
  master: 'Mastercard',
  amex: 'Amex',
  naranja: 'Naranja',
  account_money: 'Dinero en cuenta',
  debit_card: 'Débito',
  bank_transfer: 'Transf. bancaria',
  ticket: 'Efectivo',
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

function fmtCurrency(amount: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

function fmtMethod(methodId: string, type: string) {
  return PAYMENT_METHOD_LABELS[methodId] ?? PAYMENT_METHOD_LABELS[type] ?? methodId
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
                Hora
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Orden
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Comprador
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                Método
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                Cuotas
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bruto
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                Comisión
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Neto
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                Acumulado
              </th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {payments.map((p) => {
              const fee = p.marketplace_fee ?? p.total_paid_amount - p.net_received_amount
              return (
                <tr
                  key={p.id}
                  className="hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-gray-300">
                    {fmtTime(p.date_created)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    #{p.order_id}
                  </td>
                  <td className="px-4 py-3 text-gray-300 max-w-[120px] truncate">
                    {p.buyer?.nickname ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {fmtMethod(p.payment_method_id, p.payment_type)}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden lg:table-cell text-center">
                    {p.installments > 1 ? `${p.installments}x` : '1x'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 font-mono">
                    {fmtCurrency(p.total_paid_amount, p.currency_id)}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-400 font-mono hidden sm:table-cell">
                    -{fmtCurrency(fee, p.currency_id)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-400 font-mono">
                    {fmtCurrency(p.net_received_amount, p.currency_id)}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-400 font-mono hidden sm:table-cell">
                    {fmtCurrency(p.cumulative_total, p.currency_id)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${STATUS_STYLES[p.status] ?? STATUS_STYLES.cancelled}`}
                    >
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
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

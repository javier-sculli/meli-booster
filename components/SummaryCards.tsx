'use client'

interface Summary {
  total_net: number
  total_gross: number
  total_fees: number
  total_cost?: number
  total_profit?: number
  net_with_cost?: number
  missing_costs_count?: number
  count: number
  count_all: number
  avg_ticket: number
  pending_count: number
  pending_amount: number
  currency: string
}

function fmt(amount: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

interface CardProps {
  label: string
  value: string
  sub?: string
  color?: string
}

function Card({ label, value, sub, color = 'text-white' }: CardProps) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
        {label}
      </p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export default function SummaryCards({ summary }: { summary: Summary }) {
  const {
    total_net,
    total_gross,
    total_fees,
    total_cost = 0,
    total_profit = 0,
    net_with_cost = 0,
    missing_costs_count = 0,
    count,
    avg_ticket,
    pending_count,
    pending_amount,
    currency,
  } = summary

  const marginBase = missing_costs_count > 0 ? net_with_cost : total_net
  const margin = marginBase > 0 ? Math.round((total_profit / marginBase) * 100) : 0

  const subLabel = missing_costs_count > 0
    ? `Margen: ${margin}% (Costo: ${fmt(total_cost, currency)}) - ⚠️ Excluye ${missing_costs_count} venta${missing_costs_count > 1 ? 's' : ''} sin costo`
    : `Margen: ${margin}% (Costo: ${fmt(total_cost, currency)})`

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <Card
        label="Total neto del día"
        value={fmt(total_net, currency)}
        sub={`Bruto: ${fmt(total_gross, currency)}`}
        color="text-green-400"
      />
      <Card
        label="Rentabilidad del día"
        value={fmt(total_profit, currency)}
        sub={subLabel}
        color="text-emerald-400 font-extrabold"
      />
      <Card
        label="Pagos acreditados"
        value={String(count)}
        sub={count !== summary.count_all ? `${summary.count_all} en total` : undefined}
      />
      <Card
        label="Ticket promedio"
        value={fmt(avg_ticket, currency)}
        sub="Por pago neto"
      />
      <Card
        label="Comisiones MeLi"
        value={fmt(total_fees, currency)}
        sub={
          pending_count > 0
            ? `${pending_count} pago${pending_count > 1 ? 's' : ''} pendiente${pending_count > 1 ? 's' : ''} (${fmt(pending_amount, currency)})`
            : 'Sin pendientes'
        }
        color="text-orange-400"
      />
    </div>
  )
}

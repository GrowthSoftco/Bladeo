import { useState, useEffect } from 'react';

interface Summary {
  revenue: number;
  totalExpenses: number;
  netIncome: number;
  salesCount: number;
  serviceRevenue: number;
  productRevenue: number;
  byBarber: { name: string; total: number }[];
  dailySales: { date: string; total: number }[];
  byPayment: Record<string, number>;
}

interface Client {
  id: string;
  name: string;
  total_visits: number;
  total_spent: number;
  last_visit_at: string | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

export default function WarRoom() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryPrev, setSummaryPrev] = useState<Summary | null>(null);
  const [topClients, setTopClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const getRange = (p: 'week' | 'month' | 'quarter', offset = 0) => {
    const now = new Date();
    let from: Date, to: Date;
    if (p === 'week') {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) - offset * 7);
      from = monday;
      to = new Date(monday);
      to.setDate(monday.getDate() + 6);
    } else if (p === 'month') {
      from = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      to = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
    } else {
      from = new Date(now.getFullYear(), now.getMonth() - 2 - offset * 3, 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1 - offset * 3, 0);
    }
    // Cap 'to' at today for current period
    if (offset === 0 && to > now) to = now;
    return {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  };

  const load = async () => {
    setLoading(true);
    const range = getRange(period);
    const prevRange = getRange(period, 1);
    const [cur, prev, clients] = await Promise.all([
      fetch(`/api/accounting/summary?from=${range.from}&to=${range.to}`).then(r => r.json()),
      fetch(`/api/accounting/summary?from=${prevRange.from}&to=${prevRange.to}`).then(r => r.json()),
      fetch('/api/clients').then(r => r.json()),
    ]);
    setSummary(cur.revenue !== undefined ? cur : null);
    setSummaryPrev(prev.revenue !== undefined ? prev : null);
    setTopClients(
      Array.isArray(clients)
        ? [...clients].sort((a: Client, b: Client) => b.total_spent - a.total_spent).slice(0, 10)
        : []
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, [period]);

  function delta(cur: number, prev: number) {
    if (prev === 0) return cur > 0 ? '+∞%' : '—';
    const pct = Math.round(((cur - prev) / prev) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  }

  function deltaColor(cur: number, prev: number) {
    if (cur > prev) return 'text-green-400';
    if (cur < prev) return 'text-red-400';
    return 'text-[var(--color-text-secondary)]';
  }

  const maxBar = summary?.dailySales ? Math.max(...summary.dailySales.map(d => d.total), 1) : 1;
  const maxBarber = summary?.byBarber?.length ? Math.max(...summary.byBarber.map(b => b.total), 1) : 1;

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-1 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg p-1 w-fit">
        {(['week', 'month', 'quarter'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${period === p ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-secondary)] hover:text-white'}`}
          >
            {{ week: 'Esta semana', month: 'Este mes', quarter: 'Trimestre' }[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--color-text-secondary)]">Cargando War Room...</div>
      ) : !summary ? (
        <div className="text-center py-20 text-red-400">Error al cargar datos</div>
      ) : (
        <>
          {/* KPI row with vs prev period */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Ingresos', value: summary.revenue, prev: summaryPrev?.revenue ?? 0, color: 'text-[var(--color-text-primary)]', subLabel: `${summary.salesCount} ventas` },
              { label: 'Gastos', value: summary.totalExpenses, prev: summaryPrev?.totalExpenses ?? 0, color: 'text-red-400', subLabel: 'total registrado', invertDelta: true },
              { label: 'Utilidad neta', value: summary.netIncome, prev: summaryPrev?.netIncome ?? 0, color: summary.netIncome >= 0 ? 'text-green-400' : 'text-red-400', subLabel: `${summary.revenue > 0 ? Math.round((summary.netIncome / summary.revenue) * 100) : 0}% margen` },
              { label: 'Ticket promedio', value: summary.salesCount > 0 ? summary.revenue / summary.salesCount : 0, prev: (summaryPrev?.salesCount ?? 0) > 0 ? (summaryPrev?.revenue ?? 0) / (summaryPrev?.salesCount ?? 1) : 0, color: 'text-[var(--color-text-primary)]', subLabel: 'por venta' },
            ].map(({ label, value, prev, color, subLabel, invertDelta }) => {
              const d = delta(value, prev);
              const dc = invertDelta
                ? (value < prev ? 'text-green-400' : value > prev ? 'text-red-400' : 'text-[var(--color-text-secondary)]')
                : deltaColor(value, prev);
              return (
                <div key={label} className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
                  <p className="text-[var(--color-text-secondary)] text-xs mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{fmt(value)}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs font-semibold ${dc}`}>{d}</span>
                    <span className="text-xs text-[var(--color-text-secondary)]">vs período anterior</span>
                  </div>
                  <p className="text-[var(--color-text-secondary)] text-xs mt-1">{subLabel}</p>
                </div>
              );
            })}
          </div>

          {/* Daily revenue chart */}
          <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
            <h3 className="font-semibold text-[var(--color-text-primary)] mb-1 text-sm">Evolución de ingresos</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">Ingresos diarios del período</p>
            {summary.dailySales.length === 0 ? (
              <p className="text-[var(--color-text-secondary)] text-sm text-center py-8">Sin ventas en el período</p>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {summary.dailySales.map(d => (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center gap-1 group"
                    title={`${fmtDate(d.date)}: ${fmt(d.total)}`}
                  >
                    <div
                      className="w-full bg-[var(--color-brand)]/50 group-hover:bg-[var(--color-brand)] rounded-t transition-all min-h-[2px] cursor-pointer"
                      style={{ height: `${Math.max(2, Math.round((d.total / maxBar) * 144))}px` }}
                    />
                    {summary.dailySales.length <= 14 && (
                      <span className="text-[9px] text-[var(--color-text-secondary)]">{fmtDate(d.date)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Barber performance + top clients */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Barber ranking */}
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-1 text-sm">Ranking de barberos</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mb-4">Ingresos generados por cada uno</p>
              {summary.byBarber.length === 0 ? (
                <p className="text-[var(--color-text-secondary)] text-sm text-center py-8">Sin datos</p>
              ) : (
                <div className="space-y-3">
                  {summary.byBarber.map((b, i) => {
                    const pct = Math.round((b.total / maxBarber) * 100);
                    return (
                      <div key={b.name}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold w-5 text-center ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-[var(--color-text-secondary)]' : i === 2 ? 'text-amber-700' : 'text-[var(--color-text-secondary)]'}`}>
                            #{i + 1}
                          </span>
                          <span className="flex-1 text-sm text-[var(--color-text-primary)]">{b.name}</span>
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">{fmt(b.total)}</span>
                        </div>
                        <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden ml-7">
                          <div
                            className={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : 'bg-[var(--color-brand)]'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top clients */}
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-1 text-sm">Top clientes</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mb-4">Por gasto total histórico</p>
              {topClients.length === 0 ? (
                <p className="text-[var(--color-text-secondary)] text-sm text-center py-8">Sin clientes registrados</p>
              ) : (
                <div className="space-y-2">
                  {topClients.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-3 py-1.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-amber-400/20 text-amber-400' : 'bg-[var(--color-border)] text-[var(--color-text-secondary)]'}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--color-text-primary)] truncate">{c.name}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{c.total_visits} visitas</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)]">{fmt(c.total_spent)}</p>
                        {c.last_visit_at && (
                          <p className="text-xs text-[var(--color-text-secondary)]">{fmtDate(c.last_visit_at.split('T')[0])}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Revenue breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-3 text-sm">Servicios vs Productos</h3>
              <div className="space-y-3">
                {[
                  { label: 'Servicios', value: summary.serviceRevenue, total: summary.revenue, color: '#2563eb' },
                  { label: 'Productos', value: summary.productRevenue, total: summary.revenue, color: '#8b5cf6' },
                ].map(({ label, value, total, color }) => {
                  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
                        <span className="text-sm text-[var(--color-text-primary)]">{fmt(value)} <span className="text-[var(--color-text-secondary)]">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-3 text-sm">Métodos de pago</h3>
              {Object.keys(summary.byPayment).length === 0 ? (
                <p className="text-[var(--color-text-secondary)] text-sm">Sin datos</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(summary.byPayment)
                    .sort(([, a], [, b]) => b - a)
                    .map(([pm, total]) => {
                      const pct = summary.revenue > 0 ? Math.round((total / summary.revenue) * 100) : 0;
                      const labels: Record<string, string> = { efectivo: 'Efectivo', nequi: 'Nequi', bancolombia: 'Bancolombia', daviplata: 'Daviplata', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };
                      return (
                        <div key={pm} className="bg-[var(--color-surface-overlay)] rounded-lg p-3 border border-[var(--color-border)]">
                          <p className="text-xs text-[var(--color-text-secondary)] mb-1">{labels[pm] ?? pm}</p>
                          <p className="font-semibold text-[var(--color-text-primary)] text-sm">{fmt(total)}</p>
                          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{pct}%</p>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

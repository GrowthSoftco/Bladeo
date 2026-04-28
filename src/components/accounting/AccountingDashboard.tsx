import { useState, useEffect } from 'react';

interface Summary {
  dateFrom: string;
  dateTo: string;
  revenue: number;
  discounts: number;
  totalExpenses: number;
  netIncome: number;
  salesCount: number;
  serviceRevenue: number;
  productRevenue: number;
  byPayment: Record<string, number>;
  byBarber: { name: string; total: number }[];
  byCategory: Record<string, number>;
  expenses: Expense[];
  dailySales: { date: string; total: number }[];
}

interface Expense {
  id: string;
  category: string;
  description: string | null;
  amount: number;
  date: string;
}

const EXPENSE_CATEGORIES = [
  'Arriendo', 'Servicios públicos', 'Insumos', 'Salarios', 'Publicidad', 'Mantenimiento', 'Equipos', 'Otro'
];

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo', nequi: 'Nequi', bancolombia: 'Bancolombia',
  daviplata: 'Daviplata', tarjeta: 'Tarjeta', transferencia: 'Transferencia',
};

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function getMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const to = now.toISOString().split('T')[0];
  return { from, to };
}

type ReportType = 'all' | 'today' | 'date' | 'range' | '15d' | '30d' | '';

function getRangeForReport(r: ReportType): { from: string; to: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  if (r === 'today') return { from: today, to: today };
  if (r === '15d') {
    const d = new Date(now); d.setDate(d.getDate() - 15);
    return { from: d.toISOString().split('T')[0], to: today };
  }
  if (r === '30d') {
    const d = new Date(now); d.setDate(d.getDate() - 30);
    return { from: d.toISOString().split('T')[0], to: today };
  }
  if (r === 'all') return { from: '2020-01-01', to: today };
  if (r === 'date') return { from: today, to: today };
  if (r === 'range') return getMonthRange();
  return getMonthRange();
}

export default function AccountingDashboard({ initialReport = '' }: { initialReport?: string }) {
  const report = initialReport as ReportType;
  const defaultRange = report ? getRangeForReport(report) : getMonthRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [reportMode] = useState<ReportType>(report);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'expenses'>('overview');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expForm, setExpForm] = useState({ category: EXPENSE_CATEGORIES[0], description: '', amount: '', date: defaultRange.to });
  const [savingExp, setSavingExp] = useState(false);
  const [expError, setExpError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounting/summary?from=${from}&to=${to}`);
      const data = await res.json();
      setSummary(res.ok ? data : null);
    } catch { setSummary(null); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [from, to]);

  const handleAddExpense = async () => {
    if (!expForm.amount || !expForm.date) { setExpError('Completa todos los campos.'); return; }
    setSavingExp(true);
    setExpError('');
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...expForm, amount: Number(expForm.amount) }),
    });
    const data = await res.json();
    setSavingExp(false);
    if (!res.ok) { setExpError(data.error ?? 'Error'); return; }
    setShowExpenseModal(false);
    setExpForm({ category: EXPENSE_CATEGORIES[0], description: '', amount: '', date: to });
    load();
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    load();
  };

  // Mini bar chart
  const maxBar = summary?.dailySales ? Math.max(...summary.dailySales.map(d => d.total), 1) : 1;

  const setPreset = (preset: 'today' | 'week' | 'month' | 'last_month') => {
    const now = new Date();
    if (preset === 'today') {
      const d = now.toISOString().split('T')[0];
      setFrom(d); setTo(d);
    } else if (preset === 'week') {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      setFrom(monday.toISOString().split('T')[0]);
      setTo(now.toISOString().split('T')[0]);
    } else if (preset === 'month') {
      setFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
      setTo(now.toISOString().split('T')[0]);
    } else if (preset === 'last_month') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lme = new Date(now.getFullYear(), now.getMonth(), 0);
      setFrom(lm.toISOString().split('T')[0]);
      setTo(lme.toISOString().split('T')[0]);
    }
  };

  return (
    <div>
      {/* Date filter — adapts based on report mode */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {/* Show presets only when no specific report mode */}
        {!reportMode && (
          <div className="flex gap-1.5 flex-wrap">
            {(['today', 'week', 'month', 'last_month'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[#3a3a4a] transition-colors"
              >
                {{ today: 'Hoy', week: 'Esta semana', month: 'Este mes', last_month: 'Mes pasado' }[p]}
              </button>
            ))}
          </div>
        )}

        {/* Report mode label */}
        {reportMode && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-brand)]/20 border border-[var(--color-brand)]/30 text-[#93c5fd]">
              {{ all: 'Todo hasta la fecha', today: 'Hoy', '15d': 'Últimos 15 días', '30d': 'Últimos 30 días', date: 'Por fecha', range: 'Por rango' }[reportMode] ?? ''}
            </span>
          </div>
        )}

        {/* Date inputs — always shown for 'date' (single) and 'range' (two), otherwise just range for fine-tuning */}
        <div className="flex items-center gap-2 ml-auto">
          {reportMode === 'date' ? (
            <input
              type="date" value={from} onChange={e => { setFrom(e.target.value); setTo(e.target.value); }}
              className="px-3 py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
            />
          ) : (
            <>
              <input
                type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="px-3 py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
              />
              <span className="text-[var(--color-text-secondary)] text-sm">→</span>
              <input
                type="date" value={to} onChange={e => setTo(e.target.value)}
                className="px-3 py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
              />
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg p-1 w-fit">
        {(['overview', 'expenses'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-secondary)] hover:text-white'}`}
          >
            {{ overview: 'Resumen', expenses: 'Gastos' }[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-20 text-[var(--color-text-secondary)]">Cargando...</div>
      ) : !summary ? (
        <div className="text-center py-20 text-red-400">Error al cargar datos</div>
      ) : tab === 'overview' ? (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <p className="text-[var(--color-text-secondary)] text-xs mb-1">Ingresos brutos</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{fmt(summary.revenue)}</p>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">{summary.salesCount} ventas</p>
            </div>
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <p className="text-[var(--color-text-secondary)] text-xs mb-1">Gastos</p>
              <p className="text-2xl font-bold text-red-400">{fmt(summary.totalExpenses)}</p>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">Descuentos: {fmt(summary.discounts)}</p>
            </div>
            <div className={`border rounded-xl p-5 ${summary.netIncome >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <p className="text-[var(--color-text-secondary)] text-xs mb-1">Utilidad neta</p>
              <p className={`text-2xl font-bold ${summary.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(summary.netIncome)}</p>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">
                Margen: {summary.revenue > 0 ? Math.round((summary.netIncome / summary.revenue) * 100) : 0}%
              </p>
            </div>
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <p className="text-[var(--color-text-secondary)] text-xs mb-1">Ticket promedio</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">
                {summary.salesCount > 0 ? fmt(summary.revenue / summary.salesCount) : fmt(0)}
              </p>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">por venta</p>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily chart */}
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-4 text-sm">Ventas por día</h3>
              {summary.dailySales.length === 0 ? (
                <p className="text-[var(--color-text-secondary)] text-sm text-center py-8">Sin ventas en el período</p>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {summary.dailySales.map(d => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${fmtDate(d.date)}: ${fmt(d.total)}`}>
                      <div
                        className="w-full bg-[var(--color-brand)]/60 group-hover:bg-[var(--color-brand)] rounded-t transition-colors min-h-[2px]"
                        style={{ height: `${Math.max(2, Math.round((d.total / maxBar) * 112))}px` }}
                      />
                      {summary.dailySales.length <= 10 && (
                        <span className="text-[9px] text-[var(--color-text-secondary)] rotate-0">{fmtDate(d.date)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment methods */}
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-4 text-sm">Por método de pago</h3>
              {Object.keys(summary.byPayment).length === 0 ? (
                <p className="text-[var(--color-text-secondary)] text-sm text-center py-8">Sin datos</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(summary.byPayment)
                    .sort(([, a], [, b]) => b - a)
                    .map(([pm, total]) => {
                      const pct = summary.revenue > 0 ? Math.round((total / summary.revenue) * 100) : 0;
                      return (
                        <div key={pm}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-[var(--color-text-primary)]">{PAYMENT_LABELS[pm] ?? pm}</span>
                            <span className="text-sm text-[var(--color-text-primary)] font-medium">{fmt(total)}</span>
                          </div>
                          <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--color-brand)] rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* By type + by barber */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue by type */}
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-4 text-sm">Servicios vs Productos</h3>
              <div className="space-y-3">
                {[
                  { label: 'Servicios', value: summary.serviceRevenue, color: '#2563eb' },
                  { label: 'Productos', value: summary.productRevenue, color: '#8b5cf6' },
                ].map(({ label, value, color }) => {
                  const pct = summary.revenue > 0 ? Math.round((value / summary.revenue) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
                        <span className="text-sm text-[var(--color-text-primary)] font-medium">{fmt(value)} <span className="text-[var(--color-text-secondary)] font-normal">({pct}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* By barber */}
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-4 text-sm">Ingresos por barbero</h3>
              {summary.byBarber.length === 0 ? (
                <p className="text-[var(--color-text-secondary)] text-sm text-center py-8">Sin datos</p>
              ) : (
                <div className="space-y-3">
                  {summary.byBarber.map(b => {
                    const pct = summary.revenue > 0 ? Math.round((b.total / summary.revenue) * 100) : 0;
                    return (
                      <div key={b.name}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-[var(--color-text-primary)]">{b.name}</span>
                          <span className="text-sm text-[var(--color-text-primary)] font-medium">{fmt(b.total)} <span className="text-[var(--color-text-secondary)] font-normal">({pct}%)</span></span>
                        </div>
                        <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Expenses tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--color-text-primary)] font-semibold">Total gastos: <span className="text-red-400">{fmt(summary.totalExpenses)}</span></p>
            </div>
            <button
              onClick={() => { setExpForm({ ...expForm, date: to }); setShowExpenseModal(true); }}
              className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors"
            >
              + Registrar gasto
            </button>
          </div>

          {/* Expenses by category */}
          {Object.keys(summary.byCategory).length > 0 && (
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-4 text-sm">Por categoría</h3>
              <div className="space-y-2.5">
                {Object.entries(summary.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, total]) => {
                    const pct = summary.totalExpenses > 0 ? Math.round((total / summary.totalExpenses) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-[var(--color-text-primary)]">{cat}</span>
                          <span className="text-sm text-[var(--color-text-primary)] font-medium">{fmt(total)} <span className="text-[var(--color-text-secondary)] font-normal">({pct}%)</span></span>
                        </div>
                        <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Expense list */}
          {summary.expenses.length === 0 ? (
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-12 text-center">
              <p className="text-[var(--color-text-primary)] font-semibold mb-1">Sin gastos registrados</p>
              <p className="text-[var(--color-text-secondary)] text-sm">Registra los gastos del período para ver tu utilidad real.</p>
            </div>
          ) : (
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="text-left px-5 py-3 text-[var(--color-text-secondary)] font-medium">Categoría</th>
                    <th className="text-left px-5 py-3 text-[var(--color-text-secondary)] font-medium hidden sm:table-cell">Descripción</th>
                    <th className="text-right px-5 py-3 text-[var(--color-text-secondary)] font-medium">Monto</th>
                    <th className="text-right px-5 py-3 text-[var(--color-text-secondary)] font-medium hidden sm:table-cell">Fecha</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {summary.expenses.map(e => (
                    <tr key={e.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-overlay)] transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/20">{e.category}</span>
                      </td>
                      <td className="px-5 py-3.5 text-[var(--color-text-secondary)] hidden sm:table-cell">{e.description ?? '—'}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-red-400">{fmt(e.amount)}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--color-text-secondary)] hidden sm:table-cell">{fmtDate(e.date)}</td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-400/10 transition-colors float-right"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Expense modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
              <h2 className="font-semibold text-[var(--color-text-primary)]">Registrar gasto</h2>
              <button onClick={() => setShowExpenseModal(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Categoría</label>
                <select
                  value={expForm.category}
                  onChange={e => setExpForm({ ...expForm, category: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
                >
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Descripción</label>
                <input
                  type="text"
                  value={expForm.description}
                  onChange={e => setExpForm({ ...expForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
                  placeholder="Ej: Pago arriendo abril"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Monto *</label>
                  <input
                    type="number" min="0"
                    value={expForm.amount}
                    onChange={e => setExpForm({ ...expForm, amount: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Fecha *</label>
                  <input
                    type="date"
                    value={expForm.date}
                    onChange={e => setExpForm({ ...expForm, date: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
                  />
                </div>
              </div>
              {expError && <p className="text-red-400 text-sm">{expError}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowExpenseModal(false)}
                className="flex-1 py-2.5 bg-[var(--color-surface-overlay)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm font-medium rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddExpense}
                disabled={savingExp}
                className="flex-1 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {savingExp ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

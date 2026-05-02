import { useState, useEffect } from 'react';

interface Member {
  id: string;
  display_name: string;
  role: string;
  commission_pct: number;
  is_active: boolean;
}

interface BarberBreakdown {
  name: string;
  total: number;
  commissionPct: number;
  barberCut: number;
  ownerCut: number;
  advances: number;
  netPayout: number;
}

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
  byBarber: BarberBreakdown[];
  byCategory: Record<string, number>;
  expenses: Expense[];
  allExpenses: Expense[];
  dailySales: { date: string; total: number }[];
  // Barber-filter specific
  filteredBarberId: string | null;
  barberName: string | null;
  commissionPct: number | null;
  barberEarnings: number | null;
  ownerFromBarber: number | null;
  barberAdvances: number | null;
  barberNetPayout: number | null;
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
  const to   = now.toISOString().split('T')[0];
  return { from, to };
}

type ReportType = 'all' | 'today' | 'date' | 'range' | '15d' | '30d' | '';

function getRangeForReport(r: ReportType): { from: string; to: string } {
  const now   = new Date();
  const today = now.toISOString().split('T')[0];
  if (r === 'today') return { from: today, to: today };
  if (r === '15d')  { const d = new Date(now); d.setDate(d.getDate() - 15);  return { from: d.toISOString().split('T')[0], to: today }; }
  if (r === '30d')  { const d = new Date(now); d.setDate(d.getDate() - 30);  return { from: d.toISOString().split('T')[0], to: today }; }
  if (r === 'all')  return { from: '2020-01-01', to: today };
  return getMonthRange();
}

export default function AccountingDashboard({ initialReport = '' }: { initialReport?: string }) {
  const report       = initialReport as ReportType;
  const defaultRange = report ? getRangeForReport(report) : getMonthRange();

  const [from, setFrom]             = useState(defaultRange.from);
  const [to, setTo]                 = useState(defaultRange.to);
  const [reportMode]                = useState<ReportType>(report);
  const [selectedBarberId, setSelectedBarberId] = useState<string>('');
  const [members, setMembers]       = useState<Member[]>([]);
  const [summary, setSummary]       = useState<Summary | null>(null);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<'overview' | 'expenses'>('overview');
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expForm, setExpForm]       = useState({ category: EXPENSE_CATEGORIES[0], description: '', amount: '', date: defaultRange.to });
  const [savingExp, setSavingExp]   = useState(false);
  const [expError, setExpError]     = useState('');

  // Fetch barbers list once
  useEffect(() => {
    fetch('/api/members')
      .then(r => r.json())
      .then(d => setMembers(Array.isArray(d) ? d.filter((m: Member) => m.is_active !== false) : []));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      let url = `/api/accounting/summary?from=${from}&to=${to}`;
      if (selectedBarberId) url += `&barber_id=${selectedBarberId}`;
      const res  = await fetch(url);
      const data = await res.json();
      setSummary(res.ok ? data : null);
    } catch { setSummary(null); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, [from, to, selectedBarberId]);

  const handleAddExpense = async () => {
    if (!expForm.amount || !expForm.date) { setExpError('Completa todos los campos.'); return; }
    setSavingExp(true); setExpError('');
    const res  = await fetch('/api/expenses', {
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

  const maxBar        = summary?.dailySales ? Math.max(...summary.dailySales.map(d => d.total), 1) : 1;
  const isBarberView  = !!selectedBarberId;
  const expenseList   = summary?.allExpenses ?? summary?.expenses ?? [];

  const setPreset = (preset: 'today' | 'week' | 'month' | 'last_month') => {
    const now = new Date();
    if (preset === 'today') {
      const d = now.toISOString().split('T')[0]; setFrom(d); setTo(d);
    } else if (preset === 'week') {
      const day = now.getDay();
      const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      setFrom(mon.toISOString().split('T')[0]); setTo(now.toISOString().split('T')[0]);
    } else if (preset === 'month') {
      setFrom(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
      setTo(now.toISOString().split('T')[0]);
    } else if (preset === 'last_month') {
      const lm  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lme = new Date(now.getFullYear(), now.getMonth(), 0);
      setFrom(lm.toISOString().split('T')[0]); setTo(lme.toISOString().split('T')[0]);
    }
  };

  return (
    <div>
      {/* ── Filters row ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Presets */}
        {!reportMode && (
          <div className="flex gap-1.5 flex-wrap">
            {(['today', 'week', 'month', 'last_month'] as const).map(p => (
              <button key={p} onClick={() => setPreset(p)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[#3a3a4a] transition-colors">
                {{ today: 'Hoy', week: 'Esta semana', month: 'Este mes', last_month: 'Mes pasado' }[p]}
              </button>
            ))}
          </div>
        )}

        {reportMode && (
          <span className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[var(--color-brand)]/20 border border-[var(--color-brand)]/30 text-[#93c5fd]">
            {{ all: 'Todo hasta la fecha', today: 'Hoy', '15d': 'Últimos 15 días', '30d': 'Últimos 30 días', date: 'Por fecha', range: 'Por rango' }[reportMode] ?? ''}
          </span>
        )}

        {/* Date inputs */}
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {reportMode === 'date' ? (
            <input type="date" value={from} onChange={e => { setFrom(e.target.value); setTo(e.target.value); }}
              className="px-3 py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]" />
          ) : (
            <>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="px-3 py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]" />
              <span className="text-[var(--color-text-secondary)] text-sm">→</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="px-3 py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]" />
            </>
          )}
        </div>
      </div>

      {/* ── Barber selector ──────────────────────────────────────────────────── */}
      {members.length > 0 && (
        <div className="flex items-center gap-3 mb-6 p-3 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl">
          <div className="flex items-center gap-2 flex-shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <span className="text-sm text-[var(--color-text-secondary)] font-medium whitespace-nowrap">Filtrar por barbero:</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedBarberId('')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${!selectedBarberId ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}>
              Todos
            </button>
            {members.map(m => (
              <button key={m.id}
                onClick={() => setSelectedBarberId(m.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${selectedBarberId === m.id ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}>
                {m.display_name}
                {m.role === 'owner' && <span className="ml-1 opacity-60">(dueño)</span>}
              </button>
            ))}
          </div>
          {isBarberView && summary?.commissionPct !== null && summary?.commissionPct !== undefined && (
            <span className="ml-auto flex-shrink-0 text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface-overlay)] px-2.5 py-1 rounded-lg border border-[var(--color-border)]">
              Comisión: <strong className="text-green-400">{summary.commissionPct}%</strong>
            </span>
          )}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg p-1 w-fit">
        {(['overview', 'expenses'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-secondary)] hover:text-white'}`}>
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

          {/* ── Barber commission banner ──────────────────────────────────────── */}
          {isBarberView && summary.barberEarnings !== null && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/30 rounded-xl p-5">
                  <p className="text-[var(--color-text-secondary)] text-xs mb-1">Ventas generadas</p>
                  <p className="text-2xl font-bold text-[var(--color-text-primary)]">{fmt(summary.revenue)}</p>
                  <p className="text-[var(--color-text-secondary)] text-xs mt-1">{summary.salesCount} ventas · {summary.barberName}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5">
                  <p className="text-[var(--color-text-secondary)] text-xs mb-1">Ganancia bruta</p>
                  <p className="text-2xl font-bold text-green-400">{fmt(summary.barberEarnings!)}</p>
                  <p className="text-[var(--color-text-secondary)] text-xs mt-1">{summary.commissionPct}% de comisión</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
                  <p className="text-[var(--color-text-secondary)] text-xs mb-1">Anticipos pendientes</p>
                  <p className="text-2xl font-bold text-red-400">−{fmt(summary.barberAdvances ?? 0)}</p>
                  <p className="text-[var(--color-text-secondary)] text-xs mt-1">
                    {(summary.barberAdvances ?? 0) > 0 ? 'Aprobados, por descontar' : 'Sin anticipos'}
                  </p>
                </div>
                <div className={`rounded-xl p-5 border ${(summary.barberNetPayout ?? 0) >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                  <p className="text-[var(--color-text-secondary)] text-xs mb-1">💸 Neto a pagar</p>
                  <p className={`text-2xl font-bold ${(summary.barberNetPayout ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmt(summary.barberNetPayout ?? 0)}
                  </p>
                  <p className="text-[var(--color-text-secondary)] text-xs mt-1">Ganancia − anticipos</p>
                </div>
              </div>
              {(summary.barberAdvances ?? 0) > 0 && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-amber-400 text-xs">
                    {summary.barberName} tiene <strong>{fmt(summary.barberAdvances!)}</strong> en anticipos aprobados que se descontarán al momento del pago. Márcalos como "Pagados" en el módulo de Anticipos para liquidarlos.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── KPI cards ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <p className="text-[var(--color-text-secondary)] text-xs mb-1">
                {isBarberView ? 'Ventas generadas' : 'Ingresos brutos'}
              </p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{fmt(summary.revenue)}</p>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">{summary.salesCount} ventas</p>
            </div>
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <p className="text-[var(--color-text-secondary)] text-xs mb-1">
                {isBarberView ? 'Gastos (barbería)' : 'Gastos'}
              </p>
              <p className="text-2xl font-bold text-red-400">{fmt(summary.totalExpenses)}</p>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">
                {isBarberView ? 'Costos generales' : `Descuentos: ${fmt(summary.discounts)}`}
              </p>
            </div>
            <div className={`border rounded-xl p-5 ${summary.netIncome >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
              <p className="text-[var(--color-text-secondary)] text-xs mb-1">
                {isBarberView ? 'Utilidad neta (global)' : 'Utilidad neta'}
              </p>
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

          {/* ── Charts row ────────────────────────────────────────────────────── */}
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
                      <div className="w-full bg-[var(--color-brand)]/60 group-hover:bg-[var(--color-brand)] rounded-t transition-colors min-h-[2px]"
                        style={{ height: `${Math.max(2, Math.round((d.total / maxBar) * 112))}px` }} />
                      {summary.dailySales.length <= 10 && (
                        <span className="text-[9px] text-[var(--color-text-secondary)]">{fmtDate(d.date)}</span>
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
                  {Object.entries(summary.byPayment).sort(([, a], [, b]) => b - a).map(([pm, total]) => {
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

          {/* ── Services vs Products + barber breakdown ───────────────────────── */}
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

            {/* By barber — when viewing all, show breakdown; when viewing one, show commission split */}
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              {isBarberView ? (
                <>
                  <h3 className="font-semibold text-[var(--color-text-primary)] mb-4 text-sm">Distribución de ingresos</h3>
                  {summary.barberEarnings !== null && summary.ownerFromBarber !== null ? (
                    <div className="space-y-3">
                      {[
                        { label: `${summary.barberName} (comisión ${summary.commissionPct}%)`, value: summary.barberEarnings!, color: '#22c55e' },
                        { label: 'Aporte al dueño', value: summary.ownerFromBarber!, color: '#a855f7' },
                      ].map(({ label, value, color }) => {
                        const pct = summary.revenue > 0 ? Math.round((value / summary.revenue) * 100) : 0;
                        return (
                          <div key={label}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm text-[var(--color-text-primary)] truncate pr-2">{label}</span>
                              <span className="text-sm font-medium flex-shrink-0" style={{ color }}>{fmt(value)} <span className="text-[var(--color-text-secondary)] font-normal">({pct}%)</span></span>
                            </div>
                            <div className="h-1.5 bg-[var(--color-border)] rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[var(--color-text-secondary)] text-sm text-center py-8">Sin datos de comisión</p>
                  )}
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          </div>

          {/* ── Barber commission table (all-barbers view only) ───────────────── */}
          {!isBarberView && summary.byBarber.length > 1 && (
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--color-border)]">
                <h3 className="font-semibold text-[var(--color-text-primary)] text-sm">Utilidades por barbero</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Desglose de comisiones según el % configurado de cada barbero</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      <th className="text-left px-5 py-3 text-[var(--color-text-secondary)] font-medium">Barbero</th>
                      <th className="text-right px-5 py-3 text-[var(--color-text-secondary)] font-medium">Ventas</th>
                      <th className="text-right px-5 py-3 text-[var(--color-text-secondary)] font-medium">Comisión</th>
                      <th className="text-right px-5 py-3 text-green-400 font-medium">Ganancia</th>
                      <th className="text-right px-5 py-3 text-red-400 font-medium">Anticipos</th>
                      <th className="text-right px-5 py-3 text-emerald-400 font-medium">💸 A pagar</th>
                      <th className="text-right px-5 py-3 text-purple-400 font-medium">Dueño</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byBarber.map(b => (
                      <tr key={b.name} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-overlay)] transition-colors">
                        <td className="px-5 py-3.5 font-medium text-[var(--color-text-primary)]">{b.name}</td>
                        <td className="px-5 py-3.5 text-right text-[var(--color-text-primary)]">{fmt(b.total)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-brand)]/20 text-[var(--color-brand-light)]">{b.commissionPct}%</span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-green-400">{fmt(b.barberCut)}</td>
                        <td className="px-5 py-3.5 text-right text-red-400 font-medium">
                          {b.advances > 0 ? `−${fmt(b.advances)}` : <span className="text-[var(--color-text-secondary)]">—</span>}
                        </td>
                        <td className={`px-5 py-3.5 text-right font-bold ${b.netPayout >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {fmt(b.netPayout)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-purple-400">{fmt(b.ownerCut)}</td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="bg-[var(--color-surface-overlay)] font-semibold">
                      <td className="px-5 py-3 text-[var(--color-text-primary)]">Total</td>
                      <td className="px-5 py-3 text-right text-[var(--color-text-primary)]">{fmt(summary.revenue)}</td>
                      <td className="px-5 py-3 text-right" />
                      <td className="px-5 py-3 text-right text-green-400">{fmt(summary.byBarber.reduce((s, b) => s + b.barberCut, 0))}</td>
                      <td className="px-5 py-3 text-right text-red-400">
                        {summary.byBarber.reduce((s, b) => s + b.advances, 0) > 0
                          ? `−${fmt(summary.byBarber.reduce((s, b) => s + b.advances, 0))}`
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-emerald-400">{fmt(summary.byBarber.reduce((s, b) => s + b.netPayout, 0))}</td>
                      <td className="px-5 py-3 text-right text-purple-400">{fmt(summary.byBarber.reduce((s, b) => s + b.ownerCut, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

      ) : (
        /* ── Expenses tab ──────────────────────────────────────────────────── */
        <div className="space-y-4">
          {isBarberView && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-amber-400 text-xs">Los gastos son de toda la barbería, no por barbero individual.</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[var(--color-text-primary)] font-semibold">
              Total gastos: <span className="text-red-400">{fmt(summary.totalExpenses)}</span>
            </p>
            <button
              onClick={() => { setExpForm({ ...expForm, date: to }); setShowExpenseModal(true); }}
              className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors">
              + Registrar gasto
            </button>
          </div>

          {/* Expenses by category */}
          {Object.keys(summary.byCategory).length > 0 && (
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
              <h3 className="font-semibold text-[var(--color-text-primary)] mb-4 text-sm">Por categoría</h3>
              <div className="space-y-2.5">
                {Object.entries(summary.byCategory).sort(([, a], [, b]) => b - a).map(([cat, total]) => {
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
          {expenseList.length === 0 ? (
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
                  {expenseList.map(e => (
                    <tr key={e.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-overlay)] transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-red-500/20 text-red-400 border border-red-500/20">{e.category}</span>
                      </td>
                      <td className="px-5 py-3.5 text-[var(--color-text-secondary)] hidden sm:table-cell">{e.description ?? '—'}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-red-400">{fmt(e.amount)}</td>
                      <td className="px-5 py-3.5 text-right text-[var(--color-text-secondary)] hidden sm:table-cell">{fmtDate(e.date)}</td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => handleDeleteExpense(e.id)}
                          className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-400/10 transition-colors float-right">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6"/><path d="M14 11v6"/>
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

      {/* ── Expense modal ─────────────────────────────────────────────────────── */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
              <h2 className="font-semibold text-[var(--color-text-primary)]">Registrar gasto</h2>
              <button onClick={() => setShowExpenseModal(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Categoría</label>
                <select value={expForm.category} onChange={e => setExpForm({ ...expForm, category: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]">
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Descripción</label>
                <input type="text" value={expForm.description} onChange={e => setExpForm({ ...expForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
                  placeholder="Ej: Pago arriendo abril" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Monto *</label>
                  <input type="number" min="0" value={expForm.amount} onChange={e => setExpForm({ ...expForm, amount: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
                    placeholder="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Fecha *</label>
                  <input type="date" value={expForm.date} onChange={e => setExpForm({ ...expForm, date: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]" />
                </div>
              </div>
              {expError && <p className="text-red-400 text-sm">{expError}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowExpenseModal(false)}
                className="flex-1 py-2.5 bg-[var(--color-surface-overlay)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm font-medium rounded-lg transition-colors">
                Cancelar
              </button>
              <button onClick={handleAddExpense} disabled={savingExp}
                className="flex-1 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors">
                {savingExp ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';

function formatCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
}

function getToday() { return new Date().toISOString().split('T')[0]; }
function getWeekStart() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().split('T')[0];
}
function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

type Period = 'day' | 'week' | 'month';

interface Apt {
  id: string; status: string; date: string;
  services: { price: number; name: string } | null;
}

interface Props { memberId: string; }

export default function BarberPeriodStats({ memberId }: Props) {
  const [period, setPeriod] = useState<Period>('day');
  const [apts, setApts]     = useState<Apt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const today = getToday();
    const start = period === 'day' ? today : period === 'week' ? getWeekStart() : getMonthStart();
    fetch(`/api/appointments?barber_id=${memberId}&start=${start}&end=${today}`)
      .then(r => r.json())
      .then(d => setApts(Array.isArray(d) ? d : []))
      .catch(() => setApts([]))
      .finally(() => setLoading(false));
  }, [period, memberId]);

  const valid   = apts.filter(a => a.status !== 'cancelled' && a.status !== 'no_show');
  const done    = apts.filter(a => a.status === 'completed');
  const pending = apts.filter(a => a.status === 'confirmed' || a.status === 'pending');
  const total   = valid.reduce((s, a) => s + (a.services?.price ?? 0), 0);
  const avg     = valid.length ? Math.round(total / valid.length) : 0;

  // Day breakdown for bar chart (only week/month)
  const dayMap: Record<string, { date: string; count: number; total: number }> = {};
  for (const a of valid) {
    if (!dayMap[a.date]) dayMap[a.date] = { date: a.date, count: 0, total: 0 };
    dayMap[a.date].count++;
    dayMap[a.date].total += a.services?.price ?? 0;
  }
  const days = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));
  const maxDayTotal = Math.max(...days.map(d => d.total), 1);

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'day',   label: 'Hoy' },
    { key: 'week',  label: 'Semana' },
    { key: 'month', label: 'Mes' },
  ];

  const Skeleton = () => (
    <div className="h-8 bg-[var(--color-surface-overlay)] rounded-lg animate-pulse w-20 mt-1" />
  );

  return (
    <div className="mb-8">
      {/* Header + toggle */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-secondary)]">
          {period === 'day' ? 'Hoy' : period === 'week' ? 'Esta semana' : 'Este mes'}
        </p>
        <div className="flex bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg p-0.5">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                period === p.key
                  ? 'bg-[var(--color-brand)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
          <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wide mb-3">Citas</p>
          {loading ? <Skeleton /> : <>
            <p className="text-3xl font-bold text-white">{valid.length}</p>
            <p className="text-[var(--color-text-secondary)] text-xs mt-1">
              {done.length} listas · {pending.length} pend.
            </p>
          </>}
        </div>

        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
          <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wide mb-3">Ingresos est.</p>
          {loading ? <Skeleton /> : <>
            <p className="text-3xl font-bold text-[var(--color-success)]">{formatCOP(total)}</p>
            <p className="text-[var(--color-text-secondary)] text-xs mt-1">Valor servicios</p>
          </>}
        </div>

        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
          <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wide mb-3">Ticket prom.</p>
          {loading ? <Skeleton /> : <>
            <p className="text-3xl font-bold text-white">{formatCOP(avg)}</p>
            <p className="text-[var(--color-text-secondary)] text-xs mt-1">Por cita</p>
          </>}
        </div>

        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
          <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wide mb-3">
            {period === 'day' ? 'Pendientes' : 'Días activos'}
          </p>
          {loading ? <Skeleton /> : <>
            <p className="text-3xl font-bold text-white">
              {period === 'day' ? pending.length : days.length}
            </p>
            <p className="text-[var(--color-text-secondary)] text-xs mt-1">
              {period === 'day' ? 'Por confirmar' : 'Con citas'}
            </p>
          </>}
        </div>
      </div>

      {/* Bar chart — only for week/month with data */}
      {!loading && period !== 'day' && days.length > 1 && (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-4">
            Ingresos por día
          </p>
          <div className="flex items-end gap-1.5 h-20">
            {days.map(d => {
              const heightPct = (d.total / maxDayTotal) * 100;
              const label = new Date(d.date + 'T12:00:00').toLocaleDateString('es-CO', {
                weekday: 'short', day: 'numeric',
              });
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg px-2 py-1 text-[10px] text-[var(--color-text-primary)] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {formatCOP(d.total)} · {d.count} cita{d.count !== 1 ? 's' : ''}
                  </div>
                  <div
                    className="w-full rounded-t-md bg-[var(--color-brand)]/60 hover:bg-[var(--color-brand)] transition-colors min-h-[4px]"
                    style={{ height: `${Math.max(heightPct, 5)}%` }}
                  />
                  <span className="text-[9px] text-[var(--color-text-secondary)] truncate w-full text-center">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && valid.length === 0 && (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl py-8 text-center text-[var(--color-text-secondary)] text-sm">
          Sin citas {period === 'day' ? 'hoy' : period === 'week' ? 'esta semana' : 'este mes'}.
        </div>
      )}
    </div>
  );
}

import { useState, useMemo } from 'react';

interface BarberSale {
  total: number;
  barber_id: string | null;
  barber_name: string;
  commission_pct: number;
}

interface Props {
  sales: BarberSale[];
}

function formatCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
}

function calcCuts(list: BarberSale[]) {
  let ownerCut = 0, barberCut = 0;
  for (const s of list) {
    const pct = s.commission_pct / 100;
    barberCut += s.total * pct;
    ownerCut  += s.total * (1 - pct);
  }
  return { ownerCut, barberCut, total: ownerCut + barberCut };
}

export default function OwnerUtilities({ sales }: Props) {
  const [selectedBarber, setSelectedBarber] = useState<string>('all');

  // Unique barber list from sales
  const barbers = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sales) {
      if (s.barber_id && !map.has(s.barber_id)) map.set(s.barber_id, s.barber_name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sales]);

  // Filtered sales (for the selected barber)
  const filtered = useMemo(() =>
    selectedBarber === 'all' ? sales : sales.filter(s => s.barber_id === selectedBarber),
    [sales, selectedBarber]
  );

  const isFiltered = selectedBarber !== 'all';
  const filteredMetrics = useMemo(() => calcCuts(filtered), [filtered]);
  const globalMetrics  = useMemo(() => calcCuts(sales),    [sales]);

  const selectedName = barbers.find(b => b.id === selectedBarber)?.name ?? 'Barbero';

  return (
    <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">

      {/* Header + filter */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-white text-sm">Utilidades del día</h2>
        <select
          value={selectedBarber}
          onChange={e => setSelectedBarber(e.target.value)}
          className="text-xs bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[var(--color-brand)] transition-colors"
        >
          <option value="all">Todos los barberos</option>
          {barbers.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {/* ── Filtered metrics (always visible) ── */}
      {isFiltered && (
        <p className="text-[var(--color-text-secondary)] text-xs mb-3 font-medium">
          📊 {selectedName}
        </p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wide mb-2">
            {isFiltered ? 'Mis utilidades' : 'Mis utilidades'}
          </p>
          <p className="text-2xl font-bold text-[var(--color-brand-light)]">
            {formatCOP(filteredMetrics.ownerCut)}
          </p>
          <p className="text-[var(--color-text-secondary)] text-xs mt-1">
            {filtered.length} {filtered.length === 1 ? 'venta' : 'ventas'}
            {isFiltered && ' de este barbero'}
          </p>
        </div>
        <div className="bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wide mb-2">
            Utilidades barberos
          </p>
          <p className="text-2xl font-bold text-[var(--color-success)]">
            {formatCOP(filteredMetrics.barberCut)}
          </p>
          <p className="text-[var(--color-text-secondary)] text-xs mt-1">
            {isFiltered ? selectedName : 'Todos los barberos'}
          </p>
        </div>
      </div>

      {/* ── Totalization (only when a barber is selected) ── */}
      {isFiltered && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          <p className="text-[var(--color-text-secondary)] text-xs mb-3 font-medium">🧾 Total global</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg p-3 text-center">
              <p className="text-[var(--color-text-secondary)] text-[10px] uppercase tracking-wide mb-1">Ingresos</p>
              <p className="text-base font-bold text-white">{formatCOP(globalMetrics.total)}</p>
              <p className="text-[var(--color-text-secondary)] text-[10px] mt-0.5">{sales.length} ventas</p>
            </div>
            <div className="bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg p-3 text-center">
              <p className="text-[var(--color-text-secondary)] text-[10px] uppercase tracking-wide mb-1">Mis utilidades</p>
              <p className="text-base font-bold text-[var(--color-brand-light)]">{formatCOP(globalMetrics.ownerCut)}</p>
              <p className="text-[var(--color-text-secondary)] text-[10px] mt-0.5">total del día</p>
            </div>
            <div className="bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg p-3 text-center">
              <p className="text-[var(--color-text-secondary)] text-[10px] uppercase tracking-wide mb-1">Barberos</p>
              <p className="text-base font-bold text-[var(--color-success)]">{formatCOP(globalMetrics.barberCut)}</p>
              <p className="text-[var(--color-text-secondary)] text-[10px] mt-0.5">todos</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Per-barber breakdown (only when showing all and >1 barber) ── */}
      {!isFiltered && barbers.length > 1 && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
          {barbers.map(barber => {
            const bs = sales.filter(s => s.barber_id === barber.id);
            const { ownerCut, barberCut } = calcCuts(bs);
            const pct = bs[0]?.commission_pct ?? 0;
            return (
              <div key={barber.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-brand)]/20 flex items-center justify-center text-[var(--color-brand-light)] font-bold text-[10px] flex-shrink-0">
                    {barber.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[var(--color-text-primary)] font-medium">{barber.name}</span>
                  <span className="text-[var(--color-text-secondary)]">({pct}%)</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[var(--color-success)]">{formatCOP(barberCut)}</span>
                  <span className="text-[var(--color-text-secondary)]">·</span>
                  <span className="text-[var(--color-text-secondary)] text-[10px]">tuyo: {formatCOP(ownerCut)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sales.length === 0 && (
        <p className="text-center text-[var(--color-text-secondary)] text-xs mt-4">
          Sin ventas registradas hoy.
        </p>
      )}
    </div>
  );
}

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

export default function OwnerUtilities({ sales }: Props) {
  const [selectedBarber, setSelectedBarber] = useState<string>('all');

  // Build unique barber list from sales
  const barbers = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sales) {
      if (s.barber_id && !map.has(s.barber_id)) {
        map.set(s.barber_id, s.barber_name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [sales]);

  // Filter sales by selected barber
  const filtered = useMemo(() =>
    selectedBarber === 'all' ? sales : sales.filter(s => s.barber_id === selectedBarber),
    [sales, selectedBarber]
  );

  // Calculate metrics
  const { ownerCut, barberCut, salesCount } = useMemo(() => {
    let ownerCut = 0;
    let barberCut = 0;
    for (const s of filtered) {
      const pct = s.commission_pct / 100;
      barberCut += s.total * pct;
      ownerCut += s.total * (1 - pct);
    }
    return { ownerCut, barberCut, salesCount: filtered.length };
  }, [filtered]);

  return (
    <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
      {/* Header with filter */}
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

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Owner cut */}
        <div className="bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wide mb-2">
            Mis utilidades
          </p>
          <p className="text-2xl font-bold text-[var(--color-brand-light)]">
            {formatCOP(ownerCut)}
          </p>
          <p className="text-[var(--color-text-secondary)] text-xs mt-1">
            {salesCount} {salesCount === 1 ? 'venta' : 'ventas'}
          </p>
        </div>

        {/* Barbers total cut */}
        <div className="bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg p-4">
          <p className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wide mb-2">
            Utilidades barberos
          </p>
          <p className="text-2xl font-bold text-[var(--color-success)]">
            {formatCOP(barberCut)}
          </p>
          <p className="text-[var(--color-text-secondary)] text-xs mt-1">
            {selectedBarber === 'all' ? 'Todos los barberos' : barbers.find(b => b.id === selectedBarber)?.name}
          </p>
        </div>
      </div>

      {/* Per-barber breakdown (only when showing all) */}
      {selectedBarber === 'all' && barbers.length > 1 && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)] space-y-2">
          {barbers.map(barber => {
            const barberSales = sales.filter(s => s.barber_id === barber.id);
            let bCut = 0, oCut = 0;
            for (const s of barberSales) {
              bCut += s.total * (s.commission_pct / 100);
              oCut += s.total * (1 - s.commission_pct / 100);
            }
            const pct = barberSales[0]?.commission_pct ?? 0;
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
                  <span className="text-[var(--color-success)]">{formatCOP(bCut)}</span>
                  <span className="text-[var(--color-text-secondary)]">·</span>
                  <span className="text-[var(--color-text-secondary)] text-[10px]">tuyo: {formatCOP(oCut)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {salesCount === 0 && (
        <p className="text-center text-[var(--color-text-secondary)] text-xs mt-4">
          Sin ventas registradas hoy
          {selectedBarber !== 'all' && ' para este barbero'}.
        </p>
      )}
    </div>
  );
}

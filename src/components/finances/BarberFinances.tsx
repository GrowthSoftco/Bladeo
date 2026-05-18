import { useState, useEffect, useCallback, useMemo } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BarberFinanceCategory {
  id: string;
  member_id: string;
  name: string;
  type: 'income' | 'expense' | 'debt';
  color: string;
  created_at: string;
}

interface BarberFinanceEntry {
  id: string;
  member_id: string;
  barbershop_id: string;
  type: 'income' | 'expense' | 'debt';
  amount: number;
  category_id: string | null;
  category_name: string | null;
  description: string | null;
  date: string;
  source: 'manual' | 'appointment';
  appointment_id: string | null;
  created_at: string;
}

type Period = 'week' | 'biweek' | 'month' | 'custom';
type Tab    = 'all' | 'income' | 'expense' | 'debt';

interface Props {
  memberId: string;
  barbershopId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getPeriodDates(period: Period, customStart: string, customEnd: string): { start: string; end: string } {
  const today = new Date();
  if (period === 'week') {
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    const mon = new Date(today);
    mon.setDate(today.getDate() + diff);
    return { start: toDateStr(mon), end: toDateStr(today) };
  }
  if (period === 'biweek') {
    const past = new Date(today);
    past.setDate(today.getDate() - 14);
    return { start: toDateStr(past), end: toDateStr(today) };
  }
  if (period === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: toDateStr(first), end: toDateStr(today) };
  }
  return { start: customStart, end: customEnd };
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d} ${months[m - 1]}`;
}

const PRESET_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280'];

// ─── Icons ───────────────────────────────────────────────────────────────────

function IncomeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function ExpenseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

function DebtIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ─── Summary Card ────────────────────────────────────────────────────────────

function SummaryCard({ label, amount, color, subLabel }: { label: string; amount: number; color: string; subLabel?: string }) {
  return (
    <div style={{ background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', borderRadius: '0.75rem', padding: '1rem' }}>
      <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', marginBottom: '0.375rem' }}>
        {label}
      </p>
      <p style={{ fontSize: '1.25rem', fontWeight: 700, color, lineHeight: 1.2 }}>
        {fmt(amount)}
      </p>
      {subLabel && (
        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>{subLabel}</p>
      )}
    </div>
  );
}

// ─── Entry Row ───────────────────────────────────────────────────────────────

function EntryRow({ entry, categories, onDelete }: { entry: BarberFinanceEntry; categories: BarberFinanceCategory[]; onDelete: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const cat = categories.find(c => c.id === entry.category_id);
  const catColor = cat?.color ?? '#6b7280';
  const catName  = cat?.name ?? entry.category_name ?? '';
  const label    = entry.description || catName || (entry.type === 'income' ? 'Ingreso' : entry.type === 'expense' ? 'Egreso' : 'Deuda');

  const amountColor = entry.type === 'income' ? '#22c55e' : '#ef4444';

  async function handleDelete() {
    if (!confirm('¿Eliminar este movimiento?')) return;
    setDeleting(true);
    await onDelete(entry.id);
    setDeleting(false);
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        borderBottom: '1px solid var(--color-border)',
        background: hovered ? 'var(--color-surface-overlay)' : 'transparent',
        transition: 'background 150ms',
      }}
    >
      {/* Colored dot + type icon */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: catColor }} />
        <span style={{ color: entry.type === 'income' ? '#22c55e' : entry.type === 'expense' ? '#ef4444' : '#f59e0b' }}>
          {entry.type === 'income' ? <IncomeIcon /> : entry.type === 'expense' ? <ExpenseIcon /> : <DebtIcon />}
        </span>
      </div>

      {/* Center info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
            {label}
          </span>
          {entry.source === 'appointment' && (
            <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 6px', borderRadius: '9999px', background: 'rgba(37,99,235,0.15)', color: 'var(--color-brand-light)', flexShrink: 0 }}>
              Barbería
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>{formatDate(entry.date)}</span>
          {catName && (
            <span style={{ fontSize: '0.65rem', fontWeight: 500, padding: '1px 6px', borderRadius: '9999px', background: catColor + '22', color: catColor, border: '1px solid ' + catColor + '44' }}>
              {catName}
            </span>
          )}
        </div>
      </div>

      {/* Amount */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: amountColor }}>
          {entry.type === 'income' ? '+' : '-'}{fmt(entry.amount)}
        </span>
        {(hovered || deleting) && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{
              width: 28, height: 28, borderRadius: '0.375rem',
              border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)',
              color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: deleting ? 0.5 : 1,
            }}
            title="Eliminar"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Add Entry Modal ──────────────────────────────────────────────────────────

function AddEntryModal({
  categories,
  onClose,
  onSaved,
}: {
  categories: BarberFinanceCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType]               = useState<'income' | 'expense' | 'debt'>('income');
  const [amount, setAmount]           = useState('');
  const [categoryId, setCategoryId]   = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate]               = useState(toDateStr(new Date()));
  const [source, setSource]           = useState<'manual' | 'appointment'>('manual');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [newCatName, setNewCatName]   = useState('');
  const [showNewCat, setShowNewCat]   = useState(false);
  const [creatingCat, setCreatingCat] = useState(false);

  const filteredCats = categories.filter(c => c.type === type);

  // Reset category when type changes
  useEffect(() => { setCategoryId(''); }, [type]);

  async function handleCreateCategory() {
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      const res = await fetch('/api/finances/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim(), type, color: '#6b7280' }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al crear categoría.'); return; }
      setCategoryId(data.id);
      setNewCatName('');
      setShowNewCat(false);
      onSaved(); // refresh categories in parent
    } finally {
      setCreatingCat(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!amount || Number(amount) <= 0) { setError('Ingresa un monto válido.'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/finances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          amount: Number(amount),
          category_id:   categoryId   || null,
          category_name: filteredCats.find(c => c.id === categoryId)?.name || null,
          description:   description  || null,
          date,
          source,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar.'); return; }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: 'var(--color-surface-elevated)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.625rem 0.75rem',
    fontSize: '0.875rem',
    color: 'var(--color-text-primary)',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--color-text-secondary)',
    marginBottom: '0.375rem',
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', padding: '0',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--color-surface-overlay)',
          border: '1px solid var(--color-border)',
          borderRadius: '1rem 1rem 0 0',
          width: '100%', maxWidth: '480px',
          maxHeight: '90vh', overflowY: 'auto',
          padding: '1.25rem 1.25rem 2rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Agregar movimiento</h3>
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '0.5rem', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Type */}
          <div>
            <label style={labelStyle}>Tipo</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {([['income', 'Ingreso', '#22c55e'], ['expense', 'Egreso', '#ef4444'], ['debt', 'Deuda', '#f59e0b']] as const).map(([val, lbl, color]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setType(val)}
                  style={{
                    flex: 1, padding: '0.5rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600,
                    border: type === val ? `2px solid ${color}` : '1px solid var(--color-border)',
                    background: type === val ? color + '20' : 'var(--color-surface-elevated)',
                    color: type === val ? color : 'var(--color-text-secondary)',
                    cursor: 'pointer', transition: 'all 150ms',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label style={labelStyle}>Monto (COP)</label>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          {/* Category */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Categoría</label>
              <button
                type="button"
                onClick={() => setShowNewCat(s => !s)}
                style={{ fontSize: '0.7rem', color: 'var(--color-brand-light)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                + Nueva
              </button>
            </div>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              style={{ ...inputStyle, appearance: 'none' }}
            >
              <option value="">Sin categoría</option>
              {filteredCats.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {showNewCat && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Nombre de categoría"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={creatingCat}
                  style={{
                    padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600,
                    background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer',
                    opacity: creatingCat ? 0.6 : 1,
                  }}
                >
                  {creatingCat ? '...' : 'Crear'}
                </button>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Descripción (opcional)</label>
            <input
              type="text"
              placeholder="Ej. Propina cliente #5"
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Date */}
          <div>
            <label style={labelStyle}>Fecha</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          {/* Source */}
          <div>
            <label style={labelStyle}>Origen</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {([['manual', 'Manual'], ['appointment', 'Barbería']] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSource(val)}
                  style={{
                    flex: 1, padding: '0.5rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600,
                    border: source === val ? '2px solid var(--color-brand)' : '1px solid var(--color-border)',
                    background: source === val ? 'rgba(37,99,235,0.15)' : 'var(--color-surface-elevated)',
                    color: source === val ? 'var(--color-brand-light)' : 'var(--color-text-secondary)',
                    cursor: 'pointer', transition: 'all 150ms',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p style={{ fontSize: '0.8rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
              {error}
            </p>
          )}

          {/* Submit */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600,
                border: '1px solid var(--color-border)', background: 'var(--color-surface-elevated)',
                color: 'var(--color-text-secondary)', cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 1, padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600,
                background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer',
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Category Manager ─────────────────────────────────────────────────────────

function CategoryManager({ categories, onRefresh }: { categories: BarberFinanceCategory[]; onRefresh: () => void }) {
  const [open, setOpen]       = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'income' | 'expense' | 'debt'>('income');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  const grouped = useMemo(() => ({
    income:  categories.filter(c => c.type === 'income'),
    expense: categories.filter(c => c.type === 'expense'),
    debt:    categories.filter(c => c.type === 'debt'),
  }), [categories]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/finances/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), type: newType, color: newColor }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error.'); return; }
      setNewName('');
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta categoría?')) return;
    await fetch(`/api/finances/categories?id=${id}`, { method: 'DELETE' });
    onRefresh();
  }

  const sectionLabel: Record<string, string> = { income: 'Ingresos', expense: 'Egresos', debt: 'Deudas' };
  const sectionColor: Record<string, string> = { income: '#22c55e', expense: '#ef4444', debt: '#f59e0b' };

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-surface-elevated)',
    border: '1px solid var(--color-border)',
    borderRadius: '0.5rem',
    padding: '0.5rem 0.75rem',
    fontSize: '0.8rem',
    color: 'var(--color-text-primary)',
    outline: 'none',
  };

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: '0.75rem', overflow: 'hidden', marginTop: '1.5rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.875rem 1rem',
          background: 'var(--color-surface-elevated)',
          border: 'none', cursor: 'pointer',
          color: 'var(--color-text-secondary)', fontSize: '0.8rem', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}
      >
        <span>Administrar categorías</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div style={{ padding: '1rem', background: 'var(--color-surface-overlay)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(['income', 'expense', 'debt'] as const).map(type => (
            <div key={type}>
              <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: sectionColor[type], marginBottom: '0.5rem' }}>
                {sectionLabel[type]}
              </p>
              {grouped[type].length === 0 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>Sin categorías</p>
              )}
              {grouped[type].map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{cat.name}</span>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    style={{ width: 24, height: 24, borderRadius: '0.25rem', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          ))}

          {/* Add new category */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
              + Agregar categoría
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Nombre"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value as any)}
                  style={{ ...inputStyle, flex: 1, appearance: 'none' }}
                >
                  <option value="income">Ingreso</option>
                  <option value="expense">Egreso</option>
                  <option value="debt">Deuda</option>
                </select>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      style={{
                        width: 20, height: 20, borderRadius: '50%', background: c, border: 'none', cursor: 'pointer',
                        outline: newColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px',
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
              </div>
              {error && <p style={{ fontSize: '0.75rem', color: '#ef4444' }}>{error}</p>}
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
                style={{
                  padding: '0.5rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600,
                  background: 'var(--color-brand)', color: '#fff', border: 'none', cursor: 'pointer',
                  opacity: (saving || !newName.trim()) ? 0.5 : 1,
                }}
              >
                {saving ? 'Creando...' : 'Crear categoría'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BarberFinances({ memberId, barbershopId }: Props) {
  const [period, setPeriod]           = useState<Period>('month');
  const [customStart, setCustomStart] = useState(toDateStr(new Date()));
  const [customEnd, setCustomEnd]     = useState(toDateStr(new Date()));
  const [entries, setEntries]         = useState<BarberFinanceEntry[]>([]);
  const [categories, setCategories]   = useState<BarberFinanceCategory[]>([]);
  const [activeTab, setActiveTab]     = useState<Tab>('all');
  const [showModal, setShowModal]     = useState(false);
  const [loading, setLoading]         = useState(true);
  const [apiError, setApiError]       = useState<string | null>(null);

  const { start, end } = getPeriodDates(period, customStart, customEnd);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const params = new URLSearchParams({ start, end });
      const res = await fetch(`/api/finances?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error ?? `Error ${res.status}`);
        return;
      }
      setEntries(data.entries ?? []);
      setCategories(data.categories ?? []);
    } catch (e: any) {
      setApiError(e.message ?? 'Error de red');
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleDelete(id: string) {
    await fetch(`/api/finances/${id}`, { method: 'DELETE' });
    setEntries(prev => prev.filter(e => e.id !== id));
  }

  // Summary totals
  const totals = useMemo(() => {
    const income  = entries.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0);
    const expense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0);
    const debt    = entries.filter(e => e.type === 'debt').reduce((s, e) => s + Number(e.amount), 0);
    return { income, expense, debt, balance: income - expense };
  }, [entries]);

  // Filtered entries for tab
  const filteredEntries = useMemo(() => {
    if (activeTab === 'all') return entries;
    return entries.filter(e => e.type === activeTab);
  }, [entries, activeTab]);

  const tabCounts = useMemo(() => ({
    all:     entries.length,
    income:  entries.filter(e => e.type === 'income').length,
    expense: entries.filter(e => e.type === 'expense').length,
    debt:    entries.filter(e => e.type === 'debt').length,
  }), [entries]);

  const periodLabels: Record<Period, string> = {
    week:   'Semana',
    biweek: '15 días',
    month:  'Mes',
    custom: 'Personalizado',
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.375rem 0.875rem',
    borderRadius: '9999px',
    fontSize: '0.8rem',
    fontWeight: 600,
    border: active ? '1.5px solid var(--color-brand)' : '1px solid var(--color-border)',
    background: active ? 'rgba(37,99,235,0.15)' : 'var(--color-surface-elevated)',
    color: active ? 'var(--color-brand-light)' : 'var(--color-text-secondary)',
    cursor: 'pointer',
    transition: 'all 150ms',
    whiteSpace: 'nowrap' as const,
  });

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.5rem 0.875rem',
    borderRadius: '0.5rem',
    fontSize: '0.8rem',
    fontWeight: 600,
    border: 'none',
    background: active ? 'var(--color-brand)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    cursor: 'pointer',
    transition: 'all 150ms',
    display: 'flex', alignItems: 'center', gap: '0.375rem',
  });

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', paddingBottom: '5rem' }}>
      {/* Page title */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.2 }}>Mis Finanzas</h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
          Registra tus ingresos, egresos y deudas personales
        </p>
      </div>

      {/* Error banner */}
      {apiError && (
        <div style={{ marginBottom: '1rem', padding: '0.875rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.75rem', color: '#ef4444', fontSize: '0.85rem' }}>
          ⚠️ Error al cargar datos: <strong>{apiError}</strong>
          <button onClick={fetchData} style={{ marginLeft: '1rem', textDecoration: 'underline', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.85rem' }}>
            Reintentar
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <SummaryCard label="Ingresos" amount={totals.income} color="#22c55e" />
        <SummaryCard label="Egresos"  amount={totals.expense} color="#ef4444" />
        <SummaryCard
          label="Balance"
          amount={totals.balance}
          color={totals.balance >= 0 ? '#22c55e' : '#ef4444'}
        />
        <SummaryCard label="Deudas" amount={totals.debt} color="#f59e0b" />
      </div>

      {/* Period filter chips */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {(['week', 'biweek', 'month', 'custom'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={chipStyle(period === p)}>
              {periodLabels[p]}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', alignItems: 'center' }}>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              style={{
                flex: 1, background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)',
                borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.8rem',
                color: 'var(--color-text-primary)', outline: 'none',
              }}
            />
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>→</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              style={{
                flex: 1, background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)',
                borderRadius: '0.5rem', padding: '0.5rem 0.75rem', fontSize: '0.8rem',
                color: 'var(--color-text-primary)', outline: 'none',
              }}
            />
          </div>
        )}
      </div>

      {/* Tab filter */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: 'var(--color-surface-elevated)', borderRadius: '0.625rem', padding: '0.25rem' }}>
        {([['all', 'Todo'], ['income', 'Ingresos'], ['expense', 'Egresos'], ['debt', 'Deudas']] as [Tab, string][]).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={tabStyle(activeTab === tab)}>
            {label}
            <span style={{
              fontSize: '0.65rem', fontWeight: 700,
              background: activeTab === tab ? 'rgba(255,255,255,0.25)' : 'var(--color-surface-overlay)',
              color: activeTab === tab ? '#fff' : 'var(--color-text-secondary)',
              borderRadius: '9999px', padding: '1px 6px',
              minWidth: 18, textAlign: 'center',
            }}>
              {tabCounts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Entry list */}
      <div style={{ border: '1px solid var(--color-border)', borderRadius: '0.75rem', overflow: 'hidden', background: 'var(--color-surface-elevated)' }}>
        {loading ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
            Cargando...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>💸</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
              Sin movimientos en este período. ¡Agrega tu primer ingreso!
            </p>
          </div>
        ) : (
          filteredEntries.map(entry => (
            <EntryRow key={entry.id} entry={entry} categories={categories} onDelete={handleDelete} />
          ))
        )}
      </div>

      {/* Category manager */}
      <CategoryManager categories={categories} onRefresh={fetchData} />

      {/* FAB */}
      <button
        onClick={() => setShowModal(true)}
        style={{
          position: 'fixed', bottom: '5.5rem', right: '1.25rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1.25rem',
          borderRadius: '9999px',
          background: 'var(--color-brand)',
          color: '#fff',
          border: 'none', cursor: 'pointer',
          fontSize: '0.875rem', fontWeight: 700,
          boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
          zIndex: 40,
        }}
      >
        <PlusIcon />
        Agregar
      </button>

      {/* Add entry modal */}
      {showModal && (
        <AddEntryModal
          categories={categories}
          onClose={() => setShowModal(false)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';

interface Member { id: string; display_name: string; }
interface Block {
  id: string; barber_id: string; date: string;
  start_time: string | null; end_time: string | null; reason: string | null;
}

interface Props {
  barbers: Member[];
  isOwner: boolean;
  currentMemberId: string;
  initialDate: string;
  onClose: () => void;
  onSaved: () => void;
}

function toLabel(t: string | null) {
  return t ? t.slice(0, 5) : null;
}

export default function BlockModal({ barbers, isOwner, currentMemberId, initialDate, onClose, onSaved }: Props) {
  const [barberId, setBarberId]     = useState(isOwner ? (barbers[0]?.id ?? currentMemberId) : currentMemberId);
  const [date, setDate]             = useState(initialDate);
  const [fullDay, setFullDay]       = useState(false);
  const [startTime, setStartTime]   = useState('09:00');
  const [endTime, setEndTime]       = useState('10:00');
  const [reason, setReason]         = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [blocks, setBlocks]         = useState<Block[]>([]);
  const [deleting, setDeleting]     = useState<string | null>(null);

  // Fetch existing blocks whenever barber or date changes
  useEffect(() => {
    if (!barberId || !date) return;
    fetch(`/api/blocks?barber_id=${barberId}&date=${date}`)
      .then(r => r.json())
      .then(d => setBlocks(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [barberId, date]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullDay && startTime >= endTime) {
      setError('La hora de fin debe ser posterior a la de inicio.'); return;
    }
    setSaving(true); setError('');
    const res = await fetch('/api/blocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barber_id: barberId, date, start_time: startTime, end_time: endTime, reason, full_day: fullDay }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Error al guardar.'); setSaving(false); return; }
    setBlocks(prev => [...prev, data]);
    setReason(''); setSaving(false);
    onSaved();
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    await fetch(`/api/blocks/${id}`, { method: 'DELETE' });
    setBlocks(prev => prev.filter(b => b.id !== id));
    setDeleting(null);
    onSaved();
  }

  const barberName = (id: string) => barbers.find(b => b.id === id)?.display_name ?? 'Barbero';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-[var(--color-text-primary)]">Bloquear tiempo</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">El tiempo bloqueado no estará disponible para reservas</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 border-b border-[var(--color-border)]">
            {error && <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">{error}</div>}

            {/* Barber (owner only) */}
            {isOwner && (
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Barbero</label>
                <select value={barberId} onChange={e => setBarberId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]">
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
                </select>
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]" />
            </div>

            {/* Full day toggle */}
            <div className="flex items-center justify-between p-3 bg-[var(--color-surface-overlay)] rounded-lg border border-[var(--color-border)]">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Bloquear todo el día</p>
                <p className="text-xs text-[var(--color-text-secondary)]">No habrá disponibilidad en todo el día</p>
              </div>
              <button type="button" onClick={() => setFullDay(v => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${fullDay ? 'bg-red-500' : 'bg-[var(--color-border)]'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${fullDay ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Time range */}
            {!fullDay && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Desde</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Hasta</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]" />
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Motivo <span className="text-[var(--color-text-secondary)] font-normal">(opcional)</span></label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Descanso, cita médica, almuerzo…"
                className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] text-sm focus:outline-none focus:border-[var(--color-brand)]" />
            </div>

            <button type="submit" disabled={saving}
              className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
              {saving ? 'Guardando…' : fullDay ? '🚫 Bloquear día completo' : '🚫 Bloquear horario'}
            </button>
          </form>

          {/* Existing blocks */}
          <div className="p-6">
            <p className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
              Bloqueos activos — {date}
            </p>
            {blocks.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)] text-center py-4">Sin bloqueos para este día</p>
            ) : (
              <div className="space-y-2">
                {blocks.map(b => (
                  <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-3 bg-red-500/8 border border-red-500/20 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {b.start_time === null ? '🚫 Todo el día' : `${toLabel(b.start_time)} — ${toLabel(b.end_time)}`}
                      </p>
                      <p className="text-xs text-[var(--color-text-secondary)] truncate">
                        {isOwner ? barberName(b.barber_id) + (b.reason ? ` · ${b.reason}` : '') : (b.reason ?? 'Sin motivo')}
                      </p>
                    </div>
                    <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id}
                      className="text-red-400 hover:text-red-300 flex-shrink-0 disabled:opacity-40 transition-colors">
                      {deleting === b.id
                        ? <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

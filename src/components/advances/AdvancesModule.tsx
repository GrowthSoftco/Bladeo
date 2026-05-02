import { useState, useEffect, useCallback } from 'react';

interface Member {
  id: string;
  display_name: string;
  commission_pct: number;
  role: string;
  is_active: boolean;
}

interface Advance {
  id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  notes: string | null;
  requested_at: string;
  approved_at: string | null;
  paid_at: string | null;
  barber: { id: string; display_name: string; commission_pct: number } | null;
  approver: { id: string; display_name: string } | null;
}

interface Settings {
  advance_min: number;
  advance_max: number;
}

const STATUS_STYLE: Record<string, string> = {
  pending:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  approved: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
  paid:     'bg-green-500/15 text-green-400 border-green-500/30',
};
const STATUS_LABEL: Record<string, string> = {
  pending:  'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  paid:     'Pagado',
};

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Props { isOwner: boolean; currentMemberId: string; }

export default function AdvancesModule({ isOwner, currentMemberId }: Props) {
  const [advances, setAdvances]     = useState<Advance[]>([]);
  const [members, setMembers]       = useState<Member[]>([]);
  const [settings, setSettings]     = useState<Settings>({ advance_min: 50000, advance_max: 500000 });
  const [loading, setLoading]       = useState(true);
  const [filterBarber, setFilterBarber] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Modals
  const [showNew, setShowNew]             = useState(false);
  const [showSettings, setShowSettings]   = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New advance form
  const [newForm, setNewForm] = useState({
    barber_id: '',
    amount: '',
    notes: '',
  });
  const [newError, setNewError] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState({ advance_min: '', advance_max: '' });
  const [settingsError, setSettingsError] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    let url = '/api/advances?';
    if (filterBarber) url += `barber_id=${filterBarber}&`;
    if (filterStatus) url += `status=${filterStatus}&`;

    const [advsRes, settRes] = await Promise.all([
      fetch(url).then(r => r.json()),
      fetch('/api/advances/settings').then(r => r.json()),
    ]);
    setAdvances(Array.isArray(advsRes) ? advsRes : []);
    if (settRes.advance_min !== undefined) {
      setSettings(settRes);
      setSettingsForm({ advance_min: String(settRes.advance_min), advance_max: String(settRes.advance_max) });
    }
    setLoading(false);
  }, [filterBarber, filterStatus]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (!isOwner) return;
    fetch('/api/members').then(r => r.json()).then(d =>
      setMembers(Array.isArray(d) ? d.filter((m: Member) => m.is_active !== false) : [])
    );
  }, [isOwner]);

  // Pre-fill barber for non-owners
  useEffect(() => {
    if (!isOwner && !newForm.barber_id) setNewForm(f => ({ ...f, barber_id: currentMemberId }));
  }, [isOwner, currentMemberId]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalPending  = advances.filter(a => a.status === 'pending').reduce((s, a) => s + a.amount, 0);
  const totalApproved = advances.filter(a => a.status === 'approved').reduce((s, a) => s + a.amount, 0);
  const totalPaid     = advances.filter(a => a.status === 'paid').reduce((s, a) => s + a.amount, 0);

  // ── Actions ────────────────────────────────────────────────────────────────
  async function updateStatus(id: string, status: string) {
    setActionLoading(id + status);
    await fetch(`/api/advances/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setActionLoading(null);
    fetchAll();
  }

  async function deleteAdvance(id: string) {
    if (!confirm('¿Eliminar este anticipo?')) return;
    setActionLoading(id + 'del');
    await fetch(`/api/advances/${id}`, { method: 'DELETE' });
    setActionLoading(null);
    fetchAll();
  }

  async function handleNewSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNewError('');
    if (!newForm.barber_id || !newForm.amount) { setNewError('Completa todos los campos.'); return; }
    const amount = Number(newForm.amount);
    if (amount < settings.advance_min)
      { setNewError(`El mínimo de anticipo es ${fmt(settings.advance_min)}.`); return; }
    if (settings.advance_max > 0 && amount > settings.advance_max)
      { setNewError(`El máximo de anticipo es ${fmt(settings.advance_max)}.`); return; }
    setSavingNew(true);
    const res  = await fetch('/api/advances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ barber_id: newForm.barber_id, amount, notes: newForm.notes }),
    });
    const data = await res.json();
    setSavingNew(false);
    if (!res.ok) { setNewError(data.error ?? 'Error al registrar.'); return; }
    setShowNew(false);
    setNewForm({ barber_id: isOwner ? '' : currentMemberId, amount: '', notes: '' });
    fetchAll();
  }

  async function handleSettingsSave() {
    setSettingsError('');
    const min = Number(settingsForm.advance_min);
    const max = Number(settingsForm.advance_max);
    if (isNaN(min) || isNaN(max)) { setSettingsError('Valores inválidos.'); return; }
    if (min > max) { setSettingsError('El mínimo no puede superar el máximo.'); return; }
    setSavingSettings(true);
    const res  = await fetch('/api/advances/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ advance_min: min, advance_max: max }),
    });
    const data = await res.json();
    setSavingSettings(false);
    if (!res.ok) { setSettingsError(data.error ?? 'Error al guardar.'); return; }
    setSettings({ advance_min: data.advance_min, advance_max: data.advance_max });
    setShowSettings(false);
  }

  const barberName = (id: string) => members.find(m => m.id === id)?.display_name ?? 'Barbero';

  return (
    <div className="space-y-6">

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
          <p className="text-[var(--color-text-secondary)] text-xs mb-1">Límites configurados</p>
          <p className="text-lg font-bold text-[var(--color-text-primary)]">{fmt(settings.advance_min)}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">mín · máx {fmt(settings.advance_max)}</p>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
          <p className="text-[var(--color-text-secondary)] text-xs mb-1">Pendientes</p>
          <p className="text-lg font-bold text-amber-400">{fmt(totalPending)}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {advances.filter(a => a.status === 'pending').length} solicitud{advances.filter(a => a.status === 'pending').length !== 1 ? 'es' : ''}
          </p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5">
          <p className="text-[var(--color-text-secondary)] text-xs mb-1">Aprobados (por pagar)</p>
          <p className="text-lg font-bold text-blue-400">{fmt(totalApproved)}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {advances.filter(a => a.status === 'approved').length} anticipo{advances.filter(a => a.status === 'approved').length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-5">
          <p className="text-[var(--color-text-secondary)] text-xs mb-1">Pagados (descontados)</p>
          <p className="text-lg font-bold text-green-400">{fmt(totalPaid)}</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {advances.filter(a => a.status === 'paid').length} liquidado{advances.filter(a => a.status === 'paid').length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filters */}
        {isOwner && (
          <select value={filterBarber} onChange={e => setFilterBarber(e.target.value)}
            className="px-3 py-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)]">
            <option value="">Todos los barberos</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)]">
          <option value="">Todos los estados</option>
          <option value="pending">Pendientes</option>
          <option value="approved">Aprobados</option>
          <option value="rejected">Rechazados</option>
          <option value="paid">Pagados</option>
        </select>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-2">
          {isOwner && (
            <button onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm rounded-lg transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Configurar límites
            </button>
          )}
          <button onClick={() => { setNewError(''); setShowNew(true); }}
            className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors">
            + {isOwner ? 'Registrar anticipo' : 'Solicitar anticipo'}
          </button>
        </div>
      </div>

      {/* ── Advances list ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-[var(--color-surface-elevated)] rounded-xl animate-pulse" />)}
        </div>
      ) : advances.length === 0 ? (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-16 text-center">
          <div className="w-12 h-12 bg-[var(--color-surface-overlay)] rounded-full flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-text-secondary)]">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
          <p className="text-[var(--color-text-primary)] font-semibold mb-1">Sin anticipos registrados</p>
          <p className="text-[var(--color-text-secondary)] text-sm">
            {isOwner ? 'Registra anticipos para descontarlos en la liquidación.' : 'Solicita un anticipo de tu liquidación.'}
          </p>
        </div>
      ) : (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {isOwner && <th className="text-left px-5 py-3 text-[var(--color-text-secondary)] font-medium">Barbero</th>}
                  <th className="text-right px-5 py-3 text-[var(--color-text-secondary)] font-medium">Monto</th>
                  <th className="text-left px-5 py-3 text-[var(--color-text-secondary)] font-medium">Estado</th>
                  <th className="text-left px-5 py-3 text-[var(--color-text-secondary)] font-medium hidden md:table-cell">Notas</th>
                  <th className="text-left px-5 py-3 text-[var(--color-text-secondary)] font-medium hidden lg:table-cell">Fecha</th>
                  {isOwner && <th className="px-5 py-3 text-[var(--color-text-secondary)] font-medium text-center">Acciones</th>}
                  {!isOwner && <th className="px-3 py-3" />}
                </tr>
              </thead>
              <tbody>
                {advances.map(adv => (
                  <tr key={adv.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-overlay)] transition-colors">
                    {isOwner && (
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[var(--color-brand)]/20 flex items-center justify-center text-xs font-bold text-[var(--color-brand-light)] flex-shrink-0">
                            {(adv.barber?.display_name ?? '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="text-[var(--color-text-primary)] font-medium">{adv.barber?.display_name ?? '—'}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-4 text-right">
                      <span className="font-bold text-[var(--color-text-primary)] text-base">{fmt(adv.amount)}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[adv.status]}`}>
                        {STATUS_LABEL[adv.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)] hidden md:table-cell max-w-[160px] truncate">
                      {adv.notes ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)] hidden lg:table-cell whitespace-nowrap">
                      {fmtDate(adv.requested_at)}
                      {adv.paid_at && <span className="block text-xs text-green-400">Pagado: {fmtDate(adv.paid_at)}</span>}
                    </td>
                    {isOwner && (
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {adv.status === 'pending' && (
                            <>
                              <button
                                disabled={!!actionLoading}
                                onClick={() => updateStatus(adv.id, 'approved')}
                                className="px-2.5 py-1 text-xs font-medium bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 rounded-lg transition-colors disabled:opacity-50">
                                Aprobar
                              </button>
                              <button
                                disabled={!!actionLoading}
                                onClick={() => updateStatus(adv.id, 'rejected')}
                                className="px-2.5 py-1 text-xs font-medium bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-lg transition-colors disabled:opacity-50">
                                Rechazar
                              </button>
                            </>
                          )}
                          {adv.status === 'approved' && (
                            <button
                              disabled={!!actionLoading}
                              onClick={() => updateStatus(adv.id, 'paid')}
                              className="px-2.5 py-1 text-xs font-medium bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 rounded-lg transition-colors disabled:opacity-50">
                              Marcar pagado
                            </button>
                          )}
                          {(adv.status === 'pending' || adv.status === 'rejected') && (
                            <button
                              disabled={!!actionLoading}
                              onClick={() => deleteAdvance(adv.id)}
                              className="p-1.5 text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6"/><path d="M14 11v6"/>
                              </svg>
                            </button>
                          )}
                          {adv.status === 'paid' && (
                            <span className="text-xs text-[var(--color-text-secondary)] italic">Liquidado</span>
                          )}
                        </div>
                      </td>
                    )}
                    {!isOwner && (
                      <td className="px-3 py-4">
                        {adv.status === 'pending' && (
                          <button onClick={() => deleteAdvance(adv.id)} disabled={!!actionLoading}
                            className="p-1.5 text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                              <path d="M10 11v6"/><path d="M14 11v6"/>
                            </svg>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-[var(--color-border)]">
            {advances.map(adv => (
              <div key={adv.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    {isOwner && <p className="text-sm font-semibold text-[var(--color-text-primary)]">{adv.barber?.display_name ?? '—'}</p>}
                    <p className="text-xl font-bold text-[var(--color-text-primary)]">{fmt(adv.amount)}</p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{fmtDate(adv.requested_at)}</p>
                  </div>
                  <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[adv.status]}`}>
                    {STATUS_LABEL[adv.status]}
                  </span>
                </div>
                {adv.notes && <p className="text-xs text-[var(--color-text-secondary)] mb-2">{adv.notes}</p>}
                {isOwner && adv.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(adv.id, 'approved')} disabled={!!actionLoading}
                      className="flex-1 py-1.5 text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-lg disabled:opacity-50">Aprobar</button>
                    <button onClick={() => updateStatus(adv.id, 'rejected')} disabled={!!actionLoading}
                      className="flex-1 py-1.5 text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg disabled:opacity-50">Rechazar</button>
                  </div>
                )}
                {isOwner && adv.status === 'approved' && (
                  <button onClick={() => updateStatus(adv.id, 'paid')} disabled={!!actionLoading}
                    className="w-full py-1.5 text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/30 rounded-lg disabled:opacity-50">
                    Marcar como pagado
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── New advance modal ──────────────────────────────────────────────── */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
              <div>
                <h2 className="font-semibold text-[var(--color-text-primary)]">
                  {isOwner ? 'Registrar anticipo' : 'Solicitar anticipo'}
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  Rango permitido: {fmt(settings.advance_min)} — {fmt(settings.advance_max)}
                </p>
              </div>
              <button onClick={() => setShowNew(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleNewSubmit} className="p-6 space-y-4">
              {newError && <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{newError}</div>}

              {isOwner && (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Barbero *</label>
                  <select value={newForm.barber_id} onChange={e => setNewForm(f => ({ ...f, barber_id: e.target.value }))} required
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]">
                    <option value="">Seleccionar barbero...</option>
                    {members.filter(m => m.role !== 'owner').map(m => <option key={m.id} value={m.id}>{m.display_name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Monto del anticipo *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] text-sm font-medium">$</span>
                  <input
                    type="number" min={settings.advance_min} max={settings.advance_max} step="1000"
                    value={newForm.amount}
                    onChange={e => setNewForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder={`${settings.advance_min.toLocaleString('es-CO')} – ${settings.advance_max.toLocaleString('es-CO')}`}
                    required
                    className="w-full pl-8 pr-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                  Motivo <span className="text-[var(--color-text-secondary)] font-normal">(opcional)</span>
                </label>
                <input
                  value={newForm.notes}
                  onChange={e => setNewForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Ej: Urgencia médica, gastos personales..."
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] text-sm focus:outline-none focus:border-[var(--color-brand)]" />
              </div>

              {isOwner && (
                <div className="flex items-start gap-2.5 p-3 bg-blue-500/8 border border-blue-500/20 rounded-lg">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <p className="text-xs text-blue-400">Los anticipos registrados por el administrador se aprueban automáticamente y se descontarán en la liquidación del barbero.</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowNew(false)}
                  className="flex-1 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm font-medium rounded-lg transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={savingNew}
                  className="flex-1 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                  {savingNew ? 'Guardando...' : isOwner ? 'Registrar anticipo' : 'Solicitar anticipo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Settings modal (owner only) ────────────────────────────────────── */}
      {showSettings && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
              <div>
                <h2 className="font-semibold text-[var(--color-text-primary)]">Límites de anticipo</h2>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Define el rango permitido para toda la barbería</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {settingsError && <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{settingsError}</div>}

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Anticipo mínimo</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] text-sm">$</span>
                  <input type="number" min="0" step="1000"
                    value={settingsForm.advance_min}
                    onChange={e => setSettingsForm(f => ({ ...f, advance_min: e.target.value }))}
                    className="w-full pl-8 pr-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
                    placeholder="50000" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Anticipo máximo</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] text-sm">$</span>
                  <input type="number" min="0" step="1000"
                    value={settingsForm.advance_max}
                    onChange={e => setSettingsForm(f => ({ ...f, advance_max: e.target.value }))}
                    className="w-full pl-8 pr-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
                    placeholder="500000" />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowSettings(false)}
                  className="flex-1 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg hover:text-[var(--color-text-primary)] transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSettingsSave} disabled={savingSettings}
                  className="flex-1 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                  {savingSettings ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

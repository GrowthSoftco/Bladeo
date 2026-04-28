import { useState, useEffect, useCallback } from 'react';

interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  total_visits: number;
  total_spent: number;
  last_visit_at: string | null;
}

function formatCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', year: 'numeric' });
}

const emptyForm = { name: '', phone: '', email: '', notes: '' };

export default function ClientsManager() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const fetchClients = useCallback(async (q = '') => {
    setLoading(true);
    const res = await fetch(`/api/clients${q ? `?search=${encodeURIComponent(q)}` : ''}`);
    const data = await res.json();
    setClients(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  useEffect(() => {
    const timer = setTimeout(() => fetchClients(search), 300);
    return () => clearTimeout(timer);
  }, [search, fetchClients]);

  function openCreate() {
    setEditing(null); setForm(emptyForm); setError(''); setShowModal(true);
  }
  function openEdit(c: Client) {
    setEditing(c); setForm({ name: c.name, phone: c.phone ?? '', email: c.email ?? '', notes: c.notes ?? '' }); setError(''); setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    const url = editing ? `/api/clients/${editing.id}` : '/api/clients';
    const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Error al guardar.'); setSaving(false); return; }
    setShowModal(false);
    fetchClients(search);
    setSaving(false);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    const res = await fetch(`/api/clients/${deleteTarget.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDeleteError(data.error ?? 'No se pudo eliminar el cliente.');
      setDeleting(false);
      return;
    }
    setDeleteTarget(null);
    setDeleting(false);
    fetchClients(search);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Clientes</h1>
          <p className="text-[var(--color-text-secondary)]">{clients.length} cliente{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors">
          + Agregar cliente
        </button>
      </div>

      <div className="mb-6">
        <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre..."
          className="w-full max-w-md px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm transition-colors" />
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl animate-pulse" />)}</div>
      ) : clients.length === 0 ? (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl flex flex-col items-center justify-center py-16 text-center">
          <div className="text-4xl mb-4">👥</div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{search ? 'Sin resultados' : 'Sin clientes aún'}</h3>
          <p className="text-[var(--color-text-secondary)] text-sm mb-4">{search ? 'Prueba con otro término de búsqueda.' : 'Agrega tu primer cliente.'}</p>
          {!search && <button onClick={openCreate} className="px-4 py-2 bg-[var(--color-brand)] text-white text-sm font-semibold rounded-lg">+ Agregar cliente</button>}
        </div>
      ) : (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-6 py-4 text-[var(--color-text-secondary)] font-medium">Cliente</th>
                  <th className="text-left px-6 py-4 text-[var(--color-text-secondary)] font-medium hidden sm:table-cell">Teléfono</th>
                  <th className="text-left px-6 py-4 text-[var(--color-text-secondary)] font-medium hidden md:table-cell">Visitas</th>
                  <th className="text-left px-6 py-4 text-[var(--color-text-secondary)] font-medium hidden md:table-cell">Total</th>
                  <th className="text-left px-6 py-4 text-[var(--color-text-secondary)] font-medium hidden lg:table-cell">Última visita</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {clients.map(c => (
                  <tr key={c.id} className="hover:bg-[var(--color-surface-overlay)] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[var(--color-brand)]/20 flex items-center justify-center text-[#3b82f6] font-bold text-sm flex-shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <a href={`/app/clients/${c.id}`} className="font-medium text-[var(--color-text-primary)] hover:text-[#3b82f6] transition-colors">{c.name}</a>
                          {c.email && <p className="text-[var(--color-text-secondary)] text-xs">{c.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)] hidden sm:table-cell">{c.phone ?? '—'}</td>
                    <td className="px-6 py-4 text-[var(--color-text-primary)] hidden md:table-cell">{c.total_visits}</td>
                    <td className="px-6 py-4 text-[var(--color-text-primary)] hidden md:table-cell">{formatCOP(c.total_spent ?? 0)}</td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)] hidden lg:table-cell">{c.last_visit_at ? formatDate(c.last_visit_at) : '—'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3 justify-end">
                        <button onClick={() => openEdit(c)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xs font-medium transition-colors">Editar</button>
                        <button onClick={() => setDeleteTarget(c)} className="text-[var(--color-text-secondary)] hover:text-[#ef4444] text-xs font-medium transition-colors">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!deleting) { setDeleteTarget(null); setDeleteError(''); } }} />
          <div className="relative bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)] text-center mb-1">
              ¿Eliminar a {deleteTarget.name}?
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)] text-center mb-5">
              Se eliminará de tu lista de clientes de forma permanente.
            </p>
            {deleteError && (
              <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs text-center">
                {deleteError}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(''); }}
                disabled={deleting}
                className="flex-1 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit / create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
              <h2 className="font-semibold text-[var(--color-text-primary)]">{editing ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button onClick={() => setShowModal(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="px-4 py-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg text-[#ef4444] text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Nombre *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Juan Pérez"
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Teléfono</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="300 123 4567"
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="correo@ejemplo.com"
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Preferencias, alergias, etc."
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border)] transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

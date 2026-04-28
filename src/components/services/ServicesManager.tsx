import { useState, useEffect } from 'react';

interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
}

function formatCOP(amount: number) {
  return '$' + Math.round(amount).toLocaleString('es-CO').replace(/,/g, '.');
}

const emptyForm = { name: '', description: '', price: '', duration_minutes: '30', is_active: true };

export default function ServicesManager() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { fetchServices(); }, []);

  async function fetchServices() {
    setLoading(true);
    const res = await fetch('/api/services');
    const data = await res.json();
    setServices(data ?? []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  }

  function openEdit(svc: Service) {
    setEditing(svc);
    setForm({ name: svc.name, description: svc.description ?? '', price: String(svc.price), duration_minutes: String(svc.duration_minutes), is_active: svc.is_active });
    setError('');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = { ...form, price: Number(form.price), duration_minutes: Number(form.duration_minutes) };
    const url = editing ? `/api/services/${editing.id}` : '/api/services';
    const method = editing ? 'PUT' : 'POST';

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();

    if (!res.ok) { setError(data.error ?? 'Error al guardar.'); setSaving(false); return; }

    setShowModal(false);
    fetchServices();
    setSaving(false);
  }

  async function toggleActive(svc: Service) {
    await fetch(`/api/services/${svc.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...svc, is_active: !svc.is_active }),
    });
    fetchServices();
  }

  async function handleDelete(svc: Service) {
    if (!confirm(`¿Eliminar "${svc.name}"? Esta acción no se puede deshacer.`)) return;
    await fetch(`/api/services/${svc.id}`, { method: 'DELETE' });
    fetchServices();
  }

  const durations = [15, 20, 30, 45, 60, 75, 90, 120];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Servicios</h1>
          <p className="text-[var(--color-text-secondary)]">{services.length} servicio{services.length !== 1 ? 's' : ''} configurado{services.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors">
          + Nuevo servicio
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl animate-pulse" />)}
        </div>
      ) : services.length === 0 ? (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl flex flex-col items-center justify-center py-16 text-center">
          <div className="text-4xl mb-4">✂️</div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Sin servicios aún</h3>
          <p className="text-[var(--color-text-secondary)] text-sm mb-4">Agrega los servicios que ofrece tu barbería.</p>
          <button onClick={openCreate} className="px-4 py-2 bg-[var(--color-brand)] text-white text-sm font-semibold rounded-lg">
            + Nuevo servicio
          </button>
        </div>
      ) : (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-6 py-4 text-[var(--color-text-secondary)] font-medium">Servicio</th>
                <th className="text-left px-6 py-4 text-[var(--color-text-secondary)] font-medium">Precio</th>
                <th className="text-left px-6 py-4 text-[var(--color-text-secondary)] font-medium hidden sm:table-cell">Duración</th>
                <th className="text-left px-6 py-4 text-[var(--color-text-secondary)] font-medium">Estado</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {services.map(svc => (
                <tr key={svc.id} className="hover:bg-[var(--color-surface-overlay)] transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-[var(--color-text-primary)]">{svc.name}</p>
                    {svc.description && <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">{svc.description}</p>}
                  </td>
                  <td className="px-6 py-4 font-semibold text-[var(--color-text-primary)]">{formatCOP(svc.price)}</td>
                  <td className="px-6 py-4 text-[var(--color-text-secondary)] hidden sm:table-cell">{svc.duration_minutes} min</td>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleActive(svc)} className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${svc.is_active ? 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/30 hover:bg-[#22c55e]/30' : 'bg-[var(--color-border)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[#3a3a4a]'}`}>
                      {svc.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 justify-end">
                      <button onClick={() => openEdit(svc)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors text-xs font-medium">Editar</button>
                      <button onClick={() => handleDelete(svc)} className="text-[var(--color-text-secondary)] hover:text-[#ef4444] transition-colors text-xs font-medium">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
              <h2 className="font-semibold text-[var(--color-text-primary)]">{editing ? 'Editar servicio' : 'Nuevo servicio'}</h2>
              <button onClick={() => setShowModal(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="px-4 py-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg text-[#ef4444] text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Nombre *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Ej: Corte clásico"
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Descripción</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Opcional"
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Precio (COP) *</label>
                  <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required min="0" placeholder="50000"
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Duración *</label>
                  <select value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm">
                    {durations.map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-surface-overlay)] text-[#2563eb]" />
                <label htmlFor="is_active" className="text-sm text-[var(--color-text-secondary)]">Servicio activo</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border)] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear servicio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

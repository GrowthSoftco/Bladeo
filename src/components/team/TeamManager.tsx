import { useState, useEffect, useRef } from 'react';

interface Member {
  id: string;
  display_name: string;
  phone: string | null;
  role: string;
  commission_pct: number;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
}

const emptyForm = { display_name: '', email: '', password: '', phone: '', commission_pct: '0' };

export default function TeamManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  // New password modal
  const [showPassModal, setShowPassModal] = useState(false);
  const [passTarget, setPassTarget] = useState<Member | null>(null);
  const [newPass, setNewPass] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);

  // Avatar upload
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const avatarInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => { fetchMembers(); }, []);

  async function fetchMembers() {
    setLoading(true);
    const res = await fetch('/api/members');
    const data = await res.json();
    setMembers(data ?? []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setShowPass(false);
    setShowModal(true);
  }

  function openEdit(m: Member) {
    setEditing(m);
    setForm({ display_name: m.display_name, email: '', password: '', phone: m.phone ?? '', commission_pct: String(m.commission_pct) });
    setError('');
    setShowModal(true);
  }

  function openChangePass(m: Member) {
    setPassTarget(m);
    setNewPass('');
    setPassError('');
    setPassSuccess(false);
    setShowNewPass(false);
    setShowPassModal(true);
  }

  async function handleChangePass(e: React.FormEvent) {
    e.preventDefault();
    if (newPass.length < 6) { setPassError('Mínimo 6 caracteres.'); return; }
    setPassSaving(true); setPassError('');
    // We call the same endpoint — admin changes the user's password by their user_id
    const res = await fetch(`/api/members/${passTarget!.id}/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: newPass }),
    });
    const data = await res.json();
    setPassSaving(false);
    if (!res.ok) { setPassError(data.error ?? 'Error al cambiar la contraseña.'); return; }
    setPassSuccess(true);
    setTimeout(() => setShowPassModal(false), 1500);
  }

  async function handleAvatarChange(m: Member, file: File) {
    setUploadingId(m.id);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('member_id', m.id);
    const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd });
    const data = await res.json();
    setUploadingId(null);
    if (res.ok) {
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, avatar_url: data.url } : x));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');

    if (editing) {
      const res = await fetch(`/api/members/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: form.display_name, phone: form.phone, commission_pct: form.commission_pct, is_active: editing.is_active }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al guardar.'); setSaving(false); return; }
    } else {
      if (!form.email || !form.password) { setError('Email y contraseña son requeridos.'); setSaving(false); return; }
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al crear barbero.'); setSaving(false); return; }
    }

    setShowModal(false);
    fetchMembers();
    setSaving(false);
  }

  async function toggleActive(m: Member) {
    await fetch(`/api/members/${m.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: m.display_name, phone: m.phone, commission_pct: m.commission_pct, is_active: !m.is_active }),
    });
    fetchMembers();
  }

  async function handleDelete(m: Member) {
    if (!confirm(`¿Desactivar a "${m.display_name}"? Podrás reactivarlo después.`)) return;
    await fetch(`/api/members/${m.id}`, { method: 'DELETE' });
    fetchMembers();
  }

  const inputCls = 'w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm';

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Equipo</h1>
          <p className="text-[var(--color-text-secondary)]">{members.length} miembro{members.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors">
          + Agregar barbero
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl animate-pulse" />)}
        </div>
      ) : members.length === 0 ? (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl flex flex-col items-center justify-center py-16 text-center">
          <div className="text-4xl mb-4">✂️</div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Solo tú por ahora</h3>
          <p className="text-[var(--color-text-secondary)] text-sm mb-4">Agrega barberos a tu equipo para asignarles citas.</p>
          <button onClick={openCreate} className="px-4 py-2 bg-[var(--color-brand)] text-white text-sm font-semibold rounded-lg">+ Agregar barbero</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map(m => (
            <div key={m.id} className={`bg-[var(--color-surface-elevated)] border rounded-xl p-5 transition-all ${m.is_active ? 'border-[var(--color-border)]' : 'border-[var(--color-border)] opacity-60'}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {/* Avatar with upload overlay */}
                  <div className="relative group w-12 h-12 flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-[var(--color-brand)]/20 flex items-center justify-center text-[var(--color-brand-light)] font-bold text-lg overflow-hidden">
                      {m.avatar_url
                        ? <img src={m.avatar_url} alt={m.display_name} className="w-full h-full object-cover" />
                        : m.display_name.charAt(0).toUpperCase()
                      }
                    </div>
                    {/* Upload button overlay */}
                    <button
                      onClick={() => avatarInputRefs.current[m.id]?.click()}
                      disabled={uploadingId === m.id}
                      className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      title="Cambiar foto"
                    >
                      {uploadingId === m.id ? (
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                      )}
                    </button>
                    <input
                      ref={el => { avatarInputRefs.current[m.id] = el; }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleAvatarChange(m, file);
                        e.target.value = '';
                      }}
                    />
                  </div>

                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">{m.display_name}</p>
                    <p className="text-[var(--color-text-secondary)] text-xs">{m.phone ?? 'Sin teléfono'}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex-shrink-0 ${
                  m.role === 'owner'
                    ? 'bg-[var(--color-brand)]/20 text-[var(--color-brand-light)] border-[var(--color-brand)]/30'
                    : 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/30'
                }`}>
                  {m.role === 'owner' ? 'Dueño' : 'Barbero'}
                </span>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-secondary)]">Comisión</span>
                  <span className="text-[var(--color-text-primary)] font-medium">{m.commission_pct}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-text-secondary)]">Estado</span>
                  <button onClick={() => m.role !== 'owner' && toggleActive(m)}
                    className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${
                      m.is_active ? 'bg-[#22c55e]/20 text-[#22c55e] border-[#22c55e]/30' : 'bg-[var(--color-border)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
                    } ${m.role === 'owner' ? 'cursor-default' : 'hover:opacity-80 cursor-pointer'}`}>
                    {m.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </div>
              </div>

              {m.role !== 'owner' && (
                <div className="flex items-center gap-2 pt-3 border-t border-[var(--color-border)]">
                  <button onClick={() => openEdit(m)} className="flex-1 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface-overlay)] hover:bg-[var(--color-border)] rounded-lg transition-colors">
                    Editar
                  </button>
                  <button onClick={() => openChangePass(m)} className="flex-1 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-light)] bg-[var(--color-surface-overlay)] hover:bg-[var(--color-brand)]/10 rounded-lg transition-colors">
                    Clave
                  </button>
                  <button onClick={() => handleDelete(m)} className="flex-1 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[#ef4444] bg-[var(--color-surface-overlay)] hover:bg-[#ef4444]/10 rounded-lg transition-colors">
                    Desactivar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
              <h2 className="font-semibold text-[var(--color-text-primary)]">{editing ? 'Editar barbero' : 'Agregar barbero'}</h2>
              <button onClick={() => setShowModal(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="px-4 py-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg text-[#ef4444] text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Nombre completo *</label>
                <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} required
                  placeholder="Ej: Carlos Ramírez" className={inputCls} />
              </div>

              {!editing && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Correo electrónico *</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required
                      placeholder="barbero@ejemplo.com" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Contraseña temporal *</label>
                    <div className="relative">
                      <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required
                        placeholder="Mínimo 6 caracteres" className={inputCls + ' pr-10'} />
                      <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                        {showPass
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        }
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Teléfono</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="300 123 4567" className={inputCls} />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Comisión %</label>
                <input type="number" min="0" max="100" value={form.commission_pct} onChange={e => setForm(f => ({ ...f, commission_pct: e.target.value }))}
                  placeholder="0" className={inputCls} />
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">Porcentaje de cada venta que le corresponde al barbero.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border)] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear barbero'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPassModal && passTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPassModal(false)} />
          <div className="relative bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
              <h2 className="font-semibold text-[var(--color-text-primary)]">Cambiar contraseña</h2>
              <button onClick={() => setShowPassModal(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleChangePass} className="p-6 space-y-4">
              <p className="text-sm text-[var(--color-text-secondary)]">Nueva contraseña para <span className="text-[var(--color-text-primary)] font-medium">{passTarget.display_name}</span></p>

              {passError && <div className="px-4 py-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg text-[#ef4444] text-sm">{passError}</div>}
              {passSuccess && <div className="px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">✓ Contraseña actualizada</div>}

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Nueva contraseña *</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPass}
                    onChange={e => setNewPass(e.target.value)}
                    required minLength={6}
                    placeholder="Mínimo 6 caracteres"
                    className={inputCls + ' pr-10'}
                    autoFocus
                  />
                  <button type="button" onClick={() => setShowNewPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                    {showNewPass
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowPassModal(false)} className="flex-1 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border)] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={passSaving || passSuccess} className="flex-1 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                  {passSaving ? 'Guardando...' : passSuccess ? '✓ Guardado' : 'Cambiar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';

interface Member { id: string; display_name: string; avatar_url: string | null; }
interface Service { id: string; name: string; price: number; duration_minutes: number; is_active?: boolean; }
interface Client { id: string; name: string; phone: string | null; }
interface Appointment {
  id: string; barber_id: string; client_id: string | null; service_id: string;
  client_name: string; client_phone: string | null; date: string; start_time: string; end_time: string;
  status: string; notes: string | null; prepaid: boolean; prepaid_amount: number;
  services: Service | null; members: Member | null; clients: Client | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-[#f59e0b]/20 border-l-[#f59e0b] text-[#f59e0b]',
  confirmed: 'bg-[var(--color-brand)]/20 border-l-[#2563eb] text-[#3b82f6]',
  completed: 'bg-[#22c55e]/20 border-l-[#22c55e] text-[#22c55e]',
  cancelled: 'bg-[#ef4444]/20 border-l-[#ef4444] text-[#ef4444]',
  no_show: 'bg-[var(--color-border)] border-l-[#8888a0] text-[var(--color-text-secondary)]',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmada', completed: 'Completada', cancelled: 'Cancelada', no_show: 'No asistió',
};

function formatCOP(n: number) { return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.'); }

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props { barbers: Member[]; isOwner: boolean; currentMemberId: string; }

export default function AgendaView({ barbers, isOwner, currentMemberId }: Props) {
  const [view, setView] = useState<'day' | 'week'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [savingStatus, setSavingStatus] = useState('');

  // New appointment form
  const [form, setForm] = useState({
    barber_id: isOwner ? (barbers[0]?.id ?? '') : currentMemberId,
    client_search: '', client_id: '', client_name: '', client_phone: '',
    service_id: '', date: toDateStr(new Date()), start_time: '09:00', notes: '',
  });
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const dateStr = toDateStr(currentDate);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    let url = `/api/appointments?date=${dateStr}`;
    if (view === 'week') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay() + 1); // Monday
      const end = new Date(start); end.setDate(end.getDate() + 6);
      url = `/api/appointments?start=${toDateStr(start)}&end=${toDateStr(end)}`;
    }
    const res = await fetch(url);
    const data = await res.json();
    setAppointments(data ?? []);
    setLoading(false);
  }, [dateStr, view]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(d => setServices(d ?? []));
  }, []);

  async function loadClients() {
    if (clientsLoaded) return;
    const d = await fetch('/api/clients').then(r => r.json());
    setClients(d ?? []);
    setClientsLoaded(true);
  }

  // Client search
  useEffect(() => {
    const q = form.client_search.toLowerCase();
    if (q.length < 1) { setClientResults([]); return; }
    setClientResults(clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)).slice(0, 6));
  }, [form.client_search, clients]);

  // Auto end_time
  const selectedService = services.find(s => s.id === form.service_id);
  const endTime = selectedService ? addMinutes(form.start_time, selectedService.duration_minutes) : addMinutes(form.start_time, 30);

  function openNewAppointment(date = dateStr, time = '09:00') {
    setSelectedApt(null);
    setForm(f => ({ ...f, date, start_time: time, client_search: '', client_id: '', client_name: '', client_phone: '' }));
    setFormError('');
    setShowModal(true);
    loadClients();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError('');

    if (!form.barber_id || !form.service_id || !form.date || !form.start_time)
      { setFormError('Completa todos los campos requeridos.'); setSaving(false); return; }

    const clientName = form.client_id ? clients.find(c => c.id === form.client_id)?.name ?? form.client_name : form.client_name;
    if (!clientName) { setFormError('Ingresa el nombre del cliente.'); setSaving(false); return; }

    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barber_id: form.barber_id,
        client_id: form.client_id || null,
        service_id: form.service_id,
        client_name: clientName,
        client_phone: form.client_phone || null,
        date: form.date,
        start_time: form.start_time + ':00',
        end_time: endTime + ':00',
        notes: form.notes || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setFormError(data.error ?? 'Error al crear la cita.'); setSaving(false); return; }

    setShowModal(false);
    fetchAppointments();
    setSaving(false);
  }

  async function updateStatus(apt: Appointment, status: string) {
    setSavingStatus(apt.id + status);
    await fetch(`/api/appointments/${apt.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setSelectedApt(null);
    fetchAppointments();
    setSavingStatus('');
  }

  // Day view: time slots
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7am to 8pm
  const dayApts = appointments.filter(a => a.date === dateStr);

  function navPrev() {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() - 1);
    else d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  }
  function navNext() {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() + 1);
    else d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  }

  const todayStr = toDateStr(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay() + 1 + i);
    return d;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={navPrev} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-overlay)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-overlay)] rounded-lg transition-colors">Hoy</button>
            <button onClick={navNext} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-overlay)] transition-colors text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <h2 className="font-semibold text-[var(--color-text-primary)] text-lg capitalize">
            {view === 'day'
              ? currentDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' })
              : `${weekDays[0].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} — ${weekDays[6].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
            }
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg p-0.5">
            <button onClick={() => setView('day')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'day' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-secondary)] hover:text-white'}`}>Día</button>
            <button onClick={() => setView('week')} className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'week' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-secondary)] hover:text-white'}`}>Semana</button>
          </div>
          <button onClick={() => openNewAppointment()} className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
            + Nueva cita
          </button>
        </div>
      </div>

      {/* Week view */}
      {view === 'week' && (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
            {weekDays.map(d => {
              const ds = toDateStr(d);
              const isToday = ds === todayStr;
              const dayAptCount = appointments.filter(a => a.date === ds).length;
              return (
                <button key={ds} onClick={() => { setCurrentDate(new Date(d)); setView('day'); }}
                  className={`p-4 text-center hover:bg-[var(--color-surface-overlay)] transition-colors border-r border-[var(--color-border)] last:border-r-0 ${isToday ? 'bg-[var(--color-brand)]/10' : ''}`}>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1 uppercase">{d.toLocaleDateString('es-CO', { weekday: 'short' })}</p>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-semibold ${isToday ? 'bg-[var(--color-brand)] text-white' : 'text-white'}`}>
                    {d.getDate()}
                  </div>
                  {dayAptCount > 0 && <div className="mt-1 text-xs text-[#2563eb] font-medium">{dayAptCount} cita{dayAptCount > 1 ? 's' : ''}</div>}
                </button>
              );
            })}
          </div>
          <div className="p-6">
            {loading ? (
              <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-[var(--color-surface-overlay)] rounded-lg animate-pulse" />)}</div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-[var(--color-text-secondary)]">Sin citas esta semana.</p>
                <button onClick={() => openNewAppointment()} className="mt-3 text-sm text-[#2563eb] hover:text-[#3b82f6]">+ Nueva cita</button>
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map(apt => (
                  <button key={apt.id} onClick={() => setSelectedApt(apt)}
                    className={`w-full text-left px-4 py-3 rounded-lg border-l-4 transition-colors hover:opacity-90 ${STATUS_COLORS[apt.status]}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-[var(--color-text-primary)] text-sm">{apt.client_name}</p>
                        <p className="text-xs opacity-80">{apt.services?.name} · {apt.members?.display_name} · {apt.date} {apt.start_time.slice(0,5)}</p>
                      </div>
                      <span className="text-xs font-medium">{STATUS_LABELS[apt.status]}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Day view */}
      {view === 'day' && (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden flex-1">
          {loading ? (
            <div className="p-6 space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-[var(--color-surface-overlay)] rounded-lg animate-pulse" />)}</div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {dayApts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <svg className="w-10 h-10 text-[var(--color-border)] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <p className="text-[var(--color-text-secondary)] text-sm">Sin citas para este día.</p>
                  <button onClick={() => openNewAppointment()} className="mt-3 text-sm text-[#2563eb] hover:text-[#3b82f6] transition-colors">+ Nueva cita</button>
                </div>
              )}
              {dayApts.map(apt => (
                <button key={apt.id} onClick={() => setSelectedApt(apt)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[var(--color-surface-overlay)] transition-colors text-left">
                  <div className="text-center w-14 flex-shrink-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{apt.start_time.slice(0,5)}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{apt.end_time.slice(0,5)}</p>
                  </div>
                  <div className={`w-1 h-12 rounded-full flex-shrink-0 ${STATUS_COLORS[apt.status].split(' ')[1]?.replace('border-l-', 'bg-') ?? 'bg-[var(--color-text-secondary)]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--color-text-primary)] truncate">{apt.client_name}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] truncate">{apt.services?.name} · {apt.members?.display_name}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[apt.status]}`}>
                      {STATUS_LABELS[apt.status]}
                    </span>
                    {apt.services?.price && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{formatCOP(apt.services.price)}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Appointment detail modal */}
      {selectedApt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedApt(null)} />
          <div className="relative bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
              <div>
                <h2 className="font-semibold text-[var(--color-text-primary)]">{selectedApt.client_name}</h2>
                <p className="text-sm text-[var(--color-text-secondary)]">{selectedApt.date} · {selectedApt.start_time.slice(0,5)} — {selectedApt.end_time.slice(0,5)}</p>
              </div>
              <button onClick={() => setSelectedApt(null)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-[var(--color-surface-overlay)] rounded-lg p-3">
                  <p className="text-[var(--color-text-secondary)] text-xs mb-1">Servicio</p>
                  <p className="text-[var(--color-text-primary)] font-medium">{selectedApt.services?.name ?? '—'}</p>
                </div>
                <div className="bg-[var(--color-surface-overlay)] rounded-lg p-3">
                  <p className="text-[var(--color-text-secondary)] text-xs mb-1">Barbero</p>
                  <p className="text-[var(--color-text-primary)] font-medium">{selectedApt.members?.display_name ?? '—'}</p>
                </div>
                <div className="bg-[var(--color-surface-overlay)] rounded-lg p-3">
                  <p className="text-[var(--color-text-secondary)] text-xs mb-1">Teléfono</p>
                  <p className="text-[var(--color-text-primary)] font-medium">{selectedApt.client_phone ?? '—'}</p>
                </div>
                <div className="bg-[var(--color-surface-overlay)] rounded-lg p-3">
                  <p className="text-[var(--color-text-secondary)] text-xs mb-1">Estado</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[selectedApt.status]}`}>{STATUS_LABELS[selectedApt.status]}</span>
                </div>
              </div>
              {selectedApt.notes && (
                <div className="bg-[var(--color-surface-overlay)] rounded-lg p-3 text-sm">
                  <p className="text-[var(--color-text-secondary)] text-xs mb-1">Notas</p>
                  <p className="text-[var(--color-text-primary)]">{selectedApt.notes}</p>
                </div>
              )}
              {selectedApt.services?.price && (
                <div className="flex items-center justify-between bg-[var(--color-surface-overlay)] rounded-lg p-3">
                  <span className="text-[var(--color-text-secondary)] text-sm">Valor</span>
                  <span className="text-[var(--color-text-primary)] font-semibold">{formatCOP(selectedApt.services.price)}</span>
                </div>
              )}

              {/* Action buttons */}
              {selectedApt.status !== 'cancelled' && selectedApt.status !== 'completed' && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedApt.status !== 'confirmed' && (
                    <button disabled={!!savingStatus} onClick={() => updateStatus(selectedApt, 'confirmed')}
                      className="flex-1 py-2 bg-[var(--color-brand)]/20 hover:bg-[var(--color-brand)]/30 text-[#3b82f6] text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                      Confirmar
                    </button>
                  )}
                  <button disabled={!!savingStatus} onClick={() => updateStatus(selectedApt, 'completed')}
                    className="flex-1 py-2 bg-[#22c55e]/20 hover:bg-[#22c55e]/30 text-[#22c55e] text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                    Completar
                  </button>
                  <button disabled={!!savingStatus} onClick={() => updateStatus(selectedApt, 'no_show')}
                    className="flex-1 py-2 bg-[var(--color-border)] hover:bg-[#3a3a4a] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                    No asistió
                  </button>
                  <button disabled={!!savingStatus} onClick={() => updateStatus(selectedApt, 'cancelled')}
                    className="flex-1 py-2 bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New appointment modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)] sticky top-0 bg-[var(--color-surface-elevated)] z-10">
              <h2 className="font-semibold text-[var(--color-text-primary)]">Nueva cita</h2>
              <button onClick={() => setShowModal(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && <div className="px-4 py-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg text-[#ef4444] text-sm">{formError}</div>}

              {/* Barber */}
              {isOwner && barbers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Barbero *</label>
                  <select value={form.barber_id} onChange={e => setForm(f => ({ ...f, barber_id: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm">
                    {barbers.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
                  </select>
                </div>
              )}

              {/* Client */}
              <div className="relative">
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Cliente *</label>
                {form.client_id ? (
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-brand)] rounded-lg">
                    <span className="text-[var(--color-text-primary)] text-sm">{clients.find(c => c.id === form.client_id)?.name}</span>
                    <button type="button" onClick={() => setForm(f => ({ ...f, client_id: '', client_search: '', client_name: '' }))}
                      className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xs">✕ cambiar</button>
                  </div>
                ) : (
                  <div>
                    <input value={form.client_search}
                      onChange={e => setForm(f => ({ ...f, client_search: e.target.value, client_name: e.target.value }))}
                      placeholder="Buscar cliente o escribir nombre..."
                      className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />
                    {clientResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden">
                        {clientResults.map(c => (
                          <button key={c.id} type="button"
                            onClick={() => setForm(f => ({ ...f, client_id: c.id, client_name: c.name, client_phone: c.phone ?? '', client_search: c.name }))}
                            className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-border)] transition-colors text-sm">
                            <span className="text-[var(--color-text-primary)]">{c.name}</span>
                            {c.phone && <span className="text-[var(--color-text-secondary)] ml-2 text-xs">{c.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!form.client_id && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Nombre completo *</label>
                      <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value, client_search: e.target.value }))}
                        placeholder="Juan Pérez"
                        className="w-full px-3 py-2 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Teléfono</label>
                      <input type="tel" value={form.client_phone} onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))}
                        placeholder="300 123 4567"
                        className="w-full px-3 py-2 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />
                    </div>
                  </div>
                )}
              </div>

              {/* Service */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Servicio *</label>
                {services.length === 0 ? (
                  <div className="px-4 py-3 bg-[#f59e0b]/10 border border-[#f59e0b]/30 rounded-lg text-[#f59e0b] text-sm">
                    No tienes servicios creados. <a href="/app/services" className="underline font-medium">Crear servicios →</a>
                  </div>
                ) : (
                  <select value={form.service_id} onChange={e => setForm(f => ({ ...f, service_id: e.target.value }))} required
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm">
                    <option value="">Seleccionar servicio...</option>
                    {services.filter(s => s.is_active !== false).map(s => (
                      <option key={s.id} value={s.id}>{s.name} — {formatCOP(s.price)} ({s.duration_minutes} min)</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Date and time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Fecha *</label>
                  <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Hora inicio *</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} required step={1800}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />
                </div>
              </div>
              {selectedService && (
                <p className="text-xs text-[var(--color-text-secondary)]">Fin estimado: <span className="text-[var(--color-text-primary)] font-medium">{endTime}</span> ({selectedService.duration_minutes} min)</p>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  placeholder="Instrucciones especiales, preferencias..."
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border)] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                  {saving ? 'Creando...' : 'Crear cita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

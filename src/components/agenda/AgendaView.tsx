import { useState, useEffect, useCallback } from 'react';
import BlockModal from './BlockModal';

interface Block {
  id: string; barber_id: string; date: string;
  start_time: string | null; end_time: string | null; reason: string | null;
}

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
  pending:   'bg-[#f59e0b]/20 border-l-[#f59e0b] text-[#f59e0b]',
  confirmed: 'bg-[var(--color-brand)]/20 border-l-[#2563eb] text-[#3b82f6]',
  completed: 'bg-[#22c55e]/20 border-l-[#22c55e] text-[#22c55e]',
  cancelled: 'bg-[#ef4444]/20 border-l-[#ef4444] text-[#ef4444]',
  no_show:   'bg-[var(--color-border)] border-l-[#8888a0] text-[var(--color-text-secondary)]',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmada', completed: 'Completada', cancelled: 'Cancelada', no_show: 'No asistió',
};
const STATUS_DOT: Record<string, string> = {
  pending: '#f59e0b', confirmed: '#3b82f6', completed: '#22c55e', cancelled: '#ef4444', no_show: '#6b7280',
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
  const [view, setView]               = useState<'day' | 'week' | 'month'>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices]       = useState<Service[]>([]);
  const [clients, setClients]         = useState<Client[]>([]);
  const [clientsLoaded, setClientsLoaded] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [savingStatus, setSavingStatus] = useState('');
  const [blocks, setBlocks]           = useState<Block[]>([]);
  const [timelineBarber, setTimelineBarber] = useState<string>(
    isOwner ? (barbers[0]?.id ?? '') : currentMemberId
  );

  // New appointment form
  const [form, setForm] = useState({
    barber_id: isOwner ? (barbers[0]?.id ?? '') : currentMemberId,
    client_search: '', client_id: '', client_name: '', client_phone: '',
    service_id: '', date: toDateStr(new Date()), start_time: '09:00', notes: '',
  });
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');

  const dateStr  = toDateStr(currentDate);
  const todayStr = toDateStr(new Date());

  // ── Fetch blocks (supports single date or range for month view) ────────────
  const fetchBlocks = useCallback(async () => {
    let params = '';
    if (view === 'month') {
      const y = currentDate.getFullYear(), m = currentDate.getMonth();
      params = `start=${toDateStr(new Date(y, m, 1))}&end=${toDateStr(new Date(y, m + 1, 0))}`;
    } else if (view === 'week') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay() + 1);
      const end = new Date(start); end.setDate(end.getDate() + 6);
      params = `start=${toDateStr(start)}&end=${toDateStr(end)}`;
    } else {
      params = `date=${dateStr}`;
    }
    if (!isOwner) params += `&barber_id=${currentMemberId}`;
    const res = await fetch(`/api/blocks?${params}`);
    const data = await res.json();
    setBlocks(Array.isArray(data) ? data : []);
  }, [view, currentDate, dateStr, isOwner, currentMemberId]);

  // ── Fetch appointments ─────────────────────────────────────────────────────
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    let url: string;
    if (view === 'day') {
      url = `/api/appointments?date=${dateStr}`;
    } else if (view === 'week') {
      const start = new Date(currentDate);
      start.setDate(start.getDate() - start.getDay() + 1);
      const end = new Date(start); end.setDate(end.getDate() + 6);
      url = `/api/appointments?start=${toDateStr(start)}&end=${toDateStr(end)}`;
    } else {
      const y = currentDate.getFullYear(), m = currentDate.getMonth();
      url = `/api/appointments?start=${toDateStr(new Date(y, m, 1))}&end=${toDateStr(new Date(y, m + 1, 0))}`;
    }
    const [aptsRes] = await Promise.all([fetch(url), fetchBlocks()]);
    const data = await aptsRes.json();
    setAppointments(data ?? []);
    setLoading(false);
  }, [view, currentDate, dateStr, fetchBlocks]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);
  useEffect(() => { fetch('/api/services').then(r => r.json()).then(d => setServices(d ?? [])); }, []);

  async function loadClients() {
    if (clientsLoaded) return;
    const d = await fetch('/api/clients').then(r => r.json());
    setClients(d ?? []);
    setClientsLoaded(true);
  }

  useEffect(() => {
    const q = form.client_search.toLowerCase();
    if (q.length < 1) { setClientResults([]); return; }
    setClientResults(clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)).slice(0, 6));
  }, [form.client_search, clients]);

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
        barber_id: form.barber_id, client_id: form.client_id || null,
        service_id: form.service_id, client_name: clientName,
        client_phone: form.client_phone || null, date: form.date,
        start_time: form.start_time + ':00', end_time: endTime + ':00',
        notes: form.notes || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setFormError(data.error ?? 'Error al crear la cita.'); setSaving(false); return; }
    setShowModal(false); fetchAppointments(); setSaving(false);
  }

  async function updateStatus(apt: Appointment, status: string) {
    setSavingStatus(apt.id + status);
    await fetch(`/api/appointments/${apt.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setSelectedApt(null); fetchAppointments(); setSavingStatus('');
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function navPrev() {
    const d = new Date(currentDate);
    if (view === 'day')   { d.setDate(d.getDate() - 1); }
    else if (view === 'week') { d.setDate(d.getDate() - 7); }
    else { d.setDate(1); d.setMonth(d.getMonth() - 1); }
    setCurrentDate(d);
  }
  function navNext() {
    const d = new Date(currentDate);
    if (view === 'day')   { d.setDate(d.getDate() + 1); }
    else if (view === 'week') { d.setDate(d.getDate() + 7); }
    else { d.setDate(1); d.setMonth(d.getMonth() + 1); }
    setCurrentDate(d);
  }

  // ── Header title ────────────────────────────────────────────────────────────
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay() + 1 + i);
    return d;
  });
  const headerTitle =
    view === 'day'
      ? currentDate.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Bogota' })
      : view === 'week'
      ? `${weekDays[0].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} — ${weekDays[6].toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
      : currentDate.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

  // ── Day view helpers ────────────────────────────────────────────────────────
  const dayApts   = appointments.filter(a => a.date === dateStr);
  const dayBlocks = blocks.filter(b => b.date === dateStr);
  const hasFullDayBlock = dayBlocks.some(b => b.start_time === null);

  const toMin   = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fromMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const OPEN = '08:00'; const CLOSE = '20:00'; const SLOT_MIN = 30;

  type TLEvent = { kind: 'apt'; apt: Appointment } | { kind: 'block'; blk: Block } | { kind: 'free'; start: string; end: string };

  const buildTimeline = (): TLEvent[] => {
    const apts = dayApts.filter(a => !timelineBarber || a.barber_id === timelineBarber)
                        .sort((a, b) => a.start_time.localeCompare(b.start_time));
    const blks = dayBlocks.filter(b => (!timelineBarber || b.barber_id === timelineBarber) && b.start_time !== null)
                          .sort((a, b) => a.start_time!.localeCompare(b.start_time!));
    const busy = [
      ...apts.map(a => ({ s: toMin(a.start_time),  e: toMin(a.end_time),  kind: 'apt'   as const, data: a })),
      ...blks.map(b => ({ s: toMin(b.start_time!), e: toMin(b.end_time!), kind: 'block' as const, data: b })),
    ].sort((a, b) => a.s - b.s);
    const events: TLEvent[] = [];
    let cursor = toMin(OPEN);
    const closeMin = toMin(CLOSE);
    for (const iv of busy) {
      while (cursor + SLOT_MIN <= iv.s) { events.push({ kind: 'free', start: fromMin(cursor), end: fromMin(cursor + SLOT_MIN) }); cursor += SLOT_MIN; }
      if (cursor < iv.s) cursor = iv.s;
      if (iv.kind === 'apt')   events.push({ kind: 'apt',   apt: iv.data as Appointment });
      if (iv.kind === 'block') events.push({ kind: 'block', blk: iv.data as Block });
      cursor = Math.max(cursor, iv.e);
    }
    while (cursor + SLOT_MIN <= closeMin) { events.push({ kind: 'free', start: fromMin(cursor), end: fromMin(cursor + SLOT_MIN) }); cursor += SLOT_MIN; }
    return events;
  };
  const timeline = buildTimeline();

  // ── Month grid builder ──────────────────────────────────────────────────────
  const buildMonthGrid = () => {
    const y = currentDate.getFullYear(), m = currentDate.getMonth();
    const first = new Date(y, m, 1);
    let startDow = first.getDay(); // 0=Sun … 6=Sat
    startDow = startDow === 0 ? 6 : startDow - 1; // Mon=0 … Sun=6
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = startDow; i > 0; i--)            cells.push({ date: new Date(y, m, 1 - i),  inMonth: false });
    for (let d = 1; d <= daysInMonth; d++)         cells.push({ date: new Date(y, m, d),     inMonth: true  });
    while (cells.length % 7 !== 0 || cells.length < 35)
      cells.push({ date: new Date(y, m + 1, cells.length - startDow - daysInMonth + 1), inMonth: false });
    return cells;
  };
  const monthGrid = buildMonthGrid();

  // ── Month view: appointments / blocks per day (respect barber filter) ───────
  const filteredApts = isOwner && timelineBarber
    ? appointments.filter(a => a.barber_id === timelineBarber)
    : appointments;
  const filteredBlocks = isOwner && timelineBarber
    ? blocks.filter(b => b.barber_id === timelineBarber)
    : blocks;

  return (
    <div className="flex flex-col h-full">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
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
          <h2 className="font-semibold text-[var(--color-text-primary)] text-lg capitalize">{headerTitle}</h2>
        </div>

        <div className="flex items-center gap-3">
          {/* View switcher */}
          <div className="flex bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg p-0.5">
            {(['day', 'week', 'month'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === v ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-secondary)] hover:text-white'}`}>
                {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowBlockModal(true)}
              className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              Bloquear
            </button>
            <button onClick={() => openNewAppointment()}
              className="px-4 py-2 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap">
              + Nueva cita
            </button>
          </div>
        </div>
      </div>

      {/* ── MONTH VIEW ──────────────────────────────────────────────────────── */}
      {view === 'month' && (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col">

          {/* Barber filter (owner) */}
          {isOwner && (
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3 flex-wrap">
              <select value={timelineBarber} onChange={e => setTimelineBarber(e.target.value)}
                className="text-sm bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[var(--color-brand)] transition-colors">
                <option value="">Todos los barberos</option>
                {barbers.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
              </select>
              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                {Object.entries(STATUS_LABELS).map(([k, label]) => (
                  <span key={k} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: STATUS_DOT[k] }} />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Weekday headers */}
          <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d => (
              <div key={d} className="py-2.5 text-center text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide border-r border-[var(--color-border)] last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="p-8 text-center text-[var(--color-text-secondary)]">
              <div className="inline-block w-6 h-6 border-2 border-[var(--color-brand)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {monthGrid.map((cell, i) => {
                const ds        = toDateStr(cell.date);
                const isToday   = ds === todayStr;
                const inMonth   = cell.inMonth;
                const dayAptsMo = filteredApts.filter(a => a.date === ds);
                const dayBlksMo = filteredBlocks.filter(b => b.date === ds);
                const hasBlock  = dayBlksMo.length > 0;
                const isLast7   = i >= monthGrid.length - 7;

                return (
                  <button
                    key={i}
                    onClick={() => { setCurrentDate(new Date(cell.date)); setView('day'); }}
                    className={[
                      'relative flex flex-col min-h-[90px] p-2 text-left transition-colors',
                      'border-r border-b border-[var(--color-border)]',
                      (i + 1) % 7 === 0 ? 'border-r-0' : '',
                      isLast7 ? 'border-b-0' : '',
                      inMonth ? 'hover:bg-[var(--color-surface-overlay)]' : 'hover:bg-[var(--color-surface-overlay)]/40',
                      isToday ? 'bg-[var(--color-brand)]/5' : '',
                    ].join(' ')}
                  >
                    {/* Day number */}
                    <div className={[
                      'w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1 flex-shrink-0 self-start',
                      isToday
                        ? 'bg-[var(--color-brand)] text-white'
                        : inMonth
                        ? 'text-[var(--color-text-primary)]'
                        : 'text-[var(--color-text-secondary)] opacity-40',
                    ].join(' ')}>
                      {cell.date.getDate()}
                    </div>

                    {/* Appointments — show pills on desktop, dots on mobile */}
                    <div className="flex-1 w-full space-y-0.5 min-w-0">
                      {/* Desktop: pill list */}
                      <div className="hidden sm:flex flex-col gap-0.5">
                        {dayAptsMo.slice(0, 3).map(apt => (
                          <div key={apt.id}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate"
                            style={{ background: STATUS_DOT[apt.status] + '22', color: STATUS_DOT[apt.status] }}>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[apt.status] }} />
                            <span className="truncate">{apt.client_name}</span>
                          </div>
                        ))}
                        {dayAptsMo.length > 3 && (
                          <p className="text-[10px] text-[var(--color-text-secondary)] px-1">+{dayAptsMo.length - 3} más</p>
                        )}
                      </div>

                      {/* Mobile: dots */}
                      <div className="flex sm:hidden gap-1 flex-wrap mt-1">
                        {dayAptsMo.slice(0, 6).map(apt => (
                          <span key={apt.id} className="w-2 h-2 rounded-full" style={{ background: STATUS_DOT[apt.status] }} />
                        ))}
                        {dayAptsMo.length > 6 && (
                          <span className="text-[9px] text-[var(--color-text-secondary)]">+{dayAptsMo.length - 6}</span>
                        )}
                      </div>
                    </div>

                    {/* Block stripe at bottom */}
                    {hasBlock && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b"
                        style={{ background: 'rgba(239,68,68,0.4)' }} title="Día bloqueado" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Month summary footer */}
          {!loading && (
            <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-[var(--color-text-secondary)]">
                <span className="font-semibold text-[var(--color-text-primary)]">{filteredApts.length}</span> cita{filteredApts.length !== 1 ? 's' : ''} este mes
                {filteredBlocks.length > 0 && <span className="text-red-400 ml-3">· {filteredBlocks.length} bloqueo{filteredBlocks.length !== 1 ? 's' : ''}</span>}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)]">Haz clic en un día para ver el detalle</p>
            </div>
          )}
        </div>
      )}

      {/* ── WEEK VIEW ───────────────────────────────────────────────────────── */}
      {view === 'week' && (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
            {weekDays.map(d => {
              const ds = toDateStr(d);
              const isToday = ds === todayStr;
              const cnt = appointments.filter(a => a.date === ds).length;
              return (
                <button key={ds} onClick={() => { setCurrentDate(new Date(d)); setView('day'); }}
                  className={`p-4 text-center hover:bg-[var(--color-surface-overlay)] transition-colors border-r border-[var(--color-border)] last:border-r-0 ${isToday ? 'bg-[var(--color-brand)]/10' : ''}`}>
                  <p className="text-xs text-[var(--color-text-secondary)] mb-1 uppercase">{d.toLocaleDateString('es-CO', { weekday: 'short' })}</p>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-semibold ${isToday ? 'bg-[var(--color-brand)] text-white' : 'text-white'}`}>
                    {d.getDate()}
                  </div>
                  {cnt > 0 && <div className="mt-1 text-xs text-[var(--color-brand-light)] font-medium">{cnt} cita{cnt > 1 ? 's' : ''}</div>}
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
                <button onClick={() => openNewAppointment()} className="mt-3 text-sm text-[var(--color-brand-light)] hover:underline">+ Nueva cita</button>
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

      {/* ── DAY VIEW ────────────────────────────────────────────────────────── */}
      {view === 'day' && (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden flex-1">

          {/* Barber selector + legend */}
          <div className="px-6 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3 flex-wrap">
            {isOwner ? (
              <select value={timelineBarber} onChange={e => setTimelineBarber(e.target.value)}
                className="text-sm bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[var(--color-brand)] transition-colors">
                {barbers.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
              </select>
            ) : (
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {barbers.find(b => b.id === currentMemberId)?.display_name ?? 'Mi agenda'}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[var(--color-success)] inline-block"/>Disponible</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[var(--color-brand)] inline-block"/>Ocupado</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"/>Bloqueado</span>
            </div>
          </div>

          {/* Full-day block banner */}
          {hasFullDayBlock && dayBlocks.filter(b => b.start_time === null && (!timelineBarber || b.barber_id === timelineBarber)).length > 0 && (
            <div className="flex items-center gap-3 px-6 py-3 bg-red-500/10 border-b border-red-500/20">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              <p className="text-red-400 text-sm font-medium">
                Día completo bloqueado — {dayBlocks.filter(b => b.start_time === null && (!timelineBarber || b.barber_id === timelineBarber)).map(b => b.reason ?? 'Sin motivo').join(', ')}
              </p>
            </div>
          )}

          {loading ? (
            <div className="p-6 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-[var(--color-surface-overlay)] rounded-lg animate-pulse" />)}</div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {timeline.map((ev, i) => {
                if (ev.kind === 'free') return (
                  <button key={i} onClick={() => openNewAppointment(dateStr, ev.start)}
                    className="w-full flex items-center gap-4 px-6 py-3 hover:bg-[var(--color-success)]/5 transition-colors text-left group">
                    <div className="text-center w-14 flex-shrink-0">
                      <p className="text-sm font-semibold text-[var(--color-success)]">{ev.start}</p>
                      <p className="text-xs text-[var(--color-success)]/60">{ev.end}</p>
                    </div>
                    <div className="w-0.5 h-8 rounded-full bg-[var(--color-success)]/30 flex-shrink-0 group-hover:bg-[var(--color-success)]/70 transition-colors" />
                    <p className="flex-1 text-sm text-[var(--color-success)]/70 group-hover:text-[var(--color-success)] transition-colors">Disponible</p>
                    <span className="text-xs text-[var(--color-success)]/50 group-hover:text-[var(--color-success)] transition-colors opacity-0 group-hover:opacity-100 font-medium">+ Agendar →</span>
                  </button>
                );
                if (ev.kind === 'block') return (
                  <div key={i} className="flex items-center gap-4 px-6 py-3.5 bg-red-500/5">
                    <div className="text-center w-14 flex-shrink-0">
                      <p className="text-sm font-semibold text-red-400">{ev.blk.start_time!.slice(0,5)}</p>
                      <p className="text-xs text-red-400/60">{ev.blk.end_time!.slice(0,5)}</p>
                    </div>
                    <div className="w-1 h-10 rounded-full bg-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-400">🚫 Bloqueado</p>
                      <p className="text-xs text-[var(--color-text-secondary)] truncate">{ev.blk.reason ?? 'Sin motivo'}</p>
                    </div>
                  </div>
                );
                const apt = ev.apt;
                return (
                  <button key={apt.id} onClick={() => setSelectedApt(apt)}
                    className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-[var(--color-surface-overlay)] transition-colors text-left">
                    <div className="text-center w-14 flex-shrink-0">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{apt.start_time.slice(0,5)}</p>
                      <p className="text-xs text-[var(--color-text-secondary)]">{apt.end_time.slice(0,5)}</p>
                    </div>
                    <div className={`w-1 h-12 rounded-full flex-shrink-0 ${STATUS_COLORS[apt.status].split(' ')[1]?.replace('border-l-', 'bg-') ?? 'bg-[var(--color-text-secondary)]'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--color-text-primary)] truncate">{apt.client_name}</p>
                      <p className="text-sm text-[var(--color-text-secondary)] truncate">{apt.services?.name}{isOwner ? ` · ${apt.members?.display_name}` : ''}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[apt.status]}`}>{STATUS_LABELS[apt.status]}</span>
                      {apt.services?.price && <p className="text-xs text-[var(--color-text-secondary)] mt-1">{formatCOP(apt.services.price)}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Appointment detail modal ─────────────────────────────────────────── */}
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
              {selectedApt.status !== 'cancelled' && selectedApt.status !== 'completed' && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {selectedApt.status !== 'confirmed' && (
                    <button disabled={!!savingStatus} onClick={() => updateStatus(selectedApt, 'confirmed')}
                      className="flex-1 py-2 bg-[var(--color-brand)]/20 hover:bg-[var(--color-brand)]/30 text-[#3b82f6] text-sm font-medium rounded-lg transition-colors disabled:opacity-50">Confirmar</button>
                  )}
                  <button disabled={!!savingStatus} onClick={() => updateStatus(selectedApt, 'completed')}
                    className="flex-1 py-2 bg-[#22c55e]/20 hover:bg-[#22c55e]/30 text-[#22c55e] text-sm font-medium rounded-lg transition-colors disabled:opacity-50">Completar</button>
                  <button disabled={!!savingStatus} onClick={() => updateStatus(selectedApt, 'no_show')}
                    className="flex-1 py-2 bg-[var(--color-border)] hover:bg-[#3a3a4a] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg transition-colors disabled:opacity-50">No asistió</button>
                  <button disabled={!!savingStatus} onClick={() => updateStatus(selectedApt, 'cancelled')}
                    className="flex-1 py-2 bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] text-sm font-medium rounded-lg transition-colors disabled:opacity-50">Cancelar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── New appointment modal ────────────────────────────────────────────── */}
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

              {isOwner && barbers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Barbero *</label>
                  <select value={form.barber_id} onChange={e => setForm(f => ({ ...f, barber_id: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm">
                    {barbers.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
                  </select>
                </div>
              )}

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

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Notas</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                  placeholder="Instrucciones especiales, preferencias..."
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm resize-none" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border)] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
                  {saving ? 'Creando...' : 'Crear cita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Block modal ──────────────────────────────────────────────────────── */}
      {showBlockModal && (
        <BlockModal
          barbers={barbers}
          isOwner={isOwner}
          currentMemberId={currentMemberId}
          initialDate={dateStr}
          onClose={() => setShowBlockModal(false)}
          onSaved={() => fetchBlocks()}
        />
      )}
    </div>
  );
}

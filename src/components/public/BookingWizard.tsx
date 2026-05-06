import { useState, useEffect } from 'react';

interface Barber { id: string; display_name: string; avatar_url: string | null; role: string; }
interface Service { id: string; name: string; price: number; duration_minutes: number; description: string | null; }
interface Barbershop { id: string; name: string; whatsapp: string | null; }

interface Props {
  barbershop: Barbershop;
  barbers: Barber[];
  services: Service[];
}

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function fmt(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
}

function toTimeLabel(t: string) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

type Step = 'barber' | 'service' | 'date' | 'time' | 'info' | 'confirm' | 'done';

// Light-theme token shortcuts
const T = {
  card: 'bg-white border border-[#e8e6e0]',
  cardHover: 'hover:border-[#1a1818]',
  text: 'text-[#1a1818]',
  muted: 'text-[#888]',
  input: 'w-full px-4 py-3 bg-white border border-[#e0deda] rounded-xl text-[#1a1818] placeholder-[#bbb] focus:outline-none focus:border-[#1a1818] text-sm transition-colors',
  btnPrimary: 'w-full py-3.5 bg-[#1a1818] hover:bg-[#2d2b28] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-base rounded-xl transition-colors',
  btnBack: 'flex items-center gap-1 text-sm text-[#888] hover:text-[#1a1818] mb-5 transition-colors',
};

export default function BookingWizard({ barbershop, barbers, services }: Props) {
  const [step, setStep] = useState<Step>('barber');
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [closedDay, setClosedDay] = useState(false);
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [result, setResult] = useState<any>(null);

  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  useEffect(() => {
    if (!selectedDate || !selectedBarber) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedSlot('');
    setClosedDay(false);
    fetch(`/api/public/availability?barbershop_id=${barbershop.id}&barber_id=${selectedBarber.id}&date=${selectedDate}&service_id=${selectedService?.id ?? ''}`)
      .then(r => r.json())
      .then(d => {
        if (d.closed) { setClosedDay(true); setSlots([]); }
        else { setSlots(d.slots ?? []); }
      })
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, selectedBarber, selectedService]);

  const handleBook = async () => {
    if (!clientName.trim()) { setBookingError('Ingresa tu nombre.'); return; }
    setBooking(true);
    setBookingError('');
    const res = await fetch('/api/public/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barbershop_id: barbershop.id,
        barber_id: selectedBarber!.id,
        service_id: selectedService!.id,
        date: selectedDate,
        start_time: selectedSlot,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim() || null,
        notes: notes.trim() || null,
      }),
    });
    const data = await res.json();
    setBooking(false);
    if (!res.ok) { setBookingError(data.error ?? 'Error al reservar.'); return; }
    setResult(data.appointment);
    setStep('done');
  };

  const reset = () => {
    setStep('barber'); setSelectedBarber(null); setSelectedService(null);
    setSelectedDate(''); setSelectedSlot(''); setClientName('');
    setClientPhone(''); setNotes(''); setResult(null); setBookingError('');
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay();
  const calDays = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDay(calYear, calMonth);
  const toDateStr = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const stepOrder: Step[] = ['barber', 'service', 'date', 'time', 'info', 'confirm'];
  const stepIdx = stepOrder.indexOf(step);

  const StepBar = () => (
    <div className="flex items-center gap-1.5 mb-6">
      {stepOrder.map((s, i) => (
        <div
          key={s}
          className={`flex-1 h-1 rounded-full transition-colors ${i <= stepIdx ? 'bg-[#1a1818]' : 'bg-[#e8e6e0]'}`}
        />
      ))}
    </div>
  );

  // ── DONE ────────────────────────────────────────────────────────────────
  if (step === 'done' && result) {
    return (
      <div id="booking" className="bg-white border border-[#e8e6e0] rounded-2xl p-8 text-center max-w-md mx-auto">
        <div className="w-14 h-14 rounded-full bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-[#1a1818] mb-2">¡Cita reservada!</h2>
        <p className="text-[#888] text-sm mb-6 leading-relaxed">
          Tu cita está <span className="text-amber-600 font-semibold">pendiente de confirmación</span>. Te contactaremos pronto.
        </p>

        <div className="bg-[#f8f7f4] border border-[#e8e6e0] rounded-xl p-4 text-left mb-6 space-y-2.5">
          {[
            { label: 'Servicio', value: selectedService?.name },
            { label: 'Barbero', value: selectedBarber?.display_name },
            { label: 'Fecha', value: new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) },
            { label: 'Hora', value: toTimeLabel(selectedSlot) },
            { label: 'Precio', value: fmt(selectedService?.price ?? 0) },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-[#888]">{label}</span>
              <span className="text-[#1a1818] font-semibold">{value}</span>
            </div>
          ))}
        </div>

        {barbershop.whatsapp && (
          <a
            href={`https://wa.me/57${barbershop.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, acabo de reservar una cita para ${result.client_name} el ${selectedDate} a las ${toTimeLabel(selectedSlot)} con ${selectedBarber?.display_name ?? 'el barbero'}.`)}`}
            target="_blank"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#25d366] hover:bg-[#20bc5a] text-white font-semibold rounded-xl transition-colors mb-3 text-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Confirmar por WhatsApp
          </a>
        )}
        <button
          onClick={reset}
          className="w-full py-2.5 bg-white hover:bg-[#f5f4f1] border border-[#e8e6e0] text-[#888] hover:text-[#1a1818] text-sm font-medium rounded-xl transition-colors"
        >
          Reservar otra cita
        </button>
      </div>
    );
  }

  // ── WIZARD ───────────────────────────────────────────────────────────────
  return (
    <div id="booking" className="max-w-lg mx-auto">
      <div className="bg-white border border-[#e8e6e0] rounded-2xl p-6 sm:p-8">

        {step !== 'barber' && <StepBar />}

        {/* Step 1: Barber */}
        {step === 'barber' && (
          <div>
            <p className="text-xs font-semibold text-[#888] uppercase tracking-widest mb-1">Paso 1</p>
            <h3 className="text-lg font-bold text-[#1a1818] mb-5">¿Con quién quieres cortarte?</h3>
            <div className="space-y-2.5">
              {barbers.map(b => (
                <button
                  key={b.id}
                  onClick={() => { setSelectedBarber(b); setStep('service'); }}
                  className="w-full flex items-center gap-4 p-4 bg-[#f8f7f4] border border-[#e8e6e0] hover:border-[#1a1818] hover:bg-white rounded-xl transition-all group text-left"
                >
                  <div className="w-11 h-11 rounded-full bg-[#e8e6e0] flex items-center justify-center text-[#1a1818] font-bold text-base flex-shrink-0 overflow-hidden">
                    {b.avatar_url
                      ? <img src={b.avatar_url} alt={b.display_name} className="w-full h-full object-cover" />
                      : b.display_name.charAt(0).toUpperCase()
                    }
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-[#1a1818] text-sm">{b.display_name}</p>
                    <p className="text-xs text-[#888] mt-0.5">{b.role === 'owner' ? 'Dueño & Barbero' : 'Barbero'}</p>
                  </div>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#ccc] group-hover:text-[#1a1818] transition-colors flex-shrink-0">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Service */}
        {step === 'service' && (
          <div>
            <button onClick={() => setStep('barber')} className={T.btnBack}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Volver
            </button>
            <p className="text-xs font-semibold text-[#888] uppercase tracking-widest mb-1">Paso 2</p>
            <h3 className="text-lg font-bold text-[#1a1818] mb-1">¿Qué servicio?</h3>
            <p className="text-sm text-[#888] mb-5">Con <span className="text-[#1a1818] font-medium">{selectedBarber?.display_name}</span></p>
            <div className="space-y-2.5">
              {services.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedService(s); setStep('date'); }}
                  className="w-full flex items-center justify-between p-4 bg-[#f8f7f4] border border-[#e8e6e0] hover:border-[#1a1818] hover:bg-white rounded-xl transition-all text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1a1818] text-sm">{s.name}</p>
                    {s.description && <p className="text-xs text-[#888] mt-0.5 truncate">{s.description}</p>}
                    <p className="text-xs text-[#aaa] mt-0.5 flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {s.duration_minutes} min
                    </p>
                  </div>
                  <span className="text-[#1a1818] font-bold text-base ml-4 flex-shrink-0">{fmt(s.price)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Date */}
        {step === 'date' && (
          <div>
            <button onClick={() => setStep('service')} className={T.btnBack}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Volver
            </button>
            <p className="text-xs font-semibold text-[#888] uppercase tracking-widest mb-1">Paso 3</p>
            <h3 className="text-lg font-bold text-[#1a1818] mb-1">¿Qué día?</h3>
            <p className="text-sm text-[#888] mb-5">{selectedService?.name} · {selectedBarber?.display_name}</p>

            <div className="bg-[#f8f7f4] border border-[#e8e6e0] rounded-xl p-4">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => {
                    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                    else setCalMonth(m => m - 1);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[#e8e6e0] text-[#888] hover:text-[#1a1818] transition-colors disabled:opacity-30"
                  disabled={calYear === today.getFullYear() && calMonth === today.getMonth()}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <p className="font-semibold text-[#1a1818] text-sm">{MONTHS_ES[calMonth]} {calYear}</p>
                <button
                  onClick={() => {
                    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                    else setCalMonth(m => m + 1);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[#e8e6e0] text-[#888] hover:text-[#1a1818] transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS_ES.map(d => (
                  <div key={d} className="text-center text-xs text-[#aaa] py-1 font-medium">{d}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: calDays }).map((_, i) => {
                  const d = i + 1;
                  const dateStr = toDateStr(calYear, calMonth, d);
                  const dateObj = new Date(dateStr + 'T12:00:00');
                  const isPast = dateObj < today;
                  const isSelected = dateStr === selectedDate;
                  const isTodayDate = dateStr === toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

                  return (
                    <button
                      key={d}
                      onClick={() => {
                        if (!isPast) { setSelectedDate(dateStr); setStep('time'); }
                      }}
                      disabled={isPast}
                      className={[
                        'aspect-square rounded-lg text-sm font-medium transition-all',
                        isPast
                          ? 'text-[#d0ceca] cursor-not-allowed'
                          : isSelected
                            ? 'bg-[#1a1818] text-white'
                            : isTodayDate
                              ? 'bg-[#e8e6e0] text-[#1a1818] font-bold hover:bg-[#d0ceca]'
                              : 'text-[#1a1818] hover:bg-[#e8e6e0]',
                      ].join(' ')}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Time slot */}
        {step === 'time' && (
          <div>
            <button onClick={() => setStep('date')} className={T.btnBack}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Volver
            </button>
            <p className="text-xs font-semibold text-[#888] uppercase tracking-widest mb-1">Paso 4</p>
            <h3 className="text-lg font-bold text-[#1a1818] mb-1">¿A qué hora?</h3>
            <p className="text-sm text-[#888] mb-5">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>

            {loadingSlots ? (
              <div className="text-center py-10 text-[#888] text-sm">Cargando horarios...</div>
            ) : closedDay ? (
              <div className="text-center py-10">
                <p className="text-[#888] text-sm mb-3">La barbería está cerrada ese día.</p>
                <button onClick={() => setStep('date')} className="text-[#1a1818] underline text-sm font-medium">Elige otro día</button>
              </div>
            ) : slots.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-[#888] text-sm mb-3">No hay horarios disponibles ese día.</p>
                <button onClick={() => setStep('date')} className="text-[#1a1818] underline text-sm font-medium">Elige otro día</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map(slot => (
                    <button
                      key={slot}
                      onClick={() => { setSelectedSlot(slot); setStep('info'); }}
                      className={[
                        'py-2.5 rounded-xl text-sm font-medium border transition-all',
                        selectedSlot === slot
                          ? 'bg-[#1a1818] border-[#1a1818] text-white'
                          : 'bg-[#f5f4f1] border-[#e8e6e0] text-[#1a1818] hover:border-[#1a1818] hover:bg-white',
                      ].join(' ')}
                    >
                      {toTimeLabel(slot)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#aaa] mt-3 text-center">{slots.length} horarios disponibles</p>
              </>
            )}
          </div>
        )}

        {/* Step 5: Contact info */}
        {step === 'info' && (
          <div>
            <button onClick={() => setStep('time')} className={T.btnBack}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Volver
            </button>
            <p className="text-xs font-semibold text-[#888] uppercase tracking-widest mb-1">Paso 5</p>
            <h3 className="text-lg font-bold text-[#1a1818] mb-5">Tus datos</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#1a1818] mb-1.5">Nombre *</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className={T.input}
                  placeholder="Ej: Juan García"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1a1818] mb-1.5">WhatsApp / Teléfono</label>
                <input
                  type="tel"
                  value={clientPhone}
                  onChange={e => setClientPhone(e.target.value)}
                  className={T.input}
                  placeholder="300 123 4567"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#1a1818] mb-1.5">Notas <span className="text-[#aaa] font-normal">(opcional)</span></label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className={T.input + ' resize-none'}
                  placeholder="Ej: Quiero barba también"
                />
              </div>
            </div>
            <button
              onClick={() => { if (clientName.trim()) setStep('confirm'); }}
              disabled={!clientName.trim()}
              className={`mt-5 ${T.btnPrimary}`}
            >
              Continuar →
            </button>
          </div>
        )}

        {/* Step 6: Confirm */}
        {step === 'confirm' && (
          <div>
            <button onClick={() => setStep('info')} className={T.btnBack}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              Volver
            </button>
            <p className="text-xs font-semibold text-[#888] uppercase tracking-widest mb-1">Paso 6</p>
            <h3 className="text-lg font-bold text-[#1a1818] mb-5">Confirma tu cita</h3>

            <div className="bg-[#f8f7f4] border border-[#e8e6e0] rounded-xl p-5 space-y-3 mb-5">
              {[
                { label: 'Barbero', value: selectedBarber?.display_name },
                { label: 'Servicio', value: selectedService?.name },
                { label: 'Precio', value: fmt(selectedService?.price ?? 0) },
                { label: 'Duración', value: `${selectedService?.duration_minutes} min` },
                { label: 'Fecha', value: new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) },
                { label: 'Hora', value: toTimeLabel(selectedSlot) },
                { label: 'Nombre', value: clientName },
                ...(clientPhone ? [{ label: 'Teléfono', value: clientPhone }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-[#888]">{label}</span>
                  <span className="text-[#1a1818] font-semibold text-right ml-4">{value}</span>
                </div>
              ))}
            </div>

            {bookingError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{bookingError}</div>
            )}

            <button
              onClick={handleBook}
              disabled={booking}
              className={T.btnPrimary}
            >
              {booking ? 'Reservando...' : '✓ Confirmar cita'}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

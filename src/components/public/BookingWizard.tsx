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

  // Calendar
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  // Load slots when date or barber/service change
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

  // Calendar helpers
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDay = (y: number, m: number) => new Date(y, m, 1).getDay();

  const calDays = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDay(calYear, calMonth);

  const toDateStr = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // Steps progress
  const stepOrder: Step[] = ['barber', 'service', 'date', 'time', 'info', 'confirm'];
  const stepIdx = stepOrder.indexOf(step);

  const StepBar = () => (
    <div className="flex items-center gap-1 mb-6">
      {stepOrder.map((s, i) => (
        <div
          key={s}
          className={`flex-1 h-1 rounded-full transition-colors ${i <= stepIdx ? 'bg-[#2563eb]' : 'bg-[#2a2a3a]'}`}
        />
      ))}
    </div>
  );

  if (step === 'done' && result) {
    return (
      <div id="booking" className="bg-[#12121a] border border-green-500/30 rounded-2xl p-8 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-white mb-2">¡Cita reservada!</h2>
        <p className="text-[#8888a0] mb-5">
          Tu cita está <span className="text-amber-400 font-medium">pendiente de confirmación</span>. Te contactaremos para confirmarla.
        </p>
        <div className="bg-[#0a0a0f] rounded-xl p-4 text-left mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[#8888a0]">Servicio</span>
            <span className="text-white font-medium">{selectedService?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8888a0]">Barbero</span>
            <span className="text-white font-medium">{selectedBarber?.display_name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8888a0]">Fecha</span>
            <span className="text-white font-medium">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8888a0]">Hora</span>
            <span className="text-white font-medium">{toTimeLabel(selectedSlot)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#8888a0]">Precio</span>
            <span className="text-white font-medium">{fmt(selectedService?.price ?? 0)}</span>
          </div>
        </div>
        {barbershop.whatsapp && (
          <a
            href={`https://wa.me/57${barbershop.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, acabo de reservar una cita para ${result.client_name} el ${selectedDate} a las ${toTimeLabel(selectedSlot)} con ${selectedBarber?.display_name ?? 'el barbero'}.`)}`}
            target="_blank"
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#25d366] hover:bg-[#20bc5a] text-white font-semibold rounded-xl transition-colors mb-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Confirmar por WhatsApp
          </a>
        )}
        <button onClick={reset} className="w-full py-2.5 bg-[#1a1a25] hover:bg-[#2a2a3a] border border-[#2a2a3a] text-[#8888a0] hover:text-white text-sm font-medium rounded-xl transition-colors">
          Reservar otra cita
        </button>
      </div>
    );
  }

  return (
    <div id="booking" className="max-w-lg mx-auto">
      <h2 className="text-2xl font-bold text-white text-center mb-2">Reserva tu cita</h2>
      <p className="text-[#8888a0] text-center text-sm mb-6">Online, rápido y sin llamadas</p>

      {step !== 'barber' && <StepBar />}

      {/* Step 1: Select barber */}
      {step === 'barber' && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">¿Con quién quieres cortarte?</h3>
          <div className="space-y-3">
            {barbers.map(b => (
              <button
                key={b.id}
                onClick={() => { setSelectedBarber(b); setStep('service'); }}
                className="w-full flex items-center gap-4 p-4 bg-[#12121a] border border-[#2a2a3a] hover:border-[#2563eb] rounded-xl transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-full bg-[#2563eb]/20 flex items-center justify-center text-[#3b82f6] font-bold text-lg flex-shrink-0">
                  {b.avatar_url
                    ? <img src={b.avatar_url} alt={b.display_name} className="w-full h-full object-cover rounded-full" />
                    : b.display_name.charAt(0).toUpperCase()
                  }
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">{b.display_name}</p>
                  <p className="text-xs text-[#8888a0]">{b.role === 'owner' ? 'Dueño & Barbero' : 'Barbero'}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#8888a0] group-hover:text-[#2563eb] transition-colors">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Select service */}
      {step === 'service' && (
        <div>
          <button onClick={() => setStep('barber')} className="flex items-center gap-1 text-sm text-[#8888a0] hover:text-white mb-4 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Volver
          </button>
          <h3 className="text-lg font-semibold text-white mb-1">¿Qué servicio quieres?</h3>
          <p className="text-sm text-[#8888a0] mb-4">Barbero: <span className="text-white">{selectedBarber?.display_name}</span></p>
          <div className="space-y-2">
            {services.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedService(s); setStep('date'); }}
                className="w-full flex items-center justify-between p-4 bg-[#12121a] border border-[#2a2a3a] hover:border-[#2563eb] rounded-xl transition-all group text-left"
              >
                <div>
                  <p className="font-semibold text-white">{s.name}</p>
                  {s.description && <p className="text-xs text-[#8888a0] mt-0.5">{s.description}</p>}
                  <p className="text-xs text-[#8888a0] mt-0.5">{s.duration_minutes} min</p>
                </div>
                <span className="text-[#2563eb] font-bold text-lg ml-4 flex-shrink-0">{fmt(s.price)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Pick date */}
      {step === 'date' && (
        <div>
          <button onClick={() => setStep('service')} className="flex items-center gap-1 text-sm text-[#8888a0] hover:text-white mb-4 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Volver
          </button>
          <h3 className="text-lg font-semibold text-white mb-1">¿Qué día?</h3>
          <p className="text-sm text-[#8888a0] mb-4">{selectedService?.name} con {selectedBarber?.display_name}</p>

          {/* Calendar */}
          <div className="bg-[#12121a] border border-[#2a2a3a] rounded-xl p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
                  else setCalMonth(m => m - 1);
                }}
                className="p-1.5 rounded-lg hover:bg-[#2a2a3a] text-[#8888a0] hover:text-white transition-colors"
                disabled={calYear === today.getFullYear() && calMonth === today.getMonth()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <p className="font-semibold text-white">{MONTHS_ES[calMonth]} {calYear}</p>
              <button
                onClick={() => {
                  if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
                  else setCalMonth(m => m + 1);
                }}
                className="p-1.5 rounded-lg hover:bg-[#2a2a3a] text-[#8888a0] hover:text-white transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS_ES.map(d => (
                <div key={d} className="text-center text-xs text-[#8888a0] py-1">{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
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
                      if (!isPast) {
                        setSelectedDate(dateStr);
                        setStep('time');
                      }
                    }}
                    disabled={isPast}
                    className={[
                      'aspect-square rounded-lg text-sm font-medium transition-all',
                      isPast ? 'text-[#3a3a4a] cursor-not-allowed' :
                      isSelected ? 'bg-[#2563eb] text-white' :
                      isTodayDate ? 'bg-[#2563eb]/20 text-[#3b82f6] hover:bg-[#2563eb]/40' :
                      'text-white hover:bg-[#2a2a3a]'
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

      {/* Step 4: Pick time slot */}
      {step === 'time' && (
        <div>
          <button onClick={() => setStep('date')} className="flex items-center gap-1 text-sm text-[#8888a0] hover:text-white mb-4 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Volver
          </button>
          <h3 className="text-lg font-semibold text-white mb-1">¿A qué hora?</h3>
          <p className="text-sm text-[#8888a0] mb-4">
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>

          {loadingSlots ? (
            <div className="text-center py-12 text-[#8888a0]">Cargando horarios disponibles...</div>
          ) : closedDay ? (
            <div className="text-center py-12">
              <p className="text-[#8888a0] mb-3">La barbería está cerrada ese día.</p>
              <button onClick={() => setStep('date')} className="text-[#2563eb] hover:underline text-sm">Elige otro día</button>
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-[#8888a0] mb-3">No hay horarios disponibles ese día.</p>
              <button onClick={() => setStep('date')} className="text-[#2563eb] hover:underline text-sm">Elige otro día</button>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map(slot => (
                <button
                  key={slot}
                  onClick={() => { setSelectedSlot(slot); setStep('info'); }}
                  className={[
                    'py-2.5 rounded-lg text-sm font-medium border transition-all',
                    selectedSlot === slot
                      ? 'bg-[#2563eb] border-[#2563eb] text-white'
                      : 'bg-[#12121a] border-[#2a2a3a] text-white hover:border-[#2563eb] hover:text-[#3b82f6]'
                  ].join(' ')}
                >
                  {toTimeLabel(slot)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 5: Contact info */}
      {step === 'info' && (
        <div>
          <button onClick={() => setStep('time')} className="flex items-center gap-1 text-sm text-[#8888a0] hover:text-white mb-4 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Volver
          </button>
          <h3 className="text-lg font-semibold text-white mb-4">Tus datos</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#f0f0f5] mb-1.5">Tu nombre *</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="w-full px-4 py-3 bg-[#12121a] border border-[#2a2a3a] rounded-xl text-white placeholder-[#8888a0] focus:outline-none focus:border-[#2563eb] text-sm"
                placeholder="Ej: Juan García"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#f0f0f5] mb-1.5">WhatsApp / Teléfono</label>
              <input
                type="tel"
                value={clientPhone}
                onChange={e => setClientPhone(e.target.value)}
                className="w-full px-4 py-3 bg-[#12121a] border border-[#2a2a3a] rounded-xl text-white placeholder-[#8888a0] focus:outline-none focus:border-[#2563eb] text-sm"
                placeholder="300 123 4567"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#f0f0f5] mb-1.5">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 bg-[#12121a] border border-[#2a2a3a] rounded-xl text-white placeholder-[#8888a0] focus:outline-none focus:border-[#2563eb] text-sm resize-none"
                placeholder="Ej: Quiero barba también"
              />
            </div>
          </div>
          <button
            onClick={() => { if (clientName.trim()) setStep('confirm'); }}
            disabled={!clientName.trim()}
            className="mt-5 w-full py-3 bg-[#2563eb] hover:bg-[#3b82f6] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
          >
            Continuar →
          </button>
        </div>
      )}

      {/* Step 6: Confirm */}
      {step === 'confirm' && (
        <div>
          <button onClick={() => setStep('info')} className="flex items-center gap-1 text-sm text-[#8888a0] hover:text-white mb-4 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Volver
          </button>
          <h3 className="text-lg font-semibold text-white mb-5">Confirma tu cita</h3>

          <div className="bg-[#0a0a0f] border border-[#2a2a3a] rounded-xl p-5 space-y-3 mb-5">
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
                <span className="text-[#8888a0]">{label}</span>
                <span className="text-white font-medium text-right ml-4">{value}</span>
              </div>
            ))}
          </div>

          {bookingError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{bookingError}</div>
          )}

          <button
            onClick={handleBook}
            disabled={booking}
            className="w-full py-3.5 bg-[#2563eb] hover:bg-[#3b82f6] disabled:opacity-60 text-white font-bold text-base rounded-xl transition-colors"
          >
            {booking ? 'Reservando...' : '✓ Confirmar cita'}
          </button>
        </div>
      )}
    </div>
  );
}

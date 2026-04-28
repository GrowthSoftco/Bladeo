export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function formatCOP(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).replace(/,/g, '.');
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    ...options,
  });
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${displayH}:${minutes} ${ampm}`;
}

export function whatsappUrl(phone: string, message?: string): string {
  const clean = phone.replace(/\D/g, '');
  const number = clean.startsWith('57') ? clean : `57${clean}`;
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function generateTimeSlots(
  openTime: string,
  closeTime: string,
  durationMinutes: number,
): string[] {
  const slots: string[] = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  let currentMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  while (currentMinutes + durationMinutes <= closeMinutes) {
    const h = Math.floor(currentMinutes / 60).toString().padStart(2, '0');
    const m = (currentMinutes % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
    currentMinutes += durationMinutes;
  }

  return slots;
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const DAY_NAMES: Record<string, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
};

export const EXPENSE_CATEGORIES = [
  'Arriendo',
  'Servicios públicos',
  'Productos/Insumos',
  'Nómina',
  'Marketing',
  'Otros',
] as const;

export const BANKING_ENTITIES = [
  'Efecty',
  'Bancolombia',
  'Nequi Punto',
  'Daviplata',
  'Giros & Finanzas',
  'Supergiros',
  'Otros',
] as const;

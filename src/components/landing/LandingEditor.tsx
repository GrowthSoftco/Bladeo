import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';

/* ─── Types ──────────────────────────────────────────────────────────────── */
type BlockType =
  | 'hero'
  | 'text'
  | 'services'
  | 'gallery'
  | 'booking'
  | 'whatsapp'
  | 'divider'
  | 'image_text'
  | 'cta';

interface Block {
  id: string;
  type: BlockType;
  visible: boolean;
  content: Record<string, unknown>;
}

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  description?: string | null;
}

interface GalleryItem {
  id: string;
  image_url: string;
  caption?: string | null;
}

interface Props {
  barbershopId: string;
  barbershopName: string;
  barbershopSlug: string;
  initialBlocks: Block[];
  barbershopCoverUrl?: string | null;
  barbershopLogoUrl?: string | null;
  services?: ServiceItem[];
  galleryImages?: GalleryItem[];
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const LABELS: Record<BlockType, string> = {
  hero: 'Portada',
  text: 'Texto',
  services: 'Servicios',
  gallery: 'Galería',
  booking: 'Reservas',
  whatsapp: 'WhatsApp',
  divider: 'Separador',
  image_text: 'Imagen + Texto',
  cta: 'Llamada a la acción',
};

// These types can be deleted by the user
const DELETABLE: BlockType[] = ['text', 'divider', 'image_text', 'cta', 'services', 'gallery', 'booking', 'whatsapp'];

// Default content for each block type
const DEFAULTS: Record<BlockType, Record<string, unknown>> = {
  hero:       { title: '', subtitle: '', cta_text: 'Reservar cita', cta_show: true },
  text:       { heading: 'Título de la sección', body: 'Escribe aquí el contenido del bloque…' },
  services:   { heading: 'Servicios', show_book_btn: true },
  gallery:    { heading: 'Nuestro trabajo' },
  booking:    { heading: 'Reserva tu cita' },
  whatsapp:   { text: 'Reservar por WhatsApp' },
  divider:    {},
  image_text: { image_url: '', heading: 'Título del bloque', body: 'Describe aquí el contenido de esta sección…', image_side: 'left' },
  cta:        { heading: '¿Listo para reservar?', body: 'Tu próximo corte te espera.', button_text: 'Reservar ahora', style: 'dark' },
};

// Only one of each of these should exist
const UNIQUE_TYPES: BlockType[] = ['hero', 'services', 'gallery', 'booking', 'whatsapp'];

// Content blocks (always addable, can have multiples)
const CONTENT_TYPES: { type: BlockType; desc: string }[] = [
  { type: 'text',       desc: 'Encabezado y párrafo de texto' },
  { type: 'image_text', desc: 'Imagen junto a texto' },
  { type: 'cta',        desc: 'Botón de llamada a la acción' },
  { type: 'divider',    desc: 'Línea separadora' },
];

// Section blocks (unique — only show if not already present)
const SECTION_TYPES: { type: BlockType; desc: string }[] = [
  { type: 'services', desc: 'Listado de tus servicios y precios' },
  { type: 'gallery',  desc: 'Galería de fotos del barbershop' },
  { type: 'booking',  desc: 'Widget de reserva de citas' },
  { type: 'whatsapp', desc: 'Botón de contacto por WhatsApp' },
];

function genId() { return Math.random().toString(36).slice(2, 9); }

function formatCOP(n: number) {
  return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.');
}

/* ─── EditField ──────────────────────────────────────────────────────────── */
function EditField({
  value,
  onChange,
  tag = 'div',
  style,
  multiline = false,
  accentColor = '#3b82f6',
}: {
  value: string;
  onChange: (v: string) => void;
  tag?: 'h1' | 'h2' | 'h3' | 'p' | 'div' | 'span';
  style?: React.CSSProperties;
  multiline?: boolean;
  accentColor?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);

  useLayoutEffect(() => {
    if (ref.current) ref.current.textContent = value || '';
  }, []); // only on mount

  useEffect(() => {
    if (ref.current && document.activeElement !== ref.current) {
      if (ref.current.textContent !== (value || '')) {
        ref.current.textContent = value || '';
      }
    }
  }, [value]);

  const shared = {
    ref: ref as React.RefObject<any>,
    contentEditable: true as const,
    suppressContentEditableWarning: true,
    onFocus: () => setActive(true),
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      setActive(false);
      onChange(e.currentTarget.textContent?.trim() || '');
    },
    onInput: (e: React.FormEvent<HTMLElement>) => {
      onChange((e.currentTarget as HTMLElement).textContent || '');
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      if (!multiline && e.key === 'Enter') {
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur();
      }
    },
    style: {
      outline: 'none',
      cursor: 'text',
      borderBottom: active ? `2px solid ${accentColor}` : '2px solid transparent',
      transition: 'border-color 0.15s',
      display: 'block',
      ...style,
    },
  };

  if (tag === 'h1') return <h1 {...shared} />;
  if (tag === 'h2') return <h2 {...shared} />;
  if (tag === 'h3') return <h3 {...shared} />;
  if (tag === 'p') return <p {...shared} />;
  if (tag === 'span') return <span {...shared} />;
  return <div {...shared} />;
}

/* ─── InsertButton ───────────────────────────────────────────────────────── */
function InsertButton({
  onInsert,
  existingTypes,
}: {
  onInsert: (type: BlockType) => void;
  existingTypes: BlockType[];
}) {
  const [hovered, setHovered] = useState(false);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setHovered(false);
      }
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const availableSections = SECTION_TYPES.filter(s => !existingTypes.includes(s.type));

  const blockIcon = (type: BlockType) => {
    const icons: Partial<Record<BlockType, React.ReactNode>> = {
      text: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h8" /></svg>,
      image_text: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="8" height="18" rx="1" /><path d="M15 7h6M15 12h6M15 17h4" /></svg>,
      cta: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="10" rx="3" /><path d="M8 12h8" /></svg>,
      divider: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>,
      services: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg>,
      gallery: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>,
      booking: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
      whatsapp: <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>,
    };
    return icons[type] ?? null;
  };

  const menuBtnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '10px',
    width: '100%', padding: '8px 14px',
    background: 'transparent', border: 'none', cursor: 'pointer',
    fontSize: '0.82rem', color: '#1a1818', fontFamily: 'inherit', textAlign: 'left',
  };

  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '28px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { if (!open) setHovered(false); }}
    >
      <div style={{ flex: 1, height: '1px', background: hovered || open ? '#3b82f6' : '#e2e0da', transition: 'background 0.2s' }} />
      <button
        onClick={() => setOpen(v => !v)}
        title="Insertar bloque"
        style={{
          width: '24px', height: '24px', borderRadius: '50%',
          background: hovered || open ? '#3b82f6' : '#e2e0da',
          border: 'none', color: hovered || open ? '#fff' : '#999',
          fontSize: '16px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'background 0.2s, color 0.2s',
          fontFamily: 'inherit', padding: 0,
        }}
      >+</button>
      <div style={{ flex: 1, height: '1px', background: hovered || open ? '#3b82f6' : '#e2e0da', transition: 'background 0.2s' }} />

      {open && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            marginTop: '6px', background: '#fff', border: '1px solid #e2e0da',
            borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
            overflow: 'hidden', zIndex: 30, minWidth: '240px',
          }}
        >
          {/* Content blocks */}
          <div style={{ padding: '8px 0 4px' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#aaa', padding: '0 14px 4px', margin: 0 }}>
              Contenido
            </p>
            {CONTENT_TYPES.map(({ type, desc }) => (
              <button
                key={type}
                onClick={() => { onInsert(type); setOpen(false); setHovered(false); }}
                style={menuBtnStyle}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f4f1')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: '#666', flexShrink: 0 }}>{blockIcon(type)}</span>
                <span>
                  <strong style={{ display: 'block', fontSize: '0.82rem' }}>{LABELS[type]}</strong>
                  <span style={{ fontSize: '0.7rem', color: '#aaa' }}>{desc}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Section blocks (unique) */}
          {availableSections.length > 0 && (
            <div style={{ borderTop: '1px solid #f0ede8', padding: '8px 0 4px' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#aaa', padding: '0 14px 4px', margin: 0 }}>
                Secciones
              </p>
              {availableSections.map(({ type, desc }) => (
                <button
                  key={type}
                  onClick={() => { onInsert(type); setOpen(false); setHovered(false); }}
                  style={menuBtnStyle}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f4f1')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: '#666', flexShrink: 0 }}>{blockIcon(type)}</span>
                  <span>
                    <strong style={{ display: 'block', fontSize: '0.82rem' }}>{LABELS[type]}</strong>
                    <span style={{ fontSize: '0.7rem', color: '#aaa' }}>{desc}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Block Renderers ────────────────────────────────────────────────────── */

function HeroRenderer({
  block, onChange, coverUrl, logoUrl, shopName,
}: {
  block: Block;
  onChange: (c: Record<string, unknown>) => void;
  coverUrl?: string | null;
  logoUrl?: string | null;
  shopName: string;
}) {
  const c = block.content;
  return (
    <section style={{ position: 'relative', height: '420px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden', userSelect: 'none' }}>
      {coverUrl
        ? <img src={coverUrl} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }} />
        : <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#1a1818 0%,#2d2b28 100%)' }} />
      }
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.85) 100%)' }} />

      <div style={{ position: 'relative', padding: '0 28px 36px', maxWidth: '660px' }}>
        {/* Logo */}
        <div style={{ width: '56px', height: '56px', borderRadius: '12px', overflow: 'hidden', background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {logoUrl
            ? <img src={logoUrl} alt={shopName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
            : <span style={{ fontSize: '20px', fontWeight: 900, color: '#1a1818' }}>{shopName.charAt(0)}</span>
          }
        </div>

        <EditField value={(c.title as string) || ''} onChange={v => onChange({ ...c, title: v })} tag="h1" accentColor="rgba(255,255,255,0.7)"
          style={{ fontSize: 'clamp(1.8rem,4vw,3rem)', fontWeight: 900, color: '#fff', lineHeight: 1.08, margin: '0 0 10px', letterSpacing: '-0.02em' }} />

        <EditField value={(c.subtitle as string) || ''} onChange={v => onChange({ ...c, subtitle: v })} tag="p" multiline accentColor="rgba(255,255,255,0.6)"
          style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.72)', margin: '0 0 20px', lineHeight: 1.6, maxWidth: '480px' }} />

        {c.cta_show !== false && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '11px 22px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.25)' }}>
            <EditField value={(c.cta_text as string) || 'Reservar cita'} onChange={v => onChange({ ...c, cta_text: v })} tag="span" accentColor="#3b82f6"
              style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a1818', display: 'inline' }} />
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1a1818" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
          </div>
        )}
      </div>
    </section>
  );
}

function TextRenderer({ block, onChange }: { block: Block; onChange: (c: Record<string, unknown>) => void }) {
  const c = block.content;
  return (
    <section style={{ padding: '48px 28px', maxWidth: '800px', margin: '0 auto' }}>
      <EditField value={(c.heading as string) || ''} onChange={v => onChange({ ...c, heading: v })} tag="h2"
        style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1818', letterSpacing: '-0.02em', margin: '0 0 14px' }} />
      <EditField value={(c.body as string) || ''} onChange={v => onChange({ ...c, body: v })} tag="p" multiline
        style={{ fontSize: '1rem', color: '#555', lineHeight: 1.7, margin: 0 }} />
    </section>
  );
}

function ServicesRenderer({
  block, onChange, services,
}: {
  block: Block;
  onChange: (c: Record<string, unknown>) => void;
  services: ServiceItem[];
}) {
  const c = block.content;
  const hasReal = services.length > 0;
  const display = hasReal ? services : [
    { id: 'p1', name: 'Corte clásico', price: 25000, duration_minutes: 30, description: null },
    { id: 'p2', name: 'Corte + barba', price: 40000, duration_minutes: 50, description: null },
    { id: 'p3', name: 'Arreglo barba', price: 18000, duration_minutes: 20, description: null },
  ];

  return (
    <section style={{ padding: '56px 28px 40px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '24px' }}>
        <EditField value={(c.heading as string) || 'Servicios'} onChange={v => onChange({ ...c, heading: v })} tag="h2"
          style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1818', letterSpacing: '-0.02em', margin: 0 }} />
        <span style={{ fontSize: '0.8rem', color: '#aaa', fontWeight: 500, pointerEvents: 'none' }}>{display.length} disponibles</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '12px' }}>
        {display.map(svc => (
          <div key={svc.id} style={{ background: '#fff', borderRadius: '14px', padding: '18px', border: '1px solid #e8e6e0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
              <p style={{ fontWeight: 700, color: '#1a1818', margin: 0, fontSize: '0.9rem', lineHeight: 1.3 }}>{svc.name}</p>
              <span style={{ fontWeight: 800, color: '#1a1818', fontSize: '0.95rem', flexShrink: 0 }}>{formatCOP(svc.price)}</span>
            </div>
            {svc.description && <p style={{ fontSize: '0.73rem', color: '#aaa', margin: '0 0 6px', lineHeight: 1.4 }}>{svc.description}</p>}
            <p style={{ fontSize: '0.72rem', color: '#bbb', margin: 0 }}>{svc.duration_minutes} min</p>
          </div>
        ))}
      </div>
      {!hasReal && <p style={{ marginTop: '10px', fontSize: '0.68rem', color: '#bbb', fontStyle: 'italic', margin: '10px 0 0' }}>Mostrando servicios de ejemplo. Los tuyos aparecen cuando publicas.</p>}
    </section>
  );
}

function GalleryRenderer({
  block, onChange, galleryImages,
}: {
  block: Block;
  onChange: (c: Record<string, unknown>) => void;
  galleryImages: GalleryItem[];
}) {
  const c = block.content;
  const hasReal = galleryImages.length > 0;
  const display = galleryImages.slice(0, 12);

  return (
    <section style={{ padding: '56px 28px 40px', maxWidth: '800px', margin: '0 auto' }}>
      <EditField value={(c.heading as string) || 'Nuestro trabajo'} onChange={v => onChange({ ...c, heading: v })} tag="h2"
        style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1818', letterSpacing: '-0.02em', margin: '0 0 20px' }} />

      {hasReal ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
          {display.map(img => (
            <div key={img.id} style={{ aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', background: '#e8e6e0' }}>
              <img src={img.image_url} alt={img.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          ))}
          {display.length > 12 && (
            <div style={{ aspectRatio: '1', borderRadius: '10px', background: '#1a1818', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>+{galleryImages.length - 12}</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ aspectRatio: '1', borderRadius: '10px', background: i % 3 === 0 ? '#e8e6e0' : i % 3 === 1 ? '#d9d6cf' : '#ece9e3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            </div>
          ))}
        </div>
      )}

      <p style={{ marginTop: '10px', fontSize: '0.67rem', color: '#bbb', fontStyle: 'italic', margin: '10px 0 0' }}>
        {hasReal ? `${galleryImages.length} foto${galleryImages.length !== 1 ? 's' : ''} · En la landing aparecen como galería animada.` : 'Sube fotos en Galería para verlas aquí.'}
      </p>
    </section>
  );
}

function BookingRenderer({ block, onChange }: { block: Block; onChange: (c: Record<string, unknown>) => void }) {
  const c = block.content;
  return (
    <section style={{ padding: '56px 28px 40px', maxWidth: '800px', margin: '0 auto' }}>
      <EditField value={(c.heading as string) || 'Reserva tu cita'} onChange={v => onChange({ ...c, heading: v })} tag="h2"
        style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1a1818', letterSpacing: '-0.02em', margin: '0 0 24px' }} />
      <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e8e6e0', padding: '28px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {['Barbero', 'Servicio', 'Fecha', 'Confirmar'].map((step, i) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: i === 0 ? '#1a1818' : '#e8e6e0', color: i === 0 ? '#fff' : '#aaa', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</div>
              <span style={{ fontSize: '0.7rem', color: i === 0 ? '#1a1818' : '#bbb', fontWeight: i === 0 ? 700 : 400 }}>{step}</span>
              {i < 3 && <span style={{ color: '#ddd', fontSize: '0.8rem' }}>›</span>}
            </div>
          ))}
        </div>
        <p style={{ color: '#bbb', fontSize: '0.82rem', margin: 0 }}>El sistema de reservas aparece aquí para tus clientes.</p>
      </div>
    </section>
  );
}

function WhatsAppRenderer({ block, onChange }: { block: Block; onChange: (c: Record<string, unknown>) => void }) {
  const c = block.content;
  return (
    <section style={{ padding: '48px 28px 40px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ background: '#fff', border: '1px solid #e8e6e0', borderRadius: '20px', padding: '36px', textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', background: '#25d366', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1a1818', margin: '0 0 8px', letterSpacing: '-0.02em' }}>¿Listo para tu corte?</h3>
        <p style={{ color: '#888', margin: '0 0 20px', fontSize: '0.88rem' }}>Escríbenos y agendamos tu cita en minutos.</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#25d366', padding: '11px 22px', borderRadius: '12px' }}>
          <EditField value={(c.text as string) || 'Reservar por WhatsApp'} onChange={v => onChange({ ...c, text: v })} tag="span" accentColor="rgba(255,255,255,0.7)"
            style={{ fontSize: '0.88rem', fontWeight: 700, color: '#fff', display: 'inline' }} />
        </div>
      </div>
    </section>
  );
}

function DividerRenderer() {
  return (
    <div style={{ padding: '8px 28px' }}>
      <hr style={{ border: 'none', borderTop: '1px solid #e8e6e0', margin: 0 }} />
    </div>
  );
}

/* ─── ImageText Block ────────────────────────────────────────────────────── */
function ImageTextRenderer({ block, onChange }: { block: Block; onChange: (c: Record<string, unknown>) => void }) {
  const c = block.content;
  const imageOnLeft = c.image_side !== 'right';
  const [editingUrl, setEditingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState((c.image_url as string) || '');
  const [imgHovered, setImgHovered] = useState(false);

  const imageArea = (
    <div
      style={{ flex: '0 0 45%', position: 'relative', minHeight: '240px' }}
      onMouseEnter={() => setImgHovered(true)}
      onMouseLeave={() => setImgHovered(false)}
    >
      {c.image_url ? (
        <img
          src={c.image_url as string}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%', minHeight: '240px', objectFit: 'cover', borderRadius: '14px', display: 'block' }}
        />
      ) : (
        <div style={{ width: '100%', minHeight: '240px', background: '#e8e6e0', borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '2px dashed #ccc' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
          <span style={{ fontSize: '0.75rem', color: '#bbb', fontWeight: 500 }}>Haz clic para añadir imagen</span>
        </div>
      )}
      {/* Change image button — only on hover */}
      <button
        onClick={e => { e.stopPropagation(); setUrlDraft(c.image_url as string || ''); setEditingUrl(true); }}
        style={{
          display: imgHovered && !editingUrl ? 'flex' : 'none',
          alignItems: 'center', gap: '5px',
          position: 'absolute', bottom: '10px', right: '10px',
          background: 'rgba(255,255,255,0.92)', border: 'none', borderRadius: '8px',
          padding: '5px 10px', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)', color: '#1a1818',
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        Cambiar imagen
      </button>

      {/* URL input overlay */}
      {editingUrl && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 20 }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', width: '100%' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1a1818', margin: '0 0 10px' }}>URL de la imagen</p>
            <input
              type="url"
              value={urlDraft}
              onChange={e => setUrlDraft(e.target.value)}
              placeholder="https://..."
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') { onChange({ ...c, image_url: urlDraft }); setEditingUrl(false); }
                if (e.key === 'Escape') setEditingUrl(false);
              }}
              style={{ width: '100%', border: '1px solid #e2e0da', borderRadius: '8px', padding: '7px 10px', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: '10px' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => { onChange({ ...c, image_url: urlDraft }); setEditingUrl(false); }}
                style={{ flex: 1, background: '#1a1818', color: '#fff', border: 'none', borderRadius: '8px', padding: '7px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                Aplicar
              </button>
              <button onClick={() => setEditingUrl(false)}
                style={{ background: '#f0ede8', color: '#1a1818', border: 'none', borderRadius: '8px', padding: '7px 12px', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const textArea = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '12px' }}>
      <EditField value={(c.heading as string) || ''} onChange={v => onChange({ ...c, heading: v })} tag="h2"
        style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a1818', letterSpacing: '-0.02em', margin: 0 }} />
      <EditField value={(c.body as string) || ''} onChange={v => onChange({ ...c, body: v })} tag="p" multiline
        style={{ fontSize: '0.95rem', color: '#555', lineHeight: 1.7, margin: 0 }} />
    </div>
  );

  return (
    <section style={{ padding: '48px 28px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
        {imageOnLeft ? imageArea : textArea}
        {imageOnLeft ? textArea : imageArea}
      </div>
    </section>
  );
}

/* ─── CTA Block ──────────────────────────────────────────────────────────── */
function CtaRenderer({ block, onChange }: { block: Block; onChange: (c: Record<string, unknown>) => void }) {
  const c = block.content;
  const dark = c.style !== 'light';

  return (
    <section style={{ padding: '40px 28px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{
        background: dark ? '#1a1818' : '#fff',
        border: dark ? 'none' : '1px solid #e8e6e0',
        borderRadius: '20px',
        padding: '48px 40px',
        textAlign: 'center',
      }}>
        <EditField value={(c.heading as string) || ''} onChange={v => onChange({ ...c, heading: v })} tag="h2"
          accentColor={dark ? 'rgba(255,255,255,0.6)' : '#3b82f6'}
          style={{ fontSize: '1.6rem', fontWeight: 900, color: dark ? '#fff' : '#1a1818', letterSpacing: '-0.02em', margin: '0 0 12px' }} />

        <EditField value={(c.body as string) || ''} onChange={v => onChange({ ...c, body: v })} tag="p" multiline
          accentColor={dark ? 'rgba(255,255,255,0.5)' : '#3b82f6'}
          style={{ fontSize: '0.95rem', color: dark ? 'rgba(255,255,255,0.65)' : '#888', lineHeight: 1.6, margin: '0 0 24px', maxWidth: '460px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: dark ? '#fff' : '#1a1818', padding: '12px 28px', borderRadius: '12px', boxShadow: dark ? '0 4px 20px rgba(255,255,255,0.15)' : '0 4px 20px rgba(0,0,0,0.2)' }}>
          <EditField value={(c.button_text as string) || 'Reservar ahora'} onChange={v => onChange({ ...c, button_text: v })} tag="span"
            accentColor={dark ? '#1a1818' : 'rgba(255,255,255,0.6)'}
            style={{ fontSize: '0.95rem', fontWeight: 700, color: dark ? '#1a1818' : '#fff', display: 'inline' }} />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={dark ? '#1a1818' : '#fff'} strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        </div>

      </div>
    </section>
  );
}

/* ─── BlockRenderer switcher ─────────────────────────────────────────────── */
function BlockRenderer({
  block, onChange, coverUrl, logoUrl, shopName, services, galleryImages,
}: {
  block: Block;
  onChange: (c: Record<string, unknown>) => void;
  coverUrl?: string | null;
  logoUrl?: string | null;
  shopName: string;
  services: ServiceItem[];
  galleryImages: GalleryItem[];
}) {
  switch (block.type) {
    case 'hero':       return <HeroRenderer block={block} onChange={onChange} coverUrl={coverUrl} logoUrl={logoUrl} shopName={shopName} />;
    case 'text':       return <TextRenderer block={block} onChange={onChange} />;
    case 'services':   return <ServicesRenderer block={block} onChange={onChange} services={services} />;
    case 'gallery':    return <GalleryRenderer block={block} onChange={onChange} galleryImages={galleryImages} />;
    case 'booking':    return <BookingRenderer block={block} onChange={onChange} />;
    case 'whatsapp':   return <WhatsAppRenderer block={block} onChange={onChange} />;
    case 'divider':    return <DividerRenderer />;
    case 'image_text': return <ImageTextRenderer block={block} onChange={onChange} />;
    case 'cta':        return <CtaRenderer block={block} onChange={onChange} />;
    default:           return null;
  }
}

/* ─── Toolbar toggle pill (block-specific settings in blue bar) ──────────── */
function TToggle({ label, active, onClick }: {
  label: string; active: boolean; onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick(e); }}
      title={label}
      style={{
        padding: '2px 8px', borderRadius: '4px',
        border: '1px solid rgba(255,255,255,0.35)',
        background: active ? 'rgba(255,255,255,0.22)' : 'transparent',
        color: 'rgba(255,255,255,0.9)', fontSize: '0.62rem', fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, letterSpacing: '0.02em',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
      onMouseLeave={e => (e.currentTarget.style.background = active ? 'rgba(255,255,255,0.22)' : 'transparent')}
    >
      {label}
    </button>
  );
}

/* ─── Toolbar icon button ────────────────────────────────────────────────── */
function TBtn({ onClick, title, disabled, danger, children }: {
  onClick: () => void; title: string; disabled?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={title}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '26px', height: '26px', borderRadius: '6px', border: 'none',
        background: 'transparent', color: danger ? '#fca5a5' : 'rgba(255,255,255,0.85)',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1,
        padding: 0, flexShrink: 0, fontFamily: 'inherit', transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.15)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

/* ─── LandingEditor ──────────────────────────────────────────────────────── */
export default function LandingEditor({
  barbershopName,
  barbershopSlug,
  initialBlocks,
  barbershopCoverUrl,
  barbershopLogoUrl,
  services = [],
  galleryImages = [],
}: Props) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Save ── */
  const save = useCallback(async (blocksToSave: Block[]) => {
    setSaving(true);
    try {
      const res = await fetch('/api/barbershops/landing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks: blocksToSave }),
      });
      if (res.ok) {
        setToast(true);
        setTimeout(() => setToast(false), 2200);
      }
    } finally {
      setSaving(false);
    }
  }, []);

  const scheduleAutoSave = useCallback((next: Block[]) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => save(next), 1500);
  }, [save]);

  const updateBlocks = useCallback((next: Block[]) => {
    setBlocks(next);
    scheduleAutoSave(next);
  }, [scheduleAutoSave]);

  /* ── Block operations ── */
  const updateContent = (id: string, content: Record<string, unknown>) =>
    updateBlocks(blocks.map(b => b.id === id ? { ...b, content } : b));

  const toggleVisible = (id: string) =>
    updateBlocks(blocks.map(b => b.id === id ? { ...b, visible: !b.visible } : b));

  const moveBlock = (index: number, dir: -1 | 1) => {
    const next = [...blocks];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateBlocks(next);
  };

  const deleteBlock = (id: string) =>
    updateBlocks(blocks.filter(b => b.id !== id));

  const insertBlock = (type: BlockType, afterIndex: number) => {
    const newBlock: Block = { id: genId(), type, visible: true, content: { ...DEFAULTS[type] } };
    const next = [...blocks];
    next.splice(afterIndex + 1, 0, newBlock);
    updateBlocks(next);
  };

  const existingTypes = blocks.map(b => b.type);

  const headerBtn = (primary?: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: primary ? '8px 18px' : '7px 12px', borderRadius: '8px',
    fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
    border: primary ? 'none' : '1px solid var(--color-border)',
    background: primary ? 'var(--color-brand)' : 'transparent',
    color: primary ? '#fff' : 'var(--color-text-secondary)',
    fontFamily: 'inherit', textDecoration: 'none',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 20px', borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface-elevated)', flexShrink: 0, gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <a href="/app" style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-secondary)', textDecoration: 'none' }} title="Volver">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          </a>
          <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>Editor de Landing</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>— {barbershopName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {toast && <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#22c55e', background: 'rgba(34,197,94,0.1)', padding: '4px 10px', borderRadius: '6px' }}>Guardado ✓</span>}
          {saving && <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>Guardando…</span>}
          <a href={`/b/${barbershopSlug}`} target="_blank" rel="noopener"
            style={{ ...headerBtn(), display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
            Ver página
          </a>
          <button style={headerBtn(true)} onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); save(blocks); }} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <div style={{
          width: '210px', flexShrink: 0, borderRight: '1px solid var(--color-border)',
          background: 'var(--color-surface-elevated)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 10px 4px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
            Bloques
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 12px' }}>
            {blocks.map((block, index) => {
              const isHov = block.id === hoveredId;
              const canDel = DELETABLE.includes(block.type);
              return (
                <div key={block.id} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 8px', borderRadius: '8px', marginBottom: '2px',
                  background: isHov ? 'color-mix(in srgb, var(--color-brand) 12%, transparent)' : 'transparent',
                  border: `1px solid ${isHov ? 'var(--color-brand)' : 'transparent'}`,
                  transition: 'background 0.15s, border-color 0.15s', userSelect: 'none',
                }}>
                  {/* Visible */}
                  <button title={block.visible ? 'Ocultar' : 'Mostrar'} onClick={() => toggleVisible(block.id)}
                    style={{ width: '18px', height: '18px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: block.visible ? '#22c55e' : 'var(--color-text-secondary)', opacity: block.visible ? 1 : 0.45 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      {block.visible
                        ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                        : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>}
                    </svg>
                  </button>
                  {/* Label */}
                  <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-primary)', opacity: block.visible ? 1 : 0.45, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {LABELS[block.type]}
                  </span>
                  {/* Controls */}
                  <div style={{ display: 'flex', gap: '1px', flexShrink: 0 }}>
                    <button title="Subir" onClick={() => moveBlock(index, -1)} disabled={index === 0}
                      style={{ width: '18px', height: '18px', border: 'none', background: 'transparent', cursor: index === 0 ? 'default' : 'pointer', padding: 0, opacity: index === 0 ? 0.2 : 0.6, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>
                    </button>
                    <button title="Bajar" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1}
                      style={{ width: '18px', height: '18px', border: 'none', background: 'transparent', cursor: index === blocks.length - 1 ? 'default' : 'pointer', padding: 0, opacity: index === blocks.length - 1 ? 0.2 : 0.6, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    {canDel && (
                      <button title="Eliminar" onClick={() => deleteBlock(block.id)}
                        style={{ width: '18px', height: '18px', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7 }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)', fontSize: '0.67rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            <strong style={{ display: 'block', marginBottom: '2px' }}>Tip:</strong>
            Pasa el cursor por un bloque del canvas para editarlo o reordenarlo.
          </div>
        </div>

        {/* ── Canvas ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#f5f4f1' }}>
          <div style={{ width: '100%', minHeight: '100%' }}>
            {/* Top insert button */}
            <InsertButton onInsert={type => insertBlock(type, -1)} existingTypes={existingTypes} />

            {blocks.map((block, index) => {
              const hovered = block.id === hoveredId;
              const canDel = DELETABLE.includes(block.type);

              return (
                <div key={block.id}>
                  {/* Block wrapper */}
                  <div
                    style={{
                      position: 'relative',
                      outline: hovered ? '2px solid #3b82f6' : '2px solid transparent',
                      outlineOffset: '-2px',
                      transition: 'outline-color 0.15s',
                      opacity: block.visible ? 1 : 0.45,
                    }}
                    onMouseEnter={() => setHoveredId(block.id)}
                    onMouseLeave={() => setHoveredId(id => id === block.id ? null : id)}
                  >
                    {/* Toolbar overlay */}
                    {hovered && (
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: '36px',
                        background: 'rgba(59,130,246,0.93)', backdropFilter: 'blur(4px)',
                        zIndex: 20, display: 'flex', alignItems: 'center', padding: '0 10px', gap: '2px',
                        pointerEvents: 'none',
                      }}>
                        <span style={{ fontSize: '0.67rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)', flexShrink: 0 }}>
                          {LABELS[block.type]}
                        </span>

                        {/* Block-specific setting pills */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, padding: '0 8px', pointerEvents: 'auto' }}>
                          {block.type === 'hero' && (
                            <TToggle
                              label={block.content.cta_show !== false ? 'Botón CTA ✓' : 'Botón CTA —'}
                              active={block.content.cta_show !== false}
                              onClick={() => updateContent(block.id, { ...block.content, cta_show: block.content.cta_show === false })}
                            />
                          )}
                          {block.type === 'services' && (
                            <TToggle
                              label={block.content.show_book_btn !== false ? 'Btn Reservar ✓' : 'Btn Reservar —'}
                              active={block.content.show_book_btn !== false}
                              onClick={() => updateContent(block.id, { ...block.content, show_book_btn: !block.content.show_book_btn })}
                            />
                          )}
                          {block.type === 'image_text' && (
                            <TToggle
                              label={block.content.image_side === 'right' ? 'Img → derecha' : 'Img ← izquierda'}
                              active
                              onClick={() => updateContent(block.id, { ...block.content, image_side: block.content.image_side === 'right' ? 'left' : 'right' })}
                            />
                          )}
                          {block.type === 'cta' && (
                            <TToggle
                              label={block.content.style === 'light' ? '○ Estilo claro' : '● Estilo oscuro'}
                              active
                              onClick={() => updateContent(block.id, { ...block.content, style: block.content.style === 'light' ? 'dark' : 'light' })}
                            />
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', pointerEvents: 'auto' }}>
                          {/* Visible */}
                          <TBtn title={block.visible ? 'Ocultar' : 'Mostrar'} onClick={() => toggleVisible(block.id)}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              {block.visible
                                ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                                : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></>}
                            </svg>
                          </TBtn>
                          <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.3)', margin: '0 2px' }} />
                          <TBtn title="Mover arriba" disabled={index === 0} onClick={() => moveBlock(index, -1)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15" /></svg>
                          </TBtn>
                          <TBtn title="Mover abajo" disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9" /></svg>
                          </TBtn>
                          {canDel && (
                            <>
                              <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.3)', margin: '0 2px' }} />
                              <TBtn title="Eliminar bloque" danger onClick={() => deleteBlock(block.id)}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                              </TBtn>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Block content */}
                    <BlockRenderer
                      block={block}
                      onChange={content => updateContent(block.id, content)}
                      coverUrl={barbershopCoverUrl}
                      logoUrl={barbershopLogoUrl}
                      shopName={barbershopName}
                      services={services}
                      galleryImages={galleryImages}
                    />
                  </div>

                  {/* Insert button after this block */}
                  <InsertButton onInsert={type => insertBlock(type, index)} existingTypes={existingTypes} />
                </div>
              );
            })}

            {/* Footer */}
            <div style={{ padding: '28px', borderTop: '1px solid #e8e6e0', textAlign: 'center', marginTop: '8px', maxWidth: '800px', margin: '8px auto 0' }}>
              <p style={{ fontSize: '0.75rem', color: '#ccc', margin: 0 }}>
                Agendas con <strong style={{ color: '#1a1818' }}>Bladeo</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

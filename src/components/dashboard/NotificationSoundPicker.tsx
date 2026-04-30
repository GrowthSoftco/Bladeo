import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY  = '_bladeo_notif_sound';
const CUSTOM_KEY   = '_bladeo_notif_sound_custom'; // base64 data URL
const MAX_SIZE_MB  = 2;

interface Sound { id: string; label: string; description: string; }

const PRESETS: Sound[] = [
  { id: 'bladeo',  label: 'Bladeo',  description: 'Dos tonos ascendentes (defecto)' },
  { id: 'campana', label: 'Campana', description: 'Tono suave descendente' },
  { id: 'triple',  label: 'Triple',  description: 'Tres pitidos rápidos' },
  { id: 'suave',   label: 'Suave',   description: 'Un tono grave y suave' },
];

/* ── Web Audio helpers ─────────────────────────────────── */
function makeTone(ctx: AudioContext, freq: number, start: number, dur: number, vol = 0.3) {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.connect(g); g.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, start);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.start(start); osc.stop(start + dur);
}

function playPreset(id: string) {
  try {
    const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    const t = ctx.currentTime;
    if      (id === 'campana') { makeTone(ctx, 1046, t, 0.40); makeTone(ctx, 880, t + 0.30, 0.50, 0.20); }
    else if (id === 'triple')  { makeTone(ctx, 1000, t, 0.12); makeTone(ctx, 1000, t + 0.16, 0.12); makeTone(ctx, 1200, t + 0.32, 0.18); }
    else if (id === 'suave')   { makeTone(ctx, 528, t, 0.60, 0.25); }
    else                       { makeTone(ctx, 880, t, 0.25); makeTone(ctx, 1174.66, t + 0.18, 0.30); }
  } catch (e) {}
}

function playCustom(dataUrl: string) {
  try { new Audio(dataUrl).play(); } catch (e) {}
}

/* ── Component ─────────────────────────────────────────── */
export default function NotificationSoundPicker() {
  const [selected, setSelected]       = useState('bladeo');
  const [customName, setCustomName]   = useState<string | null>(null);
  const [customData, setCustomData]   = useState<string | null>(null);
  const [saved, setSaved]             = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) setSelected(s);
      if (s === 'custom') {
        const d = localStorage.getItem(CUSTOM_KEY);
        if (d) {
          setCustomData(d);
          setCustomName('Sonido personalizado');
        }
      }
    } catch (e) {}
  }, []);

  function handlePresetClick(id: string) {
    setSelected(id);
    setSaved(false);
    playPreset(id);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setUploadError(`El archivo no debe superar ${MAX_SIZE_MB} MB.`);
      return;
    }
    if (!file.type.startsWith('audio/')) {
      setUploadError('Solo se aceptan archivos de audio (mp3, wav, ogg…).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCustomData(dataUrl);
      setCustomName(file.name);
      setSelected('custom');
      setSaved(false);
      playCustom(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  function handleSave() {
    try {
      localStorage.setItem(STORAGE_KEY, selected);
      if (selected === 'custom' && customData) {
        localStorage.setItem(CUSTOM_KEY, customData);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setUploadError('No se pudo guardar. El archivo puede ser muy pesado para el navegador.');
    }
  }

  function handlePreview() {
    if (selected === 'custom' && customData) playCustom(customData);
    else playPreset(selected);
  }

  return (
    <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-semibold text-white">Sonido de notificación</h2>
          <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">
            Toca una opción para preescucharla
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreview}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:text-white transition-colors"
          >
            ▶ Probar
          </button>
          <button
            onClick={handleSave}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              saved
                ? 'bg-[var(--color-success)]/20 text-[var(--color-success)] border border-[var(--color-success)]/30'
                : 'bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white'
            }`}
          >
            {saved ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {PRESETS.map(s => {
          const active = selected === s.id;
          return (
            <button
              key={s.id}
              onClick={() => handlePresetClick(s.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                active
                  ? 'bg-[var(--color-brand)]/15 border-[var(--color-brand)] text-white'
                  : 'bg-[var(--color-surface-overlay)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand)]/50 hover:text-white'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${active ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-surface-elevated)]'}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-xs">{s.label}</p>
                <p className="text-[10px] mt-0.5 text-[var(--color-text-secondary)] truncate">{s.description}</p>
              </div>
              {active && <div className="ml-auto w-2 h-2 rounded-full bg-[var(--color-brand)] flex-shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Custom file upload */}
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
          selected === 'custom'
            ? 'border-[var(--color-brand)] bg-[var(--color-brand)]/5'
            : 'border-[var(--color-border)] hover:border-[var(--color-brand)]/50'
        }`}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center justify-center gap-2 mb-1">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--color-text-secondary)]">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span className={`text-xs font-medium ${selected === 'custom' ? 'text-[var(--color-brand-light)]' : 'text-[var(--color-text-secondary)]'}`}>
            {customName ?? 'Subir audio desde el PC'}
          </span>
        </div>
        <p className="text-[10px] text-[var(--color-text-secondary)]">
          MP3, WAV, OGG · Máx. {MAX_SIZE_MB} MB
        </p>
      </div>

      {uploadError && (
        <p className="mt-2 text-xs text-[var(--color-danger)]">{uploadError}</p>
      )}
    </div>
  );
}

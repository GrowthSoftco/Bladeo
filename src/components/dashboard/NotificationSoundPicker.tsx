import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = '_bladeo_notif_sound';

interface Sound {
  id: string;
  label: string;
  description: string;
}

const SOUNDS: Sound[] = [
  { id: 'bladeo',   label: 'Bladeo',   description: 'Dos tonos ascendentes (por defecto)' },
  { id: 'campana',  label: 'Campana',  description: 'Tono suave descendente' },
  { id: 'triple',   label: 'Triple',   description: 'Tres pitidos rápidos' },
  { id: 'suave',    label: 'Suave',    description: 'Un tono grave y suave' },
];

function createCtx() {
  return new ((window as any).AudioContext || (window as any).webkitAudioContext)();
}

function playTone(ctx: AudioContext, freq: number, start: number, duration: number, volume = 0.3) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.start(start);
  osc.stop(start + duration);
}

function previewSound(id: string) {
  try {
    const ctx = createCtx();
    const t = ctx.currentTime;
    if (id === 'bladeo') {
      playTone(ctx, 880,     t,        0.25);
      playTone(ctx, 1174.66, t + 0.18, 0.30);
    } else if (id === 'campana') {
      playTone(ctx, 1046, t,        0.40, 0.35);
      playTone(ctx, 880,  t + 0.30, 0.50, 0.20);
    } else if (id === 'triple') {
      playTone(ctx, 1000, t,        0.12);
      playTone(ctx, 1000, t + 0.16, 0.12);
      playTone(ctx, 1200, t + 0.32, 0.18);
    } else if (id === 'suave') {
      playTone(ctx, 528, t, 0.60, 0.25);
    }
  } catch (e) {}
}

export default function NotificationSoundPicker() {
  const [selected, setSelected] = useState<string>('bladeo');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SOUNDS.find(s => s.id === stored)) setSelected(stored);
    } catch (e) {}
  }, []);

  function handleSelect(id: string) {
    setSelected(id);
    setSaved(false);
    previewSound(id);
  }

  function handleSave() {
    try {
      localStorage.setItem(STORAGE_KEY, selected);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {}
  }

  return (
    <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-white text-sm">Sonido de notificación</h2>
          <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">Toca una opción para preescucharla</p>
        </div>
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

      <div className="grid grid-cols-2 gap-3">
        {SOUNDS.map(sound => {
          const isActive = selected === sound.id;
          return (
            <button
              key={sound.id}
              onClick={() => handleSelect(sound.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                isActive
                  ? 'bg-[var(--color-brand)]/15 border-[var(--color-brand)] text-white'
                  : 'bg-[var(--color-surface-overlay)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand)]/50 hover:text-white'
              }`}
            >
              {/* Play icon */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                isActive ? 'bg-[var(--color-brand)]' : 'bg-[var(--color-surface-elevated)]'
              }`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-xs">{sound.label}</p>
                <p className={`text-[10px] mt-0.5 ${isActive ? 'text-[var(--color-text-secondary)]' : 'text-[var(--color-text-secondary)]/70'}`}>
                  {sound.description}
                </p>
              </div>
              {isActive && (
                <div className="ml-auto">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-brand)]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

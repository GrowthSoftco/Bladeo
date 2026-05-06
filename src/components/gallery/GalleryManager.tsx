import { useState, useEffect, useRef } from 'react';

interface Barber { id: string; display_name: string; avatar_url: string | null; }
interface GalleryImage {
  id: string;
  image_url: string;
  caption: string | null;
  barber_id: string | null;
  created_at: string;
  barber?: Barber;
}

interface Props {
  barbers: Barber[];
  isOwner: boolean;
  currentMemberId: string;
}

export default function GalleryManager({ barbers, isOwner, currentMemberId }: Props) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [filterBarber, setFilterBarber] = useState<string>('all');
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedBarber, setSelectedBarber] = useState(isOwner ? '' : currentMemberId);
  const [uploadError, setUploadError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchImages(); }, []);

  async function fetchImages() {
    setLoading(true);
    const res = await fetch('/api/gallery');
    const data = await res.json();
    setImages(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setUploadError('');
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) { setUploadError('Selecciona una imagen.'); return; }
    setUploading(true); setUploadError('');

    const fd = new FormData();
    fd.append('file', selectedFile);
    if (caption.trim()) fd.append('caption', caption.trim());
    if (selectedBarber) fd.append('barber_id', selectedBarber);

    const res = await fetch('/api/gallery', { method: 'POST', body: fd });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) { setUploadError(data.error ?? 'Error al subir la imagen.'); return; }

    setShowUpload(false);
    setCaption('');
    setSelectedFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
    fetchImages();
  }

  async function handleDelete(img: GalleryImage) {
    if (!confirm('¿Eliminar esta foto?')) return;
    await fetch(`/api/gallery/${img.id}`, { method: 'DELETE' });
    setImages(prev => prev.filter(x => x.id !== img.id));
    if (lightbox?.id === img.id) setLightbox(null);
  }

  const filtered = filterBarber === 'all'
    ? images
    : images.filter(img => img.barber_id === filterBarber);

  const canDelete = (img: GalleryImage) => isOwner || img.barber_id === currentMemberId;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Galería</h1>
          <p className="text-[var(--color-text-secondary)]">{images.length} foto{images.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowUpload(true); setUploadError(''); setPreview(null); setSelectedFile(null); setCaption(''); }}
          className="px-4 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Subir foto
        </button>
      </div>

      {/* Filter */}
      {isOwner && barbers.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFilterBarber('all')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${filterBarber === 'all' ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface-elevated)]'}`}
          >
            Todos
          </button>
          {barbers.map(b => (
            <button
              key={b.id}
              onClick={() => setFilterBarber(b.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${filterBarber === b.id ? 'bg-[var(--color-brand)] border-[var(--color-brand)] text-white' : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface-elevated)]'}`}
            >
              {b.display_name}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="aspect-square bg-[var(--color-surface-elevated)] rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-4">📸</div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">Sin fotos aún</h3>
          <p className="text-[var(--color-text-secondary)] text-sm mb-4">Sube las primeras fotos del trabajo de tu equipo.</p>
          <button onClick={() => setShowUpload(true)} className="px-4 py-2 bg-[var(--color-brand)] text-white text-sm font-semibold rounded-lg">+ Subir foto</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(img => (
            <div
              key={img.id}
              className="group relative aspect-square rounded-xl overflow-hidden bg-[var(--color-surface-elevated)] border border-[var(--color-border)] cursor-pointer"
              onClick={() => setLightbox(img)}
            >
              <img src={img.image_url} alt={img.caption ?? ''} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex flex-col justify-end p-3">
                {img.caption && (
                  <p className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity line-clamp-2 mb-1">{img.caption}</p>
                )}
                {img.barber && (
                  <p className="text-white/80 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">{img.barber.display_name}</p>
                )}
              </div>

              {/* Delete button */}
              {canDelete(img) && (
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(img); }}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
                  title="Eliminar"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowUpload(false)} />
          <div className="relative bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
              <h2 className="font-semibold text-[var(--color-text-primary)]">Subir foto</h2>
              <button onClick={() => setShowUpload(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              {uploadError && <div className="px-4 py-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg text-[#ef4444] text-sm">{uploadError}</div>}

              {/* Image picker */}
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden ${preview ? 'border-[var(--color-brand)] p-0' : 'border-[var(--color-border)] hover:border-[var(--color-brand)] p-8'}`}
              >
                {preview ? (
                  <div className="relative w-full">
                    <img src={preview} alt="" className="w-full max-h-64 object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-white text-sm font-medium">Cambiar imagen</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-text-secondary)] mb-3">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <p className="text-sm text-[var(--color-text-secondary)]">Haz clic para seleccionar una foto</p>
                    <p className="text-xs text-[var(--color-text-secondary)]/60 mt-1">JPG, PNG o WEBP · máx 10MB</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />

              {/* Caption */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Descripción <span className="text-[var(--color-text-secondary)] font-normal">(opcional)</span></label>
                <input
                  type="text"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="Ej: Degradado con barba"
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm"
                />
              </div>

              {/* Barbero */}
              {isOwner && (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Barbero</label>
                  <select
                    value={selectedBarber}
                    onChange={e => setSelectedBarber(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm appearance-none"
                  >
                    <option value="">Sin asignar</option>
                    {barbers.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowUpload(false)} className="flex-1 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg hover:bg-[var(--color-border)] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={uploading || !selectedFile} className="flex-1 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  {uploading ? (
                    <><svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Subiendo...</>
                  ) : 'Subir foto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setLightbox(null)}>
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.image_url} alt={lightbox.caption ?? ''} className="w-full max-h-[80vh] object-contain rounded-xl" />
            {(lightbox.caption || lightbox.barber) && (
              <div className="mt-3 text-center">
                {lightbox.caption && <p className="text-white font-medium">{lightbox.caption}</p>}
                {lightbox.barber && <p className="text-white/60 text-sm mt-1">{lightbox.barber.display_name}</p>}
              </div>
            )}
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

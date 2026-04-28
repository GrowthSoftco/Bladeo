import { useState, useEffect, useRef } from 'react';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cost: number | null;
  stock: number;
  sku: string | null;
  is_active: boolean;
}

const EMPTY: Omit<Product, 'id' | 'is_active'> = {
  name: '',
  description: '',
  price: 0,
  cost: null,
  stock: 0,
  sku: '',
};

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}

export default function ProductsManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/products')
      .then(r => r.json())
      .then(d => { setProducts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (showModal) setTimeout(() => nameRef.current?.focus(), 50); }, [showModal]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY });
    setError('');
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description ?? '', price: p.price, cost: p.cost ?? null, stock: p.stock, sku: p.sku ?? '' });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setError(''); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('El nombre es requerido.'); return; }
    if (form.price < 0) { setError('El precio no puede ser negativo.'); return; }
    setSaving(true);
    setError('');
    try {
      const url = editing ? `/api/products/${editing.id}` : '/api/products';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, price: Number(form.price), cost: form.cost ? Number(form.cost) : null, stock: Number(form.stock) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return; }
      load();
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (p: Product) => {
    await fetch(`/api/products/${p.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...p, is_active: !p.is_active }),
    });
    load();
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) return;
    await fetch(`/api/products/${p.id}`, { method: 'DELETE' });
    load();
  };

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.sku?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const totalStock = products.reduce((s, p) => s + p.stock, 0);
  const totalValue = products.reduce((s, p) => s + p.stock * p.price, 0);
  const lowStock = products.filter(p => p.stock < 5 && p.is_active).length;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-[var(--color-text-secondary)] text-xs mb-1">Productos</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{products.length}</p>
        </div>
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-[var(--color-text-secondary)] text-xs mb-1">Unidades en stock</p>
          <p className="text-2xl font-bold text-[var(--color-text-primary)]">{totalStock}</p>
        </div>
        <div className={`bg-[var(--color-surface-elevated)] border rounded-xl p-4 ${lowStock > 0 ? 'border-amber-500/40' : 'border-[var(--color-border)]'}`}>
          <p className={`text-xs mb-1 ${lowStock > 0 ? 'text-amber-400' : 'text-[var(--color-text-secondary)]'}`}>Stock bajo (&lt;5)</p>
          <p className={`text-2xl font-bold ${lowStock > 0 ? 'text-amber-400' : 'text-[var(--color-text-primary)]'}`}>{lowStock}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar productos..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
        />
        <button
          onClick={openCreate}
          className="px-4 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
        >
          + Nuevo producto
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-[var(--color-text-secondary)]">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">📦</div>
          <p className="text-[var(--color-text-primary)] font-semibold mb-1">{search ? 'Sin resultados' : 'Sin productos'}</p>
          <p className="text-[var(--color-text-secondary)] text-sm">{search ? 'Intenta con otro término.' : 'Crea tu primer producto.'}</p>
        </div>
      ) : (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  <th className="text-left px-5 py-3 text-[var(--color-text-secondary)] font-medium">Producto</th>
                  <th className="text-right px-5 py-3 text-[var(--color-text-secondary)] font-medium">Precio</th>
                  <th className="text-right px-5 py-3 text-[var(--color-text-secondary)] font-medium hidden sm:table-cell">Costo</th>
                  <th className="text-right px-5 py-3 text-[var(--color-text-secondary)] font-medium">Stock</th>
                  <th className="text-center px-5 py-3 text-[var(--color-text-secondary)] font-medium hidden md:table-cell">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const margin = p.cost ? Math.round(((p.price - p.cost) / p.price) * 100) : null;
                  return (
                    <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-overlay)] transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-[var(--color-text-primary)]">{p.name}</p>
                        {p.sku && <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">SKU: {p.sku}</p>}
                        {p.description && <p className="text-[var(--color-text-secondary)] text-xs mt-0.5 truncate max-w-[200px]">{p.description}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-[var(--color-text-primary)]">{fmt(p.price)}</td>
                      <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                        {p.cost ? (
                          <div>
                            <span className="text-[var(--color-text-secondary)]">{fmt(p.cost)}</span>
                            {margin !== null && (
                              <span className="ml-2 text-xs text-green-400">{margin}%</span>
                            )}
                          </div>
                        ) : <span className="text-[var(--color-text-secondary)]">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`font-semibold ${p.stock < 5 ? 'text-amber-400' : 'text-[var(--color-text-primary)]'}`}>{p.stock}</span>
                      </td>
                      <td className="px-5 py-3.5 text-center hidden md:table-cell">
                        <button
                          onClick={() => handleToggle(p)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${p.is_active ? 'bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30' : 'bg-[var(--color-border)] text-[var(--color-text-secondary)] border-[#3a3a4a] hover:bg-[#3a3a4a]'}`}
                        >
                          {p.is_active ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors"
                            title="Editar"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                            title="Eliminar"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-[var(--color-border)]">
              <h2 className="font-semibold text-[var(--color-text-primary)]">{editing ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button onClick={closeModal} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Nombre *</label>
                <input
                  ref={nameRef}
                  type="text"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm"
                  placeholder="Ej: Pomada para cabello"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Descripción</label>
                <input
                  type="text"
                  value={form.description ?? ''}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm"
                  placeholder="Opcional"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Precio venta *</label>
                  <input
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Costo</label>
                  <input
                    type="number"
                    min="0"
                    value={form.cost ?? ''}
                    onChange={e => setForm({ ...form, cost: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm"
                    placeholder="Opcional"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stock}
                    onChange={e => setForm({ ...form, stock: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">SKU</label>
                  <input
                    type="text"
                    value={form.sku ?? ''}
                    onChange={e => setForm({ ...form, sku: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm"
                    placeholder="Opcional"
                  />
                </div>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 bg-[var(--color-surface-overlay)] hover:bg-[var(--color-border)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-sm font-medium rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

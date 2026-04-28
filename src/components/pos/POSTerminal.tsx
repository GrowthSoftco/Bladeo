import { useState, useEffect, useCallback } from 'react';

interface Service { id: string; name: string; price: number; duration_minutes: number; }
interface Product { id: string; name: string; price: number; stock: number; }
interface Member { id: string; display_name: string; }
interface Client { id: string; name: string; phone: string | null; }
interface CartItem {
  id: string;
  item_type: 'service' | 'product';
  service_id?: string;
  product_id?: string;
  name: string;
  unit_price: number;
  quantity: number;
}
interface Sale {
  id: string; total: number; payment_method: string; created_at: string;
  members?: { display_name: string } | null;
  clients?: { name: string } | null;
  sale_items?: Array<{ name: string; quantity: number; unit_price: number; total: number }>;
}

function formatCOP(n: number) { return '$' + Math.round(n).toLocaleString('es-CO').replace(/,/g, '.'); }

const PAYMENT_METHODS = [
  { value: 'efectivo', label: 'Efectivo', icon: '💵' },
  { value: 'nequi', label: 'Nequi', icon: '📱' },
  { value: 'bancolombia', label: 'Bancolombia', icon: '🏦' },
  { value: 'daviplata', label: 'Daviplata', icon: '📱' },
  { value: 'tarjeta', label: 'Tarjeta', icon: '💳' },
  { value: 'transferencia', label: 'Transferencia', icon: '🔄' },
];

interface Props { barbers: Member[]; currentMemberId: string; isOwner: boolean; }

export default function POSTerminal({ barbers, currentMemberId, isOwner }: Props) {
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barberId, setBarberId] = useState(isOwner ? (barbers[0]?.id ?? currentMemberId) : currentMemberId);
  const [clientSearch, setClientSearch] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientResults, setClientResults] = useState<Client[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [discount, setDiscount] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState<'pos' | 'history'>('pos');

  useEffect(() => {
    fetch('/api/services').then(r => r.json()).then(d => setServices(d ?? []));
    fetch('/api/clients').then(r => r.json()).then(d => setClients(d ?? []));
    // Products if available
    fetch('/api/products').then(r => r.json()).then(d => setProducts(d ?? [])).catch(() => {});
  }, []);

  const fetchSales = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await fetch(`/api/sales?from=${today}`);
    const data = await res.json();
    setRecentSales(data ?? []);
  }, []);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  // Client search
  useEffect(() => {
    const q = clientSearch.toLowerCase();
    if (q.length < 1) { setClientResults([]); return; }
    setClientResults(clients.filter(c => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)).slice(0, 5));
  }, [clientSearch, clients]);

  function addToCart(item: Omit<CartItem, 'id' | 'quantity'>) {
    const key = (item.service_id || item.product_id || item.name);
    setCart(prev => {
      const existing = prev.find(i => (i.service_id || i.product_id || i.name) === key);
      if (existing) return prev.map(i => (i.service_id || i.product_id || i.name) === key ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, id: crypto.randomUUID(), quantity: 1 }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i).filter(i => !(i.id === id && i.quantity + delta < 1)));
  }

  function removeFromCart(id: string) { setCart(prev => prev.filter(i => i.id !== id)); }

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const discountAmt = Math.min(Number(discount) || 0, subtotal);
  const total = subtotal - discountAmt;

  async function handleCheckout() {
    if (cart.length === 0) { setError('Agrega al menos un servicio o producto.'); return; }
    setSaving(true); setError(''); setSuccess('');

    const res = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        barber_id: barberId,
        client_id: clientId || null,
        items: cart.map(i => ({
          item_type: i.item_type,
          service_id: i.service_id || null,
          product_id: i.product_id || null,
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        payment_method: paymentMethod,
        discount: discountAmt,
        notes: notes || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Error al registrar venta.'); setSaving(false); return; }

    setSuccess(`Venta registrada: ${formatCOP(data.total)} — ${paymentMethod}`);
    setCart([]);
    setClientSearch(''); setClientId(''); setNotes(''); setDiscount('0');
    fetchSales();
    setSaving(false);
    setTimeout(() => setSuccess(''), 4000);
  }

  return (
    <div>
      {/* Tab header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg p-0.5">
          <button onClick={() => setTab('pos')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === 'pos' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-secondary)] hover:text-white'}`}>Cobrar</button>
          <button onClick={() => setTab('history')} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === 'history' ? 'bg-[var(--color-brand)] text-white' : 'text-[var(--color-text-secondary)] hover:text-white'}`}>Ventas de hoy</button>
        </div>
        <div className="text-sm text-[var(--color-text-secondary)]">
          Total hoy: <span className="text-[var(--color-text-primary)] font-semibold ml-1">{formatCOP(recentSales.reduce((s, r) => s + r.total, 0))}</span>
        </div>
      </div>

      {/* POS Tab */}
      {tab === 'pos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: catalog */}
          <div className="space-y-5">
            {/* Barber selector */}
            {isOwner && barbers.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Barbero</label>
                <select value={barberId} onChange={e => setBarberId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-brand)] text-sm">
                  {barbers.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
                </select>
              </div>
            )}

            {/* Services */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Servicios</label>
              {services.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)] bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg px-4 py-3">
                  No hay servicios. <a href="/app/services" className="text-[#2563eb] underline">Crear servicios →</a>
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {services.filter((s: any) => s.is_active !== false).map(s => (
                    <button key={s.id} onClick={() => addToCart({ item_type: 'service', service_id: s.id, name: s.name, unit_price: s.price })}
                      className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] hover:border-[var(--color-brand)]/60 rounded-lg p-3 text-left transition-all active:scale-95">
                      <p className="text-[var(--color-text-primary)] text-sm font-medium truncate">{s.name}</p>
                      <p className="text-[#2563eb] text-sm font-bold mt-1">{formatCOP(s.price)}</p>
                      <p className="text-[var(--color-text-secondary)] text-xs">{s.duration_minutes} min</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Products */}
            {products.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Productos</label>
                <div className="grid grid-cols-2 gap-2">
                  {products.filter((p: any) => p.is_active !== false && p.stock > 0).map(p => (
                    <button key={p.id} onClick={() => addToCart({ item_type: 'product', product_id: p.id, name: p.name, unit_price: p.price })}
                      className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] hover:border-[#22c55e]/60 rounded-lg p-3 text-left transition-all active:scale-95">
                      <p className="text-[var(--color-text-primary)] text-sm font-medium truncate">{p.name}</p>
                      <p className="text-[#22c55e] text-sm font-bold mt-1">{formatCOP(p.price)}</p>
                      <p className="text-[var(--color-text-secondary)] text-xs">Stock: {p.stock}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: cart + checkout */}
          <div className="space-y-4">
            {/* Cart */}
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <h3 className="font-semibold text-[var(--color-text-primary)] text-sm">Carrito</h3>
                {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-xs text-[var(--color-text-secondary)] hover:text-[#ef4444] transition-colors">Vaciar</button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[var(--color-text-secondary)] text-sm">Selecciona servicios o productos</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-border)]">
                  {cart.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--color-text-primary)] text-sm font-medium truncate">{item.name}</p>
                        <p className="text-[var(--color-text-secondary)] text-xs">{formatCOP(item.unit_price)} c/u</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.id, -1)} className="w-6 h-6 rounded-full bg-[var(--color-border)] text-[var(--color-text-primary)] text-xs flex items-center justify-center hover:bg-[#3a3a4a]">−</button>
                        <span className="text-[var(--color-text-primary)] text-sm w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-6 h-6 rounded-full bg-[var(--color-border)] text-[var(--color-text-primary)] text-xs flex items-center justify-center hover:bg-[#3a3a4a]">+</button>
                      </div>
                      <span className="text-[var(--color-text-primary)] text-sm font-semibold w-20 text-right">{formatCOP(item.unit_price * item.quantity)}</span>
                      <button onClick={() => removeFromCart(item.id)} className="text-[var(--color-text-secondary)] hover:text-[#ef4444] text-lg leading-none ml-1">×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Totals */}
              {cart.length > 0 && (
                <div className="border-t border-[var(--color-border)] px-4 py-3 space-y-1">
                  <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
                    <span>Subtotal</span><span>{formatCOP(subtotal)}</span>
                  </div>
                  {discountAmt > 0 && (
                    <div className="flex justify-between text-sm text-[#22c55e]">
                      <span>Descuento</span><span>−{formatCOP(discountAmt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-[var(--color-text-primary)] pt-1 border-t border-[var(--color-border)]">
                    <span>Total</span><span className="text-[#2563eb]">{formatCOP(total)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Client (optional) */}
            <div className="relative">
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Cliente (opcional)</label>
              {clientId ? (
                <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-brand)] rounded-lg">
                  <span className="text-[var(--color-text-primary)] text-sm">{clients.find(c => c.id === clientId)?.name}</span>
                  <button type="button" onClick={() => { setClientId(''); setClientSearch(''); }} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xs">✕</button>
                </div>
              ) : (
                <div>
                  <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
                    placeholder="Buscar cliente..."
                    className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />
                  {clientResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-[var(--color-surface-overlay)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden">
                      {clientResults.map(c => (
                        <button key={c.id} type="button" onClick={() => { setClientId(c.id); setClientSearch(c.name); setClientResults([]); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-border)] text-sm">
                          <span className="text-[var(--color-text-primary)]">{c.name}</span>
                          {c.phone && <span className="text-[var(--color-text-secondary)] ml-2 text-xs">{c.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Discount */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Descuento (COP)</label>
              <input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />
            </div>

            {/* Payment method */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wide mb-2">Método de pago</label>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(pm => (
                  <button key={pm.value} onClick={() => setPaymentMethod(pm.value)}
                    className={`py-2.5 px-2 rounded-lg border text-xs font-medium transition-all text-center ${
                      paymentMethod === pm.value
                        ? 'bg-[var(--color-brand)]/20 border-[var(--color-brand)] text-white'
                        : 'bg-[var(--color-surface-elevated)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[#4a4a5a]'
                    }`}>
                    <span className="block text-base mb-0.5">{pm.icon}</span>
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notas (opcional)"
              className="w-full px-4 py-2.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-brand)] text-sm" />

            {error && <div className="px-4 py-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg text-[#ef4444] text-sm">{error}</div>}
            {success && <div className="px-4 py-3 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-lg text-[#22c55e] text-sm">✓ {success}</div>}

            <button onClick={handleCheckout} disabled={saving || cart.length === 0}
              className="w-full py-3.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-base">
              {saving ? 'Registrando...' : `Cobrar ${cart.length > 0 ? formatCOP(total) : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="space-y-3">
          {recentSales.length === 0 ? (
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[var(--color-text-secondary)]">Sin ventas registradas hoy.</p>
            </div>
          ) : (
            recentSales.map(sale => (
              <div key={sale.id} className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-[var(--color-text-primary)] font-semibold">{formatCOP(sale.total)}</span>
                    <span className="text-[var(--color-text-secondary)] text-xs ml-3 capitalize">{sale.payment_method}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-[var(--color-text-secondary)] text-xs">{new Date(sale.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</p>
                    {sale.members && <p className="text-[var(--color-text-secondary)] text-xs">{(sale.members as any).display_name}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {sale.sale_items?.map((item, i) => (
                    <span key={i} className="text-xs bg-[var(--color-surface-overlay)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded-full">
                      {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.name}
                    </span>
                  ))}
                </div>
                {(sale.clients as any)?.name && (
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">Cliente: {(sale.clients as any).name}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

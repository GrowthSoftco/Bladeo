import { useState, useEffect } from 'react';

interface Transaction {
  id: string;
  transaction_type: string;
  entity: string;
  amount: number;
  commission_earned: number;
  reference: string | null;
  client_name: string | null;
  client_document: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  entity?: string | null;
  barbershopId?: string;
}

const TRANSACTION_TYPES = [
  { value: 'deposit',      label: 'Consignación',    icon: '↑', color: 'text-green-400' },
  { value: 'withdrawal',   label: 'Retiro',           icon: '↓', color: 'text-blue-400' },
  { value: 'transfer',     label: 'Transferencia',    icon: '⇄', color: 'text-purple-400' },
  { value: 'bill_payment', label: 'Pago de servicio', icon: '📄', color: 'text-amber-400' },
  { value: 'other',        label: 'Otro',             icon: '•', color: 'text-[var(--color-text-secondary)]' },
];

const COMMISSION_COP: Record<string, number> = {
  deposit: 350, withdrawal: 400, transfer: 350, bill_payment: 300, other: 0,
};

function fmt(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
}
function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function BancolombiaMark({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 1587 1591" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill="#FFD100" d="m229.5 275.5c-9.9-38.6 14.1-82.1 52.9-94.3 298.4-86.5 596.2-142.6 904.4-180.6 33.7-3.6 66.5 18.2 78.7 51.6 28.6 78.5 42.7 117.9 70.7 196.8 13.4 37.5-6.4 74.9-42.6 79.7-315.3 46.7-621 110.9-925.9 204.7-37.2 12.4-73.8-6.4-83.2-42.9-22.2-86.2-33.2-129.2-55-215zm1353.4 448.6c11.9 36.9-4 72.5-35.1 77.6-490.6 78.8-968.9 210.6-1421.4 417.9-36.4 17.7-73.2-0.5-80.9-39.9-17.8-92.4-26.6-138.3-44.1-230.5-6.8-36.1 12.8-77 45.2-92.4 445.6-197.1 915.4-316.3 1397.9-377.8 31.8-4.2 63.9 19.4 75.7 54.7 25.5 75.9 38 114 62.7 190.4zm-4 516.1c10.7 34.9-3.5 68.9-32.4 75.9-301 73-595.5 164.3-887.1 268.7-41.7 15.8-86.9-4.8-97.9-45.1-23.5-85.8-35.2-128.6-58.3-214.2-9.7-35.9 11.1-74.9 48.1-88.5 291.7-100.2 586.2-178.9 887.4-244.3 33.3-7 68.2 17.6 80.2 55.4 24.4 76.7 36.3 115.1 60 192.1z"/>
    </svg>
  );
}

function NequiMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size * 2.2} height={size * 0.7} viewBox="0 0 180.8 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill="#CA0080" d="M9.2,0H1.6C0.7,0,0,0.7,0,1.6v6.5C0,9,0.7,9.7,1.6,9.7h7.6c0.9,0,1.6-0.7,1.6-1.6V1.6C10.8,0.7,10.1,0,9.2,0z"/>
      <path fill="#3D2172" d="M55.6,0h-6.6c-0.9,0-1.6,0.7-1.6,1.6v26.2c0,0.5-0.7,0.7-1,0.3L31.3,0.7C31,0.3,30.6,0,30,0H19.2c-0.9,0-1.6,0.7-1.6,1.6v41.9c0,0.9,0.7,1.6,1.6,1.6h6.6c0.9,0,1.6-0.7,1.6-1.6v-27c0-0.5,0.7-0.7,1-0.3l15.7,28.2c0.3,0.4,0.7,0.7,1.2,0.7h10.4c0.9,0,1.6-0.7,1.6-1.6V1.6C57.1,0.7,56.4,0,55.6,0L55.6,0z"/>
      <path fill="#3D2172" d="M95,28.7c0-11.8-7.7-17.7-16.1-17.7c-10.9,0-17.2,7.6-17.2,17.9c0,11.7,7.8,17.2,16.9,17.2s14.4-4.7,15.8-10.8c0.2-0.8-0.3-1.5-1.4-1.5h-5.2c-0.6,0-1.1,0.3-1.3,0.9c-1.3,2.8-3.4,4.3-7.3,4.3c-4.5,0-7.5-2.8-8-8.6h22.1C94.4,30.5,95,29.8,95,28.7z M71.6,24.3c1-4.2,3.4-6.1,7.1-6.1c3.3,0,6.2,1.9,6.6,6.1H71.6z"/>
      <path fill="#3D2172" d="M179.2,11.9h-6.6c-0.9,0-1.6,0.7-1.6,1.6v30c0,0.9,0.7,1.6,1.6,1.6h6.6c0.9,0,1.6-0.7,1.6-1.6v-30C180.8,12.6,180.1,11.9,179.2,11.9z"/>
      <path fill="#3D2172" d="M130.3,11.9h-6.6c-0.9,0-1.6,0.7-1.6,1.6v1.6c-2-2.3-5.2-3.9-9.4-3.9c-9.5,0-14.5,8.6-14.5,17.7c0,7.9,4.1,16.8,14.3,16.8c3.6,0,7.5-1.7,9.6-4.2v12.9c0,0.9,0.7,1.6,1.6,1.6h6.6c0.9,0,1.6-0.7,1.6-1.6V13.5C131.9,12.6,131.2,11.9,130.3,11.9L130.3,11.9z M115.4,38.7c-4.3,0-7.3-3.2-7.3-10s3-10.4,7.3-10.4s7.3,3.3,7.3,10.4C122.8,35.8,119.7,38.7,115.4,38.7z"/>
      <path fill="#3D2172" d="M165.2,11.9h-6.6c-0.9,0-1.6,0.7-1.6,1.6v17c0,5.5-2.4,7.1-5.5,7.1c-3.1,0-5.5-1.6-5.5-7.1v-17c0-0.9-0.7-1.6-1.6-1.6h-6.6c-0.9,0-1.6,0.7-1.6,1.6v17.7c0,10.5,5.8,14.7,15.3,14.7c9.5,0,15.3-4.3,15.3-14.7V13.5C166.9,12.6,166.2,11.9,165.2,11.9L165.2,11.9z"/>
    </svg>
  );
}

function EntityLogo({ entity, size = 20 }: { entity: string | null | undefined; size?: number }) {
  if (entity === 'bancolombia') return <BancolombiaMark size={size} />;
  if (entity === 'nequi') return <NequiMark size={size} />;
  return <span className="text-xs text-[var(--color-text-secondary)]">—</span>;
}

const emptyForm = (entity: string | null | undefined) => ({
  transaction_type: 'deposit',
  entity: entity ?? '',
  amount: '',
  commission_earned: String(COMMISSION_COP['deposit']),
  reference: '',
  client_name: '',
  client_document: '',
  notes: '',
});

export default function BankingTerminal({ entity: initialEntity, barbershopId }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState(initialEntity ?? null);
  const [form, setForm] = useState(emptyForm(initialEntity));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);

  const handleEntityChange = async (entity: string) => {
    if (!barbershopId) return;
    const res = await fetch(`/api/barbershops/${barbershopId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banking_entity: entity }),
    });
    if (res.ok) {
      setSelectedEntity(entity);
      setForm(f => ({ ...f, entity }));
    }
  };

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/banking/transactions?from=${filterDate}&to=${filterDate}`);
    const data = await res.json();
    setTransactions(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterDate]);

  useEffect(() => {
    const fixed = COMMISSION_COP[form.transaction_type] ?? 0;
    setForm(f => ({ ...f, commission_earned: String(fixed) }));
  }, [form.transaction_type]);

  const handleSave = async () => {
    if (!form.amount || Number(form.amount) <= 0) { setError('Ingresa un monto válido.'); return; }
    setSaving(true);
    setError('');
    const res = await fetch('/api/banking/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: Number(form.amount), commission_earned: Number(form.commission_earned) || 0 }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? 'Error'); return; }
    setSuccess('Transacción registrada');
    setForm(emptyForm(selectedEntity));
    setTimeout(() => setSuccess(''), 3000);
    load();
  };

  const totalCommission = transactions.reduce((s, t) => s + t.commission_earned, 0);
  const totalAmount = transactions.reduce((s, t) => s + t.amount, 0);
  const typeLabel = (type: string) => TRANSACTION_TYPES.find(t => t.value === type)?.label ?? type;
  const typeColor = (type: string) => TRANSACTION_TYPES.find(t => t.value === type)?.color ?? 'text-[var(--color-text-primary)]';

  const inputCls = "w-full px-4 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)] placeholder-[var(--color-text-secondary)]";
  const labelCls = "block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5";

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-[var(--color-text-secondary)]">Filtrar por fecha:</label>
          <input
            type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className="px-3 py-1.5 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-brand)]"
          />
        </div>

        {/* Entity selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEntityChange('bancolombia')}
            className={`px-4 py-2 rounded-xl border transition-all duration-200 ease-out hover:scale-[1.03] cursor-pointer flex items-center gap-2 ${
              selectedEntity === 'bancolombia'
                ? 'border-[#FFD100] bg-[#FFD100]/10'
                : 'border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:border-[#FFD100]/60'
            }`}
          >
            <BancolombiaMark size={18} />
          </button>
          <button
            onClick={() => handleEntityChange('nequi')}
            className={`px-4 py-2 rounded-xl border transition-all duration-200 ease-out hover:scale-[1.03] cursor-pointer flex items-center gap-2 ${
              selectedEntity === 'nequi'
                ? 'border-[#CA0080] bg-[#CA0080]/10'
                : 'border-[var(--color-border)] bg-[var(--color-surface-elevated)] hover:border-[#CA0080]/60'
            }`}
          >
            <NequiMark size={18} />
          </button>
        </div>

        {transactions.length > 0 && (
          <div className="flex gap-4 ml-auto">
            <div className="text-right">
              <p className="text-xs text-[var(--color-text-secondary)]">Transacciones</p>
              <p className="font-semibold text-[var(--color-text-primary)]">{transactions.length} · {fmt(totalAmount)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--color-text-secondary)]">Comisiones del día</p>
              <p className="font-semibold text-green-500">{fmt(totalCommission)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* New transaction form */}
        <div className="lg:col-span-2 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[var(--color-text-primary)]">Nueva transacción</h2>
            <EntityLogo entity={selectedEntity} size={18} />
          </div>

          {/* Type selector */}
          <div className="grid grid-cols-2 gap-2">
            {TRANSACTION_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setForm(f => ({ ...f, transaction_type: t.value }))}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors text-left ${
                  form.transaction_type === t.value
                    ? 'bg-[var(--color-brand)]/15 border-[var(--color-brand)] text-[var(--color-brand-light)]'
                    : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-secondary)]'
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>{t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Monto *</label>
              <input type="number" min="0" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className={inputCls} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Comisión (COP)</label>
              <input type="number" min="0" value={form.commission_earned}
                onChange={e => setForm(f => ({ ...f, commission_earned: e.target.value }))}
                className={inputCls} placeholder="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombre cliente</label>
              <input type="text" value={form.client_name}
                onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                className={inputCls} placeholder="Opcional" />
            </div>
            <div>
              <label className={labelCls}>Documento</label>
              <input type="text" value={form.client_document}
                onChange={e => setForm(f => ({ ...f, client_document: e.target.value }))}
                className={inputCls} placeholder="CC/NIT" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Referencia / número</label>
            <input type="text" value={form.reference}
              onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
              className={inputCls} placeholder="Nro. de transacción" />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {success && <p className="text-green-500 text-sm">{success}</p>}

          <button
            onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-[var(--color-brand)] hover:bg-[var(--color-brand-light)] disabled:opacity-60 text-white font-semibold rounded-lg transition-colors"
          >
            {saving ? 'Registrando...' : 'Registrar transacción'}
          </button>
        </div>

        {/* Transaction list */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="text-center py-16 text-[var(--color-text-secondary)]">Cargando...</div>
          ) : transactions.length === 0 ? (
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl p-12 text-center">
              <div className="text-4xl mb-3">🏦</div>
              <p className="text-[var(--color-text-primary)] font-semibold mb-1">Sin transacciones</p>
              <p className="text-[var(--color-text-secondary)] text-sm">Registra las operaciones del corresponsal.</p>
            </div>
          ) : (
            <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--color-border)] flex justify-between items-center">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">{transactions.length} transacciones</span>
                <span className="text-sm font-semibold text-green-500">Comisiones: {fmt(totalCommission)}</span>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {transactions.map(t => (
                  <div key={t.id} className="px-5 py-3.5 hover:bg-[var(--color-surface-overlay)] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-sm font-medium ${typeColor(t.transaction_type)}`}>{typeLabel(t.transaction_type)}</span>
                          <span className="text-[var(--color-text-secondary)] text-xs">·</span>
                          <EntityLogo entity={t.entity?.toLowerCase()} size={14} />
                          <span className="text-[var(--color-text-secondary)] text-xs ml-auto">{fmtTime(t.created_at)}</span>
                        </div>
                        {t.client_name && (
                          <p className="text-[var(--color-text-secondary)] text-xs">{t.client_name}{t.client_document ? ` · ${t.client_document}` : ''}</p>
                        )}
                        {t.reference && <p className="text-[var(--color-text-secondary)] text-xs">Ref: {t.reference}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-[var(--color-text-primary)]">{fmt(t.amount)}</p>
                        {t.commission_earned > 0 && (
                          <p className="text-xs text-green-500">+{fmt(t.commission_earned)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

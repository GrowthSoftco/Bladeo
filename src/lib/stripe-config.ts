export const STRIPE_PRICES = {
  basic: {
    monthly: import.meta.env.STRIPE_PRICE_BASIC_MONTHLY ?? 'price_basic_monthly',
    annual: import.meta.env.STRIPE_PRICE_BASIC_ANNUAL ?? 'price_basic_annual',
  },
  pro: {
    monthly: import.meta.env.STRIPE_PRICE_PRO_MONTHLY ?? 'price_pro_monthly',
    annual: import.meta.env.STRIPE_PRICE_PRO_ANNUAL ?? 'price_pro_annual',
  },
  elite: {
    monthly: import.meta.env.STRIPE_PRICE_ELITE_MONTHLY ?? 'price_elite_monthly',
    annual: import.meta.env.STRIPE_PRICE_ELITE_ANNUAL ?? 'price_elite_annual',
  },
} as const;

export const TIER_LIMITS = {
  basic: {
    maxBarbers: 1,
    modules: ['agenda', 'clients', 'pos_services'],
  },
  pro: {
    maxBarbers: 5,
    modules: [
      'agenda', 'clients', 'pos_services', 'pos_products',
      'loyalty', 'remarketing', 'accounting', 'gallery', 'reviews',
    ],
  },
  elite: {
    maxBarbers: Infinity,
    modules: [
      'agenda', 'clients', 'pos_services', 'pos_products',
      'loyalty', 'remarketing', 'accounting', 'gallery', 'reviews',
      'warroom', 'banking', 'commissions',
    ],
  },
} as const;

export type TierKey = keyof typeof TIER_LIMITS;

export function hasAccess(tier: TierKey, module: string): boolean {
  return (TIER_LIMITS[tier]?.modules as readonly string[]).includes(module);
}

export function canAddBarber(tier: TierKey, currentCount: number): boolean {
  return currentCount < TIER_LIMITS[tier]?.maxBarbers;
}

export const PLAN_NAMES: Record<TierKey, string> = {
  basic: 'Básico',
  pro: 'Pro',
  elite: 'Elite',
};

export const PLAN_PRICES: Record<TierKey, { monthly: number; annual: number }> = {
  basic: { monthly: 79900, annual: 799000 },
  pro: { monthly: 149900, annual: 1499000 },
  elite: { monthly: 249900, annual: 2499000 },
};

export function formatCOP(amount: number): string {
  return '$' + Math.round(amount).toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).replace(/,/g, '.');
}

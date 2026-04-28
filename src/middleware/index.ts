import { defineMiddleware } from 'astro:middleware';
import { createAdminClient } from '@/lib/supabase';
import type { Subscription } from '@/lib/types';

// In-memory cache to avoid 2 DB queries on every request
const SESSION_TTL = 60_000; // 60 seconds
const sessionCache = new Map<string, { member: any; subscription: Subscription | null; expiry: number }>();

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

const PUBLIC_PREFIXES = [
  '/b/',
  '/api/auth',
  '/api/public/',
  '/api/stripe/webhook',
  '/_astro/',
];

// Module access by tier
const TIER_MODULES: Record<string, string[]> = {
  basic: [
    '/app',
    '/app/agenda',
    '/app/clients',
    '/app/services',
    '/app/pos',
    '/app/settings',
    '/app/landing',
    '/app/plans',
  ],
  pro: [
    '/app',
    '/app/agenda',
    '/app/clients',
    '/app/services',
    '/app/pos',
    '/app/products',
    '/app/team',
    '/app/accounting',
    '/app/gallery',
    '/app/remarketing',
    '/app/settings',
    '/app/landing',
    '/app/plans',
  ],
  elite: [
    '/app',
    '/app/agenda',
    '/app/clients',
    '/app/services',
    '/app/pos',
    '/app/products',
    '/app/team',
    '/app/accounting',
    '/app/gallery',
    '/app/remarketing',
    '/app/warroom',
    '/app/banking',
    '/app/settings',
    '/app/landing',
    '/app/plans',
  ],
};

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

function canAccessPath(pathname: string, tier: string): boolean {
  const allowed = TIER_MODULES[tier] ?? TIER_MODULES['basic'];
  return allowed.some(p => pathname === p || pathname.startsWith(p + '/'));
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Public API routes — no auth required (booking wizard, availability)
  if (pathname.startsWith('/api/public/')) return next();

  if (isPublicPath(pathname)) {
    return next();
  }

  if (pathname.startsWith('/app') || pathname.startsWith('/api')) {
    const accessToken = context.cookies.get('sb-access-token')?.value;

    if (!accessToken) {
      if (pathname.startsWith('/api')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return context.redirect('/login');
    }

    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      const userId = payload.sub;

      let member: any;
      let subscription: Subscription | null;

      const cached = sessionCache.get(userId);
      if (cached && cached.expiry > Date.now()) {
        member = cached.member;
        subscription = cached.subscription;
      } else {
        const admin = createAdminClient();

        const { data: memberData } = await admin
          .from('members')
          .select('*, barbershops(*)')
          .eq('user_id', userId)
          .eq('is_active', true)
          .single();

        if (!memberData) {
          if (pathname.startsWith('/app')) return context.redirect('/login?error=no_member');
          return next();
        }

        const { data: subRows } = await admin
          .from('subscriptions')
          .select('*')
          .eq('barbershop_id', memberData.barbershop_id)
          .order('created_at', { ascending: false })
          .limit(1);

        member = memberData;
        subscription = ((Array.isArray(subRows) ? subRows[0] : null) ?? null) as Subscription | null;
        sessionCache.set(userId, { member, subscription, expiry: Date.now() + SESSION_TTL });
      }

      if (!member) {
        if (pathname.startsWith('/app')) return context.redirect('/login?error=no_member');
        return next();
      }

      context.locals.user = { id: userId, email: payload.email ?? '' };
      context.locals.member = member;
      context.locals.barbershop = (member as any).barbershops ?? null;
      context.locals.subscription = subscription;

      // Paywall: allow active and trialing, block everything else
      if (pathname.startsWith('/app') && pathname !== '/app/plans') {
        const status = subscription?.status;
        const isSubscribed = status === 'active' || status === 'trialing';
        if (!isSubscribed) {
          return context.redirect('/app/plans');
        }

        // Tier-based module gating — remote DB uses plan_name, local schema uses tier
        const tier = subscription?.tier ?? (subscription as any)?.plan_name ?? 'basic';
        if (!canAccessPath(pathname, tier)) {
          // Redirect to upgrade page with context
          return context.redirect(`/app/plans?upgrade=1&required=${tier === 'basic' ? 'pro' : 'elite'}`);
        }
      }

      // Owner-only paths (within the tier's allowed modules)
      const ownerOnlyPaths = ['/app/team', '/app/settings', '/app/landing', '/app/accounting', '/app/warroom', '/app/banking', '/app/remarketing'];
      if (ownerOnlyPaths.some(p => pathname.startsWith(p)) && member.role !== 'owner') {
        return context.redirect('/app');
      }

    } catch (err) {
      console.error('Middleware error:', err);
      return context.redirect('/login');
    }
  }

  return next();
});

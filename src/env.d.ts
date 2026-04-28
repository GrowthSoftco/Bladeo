/// <reference types="astro/client" />

import type { Member, Barbershop, Subscription } from '@/lib/types';

declare global {
  namespace App {
    interface Locals {
      user: { id: string; email: string } | null;
      member: Member | null;
      barbershop: Barbershop | null;
      subscription: Subscription | null;
    }
  }
}

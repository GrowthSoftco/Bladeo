export type UserRole = 'owner' | 'barber';
export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type PaymentMethod = 'cash' | 'nequi' | 'daviplata' | 'card' | 'bancolombia';
export type SubscriptionTier = 'basic' | 'pro' | 'elite';
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'unpaid' | 'incomplete';
export type BillingCycle = 'monthly' | 'annual';
export type BankingTransactionType = 'deposit' | 'withdrawal' | 'transfer' | 'bill_payment' | 'other';
export type RewardType = 'free_service' | 'discount_pct' | 'discount_fixed' | 'custom';
export type PeriodType = 'biweekly' | 'monthly';
export type WaitlistStatus = 'waiting' | 'notified' | 'booked' | 'expired';
export type RemarketingStatus = 'pending' | 'sent' | 'failed';

export interface Barbershop {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
  description: string | null;
  address: string | null;
  city: string;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  opening_hours: Record<string, { open: string; close: string } | null> | null;
  payment_methods: PaymentMethod[] | null;
  payment_details: Record<string, string> | null;
  is_banking_correspondent: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  user_id: string;
  barbershop_id: string;
  role: UserRole;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  commission_pct: number;
  is_active: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  barbershop_id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  barbershop_id: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  stock: number;
  sku: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  barbershop_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  total_visits: number;
  total_spent: number;
  last_visit_at: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  barbershop_id: string;
  barber_id: string;
  client_id: string | null;
  service_id: string;
  client_name: string;
  client_phone: string | null;
  date: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  prepaid: boolean;
  prepaid_amount: number;
  payment_method: PaymentMethod | null;
  notes: string | null;
  created_at: string;
  // joined
  barber?: Member;
  service?: Service;
  client?: Client;
}

export interface Sale {
  id: string;
  barbershop_id: string;
  barber_id: string;
  client_id: string | null;
  appointment_id: string | null;
  subtotal: number;
  discount: number;
  total: number;
  payment_method: PaymentMethod;
  notes: string | null;
  created_at: string;
  // joined
  items?: SaleItem[];
  barber?: Member;
  client?: Client;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  item_type: 'service' | 'product';
  service_id: string | null;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface LoyaltyConfig {
  id: string;
  barbershop_id: string;
  visits_required: number;
  reward_type: RewardType;
  reward_value: number | null;
  reward_description: string | null;
  is_active: boolean;
}

export interface LoyaltyStamp {
  id: string;
  barbershop_id: string;
  client_id: string;
  current_stamps: number;
  total_redeemed: number;
  last_stamp_at: string | null;
}

export interface RemarketingRule {
  id: string;
  barbershop_id: string;
  name: string;
  days_after_last_visit: number;
  message_template: string;
  is_active: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  barbershop_id: string;
  category: string;
  description: string | null;
  amount: number;
  date: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  barbershop_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  tier: SubscriptionTier;
  billing_cycle: BillingCycle;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankingTransaction {
  id: string;
  barbershop_id: string;
  transaction_type: BankingTransactionType;
  entity: string;
  amount: number;
  commission_earned: number;
  reference: string | null;
  client_name: string | null;
  client_document: string | null;
  notes: string | null;
  created_at: string;
}

export interface GalleryImage {
  id: string;
  barbershop_id: string;
  barber_id: string | null;
  image_url: string;
  caption: string | null;
  created_at: string;
  barber?: Member;
}

export interface Review {
  id: string;
  barbershop_id: string;
  barber_id: string | null;
  client_id: string | null;
  appointment_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface Waitlist {
  id: string;
  barbershop_id: string;
  barber_id: string | null;
  client_name: string;
  client_phone: string;
  preferred_date: string | null;
  preferred_time_range: 'morning' | 'afternoon' | 'evening' | null;
  status: WaitlistStatus;
  created_at: string;
}

// App Locals (injected by middleware)
export interface AppLocals {
  user: {
    id: string;
    email: string;
  } | null;
  member: Member | null;
  barbershop: Barbershop | null;
  subscription: Subscription | null;
}

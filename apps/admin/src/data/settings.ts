import type { LucideIcon } from 'lucide-react'
import { Bell, CreditCard, FileText, Globe, Store, Truck, UserCog } from 'lucide-react'

export type SettingsSection = {
  href: string
  title: string
  body: string
  icon: LucideIcon
}

/** Settings index grid, in Shopify's order. */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    href: '/settings/general',
    title: 'General',
    body: 'Store name, contact details, address, currency and timezone.',
    icon: Store,
  },
  {
    href: '/settings/payments',
    title: 'Payments',
    body: 'Cash on delivery, UPI, Razorpay and per-method fees or discounts.',
    icon: CreditCard,
  },
  {
    href: '/settings/shipping',
    title: 'Shipping',
    body: 'Couriers, delivery estimates and dispatch policy.',
    icon: Truck,
  },
  {
    href: '/settings/notifications',
    title: 'Notifications',
    body: 'Order emails and WhatsApp messages to shoppers.',
    icon: Bell,
  },
  {
    href: '/settings/staff',
    title: 'Staff',
    body: 'Who can sign in to this store and what they can do.',
    icon: UserCog,
  },
  {
    href: '/settings/domains',
    title: 'Domains',
    body: 'The addresses your storefront answers on.',
    icon: Globe,
  },
  {
    href: '/settings/invoices',
    title: 'Invoices',
    body: 'GST details, invoice numbering and the PDF your customers receive.',
    icon: FileText,
  },
]

export const settingsContent = {
  general: {
    heading: 'General',
    body: 'Store name, contact email, address, currency and timezone will be editable here.',
    action: { label: 'Notification settings', href: '/settings/notifications' },
  },
  staff: {
    heading: 'Only you, for now',
    body: 'Invite teammates and set what each person can see and change in this store.',
  },
  domains: {
    heading: 'Domains',
    body: 'Connect your own domain and manage which hostnames route to this storefront.',
  },
  invoices: {
    heading: 'Invoices',
    body: 'GSTIN, HSN codes, invoice numbering and the PDF sent with each order.',
    action: { label: 'View orders', href: '/orders' },
  },
} as const

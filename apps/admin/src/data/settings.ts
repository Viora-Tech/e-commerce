import type { LucideIcon } from '@commerce/ui/icons'
import {
  Bell,
  CreditCard,
  FileText,
  Globe,
  Images,
  Store,
  Truck,
  UserCog,
} from '@commerce/ui/icons'

export type SettingsSection = {
  href: string
  title: string
  body: string
  icon: LucideIcon
}

/** Settings tabs in the left rail, in Shopify's order. */
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
    href: '/settings/files',
    title: 'Files',
    body: 'Where product images and uploads are stored: a local folder or your own R2 bucket.',
    icon: Images,
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
  nav: {
    label: 'Settings sections',
  },
  sections: {
    shipping: [
      { id: 'section-couriers', label: 'Couriers' },
      { id: 'section-policy', label: 'Dispatch policy' },
      { id: 'section-try-pin', label: 'Try a PIN code' },
    ],
    payments: [{ id: 'section-methods', label: 'Payment methods' }],
    files: [
      { id: 'section-providers', label: 'Storage' },
      { id: 'section-verify', label: 'Connection' },
    ],
  },
  general: {
    title: 'General',
    intro: 'What shoppers see in emails and invoices, and where your store operates.',
    details: {
      heading: 'Store details',
      name: 'Store name',
      email: 'Contact email',
      emailHelp: 'Shown on order emails and used for replies.',
      phone: 'Phone',
    },
    address: {
      heading: 'Business address',
      help: 'Printed on invoices and used as the default origin for delivery estimates.',
      line1: 'Address line 1',
      line2: 'Address line 2',
      city: 'City',
      state: 'State',
      pincode: 'PIN code',
      country: 'Country',
    },
    locale: {
      heading: 'Standards and formats',
      currency: 'Currency',
      currencyHelp: 'INR is the only currency for now.',
      timezone: 'Timezone',
      gstin: 'GSTIN',
      gstinHelp: 'Leave blank if not registered. Appears on tax invoices.',
    },
    timezones: [
      { value: 'Asia/Kolkata', label: 'India (Asia/Kolkata)' },
      { value: 'Asia/Dubai', label: 'Gulf (Asia/Dubai)' },
      { value: 'Asia/Singapore', label: 'Singapore (Asia/Singapore)' },
      { value: 'Europe/London', label: 'London (Europe/London)' },
      { value: 'America/New_York', label: 'New York (America/New_York)' },
    ],
    saved: 'Store details saved',
    failed: 'Could not save store details',
    unsaved: 'Unsaved changes',
    save: 'Save',
    discard: 'Discard',
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

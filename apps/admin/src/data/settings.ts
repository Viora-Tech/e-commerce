import type { LucideIcon } from '@commerce/ui/icons'
import {
  Bell,
  Braces,
  CreditCard,
  Globe,
  Home,
  Images,
  Palette,
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

/** The settings home: setup checklist and every section. First in the left rail. */
export const SETTINGS_HOME: SettingsSection = {
  href: '/settings',
  title: 'Overview',
  body: 'Your setup checklist and every settings page.',
  icon: Home,
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
    body: 'Couriers, shipping rates, delivery estimates and dispatch policy.',
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
    href: '/settings/custom-data',
    title: 'Custom data',
    body: 'Metafields on products and collections, and metaobject definitions.',
    icon: Braces,
  },
  {
    href: '/settings/domains',
    title: 'Domains',
    body: 'The addresses your storefront answers on.',
    icon: Globe,
  },
  {
    href: '/settings/appearance',
    title: 'Appearance',
    body: 'Admin accent colour and light or dark mode.',
    icon: Palette,
  },
]

export const settingsContent = {
  nav: {
    label: 'Settings sections',
  },
  sections: {
    payments: [
      { id: 'section-methods', label: 'Payment methods' },
      { id: 'section-unpaid', label: 'Unpaid orders' },
      { id: 'section-preorders', label: 'Pre-orders' },
    ],
    files: [
      { id: 'section-providers', label: 'Storage' },
      { id: 'section-verify', label: 'Connection' },
    ],
  },
  general: {
    title: 'General',
    intro: 'Your shop name, how customers reach you, and your address for invoices.',
    completion: {
      progress: (done: number, total: number) => `${done} of ${total} details done`,
      allDone: 'All your shop details are filled in.',
      missing: (items: string[]) => `Still to add: ${items.join(', ')}.`,
      items: {
        name: 'store name',
        email: 'contact email',
        phone: 'phone',
        address: 'business address',
        gstin: 'GSTIN',
      },
    },
    details: {
      heading: 'Store details',
      help: 'Customers see these on order emails and invoices.',
      name: 'Store name',
      nameHelp: 'The name customers know your shop by.',
      email: 'Contact email',
      emailHelp: 'Shown on order emails. When customers reply, it comes here.',
      phone: 'Phone',
      phoneHelp: 'For customers and couriers to call you. Include the country code, like +91.',
    },
    address: {
      heading: 'Business address',
      help: 'Printed on invoices and used to work out delivery dates.',
      prompt: {
        title: 'Add your business address',
        body: 'It is printed on your invoices and used to work out when parcels will arrive.',
        action: 'Add address',
      },
      line1: 'Address line 1',
      line2: 'Address line 2 (optional)',
      city: 'City',
      state: 'State',
      pincode: 'Pincode',
      country: 'Country',
    },
    tax: {
      heading: 'Taxes / GST',
      help: 'Only needed if your shop is GST registered. Skip this card if it is not.',
      gstin: 'GSTIN',
      gstinHelp: 'Your 15-character GST number. It appears on tax invoices.',
      gstRate: 'GST in your prices (%)',
      gstRateHelp:
        'The GST already included in your prices. Most shops use 18. Used to show CGST, SGST and IGST on invoices.',
    },
    locale: {
      heading: 'Currency and time',
      help: 'Used for prices, order times and reports.',
      currency: 'Currency',
      currencyHelp: 'Indian rupees (INR) for now.',
      timezone: 'Time zone',
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
} as const

export type SetupItemId =
  | 'store'
  | 'payments'
  | 'shipping'
  | 'taxes'
  | 'domain'
  | 'notifications'
  | 'policies'

/** Copy for the Settings home: the setup checklist and the list of every settings page. */
export const settingsHomeContent = {
  title: 'Settings',
  intro: 'Everything about how your shop works, in one place.',
  checklist: {
    heading: 'Get your shop ready',
    help: 'Do these once. Each one ticks itself when it is done.',
    progress: (done: number, total: number) => `${done} of ${total} done`,
    progressLabel: 'Setup progress',
    allDone: 'All done. Your shop is ready to sell.',
    doneLabel: 'Done',
    open: 'Open',
    loadFailed: 'Could not load your checklist.',
    items: {
      store: {
        title: 'Store details',
        todo: 'Add your shop name, email and business address.',
        done: 'Name, email and address are filled in.',
        href: '/settings/general',
      },
      payments: {
        title: 'Payments',
        todo: 'Choose how customers pay you: UPI, cards or cash on delivery.',
        done: 'You chose how customers pay you.',
        href: '/settings/payments',
      },
      shipping: {
        title: 'Shipping',
        todo: 'Say where you deliver and what delivery costs.',
        done: 'Delivery areas and prices are set.',
        href: '/settings/shipping',
      },
      taxes: {
        title: 'Taxes / GST',
        todo: 'Add your GSTIN if you are GST registered. Skip this if you are not.',
        done: 'Your GSTIN is on your invoices.',
        href: '/settings/general#tax',
      },
      domain: {
        title: 'Domain',
        todo: 'Connect your own website address, like yourshop.in.',
        done: 'Your own website address is working.',
        href: '/settings/domains',
      },
      notifications: {
        title: 'Notifications',
        todo: 'Connect email so customers hear from you when they order.',
        done: 'Customers get order emails.',
        href: '/settings/notifications',
      },
      policies: {
        title: 'Policies',
        todo: 'Publish your return, privacy and terms pages.',
        done: 'Your policy pages are live.',
        href: '/online-store/pages',
      },
    } satisfies Record<SetupItemId, { title: string; todo: string; done: string; href: string }>,
  },
  all: {
    heading: 'All settings',
  },
} as const

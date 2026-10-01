/**
 * The "Search settings…" index: every settings page and its major fields,
 * with the plain words and short forms a shop owner might type ("UPI",
 * "COD", "GST", "courier"). Client-side only; nothing is fetched.
 */

export type SettingsSearchEntry = {
  title: string
  /** The page it lives on, shown under the title. */
  where: string
  href: string
  /** Other words that should find it. Lowercase. */
  keywords: string[]
}

export const settingsSearchContent = {
  placeholder: 'Search settings…',
  label: 'Search settings',
  empty: (q: string) => `Nothing found for "${q}". Try a simpler word, like "UPI" or "courier".`,
  hint: 'Use ↑ and ↓ to move, Enter to open.',
} as const

export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  // Home
  {
    title: 'Setup checklist',
    where: 'Settings',
    href: '/settings',
    keywords: ['start', 'setup', 'getting started', 'progress', 'todo', 'launch', 'go live'],
  },
  // General
  {
    title: 'Store name',
    where: 'General',
    href: '/settings/general#store-details',
    keywords: ['shop name', 'business name', 'brand', 'title'],
  },
  {
    title: 'Contact email and phone',
    where: 'General',
    href: '/settings/general#store-details',
    keywords: ['email', 'phone', 'mobile', 'contact', 'reply', 'support'],
  },
  {
    title: 'Business address',
    where: 'General',
    href: '/settings/general#address',
    keywords: ['address', 'pincode', 'pin code', 'city', 'state', 'warehouse', 'invoice address'],
  },
  {
    title: 'Currency and time zone',
    where: 'General',
    href: '/settings/general#formats',
    keywords: ['currency', 'inr', 'rupee', 'timezone', 'time zone', 'clock'],
  },
  // Taxes & GST
  {
    title: 'Taxes and GST',
    where: 'Settings',
    href: '/settings/taxes',
    keywords: ['gst', 'gstin', 'tax', 'cgst', 'sgst', 'igst', 'tax rate', 'vat', 'legal name'],
  },
  {
    title: 'Prices include GST',
    where: 'Taxes & GST',
    href: '/settings/taxes#charging',
    keywords: ['inclusive', 'exclusive', 'mrp', 'tax included', 'hsn', 'composition', 'rate'],
  },
  {
    title: 'Invoice numbers',
    where: 'Taxes & GST',
    href: '/settings/taxes#invoice-numbers',
    keywords: ['invoice', 'invoice number', 'prefix', 'series', 'financial year', 'bill number'],
  },
  {
    title: 'E-invoicing (IRN)',
    where: 'Taxes & GST',
    href: '/settings/taxes#e-invoice',
    keywords: ['e-invoice', 'einvoice', 'irn', 'irp', 'qr code', 'e invoice'],
  },
  // Payments
  {
    title: 'Payments',
    where: 'Settings',
    href: '/settings/payments',
    keywords: ['payment', 'get paid', 'money', 'gateway', 'checkout', 'pay'],
  },
  {
    title: 'UPI',
    where: 'Payments',
    href: '/settings/payments',
    keywords: ['upi', 'gpay', 'google pay', 'phonepe', 'paytm', 'bhim', 'qr', 'qr code'],
  },
  {
    title: 'Cash on delivery (COD)',
    where: 'Payments',
    href: '/settings/payments',
    keywords: ['cod', 'cash', 'cash on delivery', 'pay on delivery'],
  },
  {
    title: 'Razorpay, Cashfree and other payment companies',
    where: 'Payments',
    href: '/settings/payments',
    keywords: ['razorpay', 'cashfree', 'decentro', 'card', 'cards', 'netbanking', 'emi', 'wallet'],
  },
  {
    title: 'Bank transfer and fees per method',
    where: 'Payments → Advanced',
    href: '/settings/payments/advanced',
    keywords: [
      'bank',
      'bank transfer',
      'neft',
      'imps',
      'fee',
      'discount',
      'unpaid',
      'cancel unpaid',
    ],
  },
  // Shipping
  {
    title: 'Shipping',
    where: 'Settings',
    href: '/settings/shipping',
    keywords: ['delivery', 'ship', 'shipping', 'parcel', 'dispatch'],
  },
  {
    title: 'Where you ship and what it costs',
    where: 'Shipping',
    href: '/settings/shipping#rates',
    keywords: [
      'rates',
      'shipping rate',
      'shipping charge',
      'delivery charge',
      'free shipping',
      'zone',
    ],
  },
  {
    title: 'Your boxes',
    where: 'Shipping',
    href: '/settings/shipping#boxes',
    keywords: ['box', 'boxes', 'package', 'packaging', 'weight', 'size', 'dimensions'],
  },
  {
    title: 'When orders go out',
    where: 'Shipping',
    href: '/settings/shipping#dispatch',
    keywords: ['dispatch', 'cutoff', 'holiday', 'holidays', 'working days', 'return address'],
  },
  {
    title: 'Which courier ships',
    where: 'Shipping',
    href: '/settings/shipping#courier',
    keywords: [
      'courier',
      'delhivery',
      'shiprocket',
      'rapidshyp',
      'default courier',
      'cheapest',
      'fastest',
    ],
  },
  {
    title: 'Connect a courier',
    where: 'Apps',
    href: '/apps',
    keywords: [
      'courier',
      'delhivery',
      'shiprocket',
      'rapidshyp',
      'connect courier',
      'awb',
      'pickup',
    ],
  },
  {
    title: 'Check delivery to a pincode',
    where: 'Shipping',
    href: '/settings/shipping#pincode',
    keywords: ['pincode', 'pin code', 'serviceable', 'delivery date', 'estimate'],
  },
  // Notifications
  {
    title: 'Messages your customers get',
    where: 'Notifications',
    href: '/settings/notifications',
    keywords: ['notification', 'email', 'emails', 'message', 'sms', 'order confirmation', 'alert'],
  },
  {
    title: 'WhatsApp messages',
    where: 'Notifications',
    href: '/settings/notifications#how-messages-are-sent',
    keywords: ['whatsapp', 'wa', 'meta', 'template'],
  },
  {
    title: 'Email sending (Amazon SES)',
    where: 'Notifications',
    href: '/settings/notifications#how-messages-are-sent',
    keywords: ['ses', 'amazon', 'aws', 'smtp', 'email sending', 'from address'],
  },
  // Others
  {
    title: 'Files and images',
    where: 'Settings',
    href: '/settings/files',
    keywords: ['files', 'images', 'photos', 'storage', 'r2', 'upload'],
  },
  {
    title: 'Staff',
    where: 'Settings',
    href: '/settings/staff',
    keywords: ['staff', 'team', 'users', 'invite', 'permissions', 'roles', 'employee'],
  },
  {
    title: 'Custom data',
    where: 'Settings',
    href: '/settings/custom-data',
    keywords: ['metafields', 'metaobjects', 'custom fields', 'extra fields', 'content types'],
  },
  {
    title: 'Domains',
    where: 'Settings',
    href: '/settings/domains',
    keywords: ['domain', 'website address', 'url', 'dns', 'www', '.com', '.in'],
  },
  {
    title: 'Appearance',
    where: 'Settings',
    href: '/settings/appearance',
    keywords: ['dark mode', 'light mode', 'theme', 'colour', 'color', 'accent'],
  },
  {
    title: 'Admin language',
    where: 'Settings → Account',
    href: '/settings/account',
    keywords: ['language', 'hindi', 'english', 'हिंदी', 'भाषा', 'translate', 'account'],
  },
  {
    title: 'Policies',
    where: 'Settings',
    href: '/settings/policies',
    keywords: [
      'policy',
      'policies',
      'refund',
      'return',
      'privacy',
      'terms',
      'cancellation',
      'shipping policy',
      'contact',
      'dpdp',
      'legal',
      'template',
    ],
  },
  {
    title: 'Grievance officer',
    where: 'Settings → Policies',
    href: '/settings/policies#grievance',
    keywords: ['grievance', 'complaint', 'legal name', 'consumer protection', 'e-commerce rules'],
  },
  {
    title: 'Checkout',
    where: 'Settings',
    href: '/settings/checkout',
    keywords: ['checkout', 'phone', 'mobile', 'email', 'pin code', 'pincode', 'order notes'],
  },
  {
    title: 'Minimum order value',
    where: 'Settings → Checkout',
    href: '/settings/checkout#minimum',
    keywords: ['minimum', 'min order', 'order value', 'smallest order'],
  },
  {
    title: 'Cash on delivery rules',
    where: 'Settings → Checkout',
    href: '/settings/checkout#cod',
    keywords: ['cod', 'cash on delivery', 'cod limit', 'block pincode', 'cod fee', 'whatsapp'],
  },
  {
    title: 'Business buyers at checkout',
    where: 'Settings → Checkout',
    href: '/settings/checkout#gstin',
    keywords: ['gstin', 'b2b', 'business buyer', 'gst invoice', 'company'],
  },
  {
    title: 'Customer privacy',
    where: 'Settings',
    href: '/settings/customer-privacy',
    keywords: ['privacy', 'dpdp', 'data protection', 'gdpr', 'personal data', 'consent'],
  },
  {
    title: 'Cookie banner',
    where: 'Settings → Customer privacy',
    href: '/settings/customer-privacy#banner',
    keywords: ['cookie', 'cookies', 'consent banner', 'tracking consent', 'pixel consent'],
  },
  {
    title: 'Data requests',
    where: 'Settings → Customer privacy',
    href: '/settings/customer-privacy/requests',
    keywords: ['data request', 'export data', 'delete data', 'erase', 'right to erasure', 'dsar'],
  },
  {
    title: 'Customer accounts',
    where: 'Settings',
    href: '/settings/customer-accounts',
    keywords: ['login', 'sign in', 'otp', 'guest checkout', 'customer login', 'account'],
  },
  {
    title: 'Sign-in by SMS or WhatsApp',
    where: 'Settings → Customer accounts',
    href: '/settings/customer-accounts#sign-in',
    keywords: ['sms otp', 'whatsapp otp', 'phone login', 'mobile login', 'email otp'],
  },
]

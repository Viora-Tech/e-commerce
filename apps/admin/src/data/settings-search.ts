/**
 * The "Search settings…" index: every settings page and its major fields,
 * with the plain words and short forms a shop owner might type ("UPI",
 * "COD", "GST", "courier"). Client-side only; nothing is fetched.
 */

import { routes } from '@/lib/routes'

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
  // Store › Store details
  {
    title: 'Store name',
    where: 'Store › Store details',
    href: '/settings/store#store-details',
    keywords: ['shop name', 'business name', 'brand', 'title'],
  },
  {
    title: 'Contact email and phone',
    where: 'Store › Store details',
    href: '/settings/store#store-details',
    keywords: ['email', 'phone', 'mobile', 'contact', 'reply', 'support'],
  },
  {
    title: 'Business address',
    where: 'Store › Store details',
    href: '/settings/store#address',
    keywords: ['address', 'pincode', 'pin code', 'city', 'state', 'warehouse', 'invoice address'],
  },
  {
    title: 'Currency and time zone',
    where: 'Store › Store details',
    href: '/settings/store#formats',
    keywords: ['currency', 'inr', 'rupee', 'timezone', 'time zone', 'clock'],
  },
  // Taxes & GST › GST & invoices (three tabs)
  {
    title: 'GST numbers',
    where: 'Taxes & GST › GST & invoices',
    href: '/settings/taxes',
    keywords: [
      'gst',
      'gstin',
      'tax',
      'cgst',
      'sgst',
      'igst',
      'vat',
      'pan',
      'gst numbers',
      'another state',
      'second gstin',
      'business',
      'warehouse gst',
    ],
  },
  {
    title: 'Tax rules: GST rate and legal name',
    where: 'Taxes & GST › GST & invoices',
    href: '/settings/taxes?tab=tax-rules',
    keywords: ['tax rate', 'gst rate', 'legal name', 'registered address', 'tax rules'],
  },
  {
    title: 'Prices include GST',
    where: 'Taxes & GST › GST & invoices',
    href: '/settings/taxes?tab=tax-rules#charging',
    keywords: ['inclusive', 'exclusive', 'mrp', 'tax included', 'hsn', 'composition', 'rate'],
  },
  {
    title: 'Invoice numbers',
    where: 'Taxes & GST › GST & invoices',
    href: '/settings/taxes?tab=invoices#invoice-numbers',
    keywords: ['invoice', 'invoice number', 'prefix', 'series', 'financial year', 'bill number'],
  },
  {
    title: 'E-invoicing (IRN)',
    where: 'Taxes & GST › GST & invoices',
    href: '/settings/taxes?tab=invoices#e-invoice',
    keywords: ['e-invoice', 'einvoice', 'irn', 'irp', 'qr code', 'e invoice'],
  },
  // Store › Locations & warehouses
  {
    title: 'Locations & warehouses',
    where: 'Store',
    href: '/settings/locations',
    keywords: ['warehouse', 'godown', 'location', 'bills under', 'dispatch from'],
  },
  // Payments
  {
    title: 'Payments',
    where: 'Selling',
    href: '/settings/payments',
    keywords: ['payment', 'get paid', 'money', 'gateway', 'checkout', 'pay'],
  },
  {
    title: 'UPI',
    where: 'Selling › Payments',
    href: '/settings/payments',
    keywords: ['upi', 'gpay', 'google pay', 'phonepe', 'paytm', 'bhim', 'qr', 'qr code'],
  },
  {
    title: 'Turn cash on delivery on or off',
    where: 'Selling › Payments',
    href: '/settings/payments',
    keywords: ['cod', 'cash', 'cash on delivery', 'pay on delivery'],
  },
  {
    title: 'Razorpay, Cashfree and other payment companies',
    where: 'Selling › Payments',
    href: '/settings/payments',
    keywords: ['razorpay', 'cashfree', 'decentro', 'card', 'cards', 'netbanking', 'emi', 'wallet'],
  },
  {
    title: 'Bank transfer and fees per method',
    where: 'Selling › Payments › Advanced',
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
    title: 'Shipping & delivery',
    where: 'Selling',
    href: '/settings/shipping',
    keywords: ['delivery', 'ship', 'shipping', 'parcel', 'dispatch'],
  },
  {
    title: 'Where you ship and what it costs',
    where: 'Selling › Shipping & delivery',
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
    where: 'Selling › Shipping & delivery',
    href: '/settings/shipping#boxes',
    keywords: ['box', 'boxes', 'package', 'packaging', 'weight', 'size', 'dimensions'],
  },
  {
    title: 'When orders go out',
    where: 'Selling › Shipping & delivery',
    href: '/settings/shipping#dispatch',
    keywords: ['dispatch', 'cutoff', 'holiday', 'holidays', 'working days', 'return address'],
  },
  {
    title: 'Which courier ships',
    where: 'Selling › Shipping & delivery',
    href: '/settings/shipping#courier',
    keywords: [
      'courier',
      'delhivery',
      'shiprocket',
      'rapidshyp',
      'blue dart',
      'bluedart',
      'dtdc',
      'xpressbees',
      'ekart',
      'shadowfax',
      'dhl',
      'fedex',
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
      'blue dart',
      'bluedart',
      'dtdc',
      'india post',
      'speed post',
      'xpressbees',
      'ekart',
      'shadowfax',
      'dhl',
      'fedex',
      'international shipping',
      'export',
      'connect courier',
      'awb',
      'pickup',
    ],
  },
  {
    title: 'Check delivery to a pincode',
    where: 'Selling › Shipping & delivery',
    href: '/settings/shipping#pincode',
    keywords: ['pincode', 'pin code', 'serviceable', 'delivery date', 'estimate'],
  },
  // Messages › Notifications
  {
    title: 'Messages your customers get',
    where: 'Messages › Notifications',
    href: '/settings/notifications',
    keywords: ['notification', 'email', 'emails', 'message', 'sms', 'order confirmation', 'alert'],
  },
  {
    title: 'WhatsApp messages',
    where: 'Messages › Notifications',
    href: '/settings/notifications#how-messages-are-sent',
    keywords: ['whatsapp', 'wa', 'meta', 'template'],
  },
  {
    title: 'Email sending (Amazon SES)',
    where: 'Messages › Notifications',
    href: '/settings/notifications#how-messages-are-sent',
    keywords: ['ses', 'amazon', 'aws', 'smtp', 'email sending', 'from address'],
  },
  {
    title: 'Send from your own email address',
    where: 'Messages › Notifications',
    href: '/settings/notifications#notifications-sender',
    keywords: ['sender', 'from address', 'own email', 'domain email', 'dkim', 'spf', 'reply to'],
  },
  // Moved out of Settings: file storage sits with Content › Files
  {
    title: 'Where files and images are stored',
    where: 'Content › Files',
    href: '/content/files/storage',
    keywords: ['files', 'images', 'photos', 'storage', 'r2', 's3', 'bucket', 'upload'],
  },
  // Team & advanced
  {
    title: 'Staff',
    where: 'Team & advanced',
    href: '/settings/staff',
    keywords: ['staff', 'team', 'users', 'invite', 'permissions', 'roles', 'employee'],
  },
  {
    title: 'Custom data',
    where: 'Team & advanced',
    href: '/settings/custom-data',
    keywords: ['metafields', 'metaobjects', 'custom fields', 'extra fields', 'content types'],
  },
  {
    title: 'Domains',
    where: 'Store',
    href: '/settings/domains',
    keywords: ['domain', 'website address', 'url', 'dns', 'www', '.com', '.in'],
  },
  {
    title: 'AI',
    where: 'Team & advanced',
    href: '/settings/ai',
    keywords: [
      'ai',
      'artificial intelligence',
      'write with ai',
      'ask your store',
      'usage',
      'quota',
    ],
  },
  {
    title: 'Appearance',
    where: 'Team & advanced',
    href: routes.settings.appearance(),
    keywords: ['dark mode', 'light mode', 'theme', 'colour', 'color', 'accent'],
  },
  // Your own preferences: the account menu, top right
  {
    title: 'Profile',
    where: 'Account menu › Account',
    href: routes.account.home(),
    keywords: ['name', 'photo', 'avatar', 'picture', 'phone', 'mobile', 'whatsapp', 'account'],
  },
  {
    title: 'Sign-in & security',
    where: 'Account menu › Account',
    href: routes.account.security(),
    keywords: [
      'change email',
      'email',
      'passkey',
      'fingerprint',
      'face id',
      'google',
      'sign-in history',
      'security',
    ],
  },
  {
    title: 'Sessions',
    where: 'Account menu › Account',
    href: routes.account.sessions(),
    keywords: ['devices', 'sign out', 'log out', 'logged in', 'sessions', 'lost phone'],
  },
  {
    title: 'Your notifications',
    where: 'Account menu › Account',
    href: routes.account.notifications(),
    keywords: ['order alerts', 'new order email', 'daily summary', 'whatsapp alerts', 'my alerts'],
  },
  {
    title: 'Delete my account',
    where: 'Account menu › Account › Profile',
    href: `${routes.account.home()}#delete-account`,
    keywords: ['delete account', 'close account', 'remove me'],
  },
  {
    title: 'Your stores',
    where: 'Account menu › Account › Stores',
    href: routes.account.stores(),
    keywords: ['switch store', 'leave store', 'stores', 'role', 'owner'],
  },
  {
    title: 'Admin language',
    where: 'Account menu › Account › Language & region',
    href: routes.account.language(),
    keywords: [
      'language',
      'hindi',
      'english',
      'हिंदी',
      'भाषा',
      'translate',
      '24-hour',
      '12-hour',
      'time format',
      'week starts',
    ],
  },
  // Customers
  {
    title: 'Policies',
    where: 'Customers',
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
    where: 'Customers › Policies',
    href: '/settings/policies#grievance',
    keywords: ['grievance', 'complaint', 'legal name', 'consumer protection', 'e-commerce rules'],
  },
  {
    title: 'Checkout',
    where: 'Selling',
    href: '/settings/checkout',
    keywords: ['checkout', 'phone', 'mobile', 'email', 'pin code', 'pincode', 'order notes'],
  },
  {
    title: 'Minimum order value',
    where: 'Selling › Checkout',
    href: '/settings/checkout#minimum',
    keywords: ['minimum', 'min order', 'order value', 'smallest order'],
  },
  {
    title: 'Cash on delivery rules',
    where: 'Selling › Checkout',
    href: '/settings/checkout#cod',
    keywords: ['cod', 'cash on delivery', 'cod limit', 'block pincode', 'cod fee', 'whatsapp'],
  },
  {
    title: 'Cash on delivery fee',
    where: 'Taxes & GST › Costs for profit',
    href: `${routes.settings.costs()}#cod-fee`,
    keywords: ['cod', 'cash on delivery', 'cod fee', 'cod charges', 'courier cod fee'],
  },
  {
    title: 'PIN codes without cash on delivery',
    where: 'Selling › Checkout',
    href: `${routes.settings.checkout()}#cod`,
    keywords: ['cash on delivery', 'block pincode', 'cod pincode', 'pincode', 'pin code'],
  },
  {
    title: 'Business buyers at checkout',
    where: 'Selling › Checkout',
    href: '/settings/checkout?tab=branding#gstin',
    keywords: ['gstin', 'b2b', 'business buyer', 'gst invoice', 'company'],
  },
  {
    title: 'Checkout branding',
    where: 'Selling › Checkout',
    href: '/settings/checkout?tab=branding',
    keywords: [
      'checkout logo',
      'checkout colour',
      'checkout color',
      'pay button',
      'checkout font',
      'trust badges',
      'checkout look',
    ],
  },
  {
    title: 'Privacy & data requests',
    where: 'Customers',
    href: '/settings/privacy',
    keywords: ['privacy', 'dpdp', 'data protection', 'gdpr', 'personal data', 'consent'],
  },
  {
    title: 'Cookie banner',
    where: 'Customers › Privacy & data requests',
    href: '/settings/privacy#banner',
    keywords: ['cookie', 'cookies', 'consent banner', 'tracking consent', 'pixel consent'],
  },
  {
    title: 'Data requests',
    where: 'Customers › Privacy & data requests',
    href: '/settings/privacy/requests',
    keywords: ['data request', 'export data', 'delete data', 'erase', 'right to erasure', 'dsar'],
  },
  {
    title: 'Customer accounts',
    where: 'Customers',
    href: '/settings/customer-accounts',
    keywords: ['login', 'sign in', 'otp', 'guest checkout', 'customer login', 'account'],
  },
  {
    title: 'Sign-in by SMS or WhatsApp',
    where: 'Customers › Customer accounts',
    href: '/settings/customer-accounts#sign-in',
    keywords: ['sms otp', 'whatsapp otp', 'phone login', 'mobile login', 'email otp'],
  },
]

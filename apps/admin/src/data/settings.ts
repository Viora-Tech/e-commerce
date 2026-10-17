import type { SetupItemId } from '@commerce/core/setup-tasks'
import type { LucideIcon } from '@commerce/ui/icons'
import {
  AiIcon,
  Bell,
  Braces,
  ClipboardList,
  CreditCard,
  Globe,
  Home,
  MapPinLineIcon,
  Palette,
  ReceiptIcon,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  Truck,
  Undo,
  UserCircle,
  UserCog,
} from '@commerce/ui/icons'
import { routes } from '@/lib/routes'

export type SettingsSection = {
  href: string
  title: string
  /** The one line under the title: what this page is for. */
  body: string
  icon: LucideIcon
}

/** The six headings the settings pages sit under, in the rail and on the Settings home. */
export type SettingsGroupId = 'store' | 'selling' | 'taxes' | 'customers' | 'messages' | 'team'

export type SettingsGroup = {
  id: SettingsGroupId
  sections: SettingsSection[]
}

/** The settings home: setup checklist and every section. First in the left rail. */
export const SETTINGS_HOME: SettingsSection = {
  href: routes.settings.home(),
  title: 'Overview',
  body: 'Your setup checklist and every settings page.',
  icon: Home,
}

/**
 * Every settings page, under its heading. The rail, the Settings home, the command palette and
 * the Hindi page names all read this one list; headings come from `settingsContent.groups`.
 */
export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'store',
    sections: [
      {
        href: routes.settings.store(),
        title: 'Store details',
        body: 'Shop name, contact details, address, currency and time zone, and your store data.',
        icon: Store,
      },
      {
        href: routes.settings.domains(),
        title: 'Domains',
        body: 'The website addresses your shop opens on.',
        icon: Globe,
      },
      {
        href: routes.settings.locations(),
        title: 'Locations & warehouses',
        body: 'Where you keep stock, and which GST number each place bills under.',
        icon: MapPinLineIcon,
      },
    ],
  },
  {
    id: 'selling',
    sections: [
      {
        href: routes.settings.payments(),
        title: 'Payments',
        body: 'How customers pay you: UPI, cards, cash on delivery and fees per method.',
        icon: CreditCard,
      },
      {
        href: routes.settings.checkout(),
        title: 'Checkout',
        body: 'What shoppers fill in, minimum order value, COD rules and how checkout looks.',
        icon: ShoppingCart,
      },
      {
        href: routes.settings.shipping(),
        title: 'Shipping & delivery',
        body: 'Where you deliver, what it costs, your boxes, couriers and dispatch days.',
        icon: Truck,
      },
      {
        href: routes.settings.returns(),
        title: 'Returns',
        body: 'How many days customers have to return, which reasons you accept, and refunds.',
        icon: Undo,
      },
    ],
  },
  {
    id: 'taxes',
    sections: [
      {
        href: routes.settings.taxes(),
        title: 'GST & invoices',
        body: 'Your GST numbers, how GST is added to prices, and how invoices are numbered.',
        icon: ReceiptIcon,
      },
      {
        href: routes.settings.costs(),
        title: 'Costs for profit',
        body: 'What payment gateways and cash on delivery cost you, so order profit is right.',
        icon: TrendingUp,
      },
    ],
  },
  {
    id: 'customers',
    sections: [
      {
        href: routes.settings.customerAccounts(),
        title: 'Customer accounts',
        body: 'Guest checkout, and sign-in codes by email, SMS or WhatsApp.',
        icon: UserCircle,
      },
      {
        href: routes.settings.privacy(),
        title: 'Privacy & data requests',
        body: 'Cookie banner, marketing consent, and customers asking for or deleting their data.',
        icon: ShieldCheck,
      },
      {
        href: routes.settings.policies(),
        title: 'Policies',
        body: 'Refund, privacy, terms, shipping and contact pages, from ready-made templates.',
        icon: ClipboardList,
      },
    ],
  },
  {
    id: 'messages',
    sections: [
      {
        href: routes.settings.notifications(),
        title: 'Notifications',
        body: 'Order emails and WhatsApp messages to customers, and the address they come from.',
        icon: Bell,
      },
    ],
  },
  {
    id: 'team',
    sections: [
      {
        href: routes.settings.staff(),
        title: 'Staff',
        body: 'Who can sign in to this store and what they can do.',
        icon: UserCog,
      },
      {
        href: routes.settings.ai(),
        title: 'AI',
        body: 'Write with AI and Ask your store: what you used this month, and turning them on.',
        icon: AiIcon,
      },
      {
        href: routes.settings.customData(),
        title: 'Custom data',
        body: 'Extra fields on products and collections, and your content types.',
        icon: Braces,
      },
      {
        // Your own light/dark and accent; the page lives under your account, linked here too
        // so nobody hunts for it.
        href: routes.account.appearance(),
        title: 'Appearance',
        body: 'Light or dark mode and your accent colour, just for you.',
        icon: Palette,
      },
    ],
  },
]

/** Every settings page in rail order, for lookups that do not care about the headings. */
export const SETTINGS_SECTIONS: SettingsSection[] = SETTINGS_GROUPS.flatMap((g) => g.sections)

export const settingsContent = {
  nav: {
    label: 'Settings sections',
    back: 'Settings',
  },
  groups: {
    store: 'Store',
    selling: 'Selling',
    taxes: 'Taxes & GST',
    customers: 'Customers',
    messages: 'Messages',
    team: 'Team & advanced',
  } satisfies Record<SettingsGroupId, string>,
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
    taxes: [
      { id: 'gst-numbers', label: 'GST numbers' },
      { id: 'tax-rules', label: 'Tax rules' },
      { id: 'invoices', label: 'Invoice numbers' },
    ],
  },
  general: {
    title: 'Store details',
    intro: 'Your shop name, how customers reach you, your address for invoices, and your data.',
    completion: {
      progress: (done: number, total: number) => `${done} of ${total} details done`,
      allDone: 'All your shop details are filled in.',
      missing: (items: string[]) => `Still to add: ${items.join(', ')}.`,
      items: {
        name: 'store name',
        email: 'contact email',
        phone: 'phone',
        address: 'business address',
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
      phoneHelp: 'For customers and couriers to call you. Pick the country, then type the number.',
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
  taxesPage: {
    title: 'GST & invoices',
    intro: 'Your GST numbers, how GST is added to your prices, and how your invoices are numbered.',
  },
  staff: {
    heading: 'Only you, for now',
    body: 'Invite teammates and set what each person can see and change in this store.',
  },
} as const

export type { SetupItemId }

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
    setUp: 'Set up',
    loadFailed: 'Could not load your checklist.',
    items: {
      store: {
        title: 'Store details',
        todo: 'Add your shop name, email and business address.',
        done: 'Name, email and address are filled in.',
        href: routes.settings.store(),
      },
      payments: {
        title: 'Payments',
        todo: 'Choose how customers pay you: UPI, cards or cash on delivery.',
        done: 'You chose how customers pay you.',
        href: routes.settings.payments(),
      },
      shipping: {
        title: 'Shipping & delivery',
        todo: 'Say where you deliver and what delivery costs.',
        done: 'Delivery areas and prices are set.',
        href: routes.settings.shipping(),
      },
      taxes: {
        title: 'Taxes & GST',
        todo: 'Add your GSTIN if you are GST registered. Skip this if you are not.',
        done: 'Your GSTIN is on your invoices.',
        href: routes.settings.taxes(),
      },
      domain: {
        title: 'Domain',
        todo: 'Connect your own website address, like yourshop.in.',
        done: 'Your own website address is working.',
        href: routes.settings.domains(),
      },
      notifications: {
        title: 'Notifications',
        todo: 'Connect email so customers hear from you when they order.',
        done: 'Customers get order emails.',
        href: routes.settings.notifications(),
      },
      policies: {
        title: 'Policies',
        todo: 'Publish your refund, privacy, terms, shipping and contact pages.',
        done: 'Your policy pages are live.',
        href: routes.settings.policies(),
      },
    } satisfies Record<SetupItemId, { title: string; todo: string; done: string; href: string }>,
  },
  /** The prompt shown after saving any setup page while setup is unfinished. */
  next: {
    doneTitle: (task: string, done: number, total: number) =>
      `${task} saved · ${done} of ${total} set up`,
    progressTitle: (done: number, total: number) => `${done} of ${total} set up`,
    description: (task: string) => `Next: ${task}`,
    setUp: 'Set up now',
    dontShow: 'Don’t show again',
  },
  all: {
    heading: 'All settings',
  },
  elsewhere: {
    personal: 'Your language and how the admin looks are yours, not the store’s:',
    account: 'Account',
    appearance: 'Appearance',
    personalWhere: '(also in the menu under your initials, top right).',
    storage: 'Where uploads are stored:',
    storageLink: 'Content › Files › Storage',
  },
} as const

/** The "‹ Settings" link every settings page shows above its title. */
export const SETTINGS_BACK = { href: SETTINGS_HOME.href, label: settingsContent.nav.back }

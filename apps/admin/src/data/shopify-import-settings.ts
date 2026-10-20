import type {
  SettingsAction,
  SettingsPart,
  SettingsPartState,
  SettingsReason,
  SettingsResultState,
  SettingsSubject,
} from '@commerce/plugin-shopify-import/client'

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`

/** What a reason line can say: the Shopify value it is about, and the two sides of a difference. */
export type ReasonValues = { name: string; detail: string; from: string; to: string }

/** Shopify importer › Store settings: check what Shopify has, choose parts, import, see what happened. */
export const shopifyImportSettingsContent = {
  /** The card on the importer's home page. */
  card: {
    title: 'Store settings',
    body: 'Bring your store details, tax, locations, shipping rates, policies and extra field definitions over. See every change before it is made.',
    action: 'Check settings',
  },
  intro:
    'Bring your Shopify store’s setup over: store details, tax, locations, shipping rates, policies and extra field definitions. Check first to see exactly what changes. Nothing changes until you press Import.',
  notConnected: 'Connect your Shopify store first, then come back here.',
  connect: 'Connect Shopify',
  check: 'Check Shopify',
  checkAgain: 'Check again',
  checkFailed: 'Could not read your Shopify store',
  comparing: (shop: string) => `Compared with ${shop}`,
  choose:
    'Tick what to bring over. Parts that already match, or that need access, cannot be ticked.',
  import: (n: number) => (n === 0 ? 'Import' : `Import ${plural(n, 'part', 'parts')}`),
  importFailed: 'The import did not finish',
  imported: 'Store settings imported',
  reportHeading: 'What happened',
  reportIntro:
    'Each part saved on its own. Running it again is safe: anything already here shows as matching.',
  backToCheck: 'Check again',
  openSettings: 'Open settings',
  reconnect: (scopes: string) =>
    `Shopify did not let the importer read this. Add ${scopes} to your app in Shopify, then reconnect.`,
  reconnectAction: 'Reconnect',
  showAll: (n: number) => `Show all ${n.toLocaleString('en-IN')}`,
  showLess: 'Show less',
  on: 'On',
  off: 'Off',
  parts: {
    store: {
      title: 'Store details',
      body: 'Store name, contact email and phone, business address. Currency, time zone and weight unit are compared, never changed.',
    },
    tax: {
      title: 'Tax and GST',
      body: 'Whether your prices include tax, and your GST number when Shopify shares it. A GST number already here is never replaced.',
    },
    locations: {
      title: 'Locations',
      body: 'Your Shopify locations with their addresses and PIN codes, matched by name. New ones hold no stock and do not sell online until you turn that on.',
    },
    shipping: {
      title: 'Shipping zones and rates',
      body: 'Zones and rates from your general shipping profile: flat, by order value, by weight, and free over an amount.',
    },
    packages: {
      title: 'Packages',
      body: 'Saved box sizes used when you create a shipment.',
    },
    policies: {
      title: 'Policies',
      body: 'Refund, privacy, terms of service, shipping and contact policies, cleaned of scripts and styling.',
    },
    fields: {
      title: 'Extra field definitions',
      body: 'Extra fields on products, variants, collections, customers and orders, where the field type exists here.',
    },
  } satisfies Record<SettingsPart, { title: string; body: string }>,
  state: {
    ready: 'Changes to bring over',
    same: 'Already matches',
    access: 'Needs access',
    failed: 'Could not read',
  } satisfies Record<SettingsPartState, string>,
  result: {
    done: 'Saved',
    same: 'Nothing to change',
    access: 'Needs access',
    failed: 'Not saved',
    skipped: 'Not chosen',
  } satisfies Record<SettingsResultState, string>,
  saved: (n: number) => `${plural(n, 'change', 'changes')} saved`,
  actions: {
    create: 'New',
    update: 'Change',
    same: 'Matches',
    conflict: 'Kept yours',
    manual: 'Set up by hand',
    warn: 'Note',
  } satisfies Record<SettingsAction, string>,
  subjects: {
    store_name: 'Store name',
    contact_email: 'Contact email',
    contact_phone: 'Contact phone',
    address: 'Business address',
    default_location_address: 'Default location address',
    currency: 'Currency',
    timezone: 'Time zone',
    weight_unit: 'Weight unit',
    money_format: 'Price format',
    prices_include_tax: 'Prices include tax',
    gstin: 'GST number',
    location: 'Location',
    shipping_zone: 'Shipping zone',
    delivery_profile: 'Shipping profile',
    packages: 'Packages',
    policy: 'Policy',
    field: 'Extra field',
  } satisfies Record<SettingsSubject, string>,
  owners: {
    product: 'Products',
    variant: 'Variants',
    collection: 'Collections',
    customer: 'Customers',
    order: 'Orders',
  } as Record<string, string>,
  empty: 'Nothing in Shopify for this part.',
  rates: {
    flat: (price: string) => `${price} flat`,
    free: 'Free',
    orderValue: (price: string, from: string, to: string) => `${price} for orders ${from} to ${to}`,
    orderOver: (price: string, from: string) => `${price} for orders from ${from}`,
    orderUnder: (price: string, to: string) => `${price} for orders under ${to}`,
    weight: (price: string, from: string, to: string) => `${price} for ${from} to ${to}`,
    weightOver: (price: string, from: string) => `${price} from ${from}`,
    weightUnder: (price: string, to: string) => `${price} under ${to}`,
    grams: (g: string) => `${g} g`,
  },
  reasons: {
    currency_mismatch: (v: ReasonValues) =>
      `Shopify sells in ${v.to}, this store in ${v.from}. Prices are not converted.`,
    timezone_mismatch: (v: ReasonValues) =>
      `Shopify uses ${v.to}, this store ${v.from}. Change it in Settings › General if you want the same.`,
    weight_unit: (v: ReasonValues) =>
      `Shopify weighs in ${v.detail.toLowerCase()}. Weights here are grams; imported products were converted.`,
    gstin_not_shared: () =>
      'Shopify does not share your GST number with apps. Add it in Settings › Taxes & GST.',
    gstin_exists: (v: ReasonValues) =>
      `This store already has ${v.from}. Shopify’s ${v.to} was not added. Change GST numbers in Settings › Taxes & GST.`,
    invalid_email: (v: ReasonValues) => `${v.detail} is not a valid email, so it was left out.`,
    invalid_phone: (v: ReasonValues) =>
      `${v.detail} is not a valid phone number, so it was left out.`,
    invalid_pincode: (v: ReasonValues) =>
      `${v.detail} is not a 6-digit PIN code. The address came over without it.`,
    default_location: (v: ReasonValues) =>
      `${v.name} ships first on Shopify. Your default location stays ${v.detail}; change it in Settings › Locations.`,
    app_location: (v: ReasonValues) =>
      `${v.name} is run by an app on Shopify, so it was not added.`,
    local_pickup: (v: ReasonValues) => `In-store pickup at ${v.name} is not available here yet.`,
    zone_outside_india: (v: ReasonValues) =>
      `${v.name} ships outside India. Rates here cover Indian addresses only.`,
    zone_other_countries: (v: ReasonValues) =>
      `${v.name} also covers other countries (${v.detail}). Only its Indian part came over.`,
    zone_no_rates: (v: ReasonValues) =>
      `${v.name} has no rates that could come over, so it was not created.`,
    unknown_state: (v: ReasonValues) => `${v.detail} in ${v.name} is not an Indian state here.`,
    product_profile: (v: ReasonValues) =>
      `${v.name} has rates for some products only. Rates here apply to every product.`,
    carrier_rates: (v: ReasonValues) =>
      `${v.name} is calculated live by ${v.detail || 'a carrier'}. Connect a courier here instead.`,
    mixed_conditions: (v: ReasonValues) =>
      `${v.name} depends on order value and weight at once. Rates here use one or the other.`,
    rate_currency: (v: ReasonValues) => `${v.name} is priced in ${v.detail}.`,
    packages_not_shared: () =>
      'Shopify does not share saved packages with apps. Add your box sizes in Settings › Shipping.',
    policy_type: (v: ReasonValues) =>
      `${v.name} has no page here. Copy it into a page if you need it.`,
    policy_images: (v: ReasonValues) =>
      `${plural(Number(v.detail) || 0, 'picture', 'pictures')} in ${v.name} were left out.`,
    field_type: (v: ReasonValues) => `${v.name} is a ${v.detail} field, which has no match here.`,
    reference_target: (v: ReasonValues) =>
      `${v.name} links to a content type that is not imported yet. Import content types, then check again.`,
    field_exists: (v: ReasonValues) =>
      `${v.name} already exists here as another type, so yours was kept.`,
    owner_access: (v: ReasonValues) =>
      `Extra fields on ${v.name.toLowerCase()} could not be read: ${v.detail}`,
  } satisfies Record<SettingsReason, (v: ReasonValues) => string>,
  fixHref: {
    store: '/settings/store',
    tax: '/settings/taxes',
    locations: '/settings/locations',
    shipping: '/settings/shipping',
    packages: '/settings/shipping',
    policies: '/settings/policies',
    fields: '/settings/custom-data',
  } satisfies Record<SettingsPart, string>,
} as const

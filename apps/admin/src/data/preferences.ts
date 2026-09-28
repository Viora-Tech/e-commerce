import { PREFERENCE_LIMITS } from '@commerce/core/preferences'

/** Copy for Online Store › Preferences. */
export const preferencesContent = {
  title: 'Preferences',
  subtitle:
    'How your storefront shows up in search and social, who can visit it, and what it tracks.',
  unsaved: 'Unsaved preferences',
  save: 'Save',
  discard: 'Discard',
  saved: 'Preferences saved',
  failed: 'Could not save preferences',
  unavailable: {
    heading: 'Preferences unavailable',
    body: 'You need access to the online store to change its preferences.',
  },
  seo: {
    heading: 'Title and meta description',
    body: 'Search engines and AI assistants show these for your home page.',
    title: 'Home page title',
    titleHelp: 'Leave blank to use your store name.',
    description: 'Meta description',
    descriptionHelp: 'One or two sentences about what you sell.',
    count: (n: number, max: number) => `${n} of ${max} characters`,
    preview: 'Search result preview',
  },
  social: {
    heading: 'Social sharing image',
    body: 'Shown when your store link is shared on WhatsApp, Instagram, X or Facebook. 1200 by 628 works best.',
    pick: 'Choose image',
    change: 'Change',
    remove: 'Remove',
    dialog: 'Choose a social sharing image',
    empty: 'No images yet. Upload some under Content › Files.',
    alt: 'Image description',
    altHelp: 'Read aloud by screen readers when the image is shared.',
  },
  password: {
    heading: 'Password protection',
    body: 'Only visitors with the password can see your storefront. Useful before launch.',
    enabled: 'Restrict access with a password',
    password: 'Password',
    passwordHelp: `At least ${PREFERENCE_LIMITS.passwordMin} characters. Changing it signs every visitor out.`,
    message: 'Message for visitors',
    messageHelp: 'Shown on the password page, e.g. "Opening soon".',
  },
  privacy: {
    heading: 'Cookie consent',
    body: 'The cookie banner now lives in Settings, Customer privacy. Shoppers are always asked before analytics or marketing tags load.',
    link: 'Open cookie banner settings',
  },
  tracking: {
    heading: 'Analytics and marketing',
    body: 'Tags load only after the visitor agrees to that category in the cookie banner.',
    ga4: 'Google Analytics 4 measurement ID',
    ga4Placeholder: 'G-XXXXXXXXXX',
    gtm: 'Google Tag Manager container ID',
    gtmPlaceholder: 'GTM-XXXXXXX',
    metaPixel: 'Meta pixel ID',
    metaPixelPlaceholder: '123456789012345',
    analytics: 'Analytics',
    marketing: 'Marketing',
  },
} as const

/** SOURCE OF TRUTH: new-store template copy — WHAT the neutral words a new store's header, home and footer start with (`defaultTemplate`) / WHY several sections' own defaults are still the Zero Drift theme's (the Waimers store's) copy, so these are set on each section to win over them; saved templates keep what they have. */
export const defaultTemplatesContent = {
  announcement: '<p>Welcome to our store</p>',
  hero: {
    heading: 'Welcome to our store',
    subheading: 'Discover our latest products, picked with care.',
    cta: { label: 'Shop now', href: '/collections/all' },
  },
  richText: {
    heading: 'About us',
    body: '<p>Use this section to tell customers about your brand, what you sell and why.</p>',
  },
  newsletter: {
    eyebrow: 'Newsletter',
    heading: 'Subscribe to our emails',
    text: '<p>Be the first to hear about new products and offers.</p>',
    reassurance: 'Unsubscribe any time.',
  },
  footer: { tagline: '', newsletterHeading: 'Subscribe to our emails' },
} as const

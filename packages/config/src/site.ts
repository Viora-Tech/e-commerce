/**
 * SOURCE OF TRUTH: siteConfig, brand name, support contact, public URLs, locale and UI defaults
 * WHAT: the one typed place for every value that names the platform or sets a product-wide default:
 *   brand (name, tagline, domain, logos), contact, public URLs, locale (currency, language, zone,
 *   date styles), UI defaults (rows per page, toast times), plan-limit placeholders, social links.
 * WHY: "Vextro" and its siblings were spelled out in templates, user agents and admin copy, so a
 *   rename (it may change) meant a grep. Everything reads this module instead; the
 *   `site-config` sweep fails on a literal brand name anywhere else.
 * WHERE: admin copy and shell, storefront, worker and emails all import `@commerce/config/site`.
 *   Pure data, no env, no secrets, so a client component may import it. Secrets and per-deploy
 *   URLs (ADMIN_URL, STOREFRONT_URL, keys) stay in env (`@commerce/config`); the URLs here are
 *   the public marketing and legal pages. Placeholder values are marked PLACEHOLDER: set the
 *   real ones before go-live.
 */

export type SiteConfig = {
  brand: {
    name: string
    tagline: string
    /** Bare domain, no scheme. PLACEHOLDER until the platform domain is final. */
    domain: string
    /** Paths under the app's public folder. */
    logo: { mark: string; full: string; favicon: string }
  }
  contact: {
    supportEmail: string
    /** International format, digits only (wa.me style). PLACEHOLDER. */
    whatsappNumber: string
    whatsappGreeting: string
    phone: string
  }
  urls: {
    site: string
    docs: string
    terms: string
    privacy: string
    refunds: string
    status: string
  }
  locale: {
    currency: 'INR'
    /** BCP 47 default for number and date text. */
    locale: string
    languages: readonly ['en', 'hi']
    defaultLanguage: 'en'
    timeZone: string
    /** date-fns style patterns the admin shows dates in. */
    dateFormats: { short: string; long: string; time: string }
    /** Words for the nearest days: "Today 4:05 pm", "Yesterday 9:12 am", then "5 Oct". */
    relativeDayWords: { today: string; yesterday: string }
  }
  ui: {
    rowsPerPage: { options: readonly [10, 25, 50, 100]; default: 10 }
    toastMs: { default: number; success: number; error: number }
  }
  /** PLACEHOLDER limits per plan; billing owns the real numbers. */
  plans: Record<'free' | 'growth' | 'scale', { name: string; ordersPerMonth: number }>
  social: { x: string; instagram: string; youtube: string; linkedin: string; github: string }
}

export const siteConfig: SiteConfig = {
  brand: {
    name: 'Vextro',
    tagline: 'Run your store in plain words.',
    domain: 'vextro.example',
    logo: { mark: '/brand/mark.svg', full: '/brand/logo.svg', favicon: '/favicon.ico' },
  },
  contact: {
    supportEmail: 'support@vextro.example',
    whatsappNumber: '910000000000',
    whatsappGreeting: 'Hi, I need help with my store.',
    phone: '+91 00000 00000',
  },
  urls: {
    site: 'https://vextro.example',
    docs: 'https://docs.vextro.example',
    terms: 'https://vextro.example/terms',
    privacy: 'https://vextro.example/privacy',
    refunds: 'https://vextro.example/refunds',
    status: 'https://status.vextro.example',
  },
  locale: {
    currency: 'INR',
    locale: 'en-IN',
    languages: ['en', 'hi'],
    defaultLanguage: 'en',
    timeZone: 'Asia/Kolkata',
    dateFormats: { short: 'd MMM', long: 'd MMM yyyy', time: 'h:mm a' },
    relativeDayWords: { today: 'Today', yesterday: 'Yesterday' },
  },
  ui: {
    rowsPerPage: { options: [10, 25, 50, 100], default: 10 },
    toastMs: { default: 4000, success: 3000, error: 6000 },
  },
  plans: {
    free: { name: 'Free', ordersPerMonth: 100 },
    growth: { name: 'Growth', ordersPerMonth: 1000 },
    scale: { name: 'Scale', ordersPerMonth: 10000 },
  },
  social: {
    x: 'https://x.com/vextro',
    instagram: 'https://instagram.com/vextro',
    youtube: 'https://youtube.com/@vextro',
    linkedin: 'https://linkedin.com/company/vextro',
    github: 'https://github.com/vextro',
  },
}

/** `https://wa.me/<number>?text=...`: the "Help on WhatsApp" link. */
export function whatsappHelpUrl(text: string = siteConfig.contact.whatsappGreeting): string {
  return `https://wa.me/${siteConfig.contact.whatsappNumber}?text=${encodeURIComponent(text)}`
}

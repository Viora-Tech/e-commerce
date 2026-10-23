/**
 * SOURCE OF TRUTH: siteConfig, brand name, support contact, public URLs, locale and UI defaults
 * WHAT: the one typed place for every value that names the platform or sets a product-wide default:
 *   brand (name, tagline, domain, logos), contact, public URLs, locale (currency, language, zone,
 *   date styles), UI defaults (rows per page, toast times), plan-limit placeholders, social links.
 * WHY: The platform name and its siblings were spelled out in templates, user agents and admin copy, so a
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
    /** The merchant admin (sign in, sign up). */
    admin: string
    docs: string
    /**
     * The App Store website, where apps are browsed and installed from (apps/www `/apps`).
     * `apps.<domain>` redirects here; see docs/handoff/changes/2026-10-23-app-store-site.md.
     */
    apps: string
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
  /**
   * Plans as the landing site shows them, before GST. Mirrors `packages/core/src/billing/plans.ts`
   * (memory-bank/pricing.md, decided 2026-10-18); change both together.
   */
  plans: Record<
    'starter' | 'growth' | 'pro',
    { name: string; ordersPerMonth: number; monthlyInr: number; yearlyInr: number }
  >
  /** Days of Growth every new store gets, no card asked. */
  trialDays: number
  social: { x: string; instagram: string; youtube: string; linkedin: string; github: string }
}

export const siteConfig: SiteConfig = {
  brand: {
    name: 'Koomerce',
    tagline: 'Run your store in plain words.',
    domain: 'koomerce.app',
    logo: { mark: '/brand/mark.svg', full: '/brand/logo.svg', favicon: '/favicon.ico' },
  },
  contact: {
    supportEmail: 'support@koomerce.app',
    whatsappNumber: '910000000000',
    whatsappGreeting: 'Hi, I need help with my store.',
    phone: '+91 94168 74123',
  },
  urls: {
    site: 'https://koomerce.app',
    admin: 'https://admin.koomerce.app',
    docs: 'https://docs.koomerce.app',
    apps: 'https://koomerce.app/apps',
    terms: 'https://koomerce.app/terms',
    privacy: 'https://koomerce.app/privacy',
    refunds: 'https://koomerce.app/refunds',
    status: 'https://status.koomerce.app',
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
    starter: { name: 'Starter', ordersPerMonth: 50, monthlyInr: 499, yearlyInr: 4990 },
    growth: { name: 'Growth', ordersPerMonth: 200, monthlyInr: 1499, yearlyInr: 14990 },
    pro: { name: 'Pro', ordersPerMonth: 1000, monthlyInr: 4999, yearlyInr: 49990 },
  },
  trialDays: 14,
  social: {
    x: 'https://x.com/koomerce',
    instagram: 'https://instagram.com/koomerce',
    youtube: 'https://youtube.com/@koomerce',
    linkedin: 'https://linkedin.com/company/koomerce',
    github: 'https://github.com/koomerce',
  },
}

/**
 * A page of the App Store website: the directory, one category (`{ category: 'shipping' }`) or
 * one app (`{ app: 'reviews' }`). Opened in a new tab from the admin.
 */
export function appStoreUrl(to: { app?: string; category?: string } = {}): string {
  if (to.app) return `${siteConfig.urls.apps}/${encodeURIComponent(to.app)}`
  if (to.category) return `${siteConfig.urls.apps}/category/${encodeURIComponent(to.category)}`
  return siteConfig.urls.apps
}

/** `https://wa.me/<number>?text=...`: the "Help on WhatsApp" link. */
export function whatsappHelpUrl(text: string = siteConfig.contact.whatsappGreeting): string {
  return `https://wa.me/${siteConfig.contact.whatsappNumber}?text=${encodeURIComponent(text)}`
}

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
  /** The business behind the platform, as payment partners and the legal pages name it. */
  company: {
    legalName: string
    /** Registered and operational address (the same place): GST invoices only. */
    address: string
    /** What the public website shows. */
    publicAddress: string
    gstin: string
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
    rowsPerPage: { options: readonly [10, 25, 50, 100]; default: 50 }
    toastMs: { default: number; success: number; error: number }
  }
  /**
   * Plans as the landing site shows them, before GST. Mirrors `packages/core/src/billing/plans.ts`
   * (memory-bank/pricing.md, decided 2026-10-28); change both together. `feePercent` is charged
   * on each order's total after `ordersPerMonth`; `visitsPerMonth` is fair use (null: by hand).
   */
  plans: Record<
    'starter' | 'growth' | 'pro' | 'scale',
    {
      name: string
      ordersPerMonth: number
      monthlyInr: number
      yearlyInr: number
      feePercent: number
      visitsPerMonth: number | null
    }
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
    phone: '+91 93550 74123',
  },
  company: {
    legalName: 'Viora India (a sole proprietorship of Kuldeep Saini)',
    /** Registered address: GST invoices only, never shown on the site (it is also the owner's home). */
    address: '745/25, Saini Niwas, Gali Number 3, West Ram Nagar, Sonipat 131001, Haryana, India',
    /** What the website shows: the city only (owner, 2026-10-29). */
    publicAddress: 'Sonipat, Haryana, India',
    gstin: '06OIEPS3969E1ZM',
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
    // 50 like Shopify: 10 made 1,357 orders 136 pages and 2,808 files 281 (audit #4, #89).
    rowsPerPage: { options: [10, 25, 50, 100], default: 50 },
    toastMs: { default: 4000, success: 3000, error: 6000 },
  },
  plans: {
    starter: {
      name: 'Starter',
      ordersPerMonth: 50,
      monthlyInr: 499,
      yearlyInr: 4990,
      feePercent: 1,
      visitsPerMonth: 25_000,
    },
    growth: {
      name: 'Growth',
      ordersPerMonth: 200,
      monthlyInr: 1999,
      yearlyInr: 19990,
      feePercent: 0.75,
      visitsPerMonth: 100_000,
    },
    pro: {
      name: 'Pro',
      ordersPerMonth: 500,
      monthlyInr: 4999,
      yearlyInr: 49990,
      feePercent: 0.5,
      visitsPerMonth: 500_000,
    },
    scale: {
      name: 'Scale',
      ordersPerMonth: 2000,
      monthlyInr: 14999,
      yearlyInr: 149990,
      feePercent: 0,
      visitsPerMonth: null,
    },
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

import type { Fields } from '@puckeditor/core'
import type { ReactNode } from 'react'
import { type IconName, isIconName } from '../../components/icon'
import { footerContent as copy } from '../../data/zero-drift/footer'
import { inlineRichtext, inlineText } from '../inline-fields'

/**
 * SOURCE OF TRUTH KEYWORDS: footerDef, footerSettings, Footer section settings
 * WHAT:  The Footer dynamic section's fields and defaults (Zero Drift `sections/footer.liquid`:
 *        help cards, the about text with logo and socials, payment icons, policy links), and
 *        `footerSettings`, which turns saved settings into `<Footer>` props.
 * WHY:   The footer is drawn by the storefront (store menus, policies, grievance officer,
 *        theme toggle) and by the admin canvas; both read the section through this one
 *        mapper, so an old saved `{ tagline }` and a new section render the same way.
 * WHERE: `../dynamic.tsx` registers it; `components/footer.tsx` draws it.
 */

export type SocialPlatform = (typeof copy.socialOptions)[number]['value']
export type PaymentMethod = (typeof copy.paymentOptions)[number]['value']

/** What the section's settings decide. Inline-edited copy arrives as React nodes in the editor. */
export type FooterSettings = {
  helpCards: { icon: IconName; title: ReactNode; text: ReactNode; link: string }[]
  aboutHeading: ReactNode
  tagline: ReactNode
  showLogo: boolean
  wide: boolean
  showSocial: boolean
  socials: { platform: SocialPlatform; url: string }[]
  showPaymentIcons: boolean
  paymentIcons: { method: PaymentMethod }[]
  showPolicies: boolean
}

const showHide = (label: string) => ({ type: 'radio', label, options: copy.showHide }) as const

const DEFAULTS: FooterSettings = {
  helpCards: copy.helpCards.map((c) => ({ ...c })),
  aboutHeading: copy.aboutHeading,
  tagline: copy.tagline,
  showLogo: true,
  wide: true,
  showSocial: true,
  socials: [],
  showPaymentIcons: true,
  paymentIcons: copy.paymentIcons.map((p) => ({ ...p })),
  showPolicies: true,
}

const FIELDS = {
  helpCards: {
    type: 'array',
    label: copy.fields.helpCards,
    max: 3,
    getItemSummary: (c: { title?: unknown }) =>
      typeof c.title === 'string' && c.title ? c.title : copy.helpCardFallback,
    arrayFields: {
      icon: { type: 'select', label: copy.fields.helpIcon, options: copy.iconOptions },
      title: inlineText(copy.fields.helpTitle),
      text: inlineText(copy.fields.helpText),
      link: { type: 'text', label: copy.fields.helpLink },
    },
  },
  aboutHeading: inlineText(copy.fields.aboutHeading),
  tagline: inlineRichtext(copy.fields.tagline),
  showLogo: showHide(copy.fields.showLogo),
  wide: showHide(copy.fields.wide),
  showSocial: showHide(copy.fields.showSocial),
  socials: {
    type: 'array',
    label: copy.fields.socials,
    max: 6,
    getItemSummary: (s: { platform?: string }) =>
      copy.socialOptions.find((o) => o.value === s.platform)?.label ?? copy.socialFallback,
    arrayFields: {
      platform: { type: 'select', label: copy.fields.socialPlatform, options: copy.socialOptions },
      url: { type: 'text', label: copy.fields.socialUrl },
    },
  },
  showPaymentIcons: showHide(copy.fields.showPaymentIcons),
  paymentIcons: {
    type: 'array',
    label: copy.fields.paymentIcons,
    max: 6,
    getItemSummary: (p: { method?: string }) =>
      copy.paymentOptions.find((o) => o.value === p.method)?.label ?? copy.paymentFallback,
    arrayFields: {
      method: { type: 'select', label: copy.fields.paymentMethod, options: copy.paymentOptions },
    },
  },
  showPolicies: showHide(copy.fields.showPolicies),
} as unknown as Fields

export const footerDef = { label: copy.label, fields: FIELDS, defaultProps: DEFAULTS }

const SOCIALS = new Set<string>(copy.socialOptions.map((o) => o.value))
const PAYMENTS = new Set<string>(copy.paymentOptions.map((o) => o.value))

const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'object' && v !== null) : []
const flag = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback)
/** Saved copy: a string on the storefront, a React node while editing; missing is the default. */
const copyValue = (value: unknown, fallback: ReactNode): ReactNode =>
  value === undefined || value === null ? fallback : (value as ReactNode)
const str = (value: unknown) => (typeof value === 'string' ? value : '')

/** Saved Footer settings (any age) as `<Footer>` props; missing keys take the defaults. */
export function footerSettings(s: Record<string, unknown>): FooterSettings {
  return {
    helpCards: (s.helpCards === undefined ? DEFAULTS.helpCards : list(s.helpCards)).map((c) => ({
      icon: typeof c.icon === 'string' && isIconName(c.icon) ? c.icon : 'question',
      title: copyValue(c.title, ''),
      text: copyValue(c.text, ''),
      link: str(c.link),
    })),
    aboutHeading: copyValue(s.aboutHeading, DEFAULTS.aboutHeading),
    tagline: copyValue(s.tagline, DEFAULTS.tagline),
    showLogo: flag(s.showLogo, DEFAULTS.showLogo),
    wide: flag(s.wide, DEFAULTS.wide),
    showSocial: flag(s.showSocial, DEFAULTS.showSocial),
    socials: list(s.socials).flatMap((x) =>
      typeof x.platform === 'string' && SOCIALS.has(x.platform)
        ? [{ platform: x.platform as SocialPlatform, url: str(x.url) }]
        : [],
    ),
    showPaymentIcons: flag(s.showPaymentIcons, DEFAULTS.showPaymentIcons),
    paymentIcons: (s.paymentIcons === undefined ? DEFAULTS.paymentIcons : list(s.paymentIcons))
      .map((p) => p.method)
      .filter((m): m is PaymentMethod => typeof m === 'string' && PAYMENTS.has(m))
      .map((method) => ({ method })),
    showPolicies: flag(s.showPolicies, DEFAULTS.showPolicies),
  }
}

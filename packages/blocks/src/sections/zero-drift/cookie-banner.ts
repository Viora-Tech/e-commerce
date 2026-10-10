import type { Fields } from '@puckeditor/core'
import type { ReactNode } from 'react'
import { cookieBannerContent as copy } from '../../data/zero-drift/cookie-banner'
import { inlineRichtext, inlineText } from '../inline-fields'

/**
 * SOURCE OF TRUTH KEYWORDS: cookieBannerDef, cookieBannerSettings, CookieBanner section
 * WHAT:  The CookieBanner dynamic section (Glide `sections/cookie-banner.liquid`): how the
 *        consent banner looks and what its buttons say. It decides nothing about consent.
 * WHY:   Consent (the cookie, its version, what each answer loads, the `#cookie-settings`
 *        reopen link) stays in the storefront's ConsentManager; the footer group only owns
 *        the banner's appearance, so a merchant styles it in Customize like any section.
 * WHERE: `../dynamic.tsx` registers it; the storefront layout renders ConsentManager with
 *        these settings, the admin canvas a static `components/sections/zero-drift/cookie-banner.tsx`.
 */

export type CookieBannerPosition = (typeof copy.positionOptions)[number]['value']

/** The banner's look and labels. Inline-edited copy arrives as React nodes in the editor. */
export type CookieBannerSettings = {
  position: CookieBannerPosition
  message: ReactNode
  policyLink: string
  policyLabel: ReactNode
  acceptLabel: ReactNode
  declineLabel: ReactNode
  showPreferences: boolean
  preferencesLabel: ReactNode
  /** Seconds before the banner appears; nothing optional loads in the meantime either way. */
  delay: number
}

const DEFAULTS: CookieBannerSettings = {
  position: 'bar',
  message: copy.message,
  policyLink: '',
  policyLabel: copy.policyLabel,
  acceptLabel: copy.acceptLabel,
  declineLabel: copy.declineLabel,
  showPreferences: true,
  preferencesLabel: copy.preferencesLabel,
  delay: 1,
}

const FIELDS = {
  position: { type: 'radio', label: copy.fields.position, options: copy.positionOptions },
  message: inlineRichtext(copy.fields.message),
  policyLink: { type: 'text', label: copy.fields.policyLink },
  policyLabel: inlineText(copy.fields.policyLabel),
  acceptLabel: inlineText(copy.fields.acceptLabel),
  declineLabel: inlineText(copy.fields.declineLabel),
  showPreferences: { type: 'radio', label: copy.fields.showPreferences, options: copy.showHide },
  preferencesLabel: inlineText(copy.fields.preferencesLabel),
  delay: { type: 'number', label: copy.fields.delay, min: 0, max: 20 },
} as unknown as Fields

export const cookieBannerDef = { label: copy.label, fields: FIELDS, defaultProps: DEFAULTS }

const POSITIONS = new Set<string>(copy.positionOptions.map((o) => o.value))
const MAX_DELAY_SECONDS = 20

const copyValue = (value: unknown, fallback: ReactNode): ReactNode =>
  value === undefined || value === null ? fallback : (value as ReactNode)

/** Saved CookieBanner settings as the banner's props; missing or invalid keys take the defaults. */
export function cookieBannerSettings(s: Record<string, unknown>): CookieBannerSettings {
  const delay = typeof s.delay === 'number' && Number.isFinite(s.delay) ? s.delay : DEFAULTS.delay
  return {
    position:
      typeof s.position === 'string' && POSITIONS.has(s.position)
        ? (s.position as CookieBannerPosition)
        : DEFAULTS.position,
    message: copyValue(s.message, DEFAULTS.message),
    policyLink: typeof s.policyLink === 'string' ? s.policyLink : '',
    policyLabel: copyValue(s.policyLabel, DEFAULTS.policyLabel),
    acceptLabel: copyValue(s.acceptLabel, DEFAULTS.acceptLabel),
    declineLabel: copyValue(s.declineLabel, DEFAULTS.declineLabel),
    showPreferences:
      typeof s.showPreferences === 'boolean' ? s.showPreferences : DEFAULTS.showPreferences,
    preferencesLabel: copyValue(s.preferencesLabel, DEFAULTS.preferencesLabel),
    delay: Math.min(MAX_DELAY_SECONDS, Math.max(0, delay)),
  }
}

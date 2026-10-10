import type { Fields } from '@puckeditor/core'
import type { ReactNode } from 'react'
import { headerContent as copy } from '../../data/zero-drift/header'
import { imageField } from '../framed'
import { inlineText } from '../inline-fields'

/**
 * SOURCE OF TRUTH KEYWORDS: headerDef, headerSettings, Header section settings
 * WHAT:  The Header dynamic section's fields and defaults (Glide `sections/header.liquid`:
 *        menu, logo position, sticky, wishlist, menu images and hover look, the dropdowns'
 *        feature cards, the search overlay's popular terms and brand collections), and
 *        `headerSettings`, which turns saved settings into typed values.
 * WHY:   The header is drawn by the storefront (store menus, cart count, predictive search)
 *        and by the admin canvas; both read the section through this one mapper, so an old
 *        saved `{ menu }` and a new section render the same way.
 * WHERE: `../dynamic.tsx` registers it; `components/header.tsx` draws it;
 *        `../../header-menu.ts` turns the settings into menu cards and search shortcuts.
 */

export type FeatureCardSetting = {
  /** The top-level menu item's title this card shows under (case-insensitive). */
  menuItem: string
  collection: string
  image: { url: string; alt: string }
  eyebrow: ReactNode
  label: ReactNode
  link: string
  style: 'light' | 'dark'
}

/** What the section's settings decide. Inline-edited copy arrives as React nodes in the editor. */
export type HeaderSettings = {
  menu: string
  logoPosition: 'left' | 'center'
  sticky: 'none' | 'always' | 'on-scroll-up'
  showWishlist: boolean
  showMenuImages: boolean
  menuHover: 'underline' | 'pill'
  featureCards: FeatureCardSetting[]
  popularTerms: string
  brandCollections: { handle: string }[]
}

const d = copy.defaults
const f = copy.fields

const DEFAULTS: HeaderSettings = {
  menu: d.menu,
  logoPosition: d.logoPosition,
  sticky: d.sticky,
  showWishlist: d.showWishlist,
  showMenuImages: d.showMenuImages,
  menuHover: d.menuHover,
  featureCards: d.featureCards.map((c) => ({ ...c, image: { ...c.image } })),
  popularTerms: d.popularTerms,
  brandCollections: [],
}

const showHide = (label: string) =>
  ({ type: 'radio', label, options: copy.options.showHide }) as const

const FIELDS = {
  menu: { type: 'text', label: f.menu },
  logoPosition: { type: 'select', label: f.logoPosition, options: copy.options.logoPosition },
  sticky: { type: 'select', label: f.sticky, options: copy.options.sticky },
  showWishlist: showHide(f.showWishlist),
  showMenuImages: showHide(f.showMenuImages),
  menuHover: { type: 'select', label: f.menuHover, options: copy.options.menuHover },
  featureCards: {
    type: 'array',
    label: f.featureCards,
    getItemSummary: (c: { menuItem?: unknown }) =>
      typeof c.menuItem === 'string' && c.menuItem ? c.menuItem : f.cardFallback,
    defaultItemProps: { ...copy.newFeatureCard, image: { ...copy.newFeatureCard.image } },
    arrayFields: {
      menuItem: { type: 'text', label: f.menuItem },
      eyebrow: inlineText(f.eyebrow),
      label: inlineText(f.cardLabel),
      link: { type: 'text', label: f.link },
      collection: { type: 'text', label: f.collection },
      image: imageField(f.image),
      style: { type: 'select', label: f.style, options: copy.options.style },
    },
  },
  popularTerms: { type: 'text', label: f.popularTerms },
  brandCollections: {
    type: 'array',
    label: f.brandCollections,
    max: copy.maxBrands,
    getItemSummary: (b: { handle?: unknown }) =>
      typeof b.handle === 'string' && b.handle ? b.handle : f.brandFallback,
    defaultItemProps: { handle: '' },
    arrayFields: { handle: { type: 'text', label: f.brandHandle } },
  },
} as unknown as Fields

export const headerDef = { label: copy.label, fields: FIELDS, defaultProps: DEFAULTS }

const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'object' && v !== null) : []
const text = (value: unknown, fallback = '') => (typeof value === 'string' ? value : fallback)
const oneOf = <T extends string>(value: unknown, allowed: readonly { value: T }[], fallback: T) =>
  allowed.some((o) => o.value === value) ? (value as T) : fallback
/** Saved copy: a string on the storefront, a React node while editing; missing is empty. */
const node = (value: unknown): ReactNode =>
  value === undefined || value === null ? '' : (value as ReactNode)

/** Saved Header settings (any age, `{ menu }` included) as typed values; missing keys default. */
export function headerSettings(s: Record<string, unknown>): HeaderSettings {
  const image = (value: unknown) => {
    const i = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
    return { url: text(i.url), alt: text(i.alt) }
  }
  return {
    menu: text(s.menu),
    logoPosition: oneOf(s.logoPosition, copy.options.logoPosition, DEFAULTS.logoPosition),
    sticky: oneOf(s.sticky, copy.options.sticky, DEFAULTS.sticky),
    showWishlist: typeof s.showWishlist === 'boolean' ? s.showWishlist : DEFAULTS.showWishlist,
    showMenuImages:
      typeof s.showMenuImages === 'boolean' ? s.showMenuImages : DEFAULTS.showMenuImages,
    menuHover: oneOf(s.menuHover, copy.options.menuHover, DEFAULTS.menuHover),
    featureCards:
      s.featureCards === undefined
        ? DEFAULTS.featureCards
        : records(s.featureCards).map((c) => ({
            menuItem: text(c.menuItem),
            collection: text(c.collection),
            image: image(c.image),
            eyebrow: node(c.eyebrow),
            label: node(c.label),
            link: text(c.link),
            style: oneOf(c.style, copy.options.style, 'light'),
          })),
    popularTerms: text(s.popularTerms, DEFAULTS.popularTerms),
    brandCollections: records(s.brandCollections).flatMap((b) =>
      typeof b.handle === 'string' && b.handle.trim() ? [{ handle: b.handle.trim() }] : [],
    ),
  }
}

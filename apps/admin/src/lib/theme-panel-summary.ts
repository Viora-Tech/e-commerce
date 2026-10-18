import { THEME_FONTS, type Theme } from '@commerce/core/theme'
import { cornerStyleOf, sizeScaleOf } from '@/lib/theme-quick-settings'

/** The Theme settings groups, in Figma's order (697:5119). */
export const THEME_GROUPS = [
  'colours',
  'typography',
  'buttons',
  'layout',
  'cards',
  'cart',
  'social',
  'css',
  'brand',
] as const

export type ThemeGroup = (typeof THEME_GROUPS)[number]

type SummaryCopy = {
  summary: {
    colours: string
    typography: (heading: string, body: string, size: string) => string
    buttons: (style: string, corners: string) => string
    layout: (width: number, spacing: string) => string
    cards: (ratio: string, extras: string[]) => string
    vendor: string
    saleBadge: string
    hoverImage: string
    quickAdd: string
    rating: string
    wishlist: string
    minimal: string
    standard: string
    cart: (type: 'drawer' | 'page', bar: boolean) => string
    social: (names: string[]) => string
    css: (lines: number) => string
    brand: (logo: string | null, favicon: string | null) => string
  }
  sizes: Record<'s' | 'm' | 'l', string>
  corners: Record<'square' | 'soft' | 'round', string>
  styles: Record<'solid' | 'outline', string>
}

const SOCIAL_NAMES: Record<string, string> = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
  facebook: 'Facebook',
  twitter: 'X',
  discord: 'Discord',
}
const socialName = (p: string) => SOCIAL_NAMES[p] ?? p

/** `.../waimers-logo.svg?v=2` → `waimers-logo.svg`. */
const fileName = (url: string | undefined | null) =>
  url ? (url.split('?')[0]?.split('/').pop() ?? null) : null

/** Section spacing as the S / M / L the panel's sizes use. */
const spacingSize = (multiplier: number): 's' | 'm' | 'l' =>
  multiplier < 0.85 ? 's' : multiplier > 1.15 ? 'l' : 'm'

/**
 * The one line under each Theme settings row (Figma 697:5119): what the group is set to now,
 * e.g. "Archivo / Figtree · size M" or "Filled · Round corners".
 */
export function themeGroupSummary(
  group: ThemeGroup,
  theme: Theme,
  copy: SummaryCopy,
  ratioLabel: (ratio: Theme['cards']['imageRatio']) => string,
): string {
  const s = copy.summary
  switch (group) {
    case 'colours':
      return s.colours
    case 'typography':
      return s.typography(
        THEME_FONTS[theme.fonts.heading].label,
        THEME_FONTS[theme.fonts.body].label,
        copy.sizes[sizeScaleOf(theme.fonts)],
      )
    case 'buttons':
      return s.buttons(
        copy.styles[theme.buttons.style],
        copy.corners[cornerStyleOf(theme.shape.buttonRadius)],
      )
    case 'layout':
      return s.layout(theme.layout.pageWidth, copy.sizes[spacingSize(theme.layout.sectionSpacing)])
    case 'cards':
      return s.cards(
        `${theme.cards.style === 'minimal' ? s.minimal : s.standard} · ${ratioLabel(theme.cards.imageRatio).toLowerCase()}`,
        [
          theme.cards.showQuickAdd ? s.quickAdd : null,
          theme.cards.showRating ? s.rating : null,
          theme.cards.showVendor ? s.vendor : null,
          theme.cards.showSaleBadge ? s.saleBadge : null,
          theme.cards.hoverImage ? s.hoverImage : null,
        ].filter((x): x is string => x !== null),
      )
    case 'cart':
      return s.cart(theme.cart.type, theme.cart.freeShippingBar)
    case 'social':
      return s.social(theme.social.links.map((l) => socialName(l.platform)))
    case 'css':
      return s.css(theme.customCss.trim() ? theme.customCss.trim().split('\n').length : 0)
    case 'brand':
      return s.brand(fileName(theme.brand.logo?.url), fileName(theme.brand.favicon?.url))
  }
}

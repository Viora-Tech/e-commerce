import type { ReactNode } from 'react'
import { headerContent as copy } from './data/zero-drift/header'
import { hasCopy } from './sections/main-product-settings'
import type { FeatureCardSetting } from './sections/zero-drift/header'
import type { NavLink } from './types'

/**
 * SOURCE OF TRUTH KEYWORDS: menuCardsFor, searchShortcuts, header menu cards
 * WHAT:  Turns the Header section's settings into what the header draws beyond the menu
 *        itself: the cards in a dropdown's right-hand zone, and the search overlay's
 *        popular-term and brand pills.
 * WHY:   Zero Drift's header.liquid resolves both from section blocks, the menu and the store's
 *        collections; the storefront and the admin canvas must agree, so it lives here.
 * WHERE: `components/header.tsx` (cards); the storefront layout (search shortcuts for
 *        its predictive search).
 */

/** A collection as the header needs it: a title and the image a menu card can lead with. */
export type MenuCollection = { handle: string; title: string; imageUrl: string | null }

/** One card in a dropdown's right-hand zone. With no image it draws as a text card. */
export type MenuCard = {
  key: string
  href: string
  image: { url: string; alt: string } | null
  /** Null when blank, so the card can skip it without inspecting editor nodes. */
  eyebrow: ReactNode | null
  title: ReactNode
  tone: 'light' | 'dark'
}

/** A pill in the search overlay: a popular term or a brand collection. */
export type SearchShortcut = { label: string; href: string }

/** The handle in a `/collections/<handle>` link, or null for any other link. */
function collectionHandle(href: string): string | null {
  const match = /^\/collections\/([^/?#]+)/.exec(href)
  return match?.[1] ? decodeURIComponent(match[1]) : null
}

const key = (value: string) => value.trim().toLowerCase()

/**
 * The cards a top-level item's dropdown shows. Curated feature cards whose menu item matches
 * the link's title win (up to three, as the theme's `feature_card` blocks); otherwise, with
 * menu images on, the item's child links that point at a collection with an image. The theme
 * shows those collections' products there; menus carry no product data here, so the
 * collection's own image stands in.
 */
export function menuCardsFor(
  link: NavLink,
  cards: FeatureCardSetting[],
  collections: MenuCollection[],
  showImages: boolean,
): MenuCard[] {
  if (!showImages) return []
  const byHandle = new Map(collections.map((c) => [c.handle, c]))
  const curated = cards
    .filter((c) => c.menuItem && key(c.menuItem) === key(link.label))
    .flatMap((c, i) => {
      const source = c.collection ? byHandle.get(c.collection) : undefined
      const href = c.link || (source ? `/collections/${source.handle}` : '')
      const image = c.image.url
        ? c.image
        : source?.imageUrl
          ? { url: source.imageUrl, alt: source.title }
          : null
      const title = hasCopy(c.label) ? c.label : (source?.title ?? '')
      // A card needs somewhere to go and something to show: an image, or failing that a label.
      if (!href || (!image && !hasCopy(title))) return []
      return [
        {
          key: `card-${i}`,
          href,
          image,
          eyebrow: hasCopy(c.eyebrow) ? c.eyebrow : null,
          title,
          tone: c.style,
        },
      ]
    })
    .slice(0, copy.maxCardsPerMenu)
  if (curated.length > 0) return curated
  return (link.children ?? [])
    .flatMap((child) => {
      const handle = collectionHandle(child.href)
      const source = handle ? byHandle.get(handle) : undefined
      if (!source?.imageUrl) return []
      return [
        {
          key: child.id,
          href: child.href,
          image: { url: source.imageUrl, alt: source.title },
          eyebrow: null,
          title: child.label,
          tone: 'light' as const,
        },
      ]
    })
    .slice(0, copy.maxCardsPerMenu)
}

/**
 * The search overlay's pills. Popular terms are the comma-separated setting. Brands are the
 * picked collections when there are any, else the collections linked under the menu item
 * whose title says "brand" (the theme's fallback), at most ten.
 */
export function searchShortcuts(
  popularTerms: string,
  brandCollections: { handle: string }[],
  links: NavLink[],
  collections: MenuCollection[],
): { popular: SearchShortcut[]; brands: SearchShortcut[] } {
  const popular = popularTerms
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((term) => ({ label: term, href: `/search?q=${encodeURIComponent(term)}` }))
  const byHandle = new Map(collections.map((c) => [c.handle, c]))
  const picked = brandCollections.flatMap(({ handle }) => {
    const c = byHandle.get(handle)
    return c ? [{ label: c.title, href: `/collections/${c.handle}` }] : []
  })
  const brandMenu = links.find((l) => key(l.label).includes(copy.brandMenuWord))
  const fromMenu = (brandMenu?.children ?? [])
    .filter((child) => collectionHandle(child.href) !== null)
    .map((child) => ({ label: child.label, href: child.href }))
  const brands = (brandCollections.length > 0 ? picked : fromMenu).slice(0, copy.maxBrands)
  return { popular, brands }
}

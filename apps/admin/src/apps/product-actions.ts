/**
 * App product actions: what installed apps add to a product's "More actions" menu, under an
 * "Apps" group per app. Each one either links to a page the app already has (filtered to the
 * product where that page can) or opens a tab of the product page and puts the cursor in the
 * field the app reads. Pure, so the menu's rules are unit tested. An app missing here adds
 * nothing to the menu.
 */
import type { productPageContent } from '@/data/product-page'
import { routes } from '@/lib/routes'

/** An installed app, as the product page receives it (`apps.list`, installed only). */
export type ProductApp = { id: string; name: string; icon: string | null }

type ActionLabel = keyof (typeof productPageContent)['actions']

export type ProductAppTarget =
  | { kind: 'link'; href: (productId: string) => string }
  /** A tab of the product page, and the id of the field to focus there. */
  | { kind: 'tab'; tab: 'shipping' | 'seo' | 'more'; focus?: string }

export type ProductAppAction = {
  id: string
  label: ActionLabel
  /** Icon name from `./app-icons`. */
  icon: string
  target: ProductAppTarget
}

export const PRODUCT_APP_ACTIONS: Record<string, readonly ProductAppAction[]> = {
  reviews: [
    {
      id: 'reviews/view',
      label: 'viewReviews',
      icon: 'Star',
      target: {
        kind: 'link',
        href: (productId) =>
          `${routes.apps.page('reviews')}?product=${encodeURIComponent(productId)}`,
      },
    },
  ],
  'back-in-stock': [
    {
      id: 'back-in-stock/waiting',
      label: 'backInStock',
      icon: 'Bell',
      target: { kind: 'tab', tab: 'more' },
    },
  ],
  'gst-invoices': [
    {
      id: 'gst-invoices/hsn',
      label: 'editGst',
      icon: 'FileText',
      target: { kind: 'tab', tab: 'shipping', focus: 'product-hs' },
    },
  ],
  'google-search-console': [
    {
      id: 'google-search-console/product',
      label: 'searchPerformance',
      icon: 'Search',
      target: { kind: 'tab', tab: 'seo' },
    },
  ],
}

/** Installed apps that add product actions, each with its actions, in the order apps arrive. */
export function productActionsFor(
  apps: readonly ProductApp[],
): { app: ProductApp; actions: readonly ProductAppAction[] }[] {
  return apps.flatMap((app) => {
    const actions = PRODUCT_APP_ACTIONS[app.id]
    return actions?.length ? [{ app, actions }] : []
  })
}

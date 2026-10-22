'use client'

import { appIcon } from '@/apps/app-icons'
import { type ProductApp, productActionsFor } from '@/apps/product-actions'
import type { ProductSectionProps } from '@/apps/product-sections'
import type { ActionItem } from '@/components/layout/action-menu'
import { productPageContent } from '@/data/product-page'
import { useCopy } from '@/hooks/use-copy'

/**
 * Installed apps' items for the product's More actions menu, each app's under its name (the
 * order page's equivalent is `useOrderAppActions`). Empty while the product is unsaved.
 */
export function useProductAppActions(
  apps: readonly ProductApp[],
  productId: string | null,
  onOpenTab: ProductSectionProps['onOpenTab'],
): ActionItem[] {
  const copy = useCopy(productPageContent)
  if (!productId) return []
  return productActionsFor(apps).flatMap(({ app, actions }) =>
    actions.map((action, i): ActionItem => {
      const { target } = action
      return {
        id: action.id,
        label: copy.actions[action.label],
        icon: appIcon(action.icon),
        heading: i === 0 ? app.name : undefined,
        ...(target.kind === 'link'
          ? { href: target.href(productId) }
          : { onSelect: () => onOpenTab(target.tab, target.focus) }),
      }
    }),
  )
}

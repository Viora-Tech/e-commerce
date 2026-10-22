'use client'

import { Blocks } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import type { ProductApp } from '@/apps/product-actions'
import { PRODUCT_APP_SECTIONS, type ProductSectionProps } from '@/apps/product-sections'
import AppLogo from '@/components/apps/app-logo'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { productPageContent } from '@/data/product-page'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { VariantRow } from './form-state'

type ProductAppsPanelProps = {
  /** Installed apps; those with a section in `PRODUCT_APP_SECTIONS` get one here. */
  apps: readonly ProductApp[]
  /** Null while the product is unsaved: app sections need its id. */
  productId: string | null
  /** The product's title, naming a variant without options. */
  title: string
  variants: readonly VariantRow[]
  onOpenTab: ProductSectionProps['onOpenTab']
}

/** Installed apps that add a section to products, in the order apps arrive. */
export function productAppSections(apps: readonly ProductApp[]): ProductApp[] {
  return apps.filter((app) => app.id in PRODUCT_APP_SECTIONS)
}

/**
 * The product page's More tab, like Shopify's app blocks on a product: one section per installed
 * app that adds something to products, headed by the app's logo and name. With none, a pointer
 * to the App store.
 */
export default function ProductAppsPanel({
  apps,
  productId,
  title,
  variants,
  onOpenTab,
}: ProductAppsPanelProps) {
  // Hooks
  const copy = useCopy(productPageContent)

  // Early returns
  const withSections = productAppSections(apps)
  if (withSections.length === 0) {
    return (
      <EmptyState
        variant="page"
        icon={Blocks}
        heading={copy.apps.emptyHeading}
        body={copy.apps.emptyBody}
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.apps.store()} />}
          >
            {copy.apps.browse}
          </Button>
        }
      />
    )
  }

  if (!productId) {
    return <EmptyState variant="dashed" body={copy.apps.unsaved} />
  }

  // Render logic
  /* Only saved variants: an app keys its data by variant id. */
  const saved = variants.flatMap((v) =>
    v.id
      ? [
          {
            id: v.id,
            label: v.optionValues.join(' / ') || title,
            hsCode: v.hsCode,
            gstRate: v.gstRate,
          },
        ]
      : [],
  )

  return (
    <>
      {withSections.map((app) => {
        const Section = PRODUCT_APP_SECTIONS[app.id]
        if (!Section) return null
        return (
          <DataCard
            key={app.id}
            title={
              <span className="flex min-w-0 items-center gap-2.5">
                <AppLogo id={app.id} icon={app.icon} size={28} />
                <span className="truncate">{app.name}</span>
              </span>
            }
            action={
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href={routes.apps.page(app.id)} />}
              >
                {copy.apps.openApp}
              </Button>
            }
          >
            <Section productId={productId} variants={saved} onOpenTab={onOpenTab} />
          </DataCard>
        )
      })}
    </>
  )
}

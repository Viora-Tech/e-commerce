'use client'

import { Copy, ExternalLink, Eye, Package, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import ActionMenu from '@/components/layout/action-menu'
import FallbackImage from '@/components/layout/fallback-image'
import PageHeader from '@/components/layout/page-header'
import OrderChip from '@/components/orders/order-chip'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { type LoadedProduct, type ProductFormState, stockOf } from './form-state'

type ProductHeaderProps = {
  product: LoadedProduct | null
  form: ProductFormState
  /** No options: one variant, so the line reads "No options" rather than "1 variant". */
  single: boolean
  busy: boolean
  storefrontOrigin: string
  onDuplicate: () => void
  onDelete: () => void
}

/** Figma product editor header (631:7713): photo, title and status, a one-line summary, Preview
 *  and More actions. Saving lives under the side column and on the save bar. */
export default function ProductHeader({
  product,
  form,
  single,
  busy,
  storefrontOrigin,
  onDuplicate,
  onDelete,
}: ProductHeaderProps) {
  // Hooks
  const copy = useCopy(productFormContent)

  // Render logic
  const s = copy.summary
  const summary = product
    ? [
        single ? s.noOptions : s.variants(form.variants.length),
        s.inStock(stockOf(form.variants)),
        s.typeBy(form.productType || null, form.vendor || null),
      ]
        .filter(Boolean)
        .join(' · ')
    : undefined

  return (
    <PageHeader
      title={product ? product.title : copy.newTitle}
      back={{ label: copy.backLabel, href: routes.products.list() }}
      lead={{
        kind: 'tile',
        node: (
          <FallbackImage
            src={form.media[0]?.url}
            fallback={<Package aria-hidden="true" />}
            className="size-full bg-card object-cover"
          />
        ),
      }}
      badges={product ? <OrderChip kind="product" value={form.status} /> : null}
      summary={summary}
      actions={
        product ? (
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a
                  href={`${storefrontOrigin}/products/${product.handle}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <Eye aria-hidden="true" />
              {copy.preview}
            </Button>
            <ActionMenu
              label={copy.moreActions}
              trigger="button"
              disabled={busy}
              items={[
                { label: copy.duplicate.action, icon: Copy, onSelect: onDuplicate },
                {
                  label: copy.viewOnStore,
                  icon: ExternalLink,
                  href: `${storefrontOrigin}/products/${product.handle}`,
                  newTab: true,
                  hidden: form.status !== 'active',
                },
                { label: copy.addAnother, icon: Plus, href: routes.products.new() },
                { label: copy.delete.action, icon: Trash2, destructive: true, onSelect: onDelete },
              ]}
            />
          </>
        ) : null
      }
    />
  )
}

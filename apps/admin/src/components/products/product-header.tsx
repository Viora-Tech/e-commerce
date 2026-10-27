'use client'

import { Archive, Copy, ExternalLink, Eye, Package, Plus, Save, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import ActionMenu, { type ActionItem } from '@/components/layout/action-menu'
import FallbackImage from '@/components/layout/fallback-image'
import PageHeader from '@/components/layout/page-header'
import OrderChip from '@/components/orders/order-chip'
import { productFormContent } from '@/data/product-form'
import { productPageContent } from '@/data/product-page'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { type LoadedProduct, type ProductFormState, stockOf } from './form-state'

type ProductHeaderProps = {
  product: LoadedProduct | null
  form: ProductFormState
  /** No options: one variant, so the line reads "No options" rather than "1 variant". */
  single: boolean
  busy: boolean
  /** Unsaved edits: Save is on. A new product can always be saved. */
  dirty: boolean
  storefrontOrigin: string
  onSave: () => void
  onDuplicate: () => void
  /** Archives the product, or brings an archived one back as a draft. */
  onArchive: () => void
  onDelete: () => void
  /** Installed apps' actions, each app's under its name (`useProductAppActions`). */
  appItems: readonly ActionItem[]
}

/** Figma product editor header (631:7713): photo, title and status, a one-line summary, Preview
 *  and More actions, then Save at the top right (#850, #851: testers missed the save bar and the
 *  side column's buttons). The save bar still appears at the bottom while there are edits. */
export default function ProductHeader({
  product,
  form,
  single,
  busy,
  dirty,
  storefrontOrigin,
  onSave,
  onDuplicate,
  onArchive,
  onDelete,
  appItems,
}: ProductHeaderProps) {
  // Hooks
  const copy = useCopy(productFormContent)
  const pageCopy = useCopy(productPageContent)

  // Render logic
  const s = copy.summary
  const archived = form.status === 'archived'
  const saveButton = (
    <Button disabled={busy || (Boolean(product) && !dirty)} onClick={onSave}>
      <Save aria-hidden="true" />
      {copy.saveBar.save}
    </Button>
  )
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
                {
                  label: archived ? pageCopy.actions.unarchive : pageCopy.actions.archive,
                  icon: Archive,
                  onSelect: onArchive,
                },
                {
                  label: copy.delete.action,
                  icon: Trash2,
                  destructive: true,
                  onSelect: onDelete,
                },
                ...appItems,
              ]}
            />
            {saveButton}
          </>
        ) : (
          saveButton
        )
      }
    />
  )
}

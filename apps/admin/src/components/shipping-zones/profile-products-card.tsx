'use client'

import { Folder, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { itemTabs } from '@/components/discounts/pick-sources'
import DataCard from '@/components/layout/data-card'
import ResourcePickDialog from '@/components/pickers/resource-pick-dialog'
import SelectProductsDialog, {
  type PickedProducts,
} from '@/components/products/select-products-dialog'
import { discountFormContent } from '@/data/discounts'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ProfileProductRow from './profile-product-row'
import { addRows, type ProfileProductRow as Row, tickVariant } from './profile-products-state'

type ProfileProductsCardProps = {
  /** The profile being edited; null while it is being made. */
  profileId: string | null
  rows: Row[]
  canManage: boolean
  onChange: (rows: Row[]) => void
  onError: (message: string) => void
}

/** The entries API answers at most this many products per call (the API's bulk limit). */
const ENTRIES_MAX = 200

/**
 * A custom profile's products and variants. "Add products" opens the product picker, where a
 * product can be taken whole or by some of its variants; each row then opens to tick its
 * variants. "Add a collection's products" adds whole products.
 */
export default function ProfileProductsCard({
  profileId,
  rows,
  canManage,
  onChange,
  onError,
}: ProfileProductsCardProps) {
  // Hooks
  const { profile: copy } = useCopy(shippingRatesContent)
  const discountCopy = useCopy(discountFormContent)
  const locale = useLocale()
  const [picking, setPicking] = useState(false)
  const [pickingCollections, setPickingCollections] = useState(false)

  // Helpers
  /** Fetch the picked products' variants and where they ship now, then list them. */
  const add = async (productIds: string[], picked: Map<string, string[]>) => {
    if (productIds.length === 0) return
    try {
      const pages = await Promise.all(
        Array.from({ length: Math.ceil(productIds.length / ENTRIES_MAX) }, (_, i) =>
          api.shipping.profiles.productEntries({
            profileId,
            productIds: productIds.slice(i * ENTRIES_MAX, (i + 1) * ENTRIES_MAX),
          }),
        ),
      )
      const fresh = pages.flat()
      const added = fresh.filter((e) => !rows.some((r) => r.productId === e.productId)).length
      onChange(addRows(rows, fresh, picked))
      toast.success(copy.products.added(added))
    } catch (err) {
      onError(err instanceof Error ? err.message : copy.toasts.failed)
    }
  }

  // Event handlers
  const handlePicked = (picked: PickedProducts) => {
    // Every variant ticked takes the product whole; some ticked takes just those.
    const partial = new Map(
      picked
        .filter((p) => p.variantIds.length < p.product.variants.length)
        .map((p) => [p.product.id, p.variantIds]),
    )
    void add(
      picked.map((p) => p.product.id),
      partial,
    )
  }

  const handleCollections = async (collectionIds: string[]) => {
    setPickingCollections(false)
    if (collectionIds.length === 0) return
    try {
      const ids = await api.shipping.profiles.collectionProducts({ collectionIds })
      await add(ids, new Map())
    } catch (err) {
      onError(err instanceof Error ? err.message : copy.toasts.failed)
    }
  }

  const handleTick = (productId: string, variantId: string, on: boolean) =>
    onChange(tickVariant(rows, productId, variantId, on))

  const handleRemove = (productId: string) =>
    onChange(rows.filter((r) => r.productId !== productId))

  // Render logic
  const collectionTabs = itemTabs(discountCopy.value, locale).filter((t) => t.key === 'collections')

  return (
    <DataCard
      title={copy.products.heading}
      subtitle={copy.products.meta}
      footer={
        canManage ? (
          <>
            <Button variant="outline" onClick={() => setPicking(true)}>
              <Plus aria-hidden="true" />
              {copy.products.addProducts}
            </Button>
            <Button variant="outline" onClick={() => setPickingCollections(true)}>
              <Folder aria-hidden="true" />
              {copy.products.addCollection}
            </Button>
          </>
        ) : null
      }
    >
      {rows.length === 0 ? (
        <p className="text-caption">{copy.products.nothingPicked}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {rows.map((r) => (
            <ProfileProductRow
              key={r.productId}
              row={r}
              disabled={!canManage}
              onTick={(variantId, on) => handleTick(r.productId, variantId, on)}
              onRemove={() => handleRemove(r.productId)}
            />
          ))}
        </ul>
      )}
      <SelectProductsDialog open={picking} onOpenChange={setPicking} onConfirm={handlePicked} />
      <ResourcePickDialog
        open={pickingCollections}
        title={copy.products.collectionTitle}
        tabs={collectionTabs}
        selected={{ tab: 'collections', ids: [] }}
        onClose={() => setPickingCollections(false)}
        onDone={(r) => void handleCollections(r.ids)}
      />
    </DataCard>
  )
}

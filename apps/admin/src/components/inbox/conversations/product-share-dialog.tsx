'use client'

import { PRODUCTS_PER_CARD_MAX } from '@commerce/core/inbox'
import { toast } from 'sonner'
import ResourcePickDialog from '@/components/pickers/resource-pick-dialog'
import type { PickPage } from '@/components/pickers/resource-pick-types'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type ProductShareDialogProps = {
  onClose: () => void
  onShare: (productIds: string[]) => Promise<void>
}

const PAGE = 30

/** Browse for up to 3 active products to share as a card the shopper can add to cart. */
export default function ProductShareDialog({ onClose, onShare }: ProductShareDialogProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)
  const fmt = useFormat()

  // Event handlers
  const handleDone = async (ids: string[]) => {
    if (ids.length === 0) {
      onClose()
      return
    }
    if (ids.length > PRODUCTS_PER_CARD_MAX) {
      toast.error(copy.composer.productPicker.tooMany)
      return
    }
    await onShare(ids)
  }

  // Render logic
  const p = copy.composer.productPicker

  return (
    <ResourcePickDialog
      open
      title={p.title}
      description={p.description}
      selected={{ tab: 'products', ids: [] }}
      tabs={[
        {
          key: 'products',
          label: p.tab,
          search: p.search,
          empty: p.empty,
          load: async ({ page, search }): Promise<PickPage> => {
            const r = await api.products.list({
              page,
              perPage: PAGE,
              status: 'active',
              search: search || undefined,
            })
            return {
              items: r.items.map((item) => ({
                id: item.id,
                title: item.title,
                imageUrl: item.imageUrl,
                thumb: 'image',
                meta: item.minPricePaise === null ? undefined : fmt.money(item.minPricePaise),
              })),
              total: r.total,
            }
          },
        },
      ]}
      onClose={onClose}
      onDone={(result) => handleDone(result.ids)}
    />
  )
}

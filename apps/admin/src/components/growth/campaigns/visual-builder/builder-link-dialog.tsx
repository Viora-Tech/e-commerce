'use client'

import ResourcePickDialog, {
  type PickPage,
  type PickResult,
  type PickTab,
} from '@/components/pickers/resource-pick-dialog'
import { emailBuilderContent } from '@/data/email-builder'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type BuilderLinkDialogProps = {
  open: boolean
  /** The store path picked (`/products/handle`), or null when cancelled. */
  onDone: (path: string | null) => void
}

const PAGE = 30

const matches = (title: string, search: string) =>
  !search.trim() || title.toLowerCase().includes(search.trim().toLowerCase())

/**
 * Picks the product or collection an email image or button links to (owner feedback, 3 Nov
 * 2026). Each row's id is its store path, so the pick goes straight into the link.
 */
export default function BuilderLinkDialog({ open, onDone }: BuilderLinkDialogProps) {
  // Hooks
  const { link: copy } = useCopy(emailBuilderContent)

  // Event handlers
  const handleDone = (result: PickResult) => onDone(result.ids[0] ?? null)

  // Render logic
  const tabs: PickTab[] = [
    {
      key: 'products',
      label: copy.products,
      search: copy.productSearch,
      empty: copy.noProducts,
      load: async ({ page, search }): Promise<PickPage> => {
        const r = await api.products.list({ page, perPage: PAGE, search: search || undefined })
        return {
          items: r.items.map((p) => ({
            id: `/products/${encodeURIComponent(p.handle)}`,
            title: p.title,
            imageUrl: p.imageUrl,
            thumb: 'image' as const,
          })),
          total: r.total,
        }
      },
    },
    {
      key: 'collections',
      label: copy.collections,
      search: copy.collectionSearch,
      empty: copy.noCollections,
      load: async ({ page, search }): Promise<PickPage> => {
        const all = (await api.collections.list()).filter((c) => matches(c.title, search))
        return {
          items: all.slice((page - 1) * PAGE, page * PAGE).map((c) => ({
            id: `/collections/${encodeURIComponent(c.handle)}`,
            title: c.title,
            imageUrl: c.imageUrl,
            thumb: 'image' as const,
          })),
          total: all.length,
        }
      },
    },
  ]

  return (
    <ResourcePickDialog
      open={open}
      title={copy.title}
      description={copy.body}
      tabs={tabs}
      selected={{ tab: 'products', ids: [] }}
      onClose={() => onDone(null)}
      onDone={handleDone}
    />
  )
}

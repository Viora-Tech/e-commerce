'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import ResourcePickDialog, {
  type PickPage,
  type PickResult,
  type PickTab,
} from '@/components/pickers/resource-pick-dialog'
import { segmentsContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'

type SegmentProductFieldProps = {
  /** The product id the rule holds; empty until one is chosen. */
  value: string
  onChange: (productId: string) => void
}

const PAGE = 30

/** "Bought a product": the chosen product's name, and the Browse picker to change it (#1020). */
export default function SegmentProductField({ value, onChange }: SegmentProductFieldProps) {
  // Hooks
  const copy = useCopy(segmentsContent)
  const [open, setOpen] = useState(false)
  const { data: title, setData: setTitle } = useLoad(async () => {
    if (!value) return null
    const r = await api.products.list({ page: 1, perPage: 1, ids: [value] })
    return r.items[0]?.title ?? null
  }, [value])

  // Event handlers
  const handleDone = (result: PickResult) => {
    setOpen(false)
    const id = result.ids[0]
    if (!id) return
    setTitle(result.items.find((i) => i.id === id)?.title ?? null)
    onChange(id)
  }

  // Render logic
  const tabs: PickTab[] = [
    {
      key: 'products',
      label: copy.fields.product ?? 'Product',
      search: copy.productSearch,
      empty: copy.noProducts,
      load: async ({ page, search }): Promise<PickPage> => {
        const r = await api.products.list({ page, perPage: PAGE, search: search || undefined })
        return {
          items: r.items.map((p) => ({
            id: p.id,
            title: p.title,
            imageUrl: p.imageUrl,
            thumb: 'image' as const,
          })),
          total: r.total,
        }
      },
    },
  ]

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-52 justify-start truncate"
        onClick={() => setOpen(true)}
      >
        {title ?? copy.pickProduct}
      </Button>
      <ResourcePickDialog
        open={open}
        title={copy.pickProductTitle}
        tabs={tabs}
        selected={{ tab: 'products', ids: value ? [value] : [] }}
        onClose={() => setOpen(false)}
        onDone={handleDone}
      />
    </>
  )
}

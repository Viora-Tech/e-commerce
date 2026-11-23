'use client'

import { DESIGN_LIMITS, type ProductItem } from '@commerce/notifications/design'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { useRef, useState } from 'react'
import ResourcePickDialog, {
  type PickResult,
  type PickTab,
} from '@/components/pickers/resource-pick-dialog'
import { emailDesignFieldsContent } from '@/data/email-design-fields'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type DesignProductsFieldProps = {
  items: ProductItem[]
  onChange: (items: ProductItem[]) => void
}

type ProductRow = Awaited<ReturnType<typeof api.products.list>>['items'][number]

const PAGE = 30

/**
 * The products of a Products block, picked with the admin's Browse dialog. Each is kept as it
 * is now (name, price, picture, handle), so an email never waits on the catalogue to send.
 */
export default function DesignProductsField({ items, onChange }: DesignProductsFieldProps) {
  // Hooks
  const copy = useCopy(emailDesignFieldsContent)
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  /** Every product row seen in the dialog, to keep its handle and price. */
  const seen = useRef(new Map<string, ProductRow>())

  // Event handlers
  const handleDone = (result: PickResult) => {
    setOpen(false)
    const kept = new Map(items.map((i) => [i.id, i]))
    const next = result.ids.slice(0, DESIGN_LIMITS.products).flatMap((id): ProductItem[] => {
      const row = seen.current.get(id)
      if (row) {
        return [
          {
            id: row.id,
            title: row.title,
            handle: row.handle,
            priceLabel: row.minPricePaise === null ? '' : formatPaise(row.minPricePaise, locale),
            imageUrl: row.imageUrl ?? undefined,
          },
        ]
      }
      const old = kept.get(id)
      return old ? [old] : []
    })
    onChange(next)
  }

  // Render logic
  const p = copy.products
  const tabs: PickTab[] = [
    {
      key: 'products',
      label: p.tab,
      search: p.search,
      empty: p.empty,
      load: async ({ page, search }) => {
        const r = await api.products.list({ page, perPage: PAGE, search: search || undefined })
        for (const row of r.items) seen.current.set(row.id, row)
        return {
          items: r.items.map((row) => ({
            id: row.id,
            title: row.title,
            imageUrl: row.imageUrl,
            thumb: 'image' as const,
            meta: row.minPricePaise === null ? undefined : formatPaise(row.minPricePaise, locale),
          })),
          total: r.total,
        }
      },
    },
  ]

  return (
    <Field>
      <FieldLabel>{p.count(items.length)}</FieldLabel>
      {items.length === 0 ? (
        <p className="text-caption text-muted-foreground">{p.none}</p>
      ) : (
        <ul className="flex flex-col gap-1 text-body">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between gap-2">
              <span className="truncate">{i.title}</span>
              <span className="shrink-0 text-muted-foreground">{i.priceLabel}</span>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        {items.length > 0 ? p.change : p.choose}
      </Button>
      <ResourcePickDialog
        open={open}
        title={p.pickTitle}
        description={p.pickDescription}
        tabs={tabs}
        selected={{ tab: 'products', ids: items.map((i) => i.id) }}
        onClose={() => setOpen(false)}
        onDone={handleDone}
      />
    </Field>
  )
}

'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { loadCatalogPicked } from '@/components/catalogs/catalog-pick-sources'
import DataCard from '@/components/layout/data-card'
import type { PickItem } from '@/components/pickers/resource-pick-types'
import { catalogsContent } from '@/data/catalogs'
import { preordersContent } from '@/data/preorders'
import { useCopy } from '@/hooks/use-copy'
import type { CampaignFormState } from './campaign-form-state'

type CampaignMembersCardProps = {
  form: CampaignFormState
  disabled: boolean
  onLimit: (productId: string, limit: string) => void
}

/** Titles of the picked products, reloaded when the picked set changes. */
function usePickedProducts(productIds: string[], pickCopy: typeof catalogsContent.form) {
  const [rows, setRows] = useState<PickItem[]>([])
  const key = productIds.join(',')

  useEffect(() => {
    let live = true
    const ids = key ? key.split(',') : []
    loadCatalogPicked('products', ids, pickCopy)
      .then((items) => {
        if (live) setRows(items)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [key, pickCopy])

  return rows
}

/** Per product (#1473): which variants take pre-orders and its own limit beyond stock. */
export default function CampaignMembersCard({ form, disabled, onLimit }: CampaignMembersCardProps) {
  // Hooks
  const { form: f } = useCopy(preordersContent)
  const { form: pickCopy } = useCopy(catalogsContent)
  const rows = usePickedProducts(form.productIds, pickCopy)

  // Helpers
  const title = (id: string) => rows.find((r) => r.id === id)?.title ?? '…'

  // Early returns
  if (form.productIds.length === 0) return null

  return (
    <DataCard title={f.perProduct} subtitle={f.perProductHelp}>
      <ul className="flex flex-col divide-y divide-border">
        {form.productIds.map((id) => {
          const m = form.members[id]
          const picked = m?.variantIds ?? null
          return (
            <li key={id} className="flex items-center gap-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-body-strong">{title(id)}</span>
                <span className="text-caption text-muted-foreground">
                  {picked === null ? f.allVariants : f.someVariants(picked.length)}
                </span>
              </span>
              <span className="w-28">
                <Input
                  aria-label={`${f.productLimit} ${title(id)}`}
                  inputMode="numeric"
                  placeholder={f.campaignLimit}
                  value={m?.limit ?? ''}
                  disabled={disabled}
                  onChange={(e) => onLimit(id, e.target.value)}
                />
              </span>
            </li>
          )
        })}
      </ul>
    </DataCard>
  )
}

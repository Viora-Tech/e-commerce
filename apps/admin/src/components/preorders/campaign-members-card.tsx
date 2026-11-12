'use client'

import type { PreorderCampaignVariant } from '@commerce/core'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { loadCatalogPicked } from '@/components/catalogs/catalog-pick-sources'
import DataCard from '@/components/layout/data-card'
import type { PickItem } from '@/components/pickers/resource-pick-types'
import { catalogsContent } from '@/data/catalogs'
import { preordersContent } from '@/data/preorders'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { type CampaignFormState, takesPreorders, variantFallback } from './campaign-form-state'
import CampaignVariantLimits from './campaign-variant-limits'

type CampaignMembersCardProps = {
  form: CampaignFormState
  disabled: boolean
  /** Bumped after each save so the variants' stored limits load again. */
  reloadKey: number
  onLimit: (productId: string, limit: string) => void
  onVariantLimit: (productId: string, variantId: string, limit: string) => void
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

/** The picked products' variants with their own stored limits; null while loading. */
function useCampaignVariants(productIds: string[], reloadKey: number) {
  const [rows, setRows] = useState<PreorderCampaignVariant[] | null>(null)
  const key = productIds.join(',')

  useEffect(() => {
    let live = true
    const ids = key ? key.split(',') : []
    // reloadKey only asks for a fresh read after a save.
    void reloadKey
    api.preorders.campaigns
      .variants({ productIds: ids })
      .then((items) => {
        if (live) setRows(items)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [key, reloadKey])

  return rows
}

/** Per product (#1473): which variants take pre-orders and its own limit beyond stock. */
export default function CampaignMembersCard({
  form,
  disabled,
  reloadKey,
  onLimit,
  onVariantLimit,
}: CampaignMembersCardProps) {
  // Hooks
  const { form: f } = useCopy(preordersContent)
  const { form: pickCopy } = useCopy(catalogsContent)
  const rows = usePickedProducts(form.productIds, pickCopy)
  const variants = useCampaignVariants(form.productIds, reloadKey)

  // Helpers
  const title = (id: string) => rows.find((r) => r.id === id)?.title ?? '…'
  const variantsOf = (id: string) =>
    (variants ?? []).filter((v) => v.productId === id && takesPreorders(form, id, v.id))
  const fallbackText = (id: string) => {
    const fallback = variantFallback(form, id)
    if (!fallback) return f.noLimit
    return fallback.from === 'product'
      ? f.fromProduct(fallback.limit)
      : f.fromCampaign(fallback.limit)
  }

  // Early returns
  if (form.productIds.length === 0) return null

  return (
    <DataCard title={f.perProduct} subtitle={f.perProductHelp}>
      <ul className="flex flex-col divide-y divide-border">
        {form.productIds.map((id) => {
          const m = form.members[id]
          const picked = m?.variantIds ?? null
          return (
            <li key={id} className="flex flex-col gap-2 py-2">
              <span className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body-strong">{title(id)}</span>
                  <span className="text-caption text-muted-foreground">
                    {picked === null ? f.allVariants : f.someVariants(picked.length)}
                  </span>
                </span>
                <span className="w-28 shrink-0">
                  <Input
                    aria-label={`${f.productLimit} ${title(id)}`}
                    inputMode="numeric"
                    placeholder={f.campaignLimit}
                    value={m?.limit ?? ''}
                    disabled={disabled}
                    onChange={(e) => onLimit(id, e.target.value)}
                  />
                </span>
              </span>
              {variants === null ? (
                <span className="text-caption text-muted-foreground">{f.loadingVariants}</span>
              ) : (
                <CampaignVariantLimits
                  variants={variantsOf(id)}
                  edits={form.variantLimits[id] ?? {}}
                  placeholder={fallbackText(id)}
                  disabled={disabled}
                  onChange={(variantId, limit) => onVariantLimit(id, variantId, limit)}
                />
              )}
            </li>
          )
        })}
      </ul>
    </DataCard>
  )
}

'use client'

import { Save } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { productCollectionsCardContent } from '@/data/collections'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { collectionIdsToSave } from './collection-pick'
import ProductCollectionsField, { type CollectionOption } from './product-collections-field'

type ProductCollectionsCardProps = {
  /** Null while the product is unsaved. */
  productId: string | null
  /**
   * A new product's picks, held until it is created and then saved with it: Shopify lets you
   * choose collections before the first save (audit #200).
   */
  onPendingChange?: ((collectionIds: string[]) => void) | undefined
  /** Changes after each product save; smart collections re-evaluate on save, so refetch. */
  revision?: number
}

type Loaded = { manual: CollectionOption[]; automatic: CollectionOption[]; memberOf: string[] }

/**
 * Manual collections this product sits in (editable here) plus the automatic
 * ones it currently matches (read-only: they follow the collection's rules).
 * Saves on its own button, like MetafieldsCard, so the page's save bar and
 * its product write stay untouched.
 */
export default function ProductCollectionsCard({
  productId,
  revision = 0,
  onPendingChange,
}: ProductCollectionsCardProps) {
  // Hooks
  const copy = useCopy(productCollectionsCardContent)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [value, setValue] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  // A new product: the manual collections to pick from, nothing chosen yet.
  useEffect(() => {
    if (productId) return
    let live = true
    api.collections
      .list()
      .then((all) => {
        if (!live) return
        setLoaded({ manual: all.filter((c) => c.kind === 'manual'), automatic: [], memberOf: [] })
      })
      .catch(() => live && setLoaded({ manual: [], automatic: [], memberOf: [] }))
    return () => {
      live = false
    }
  }, [productId])

  useEffect(() => {
    if (!productId || revision < 0) return
    let live = true
    Promise.all([api.collections.list(), api.collections.forProduct({ productId })])
      .then(([all, memberOf]) => {
        if (!live) return
        const manual = all.filter((c) => c.kind === 'manual').map((c) => ({ ...c }))
        const automatic = all.filter((c) => c.kind === 'automatic' && memberOf.includes(c.id))
        setLoaded({ manual, automatic, memberOf })
        const manualIds = memberOf.filter((id) => manual.some((c) => c.id === id))
        setValue(manualIds)
        setSaved(manualIds)
      })
      .catch(() => live && setLoaded({ manual: [], automatic: [], memberOf: [] }))
    return () => {
      live = false
    }
  }, [productId, revision])

  // Event handlers
  const handleSave = async () => {
    if (!productId || !loaded) return
    setBusy(true)
    try {
      const collectionIds = collectionIdsToSave(value, loaded.manual)
      await api.collections.setForProduct({ productId, collectionIds })
      setValue(collectionIds)
      setSaved(collectionIds)
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handlePick = (next: string[]) => {
    setValue(next)
    if (!productId) onPendingChange?.(next)
  }

  // Render logic
  const dirty = JSON.stringify(value) !== JSON.stringify(saved)

  return (
    <DataCard
      title={copy.heading}
      action={
        productId && dirty ? (
          <Button size="sm" onClick={() => void handleSave()} disabled={busy}>
            <Save aria-hidden="true" />
            {busy ? copy.saving : copy.save}
          </Button>
        ) : null
      }
      bodyClassName="flex flex-col gap-4"
    >
      {loaded === null ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <>
          <ProductCollectionsField options={loaded.manual} value={value} onChange={handlePick} />
          <div className="flex flex-col gap-1.5">
            <FieldLabel>{copy.automaticLabel}</FieldLabel>
            {loaded.automatic.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {loaded.automatic.map((c) => (
                  <li key={c.id}>
                    <Badge variant="secondary">{c.title}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-body text-muted-foreground">{copy.automaticNone}</p>
            )}
            <FieldDescription>{copy.automaticHelp}</FieldDescription>
          </div>
        </>
      )}
    </DataCard>
  )
}

'use client'

import type { SearchPinGroup } from '@commerce/core'
import { normaliseSearchQuery, type SearchBoostRule } from '@commerce/core/discovery'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import PageHeader from '@/components/layout/page-header'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import { appsContent } from '@/data/apps'
import { searchDiscoveryContent } from '@/data/search-discovery'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import BoostRulesCard, { type BoostValueChoices } from './boost-rules-card'
import type { PickedItem } from './picked-list'
import PinDialog from './pin-dialog'
import PinsCard from './pins-card'

type Loaded = { rules: SearchBoostRule[]; pins: SearchPinGroup[] }

type Editing = { term: string; products: PickedItem[] }

const NO_CHOICES: BoostValueChoices = { tag: [], type: [], vendor: [] }

const errorText = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback

/**
 * The Search & discovery app's Boosts page: products pinned to the top for a search, and boost
 * or bury rules by tag, type or vendor. `?pin=<search>` (the Overview's "Pin a product") opens
 * the pin dialog for that search. Edits happen in a dialog, never a side drawer.
 */
export default function BoostsPage() {
  // Hooks
  const apps = useCopy(appsContent)
  const copy = useCopy(searchDiscoveryContent)
  const searchParams = useSearchParams()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [choices, setChoices] = useState<BoostValueChoices>(NO_CHOICES)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [busy, setBusy] = useState(false)

  /** The first read failed: Try again instead of a blank page. */
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `loadAttempt` is Try again
  useEffect(() => {
    setLoadFailed(false)
    api.search.boosts.get().then(
      (data) => {
        const pinParam = searchParams.get('pin') ?? ''
        setLoaded(data)
        if (!pinParam) return
        const existing = data.pins.find((g) => g.term === normaliseSearchQuery(pinParam))
        setEditing({ term: existing?.term ?? pinParam, products: existing?.products ?? [] })
      },
      () => setLoadFailed(true),
    )
    api.products
      .facets()
      .then((f) => setChoices({ tag: f.tags, type: f.productTypes, vendor: f.vendors }))
      .catch(() => undefined)
  }, [loadAttempt])

  // Event handlers
  const handleSavePins = async (term: string, productIds: string[]) => {
    try {
      let pins = await api.search.boosts.setPins({ term, productIds })
      // A renamed search moves its pins: the old words lose them.
      const before = loaded?.pins.some((g) => g.term === editing?.term) ? (editing?.term ?? '') : ''
      if (before && normaliseSearchQuery(term) !== before) {
        pins = await api.search.boosts.setPins({ term: before, productIds: [] })
      }
      setLoaded((prev) => (prev ? { ...prev, pins } : prev))
      toast.success(copy.boosts.pinDialog.saved)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
      throw err
    }
  }

  const handleRemovePins = async (group: SearchPinGroup) => {
    setBusy(true)
    try {
      const pins = await api.search.boosts.setPins({ term: group.term, productIds: [] })
      setLoaded((prev) => (prev ? { ...prev, pins } : prev))
      toast.success(copy.boosts.pins.removed)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(false)
    }
  }

  const handleSaveRules = async (rules: SearchBoostRule[]) => {
    try {
      const saved = await api.search.boosts.setRules({ rules })
      setLoaded((prev) => (prev ? { ...prev, rules: saved } : prev))
      toast.success(copy.boosts.rules.saved)
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    }
  }

  // Early returns
  if (!loaded && loadFailed) {
    return (
      <LoadFailedState
        size="page"
        heading={apps.couldNotLoad.settings}
        onRetry={() => setLoadAttempt((n) => n + 1)}
      />
    )
  }
  if (!loaded) return <SectionPageSkeleton cards={2} />

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.boosts.title} summary={copy.boosts.summary} />
      <PinsCard
        groups={loaded.pins}
        busy={busy}
        onAdd={() => setEditing({ term: '', products: [] })}
        onEdit={(g) => setEditing({ term: g.term, products: g.products })}
        onRemove={handleRemovePins}
      />
      <BoostRulesCard rules={loaded.rules} choices={choices} onSave={handleSaveRules} />
      <PinDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        term={editing?.term ?? ''}
        products={editing?.products ?? []}
        onSave={handleSavePins}
      />
    </div>
  )
}

'use client'

import {
  courierId,
  type DeliveryLayout,
  type DeliveryOption,
} from '@commerce/core/delivery-options'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SectionHead from '@/components/layout/section-head'
import SortableStack from '@/components/layout/sortable-stack'
import { reorderLabels } from '@/data/common'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import CheckoutPreviewList from './checkout-preview-list'
import { courierRows } from './courier-rows'
import CourierSwitchesCard from './courier-switches-card'
import DeliveryWarnings from './delivery-warnings'
import LayoutPicker from './layout-picker'
import OptionEditCard from './option-edit-card'
import PriceIncludesCard from './price-includes-card'
import { PREVIEW_CART, PREVIEW_PIN, useCheckoutPreview } from './use-checkout-preview'
import { useDeliveryOverview, useRouteCatalogue } from './use-delivery-overview'

const APP = 'delivery-options'

const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])]

/** The options in page order, with that order as their position (what the engine sorts by). */
const positionedOf = (drafts: DeliveryOption[] | null) =>
  (drafts ?? []).map((o, position) => ({ ...o, position }))

/** The option the courier list prices from: the first one shown. */
const listOptionOf = (drafts: DeliveryOption[] | null) =>
  positionedOf(drafts).find((o) => o.enabled) ?? null

/**
 * Apps → Delivery options → Options: how checkout shows delivery, edited in place and saved
 * together. Courier list (Figma 938:12101): the couriers shoppers may see, what the price
 * includes and a live preview of the unsaved edits. Fixed options (Figma 929:11812): one card per
 * option, dragged into order. Each option's own page keeps the advanced settings.
 */
export default function DeliveryOptionsPage() {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const pages = useCopy(deliveryPagesContent)
  const sortLabels = useCopy(reorderLabels)
  const { overview, reload } = useDeliveryOverview()
  const [layout, setLayout] = useState<DeliveryLayout>('fixed')
  const [drafts, setDrafts] = useState<DeliveryOption[] | null>(null)
  const [savedKey, setSavedKey] = useState('')
  const [busy, setBusy] = useState(false)
  const { catalogue, loading } = useRouteCatalogue(layout === 'list')
  const preview = useCheckoutPreview(
    { layout, options: positionedOf(drafts) },
    PREVIEW_PIN,
    layout === 'list',
  )

  useEffect(() => {
    if (!overview) return
    const saved = overview.layout ?? 'fixed'
    setLayout(saved)
    setDrafts(overview.options)
    setSavedKey(JSON.stringify({ layout: saved, options: overview.options }))
  }, [overview])

  // Helpers
  const rowsNow = () => courierRows(catalogue?.routes ?? [])
  const idsNow = () => rowsNow().map((r) => r.id)
  const allowNow = () => listOptionOf(drafts)?.couriers.allow ?? null
  const isOn = (id: string) => allowNow()?.includes(id) ?? true
  const isNew = (id: string) =>
    allowNow() !== null && !(listOptionOf(drafts)?.couriers.known ?? []).includes(id)
  const nameOf = (id: string) => {
    const row = rowsNow().find((r) => r.id === id)
    return row ? `${row.carrier} ${pages.routeTable.speeds[row.speed]}` : id
  }
  const update = (next: DeliveryOption) =>
    setDrafts((list) => (list ?? []).map((o) => (o.id === next.id ? next : o)))

  // Event handlers
  const handleToggle = (id: string, on: boolean) => {
    const listOption = listOptionOf(drafts)
    if (!listOption) return
    const allIds = idsNow()
    const base = allowNow() ?? allIds
    const next = on ? union(base, [id]) : base.filter((x) => x !== id)
    update({
      ...listOption,
      couriers: {
        ...listOption.couriers,
        allow: next,
        known: union(listOption.couriers.known, allIds),
      },
    })
  }
  const handlePreset = async () => {
    setBusy(true)
    try {
      await api.deliveryOptions.addPreset()
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }
  const handleSave = async () => {
    if (!drafts) return
    setBusy(true)
    const allIds = idsNow()
    const listId = layout === 'list' ? listOptionOf(drafts)?.id : null
    try {
      const options = drafts.map(({ id, position: _position, ...option }) => {
        // Saving the courier list fixes what is on today, so couriers added later start off.
        const fix = id === listId && allIds.length > 0
        return {
          id,
          option: fix
            ? {
                ...option,
                couriers: {
                  ...option.couriers,
                  allow: option.couriers.allow ?? allIds,
                  known: union(option.couriers.known, allIds),
                },
              }
            : option,
        }
      })
      await api.deliveryOptions.saveOptions({ layout, options })
      toast.success(copy.saved)
      reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (!overview || !drafts) return null

  // Render logic
  const listed = layout === 'list'
  const rows = rowsNow()
  const allIds = rows.map((r) => r.id)
  const listOption = listOptionOf(drafts)
  const page = pages.pages.options
  const dirty = JSON.stringify({ layout, options: drafts }) !== savedKey
  const firstShown = drafts.find((o) => o.enabled)
  const backupName = drafts.find((o) => o.enabled && o.speed === 'standard')?.name
  const pick = preview.result?.options[0]?.pick?.route
  const includedId = pick ? courierId(pick.carrierKey, pick.speed) : null
  const shownIds = new Set(
    (preview.result?.options[0]?.choices ?? []).map((c) =>
      courierId(c.route.carrierKey, c.route.speed),
    ),
  )
  const off = allIds.filter((id) => !isOn(id)).map(nameOf)
  const hidden = preview.result
    ? allIds.filter((id) => isOn(id) && !shownIds.has(id) && id !== includedId).map(nameOf)
    : []

  return (
    <div className="flex flex-col gap-5">
      <SectionHead
        title={page.title}
        intro={listed ? page.introList : page.intro}
        action={
          <div className="flex items-center gap-2">
            {listed ? null : (
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href={routes.apps.page(APP, 'options', 'new')} />}
              >
                <Plus aria-hidden />
                {copy.options.add}
              </Button>
            )}
            <Button onClick={handleSave} disabled={!dirty || busy}>
              {copy.save}
            </Button>
          </div>
        }
      />
      <DeliveryWarnings warnings={overview.warnings} />
      <LayoutPicker value={layout} onChange={setLayout} />

      {drafts.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-panel-border bg-card p-4">
          <p className="text-body text-muted-foreground">{copy.options.empty}</p>
          <p className="text-caption text-muted-foreground">{copy.options.presetHelp}</p>
          <Button onClick={handlePreset} disabled={busy}>
            {copy.options.preset}
          </Button>
        </div>
      ) : listed ? (
        listOption ? (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              <CourierSwitchesCard
                rows={rows}
                loading={loading}
                isOn={isOn}
                isNew={isNew}
                includedId={includedId}
                onToggle={handleToggle}
              />
              <PriceIncludesCard option={listOption} onChange={update} />
            </div>
            <section className="flex flex-col gap-3 rounded-xl border border-panel-border bg-card p-4 lg:sticky lg:top-4">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-card-title text-ink-strong">{pages.preview.previewTitle}</h2>
                <p className="text-caption text-muted-foreground">
                  {pages.preview.previewFor(PREVIEW_PIN, String(PREVIEW_CART.weightGrams / 1000))}
                </p>
              </div>
              <CheckoutPreviewList {...preview} look="logos" />
              {hidden.length || off.length ? (
                <p className="text-caption text-muted-foreground">
                  {[
                    hidden.length ? pages.preview.hidden(hidden.join(', ')) : null,
                    off.length ? pages.preview.off(off.join(', ')) : null,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </p>
              ) : null}
            </section>
          </div>
        ) : (
          <p className="text-body text-muted-foreground">{pages.layout.needsOption}</p>
        )
      ) : (
        <>
          <SortableStack
            items={drafts}
            onReorder={setDrafts}
            getTitle={(o) => o.name}
            labels={sortLabels}
            className="flex flex-col gap-4"
            itemClassName="rounded-xl"
            renderItem={(o, { handle, isDragging }) => (
              <OptionEditCard
                option={o}
                isDefault={o.id === firstShown?.id}
                handle={handle}
                isDragging={isDragging}
                onChange={update}
              />
            )}
          />
          <p className="rounded-xl border border-panel-border bg-card px-4 py-3 text-caption text-muted-foreground">
            {backupName ? pages.optionCards.fallback(backupName) : pages.optionCards.fallbackNone}
          </p>
        </>
      )}
    </div>
  )
}

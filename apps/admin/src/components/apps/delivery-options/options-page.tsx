'use client'

import type { DeliveryLayout, DeliveryOption } from '@commerce/core/delivery-options'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import EmptyState from '@/components/layout/empty-state'
import SaveBar from '@/components/layout/save-bar'
import SectionHead from '@/components/layout/section-head'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import SortableStack from '@/components/layout/sortable-stack'
import { appsContent } from '@/data/apps'
import { reorderLabels } from '@/data/common'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'
import CourierListPreview from './courier-list-preview'
import { courierRows } from './courier-rows'
import CourierSwitchesCard from './courier-switches-card'
import DeliveryWarnings from './delivery-warnings'
import LayoutPicker from './layout-picker'
import ListQuestionsCard from './list-questions-card'
import OptionEditCard from './option-edit-card'
import RulesDefaultNote from './rules-default-note'
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
 * together. Courier list (Figma 938:12101): the 3 delivery price questions with one collapsed
 * "More settings" (owner, 21 Nov 2026), the couriers shoppers may see and a live preview of the
 * unsaved edits. Fixed options (Figma 929:11812): one card per
 * option with a one-line summary, dragged into order; each option's own page asks the questions.
 */
export default function DeliveryOptionsPage() {
  // Hooks
  const apps = useCopy(appsContent)
  const copy = useCopy(deliveryOptionsContent)
  const pages = useCopy(deliveryPagesContent)
  const sortLabels = useCopy(reorderLabels)
  const { overview, failed: overviewFailed, reload } = useDeliveryOverview()
  const [layout, setLayout] = useState<DeliveryLayout>('fixed')
  const [drafts, setDrafts] = useState<DeliveryOption[] | null>(null)
  const [savedKey, setSavedKey] = useState('')
  /** Which action is running, so only its button spins. */
  const [busy, setBusy] = useState<'preset' | 'save' | null>(null)
  const { catalogue, loading } = useRouteCatalogue(layout === 'list')

  // Helpers
  /** Puts the page back to what is saved: on load, after a save, and on Discard. */
  const resetToSaved = (saved: NonNullable<typeof overview>) => {
    const savedLayout = saved.layout ?? 'fixed'
    setLayout(savedLayout)
    setDrafts(saved.options)
    setSavedKey(JSON.stringify({ layout: savedLayout, options: saved.options }))
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: resets only when the saved settings change.
  useEffect(() => {
    if (overview) resetToSaved(overview)
  }, [overview])

  const rowsNow = () => courierRows(catalogue?.routes ?? [])
  const idsNow = () => rowsNow().map((r) => r.id)
  const allowNow = () => listOptionOf(drafts)?.couriers.allow ?? null
  const isOn = (id: string) => allowNow()?.includes(id) ?? true
  const isNew = (id: string) =>
    allowNow() !== null && !(listOptionOf(drafts)?.couriers.known ?? []).includes(id)
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
  const handleDiscard = () => {
    if (overview) resetToSaved(overview)
  }
  const handlePreset = async () => {
    setBusy('preset')
    try {
      await api.deliveryOptions.addPreset()
      reload()
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(null)
    }
  }
  const handleSave = async () => {
    if (!drafts) return
    setBusy('save')
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
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(null)
    }
  }

  // Early returns
  if (!overview && overviewFailed) {
    return <LoadFailedState size="page" heading={apps.couldNotLoad.settings} onRetry={reload} />
  }
  if (!overview || !drafts) return <SectionPageSkeleton cards={2} />

  // Render logic
  const listed = layout === 'list'
  const rows = rowsNow()
  const listOption = listOptionOf(drafts)
  const page = pages.pages.options
  const dirty = JSON.stringify({ layout, options: drafts }) !== savedKey
  const firstShown = drafts.find((o) => o.enabled)
  const backupName = drafts.find((o) => o.enabled && o.speed === 'standard')?.name

  return (
    <div className="flex flex-col gap-5">
      {/* Every change on this page waits for Save: the bar shows as soon as one is made. */}
      <SaveBar
        open={dirty}
        message={copy.option.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.option.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy === 'save'}
      />
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
          </div>
        }
      />
      <DeliveryWarnings warnings={overview.warnings} />
      <LayoutPicker value={layout} onChange={setLayout} />
      <RulesDefaultNote />

      {drafts.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-panel-border bg-card p-4">
          <EmptyState variant="inline" body={copy.options.empty} />
          <p className="text-caption text-muted-foreground">{copy.options.presetHelp}</p>
          <Button onClick={handlePreset} disabled={busy !== null} loading={busy === 'preset'}>
            {copy.options.preset}
          </Button>
        </div>
      ) : listed ? (
        listOption ? (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              <ListQuestionsCard option={listOption} onChange={update} />
              <CourierSwitchesCard
                rows={rows}
                loading={loading}
                isOn={isOn}
                isNew={isNew}
                onToggle={handleToggle}
              />
            </div>
            <CourierListPreview
              draft={{ layout, options: positionedOf(drafts) }}
              rows={rows}
              isOn={isOn}
              fastest={listOption.strategy === 'fastest'}
            />
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
            itemClassName="rounded-lg"
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
          <p className="rounded-lg border border-panel-border bg-card px-4 py-3 text-caption text-muted-foreground">
            {backupName ? pages.optionCards.fallback(backupName) : pages.optionCards.fallbackNone}
          </p>
        </>
      )}
    </div>
  )
}

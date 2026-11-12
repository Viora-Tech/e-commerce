'use client'

import type { CourierRateRow } from '@commerce/core'
import { RefreshCw, XIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@commerce/ui/shadcn/drawer'
import { Switch } from '@commerce/ui/shadcn/switch'
import type { ReactNode } from 'react'
import { useState } from 'react'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { type CourierSort, courierMode, sortCourierRows } from './courier-groups'
import CourierTable from './courier-table'
import { coverNotes } from './cover-notes'
import { rowInsuranceState } from './insured-rows'

type CourierDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "#2424 · Sonipat → Chennai · 1.01 kg charged (20 × 20 × 5 cm) · Prepaid ₹998". */
  summary: string
  /** Null while the couriers are being asked; the body shows `status` instead. */
  rows: readonly CourierRateRow[] | null
  pick: string
  onPick: (optionKey: string) => void
  onShipNow?: ((optionKey: string) => void) | undefined
  shippingKey: string | null
  insured: boolean
  onInsured: (on: boolean) => void
  /** "₹2,499": what the insurance covers (the parcel's value). */
  valueLabel: string
  onRetry?: (() => void) | undefined
  /** Asking, failed, updating: shown above the table. */
  status?: ReactNode
  /** The parcel's charged weight, for couriers that did not say their own. */
  chargedGrams?: number | null | undefined
  /** Ship it yourself: the panel and tracking fields, shown under the table when picked. */
  children?: ReactNode
}

type Mode = 'all' | 'air' | 'surface'

const MODES: Mode[] = ['all', 'air', 'surface']
const SORTS: CourierSort[] = ['recommended', 'cheapest', 'fastest']

/**
 * Select courier partner (Figma 898:7790): a bottom drawer with a swipe handle, the order's
 * route and charged weight, the Shipping insurance toggle beside Close, All / Air / Surface
 * tabs with counts, Sort, and the courier table with its price breakdown.
 */
export default function CourierDrawer({
  open,
  onOpenChange,
  summary,
  rows,
  pick,
  onPick,
  onShipNow,
  shippingKey,
  insured,
  onInsured,
  valueLabel,
  onRetry,
  status,
  chargedGrams,
  children,
}: CourierDrawerProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.drawer)
  const courierCopy = useCopy(createShipmentContent.courier)
  const fmt = useFormat()
  const [mode, setMode] = useState<Mode>('all')
  const [sort, setSort] = useState<CourierSort>('recommended')

  // Helpers
  const count = (m: Mode) =>
    m === 'all' ? (rows ?? []).length : (rows ?? []).filter((r) => courierMode(r) === m).length

  // Render logic
  const all = rows ?? []
  const shown = sortCourierRows(
    all.filter((r) => mode === 'all' || courierMode(r) === mode),
    sort,
  )
  const picked = all.find((r) => r.optionKey === pick)
  // The picked row's insurance fee (Delhivery Protect, the route's rate or the courier's line).
  const pickedInsurance = picked ? rowInsuranceState(picked, true) : null
  const insuranceLine =
    pickedInsurance?.kind === 'added' || pickedInsurance?.kind === 'included'
      ? pickedInsurance.pricePaise
      : null
  // The picked courier's real cover: its cap, uninsured refund limit, used goods, claim excess.
  const notes = picked?.cover ? coverNotes(picked, insured, 0) : null
  const coveredLabel = notes?.capped
    ? copy.coverOf(fmt.money(notes.coveredPaise), fmt.money(notes.valuePaise))
    : valueLabel
  const excess = notes?.deductibleBps
    ? copy.claimExcess(fmt.number(notes.deductibleBps / 100))
    : undefined

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      {/* One height whatever the number of couriers (owner, 11 Nov): a single service leaves room below, the drawer does not shrink. */}
      <DrawerContent className="mx-auto h-[calc(100dvh-6rem)] max-w-[90rem]">
        <DrawerHeader className="flex flex-row flex-wrap items-start justify-between gap-4 px-4 pt-2 text-left md:px-8">
          <div className="flex min-w-0 flex-col items-start gap-1 text-left">
            <DrawerTitle className="text-lg font-semibold text-ink-strong">
              {copy.title}
            </DrawerTitle>
            <DrawerDescription className="text-body text-muted-foreground">
              {summary}
            </DrawerDescription>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex max-w-[26rem] flex-col gap-1.5">
              <label
                htmlFor="drawer-insurance"
                className="flex cursor-pointer items-center gap-4 rounded-lg border border-border px-4 py-2.5"
              >
                <span className="flex flex-col text-left">
                  <span className="text-body font-medium text-ink-strong">{copy.insurance}</span>
                  <span className="text-caption text-muted-foreground" title={excess}>
                    {copy.insuranceCovers(
                      insuranceLine === null ? null : fmt.money(insuranceLine),
                      coveredLabel,
                    )}
                  </span>
                </span>
                <Switch id="drawer-insurance" checked={insured} onCheckedChange={onInsured} />
              </label>
              {notes?.uninsuredLimitPaise != null && picked ? (
                <p role="status" className="text-caption text-warning">
                  {copy.uninsuredLimit(
                    picked.providerName,
                    fmt.money(notes.uninsuredLimitPaise),
                    fmt.money(notes.valuePaise),
                  )}
                </p>
              ) : null}
              {notes?.usedNotCovered && picked ? (
                <p role="status" className="text-caption text-warning">
                  {copy.usedNotCovered(picked.providerName)}
                </p>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={copy.close}
              onClick={() => onOpenChange(false)}
            >
              <XIcon aria-hidden="true" />
            </Button>
          </div>
        </DrawerHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'motion-press flex h-8 items-center gap-1.5 rounded-full border px-3 text-body',
                    mode === m
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {copy.mode[m]}
                  <span className="tabular-nums opacity-70">{count(m)}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {onRetry ? (
                <Button variant="ghost" size="sm" onClick={onRetry}>
                  <RefreshCw aria-hidden="true" />
                  {courierCopy.retry}
                </Button>
              ) : null}
              <div className="w-48">
                <ChoiceField
                  id="drawer-sort"
                  label={copy.sortLabel}
                  hideLabel
                  value={sort}
                  options={SORTS.map((s) => ({
                    value: s,
                    label: `${copy.sortLabel}: ${copy.sort[s]}`,
                  }))}
                  onChange={(v) => setSort(v as CourierSort)}
                />
              </div>
            </div>
          </div>
          {status}
          {rows ? (
            <div className="-mx-4 md:-mx-8">
              <CourierTable
                rows={shown}
                pick={pick}
                onPick={onPick}
                onShipNow={onShipNow}
                shippingKey={shippingKey}
                insured={insured}
                chargedGrams={chargedGrams}
              />
            </div>
          ) : null}
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

'use client'

import type { RouteSetting } from '@commerce/core/delivery-options'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'
import { toast } from 'sonner'
import AppStoreLink from '@/components/apps/app-store-link'
import SectionHead from '@/components/layout/section-head'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routeRows } from './courier-rows'
import DeliveryWarnings from './delivery-warnings'
import InsuranceCoverCard from './insurance-cover-card'
import ProtectCard from './protect-card'
import RouteSettingDialog, { type RouteSettingTarget } from './route-setting-dialog'
import RouteTableRow from './route-table-row'
import { useDeliveryOverview, useRouteCatalogue } from './use-delivery-overview'

type Filter = 'all' | 'direct' | 'aggregator'
const FILTERS: readonly Filter[] = ['all', 'direct', 'aggregator']

const COLUMNS = [
  'route',
  'speed',
  'priceFrom',
  'cod',
  'insures',
  'rate',
  'courierName',
  'answering',
  'on',
] as const

/**
 * Apps → Delivery options → Routes (Figma 929:12240): every courier × app the connected apps
 * offer, in one table with its switches, then Delhivery Protect and the insurance cover terms.
 * The routes come from asking each app on two long lanes (`deliveryRouteCatalogue`).
 */
export default function DeliveryRoutesPage() {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const pages = useCopy(deliveryPagesContent)
  const { overview, reload } = useDeliveryOverview()
  const { catalogue, loading, reload: reloadRoutes } = useRouteCatalogue()
  const [filter, setFilter] = useState<Filter>('all')
  const [target, setTarget] = useState<RouteSettingTarget | null>(null)
  const [busy, setBusy] = useState(false)

  // Helpers
  const settingOf = (key: string): RouteSetting | null =>
    overview?.routeSettings.find((s) => s.key === key) ?? null
  const changed = () => {
    reload()
    reloadRoutes()
  }

  // Event handlers
  const handleSet = async (key: string, patch: { enabled?: boolean; showName?: boolean }) => {
    setBusy(true)
    try {
      const had = settingOf(key)
      await api.deliveryOptions.saveRouteSetting({ ...(had ?? { key, enabled: true }), ...patch })
      changed()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (!overview) return null

  // Render logic
  const t = pages.routeTable
  const rows = routeRows(catalogue?.routes ?? [])
  const shown = filter === 'all' ? rows : rows.filter((r) => r.channel === filter)
  const counts: Record<Filter, number> = {
    all: rows.length,
    direct: rows.filter((r) => r.channel === 'direct').length,
    aggregator: rows.filter((r) => r.channel === 'aggregator').length,
  }
  const failedApps = (catalogue?.apps ?? []).filter((a) => !a.ok)

  return (
    <div className="flex flex-col gap-5">
      <SectionHead
        title={pages.pages.routes.title}
        intro={pages.pages.routes.intro}
        action={<AppStoreLink category="shipping">{copy.routes.connect}</AppStoreLink>}
      />
      <DeliveryWarnings warnings={overview.warnings} />
      <section className="flex flex-col rounded-xl border border-panel-border bg-card">
        <fieldset className="flex flex-wrap gap-2 p-4">
          <legend className="sr-only">{t.filtersLabel}</legend>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'motion-press flex h-8 items-center gap-1.5 rounded-full border px-3 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === f
                  ? 'border-ink-strong bg-ink-strong text-background'
                  : 'border-hairline text-ink-strong hover:bg-row-hover',
              )}
            >
              {t.filters[f]}
              <span className={filter === f ? 'opacity-70' : 'text-muted-foreground'}>
                {counts[f]}
              </span>
            </button>
          ))}
        </fieldset>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem]">
            <thead className="bg-muted/40 text-left text-caption font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                {COLUMNS.map((c, i) => (
                  <th
                    key={c}
                    className={cn(
                      'py-2 pr-3 font-medium',
                      i === 0 && 'pl-4',
                      c === 'on' && 'pr-4 text-right',
                    )}
                  >
                    {t.columns[c]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <RouteTableRow
                  key={row.id}
                  row={row}
                  health={overview.health.apps.find((h) => h.providerId === row.providerId)}
                  appPrices={overview.apps.find((a) => a.id === row.providerId)?.prices ?? false}
                  courierRate={catalogue?.courierRates[row.providerId]}
                  busy={busy}
                  onOpen={() =>
                    setTarget({
                      kind: 'exact',
                      key: row.settingKey,
                      label: `${row.carrier} (${row.providerLabel})`,
                    })
                  }
                  onSet={(patch) => handleSet(row.settingKey, patch)}
                />
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 ? (
          <p className="border-t border-hairline px-4 py-3 text-body text-muted-foreground">
            {loading ? t.loading : t.empty}
          </p>
        ) : null}
        <div className="flex flex-col gap-1 border-t border-hairline px-4 py-3 text-caption text-muted-foreground">
          <p>{t.footer}</p>
          {catalogue ? <p>{t.source(catalogue.lanes.join(', '))}</p> : null}
          {failedApps.map((a) => (
            <p key={a.providerId} className="text-warning-foreground dark:text-warning">
              {t.failed(a.providerLabel)}
            </p>
          ))}
        </div>
      </section>
      <ProtectCard card={overview.protect} onChanged={reload} />
      <InsuranceCoverCard card={overview.protect} onChanged={reload} />
      {target ? (
        <RouteSettingDialog
          open
          target={target}
          current={target.kind === 'exact' ? settingOf(target.key) : null}
          onOpenChange={(open) => (open ? null : setTarget(null))}
          onSaved={changed}
        />
      ) : null}
    </div>
  )
}

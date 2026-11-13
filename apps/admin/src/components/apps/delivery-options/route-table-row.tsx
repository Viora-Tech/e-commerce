'use client'

import type { AppHealth, CourierInsuranceRate } from '@commerce/core'
import { Switch } from '@commerce/ui/shadcn/switch'
import StatusChip from '@/components/layout/status-chip'
import CourierMark from '@/components/shipments/create-shipment/courier-mark'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { RouteRow } from './courier-rows'

type RouteTableRowProps = {
  row: RouteRow
  /** What checkout recorded for the row's app. */
  health: AppHealth | undefined
  /** The app gives live prices at all. */
  appPrices: boolean
  /** The app's own published insurance rate (Shiprocket, RapidShyp). */
  courierRate: CourierInsuranceRate | undefined
  busy: boolean
  onOpen: () => void
  onSet: (patch: { enabled?: boolean; showName?: boolean }) => void
}

const CELL = 'py-3 pr-3 align-middle'

/** One route in the Routes table (Figma 929:12240): courier × app, its facts and switches. */
export default function RouteTableRow({
  row,
  health,
  appPrices,
  courierRate,
  busy,
  onOpen,
  onSet,
}: RouteTableRowProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const pages = useCopy(deliveryPagesContent)
  const fmt = useFormat()

  // Render logic
  const t = pages.routeTable
  const name = `${row.carrier} (${row.providerLabel})`
  const delhiveryDirect = row.channel === 'direct' && row.carrierKey === 'delhivery'
  const rate = !row.insures
    ? t.none
    : delhiveryDirect
      ? t.protect
      : row.insurancePercent != null || row.insuranceMinPaise != null
        ? t.rate(
            String(row.insurancePercent ?? 0),
            row.insuranceMinPaise ? fmt.money(row.insuranceMinPaise) : null,
          )
        : courierRate
          ? t.courierRate(String(courierRate.bps / 100), courierRate.gstIncluded)
          : copy.routes.notSet
  const skippedMin = health?.skippedSince
    ? Math.max(1, Math.round((Date.now() - Date.parse(health.skippedSince)) / 60_000))
    : null
  const answer =
    health?.successRate == null
      ? null
      : pages.apps.line(
          `${Math.round(health.successRate * 100)}%`,
          health.typicalMs === null ? null : pages.tiles.ms(health.typicalMs),
        )

  return (
    <tr className="border-t border-hairline text-body">
      <td className={`${CELL} pl-4`}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={t.edit(name)}
          className="flex items-center gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CourierMark label={row.carrier} className="h-7 w-12" />
          <span className="flex min-w-0 flex-col">
            <span className="font-medium text-ink-strong hover:underline">{row.carrier}</span>
            <span className="text-caption text-muted-foreground">
              {row.channel === 'direct' ? t.direct : t.via(row.providerLabel)}
            </span>
          </span>
        </button>
      </td>
      <td className={CELL}>{row.speeds.map((s) => t.speeds[s]).join(', ')}</td>
      <td className={CELL}>
        {row.price === 'live' ? t.livePrice : row.price === 'card' ? t.costCard : t.noPrice}
      </td>
      <td className={CELL}>{row.cod ? t.yes : t.no}</td>
      <td className={CELL}>
        {!row.insures ? (
          <StatusChip tone="danger">{t.no}</StatusChip>
        ) : row.channel === 'direct' && !delhiveryDirect ? (
          <StatusChip>{t.contract}</StatusChip>
        ) : (
          <StatusChip tone="success">{t.insures}</StatusChip>
        )}
      </td>
      <td className={`${CELL} whitespace-nowrap`}>{rate}</td>
      <td className={CELL}>
        <Switch
          checked={row.showName}
          disabled={busy}
          onCheckedChange={(on) => onSet({ showName: on })}
          aria-label={t.showName(row.carrier)}
        />
      </td>
      <td className={CELL}>
        {skippedMin ? (
          <StatusChip tone="attention">{pages.apps.skipped(skippedMin)}</StatusChip>
        ) : answer ? (
          <StatusChip tone="success">{answer}</StatusChip>
        ) : (
          <StatusChip>{appPrices ? pages.apps.quiet : t.noLivePrice}</StatusChip>
        )}
      </td>
      <td className={`${CELL} pr-4 text-right`}>
        <Switch
          checked={row.enabled}
          disabled={busy}
          onCheckedChange={(on) => onSet({ enabled: on })}
          aria-label={t.on(name)}
        />
      </td>
    </tr>
  )
}

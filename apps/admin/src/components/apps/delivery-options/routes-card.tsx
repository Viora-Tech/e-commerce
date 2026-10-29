'use client'

import type { Route } from '@commerce/core'
import type { RouteSetting } from '@commerce/core/delivery-options'
import { Pencil, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import AppStoreLink from '@/components/apps/app-store-link'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { carrierName, channelLabel, type Overview } from './format'
import RouteSettingDialog, { type RouteSettingTarget } from './route-setting-dialog'

type RoutesCardProps = {
  apps: Overview['apps']
  settings: RouteSetting[]
  /** Routes the apps answered for the last Try a PIN. */
  seen: Route[]
  onChanged: () => void
}

/** "carrier:delhivery|channel:direct" → "Delhivery · Direct". */
function settingLabel(key: string, copy: typeof deliveryOptionsContent, seen: Route[]): string {
  const m = /^carrier:([^|]+)\|channel:(.+)$/.exec(key)
  if (m)
    return `${carrierName(m[1] as string, copy.routeDialog.anyCourier)} · ${channelLabel(m[2] as string, copy)}`
  const route = seen.find((r) => r.key === key)
  return route ? `${route.carrier} · ${route.serviceLabel} (${route.providerLabel})` : key
}

/** The connected courier apps, the merchant's route settings, and the routes last answered. */
export default function RoutesCard({ apps, settings, seen, onChanged }: RoutesCardProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const fmt = useFormat()
  const [target, setTarget] = useState<RouteSettingTarget | null>(null)

  // Helpers
  const rateOf = (s: Pick<RouteSetting, 'insurancePercent' | 'insuranceMinPaise'> | null) =>
    s?.insurancePercent != null || s?.insuranceMinPaise != null
      ? copy.routes.rate(
          String(s.insurancePercent ?? 0),
          s.insuranceMinPaise ? fmt.money(s.insuranceMinPaise) : null,
        )
      : copy.routes.notSet

  // Render logic
  const r = copy.routes
  const current =
    target?.kind === 'exact' ? (settings.find((s) => s.key === target.key) ?? null) : null

  return (
    <SettingsCard
      title={r.title}
      description={r.description}
      footer={
        <Button variant="outline" onClick={() => setTarget({ kind: 'carrier' })}>
          <Plus aria-hidden />
          {r.addSetting}
        </Button>
      }
    >
      {apps.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-body text-muted-foreground">{r.none}</p>
          <AppStoreLink category="shipping">{r.connect}</AppStoreLink>
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {apps.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-body"
            >
              <span className="font-medium text-ink-strong">{a.label}</span>
              <StatusChip tone="success">{r.connected}</StatusChip>
              <span className="text-caption text-muted-foreground">
                {a.channel === 'aggregator' ? r.aggregator : r.direct} ·{' '}
                {a.prices ? r.prices : r.noPrice}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-body font-medium text-ink-strong">{r.settingsTitle}</p>
        {settings.length === 0 ? (
          <p className="text-caption text-muted-foreground">{r.settingsEmpty}</p>
        ) : (
          <ul className="flex flex-col">
            {settings.map((s) => (
              <li
                key={s.key}
                className="flex items-center gap-3 border-t border-hairline py-2 text-body first:border-t-0"
              >
                <span className="min-w-0 flex-1">{settingLabel(s.key, copy, seen)}</span>
                <span className="text-caption text-muted-foreground">
                  {r.columns.insures}: {s.insures == null ? '—' : s.insures ? r.yes : r.no} ·{' '}
                  {rateOf(s)}
                </span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={copy.edit}
                  onClick={() =>
                    setTarget({ kind: 'exact', key: s.key, label: settingLabel(s.key, copy, seen) })
                  }
                >
                  <Pencil aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {seen.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-body font-medium text-ink-strong">{r.seen}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead className="text-left text-caption text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">{r.columns.route}</th>
                  <th className="py-2 pr-3 font-medium">{r.columns.speed}</th>
                  <th className="py-2 pr-3 font-medium">{r.columns.cost}</th>
                  <th className="py-2 pr-3 font-medium">{r.columns.cod}</th>
                  <th className="py-2 pr-3 font-medium">{r.columns.insures}</th>
                  <th className="py-2 pr-3 font-medium">{r.columns.insurance}</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {seen.map((route) => {
                  const label = `${route.carrier} · ${route.serviceLabel} (${route.providerLabel})`
                  return (
                    <tr key={route.key} className="border-t border-hairline">
                      <td className="py-2 pr-3">{label}</td>
                      <td className="py-2 pr-3">
                        {route.speed === 'express' ? r.express : r.standard}
                      </td>
                      <td className="py-2 pr-3 tabular-nums">
                        {route.costPaise === null ? r.noPrice : fmt.money(route.costPaise)}
                      </td>
                      <td className="py-2 pr-3">{route.codAvailable === false ? r.no : r.yes}</td>
                      <td className="py-2 pr-3">{route.insures ? r.yes : r.no}</td>
                      <td className="py-2 pr-3">
                        {route.insures ? rateOf(route) : '—'}
                        {route.insures ? (
                          <span className="block text-caption text-muted-foreground">
                            {r.contract}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={copy.edit}
                          onClick={() => setTarget({ kind: 'exact', key: route.key, label })}
                        >
                          <Pencil aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {target ? (
        <RouteSettingDialog
          open
          target={target}
          current={current}
          onOpenChange={(open) => (open ? null : setTarget(null))}
          onSaved={onChanged}
        />
      ) : null}
    </SettingsCard>
  )
}

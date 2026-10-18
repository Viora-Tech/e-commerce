'use client'

import { permissions } from '@commerce/core/permissions'
import { Plus, Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import RowActionsCell from '@/components/table/row-actions-cell'
import { stateName } from '@/data/india'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { describePrice, fromRate, type LoadedZone } from './form-state'

type ListCopy = (typeof shippingRatesContent)['list']

/** "Karnataka, Kerala · 2 PIN code rules", or "All of India". */
function coverage(copy: ListCopy, zone: LoadedZone): string {
  const includes = zone.pincodeRules.filter((r) => r.mode === 'include').length
  const excludes = zone.pincodeRules.length - includes
  if (zone.stateCodes.length === 0 && includes === 0) {
    return excludes ? copy.everywhereExcept(excludes) : copy.allIndia
  }
  const parts: string[] = []
  if (zone.stateCodes.length) parts.push(copy.states(zone.stateCodes.map(stateName)))
  if (zone.pincodeRules.length) parts.push(copy.pincodes(zone.pincodeRules.length))
  return parts.join(' · ')
}

const zoneHref = (id: string) => routes.settings.shippingZone(id)

/** Settings → Shipping → Shipping rates: every zone with what it covers and charges. */
export default function ShippingZonesCard() {
  // Hooks
  const ratesCopy = useCopy(shippingRatesContent)
  const fmt = useFormat()
  const { hasPermission } = usePermissions()
  const [zones, setZones] = useState<LoadedZone[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    api.shipping.zones
      .list()
      .then((z) => {
        if (live) setZones(z)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [])

  // Render logic
  const copy = ratesCopy.list
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const create = canManage ? (
    <Button nativeButton={false} render={<Link href={routes.settings.newShippingZone()} />}>
      <Plus />
      {copy.create}
    </Button>
  ) : null

  // Early returns
  if (failed || zones === null || zones.length === 0) {
    return (
      <SettingsCard title={copy.heading} description={copy.meta}>
        {failed ? (
          <p className="text-body text-danger">{copy.loadFailed}</p>
        ) : zones === null ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <EmptyState
            icon={Truck}
            heading={copy.empty.heading}
            body={copy.empty.body}
            action={create}
          />
        )}
      </SettingsCard>
    )
  }

  return (
    <SettingsTable
      heading={copy.heading}
      description={copy.meta}
      actions
      columns={[
        { label: copy.columns.zone },
        { label: copy.columns.covers, className: 'hidden md:table-cell' },
        { label: copy.columns.rates },
      ]}
      after={create ? <div className="px-4 py-3 md:px-6">{create}</div> : null}
    >
      {zones.map((z) => (
        <SettingsTableRow key={z.id} className="align-top">
          <SettingsTableCell>
            <Link
              href={zoneHref(z.id)}
              className="font-semibold text-ink-strong underline-offset-4 hover:underline"
            >
              {z.name}
            </Link>
            <div className="text-caption text-muted-foreground md:hidden">{coverage(copy, z)}</div>
          </SettingsTableCell>
          <SettingsTableCell className="hidden text-muted-foreground md:table-cell">
            {coverage(copy, z)}
          </SettingsTableCell>
          <SettingsTableCell className="whitespace-normal">
            {z.rates.length === 0 ? (
              <StatusChip tone="attention">{copy.noRates}</StatusChip>
            ) : (
              <ul className="flex flex-col gap-1">
                {z.rates.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold">{r.name}</span>
                    <span className="text-caption text-muted-foreground">
                      {describePrice(ratesCopy, fmt, fromRate(r))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SettingsTableCell>
          <SettingsTableCell className="w-16 p-0 last:pr-2 md:last:pr-2">
            <RowActionsCell href={zoneHref(z.id)} />
          </SettingsTableCell>
        </SettingsTableRow>
      ))}
    </SettingsTable>
  )
}

'use client'

import { permissions } from '@commerce/core/permissions'
import { Plus, Truck } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { INDIAN_STATES } from '@/data/india'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { describePrice, fromRate, type LoadedZone } from './form-state'

type ListCopy = (typeof shippingRatesContent)['list']

const stateName = (code: string): string => INDIAN_STATES.find((s) => s.code === code)?.name ?? code

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

const zoneHref = (id: string) => `/settings/shipping/zones/${id}`

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
    <Button nativeButton={false} render={<Link href="/settings/shipping/zones/new" />}>
      <Plus />
      {copy.create}
    </Button>
  ) : null

  return (
    <DataCard title={copy.heading} meta={copy.meta} action={zones?.length ? create : null} flush>
      {failed ? (
        <p className="px-5 pb-2 text-body text-destructive">{copy.loadFailed}</p>
      ) : zones === null ? (
        <div className="flex flex-col gap-2 px-5 pb-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : zones.length === 0 ? (
        <EmptyState
          icon={Truck}
          heading={copy.empty.heading}
          body={copy.empty.body}
          action={create}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">{copy.columns.zone}</TableHead>
              <TableHead className="hidden md:table-cell">{copy.columns.covers}</TableHead>
              <TableHead className="pr-5">{copy.columns.rates}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zones.map((z) => (
              <TableRow key={z.id}>
                <TableCell className="pl-5 align-top">
                  <Link
                    href={zoneHref(z.id)}
                    className="text-body-strong text-ink-strong underline-offset-4 hover:underline"
                  >
                    {z.name}
                  </Link>
                  <div className="text-caption text-muted-foreground md:hidden">
                    {coverage(copy, z)}
                  </div>
                </TableCell>
                <TableCell className="hidden align-top text-muted-foreground md:table-cell">
                  {coverage(copy, z)}
                </TableCell>
                <TableCell className="pr-5 align-top whitespace-normal">
                  {z.rates.length === 0 ? (
                    <Badge variant="warning">{copy.noRates}</Badge>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {z.rates.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-baseline gap-x-2">
                          <span className="text-body-strong">{r.name}</span>
                          <span className="text-caption text-muted-foreground">
                            {describePrice(ratesCopy, fmt, fromRate(r))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </DataCard>
  )
}

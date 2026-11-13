'use client'

import { Button } from '@commerce/ui/shadcn/button'
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
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import TableEmptyRow from '@/components/table/table-empty-row'
import TableSkeletonRows from '@/components/table/table-skeleton-rows'
import { delhiveryAppContent } from '@/data/delhivery'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { pickupWhen } from './pickup-when'

type Places = Awaited<ReturnType<typeof api.shipments.courierPickupPlaces>>

/**
 * `/apps/delhivery/pickup-locations`: where Delhivery collects this store's parcels. The
 * account's own pickup location (Connect page) and every location with courier pickup on
 * (Settings › Locations), with the name sent to Delhivery and the next pickup booked there.
 */
export default function PickupLocationsPage() {
  // Hooks
  const all = useCopy(delhiveryAppContent)
  const format = useFormat()
  const [places, setPlaces] = useState<Places | null>(null)
  useEffect(() => {
    let live = true
    api.shipments
      .courierPickupPlaces({ provider: 'delhivery' })
      .then((p) => live && setPlaces(p))
      .catch(() => live && setPlaces([]))
    return () => {
      live = false
    }
  }, [])

  // Render logic
  const copy = all.pickupLocationsPage
  const c = copy.columns

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.settings.locations()} />}
          >
            {copy.manage}
          </Button>
        }
      />
      <div className="overflow-hidden rounded-xl border border-border surface-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={HEAD}>{c.place}</TableHead>
              <TableHead className={HEAD}>{c.registered}</TableHead>
              <TableHead className={HEAD}>{c.address}</TableHead>
              <TableHead className={HEAD}>{c.next}</TableHead>
              <TableHead className={HEAD} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {places === null ? <TableSkeletonRows columns={5} rows={2} label={copy.title} /> : null}
            {places !== null && places.length === 0 ? (
              <TableEmptyRow colSpan={5} message={copy.empty} />
            ) : null}
            {(places ?? []).map((p) => (
              <TableRow key={p.locationId ?? 'own'}>
                <TableCell className={CELL}>
                  <span className="flex items-center gap-2">
                    <span className="text-ink-strong">{p.label}</span>
                    {p.isDefault ? <StatusChip>{all.overview.pickup.default}</StatusChip> : null}
                  </span>
                </TableCell>
                <TableCell className={`${CELL} font-mono text-caption`}>{p.pickupName}</TableCell>
                <TableCell className={`${CELL} tabular-nums`}>
                  {[p.city, p.pincode].filter(Boolean).join(' ')}
                </TableCell>
                <TableCell className={CELL}>
                  {p.nextPickup ? (
                    copy.next(
                      pickupWhen(format, p.nextPickup.date, p.nextPickup.timeFrom),
                      p.nextPickup.parcels,
                    )
                  ) : (
                    <span className="text-muted-foreground">{copy.none}</span>
                  )}
                </TableCell>
                <TableCell className={`${CELL} text-right`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link
                        href={
                          p.locationId
                            ? routes.settings.location(p.locationId)
                            : routes.apps.connect('delhivery')
                        }
                      />
                    }
                  >
                    {p.locationId ? copy.manage : copy.changeDefault}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

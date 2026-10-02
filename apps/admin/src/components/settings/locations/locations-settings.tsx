'use client'

import type { BusinessGstView, LocationBillingView } from '@commerce/core'
import { MapPinLineIcon, Plus, TriangleAlert } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AddLocationDialog from '@/components/inventory/add-location-dialog'
import PageHeader from '@/components/layout/page-header'
import { businessGstContent } from '@/data/business-gst'
import { useCopy } from '@/hooks/use-copy'

type LocationsSettingsProps = {
  view: BusinessGstView
}

/** Settings › Locations: every place stock sits, its state, and the GST number it bills under. */
export default function LocationsSettings({ view }: LocationsSettingsProps) {
  // Hooks
  const { locations: copy } = useCopy(businessGstContent)
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  // Helpers
  const gstinOf = (l: LocationBillingView) =>
    view.registrations.find((r) => r.id === l.gstRegistrationId)?.gstin ?? null
  const pickupOf = (l: LocationBillingView) =>
    l.courierPickup
      ? copy.pickupHere([l.city, l.pincode].filter(Boolean).join(' '))
      : copy.pickupShipping

  // Event handlers
  const handleCreated = () => router.refresh()

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        icon={<MapPinLineIcon aria-hidden="true" />}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            {copy.add}
          </Button>
        }
      />
      <Card className="gap-0 p-0">
        <CardHeader className="px-4 pt-4 pb-3">
          <CardTitle>{copy.heading}</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">{copy.columns.name}</TableHead>
              <TableHead className="hidden sm:table-cell">{copy.columns.state}</TableHead>
              <TableHead>{copy.columns.billsUnder}</TableHead>
              <TableHead className="hidden md:table-cell">{copy.columns.pickup}</TableHead>
              <TableHead className="w-0 pr-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.locations.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="pl-4">
                  <span className="flex flex-wrap items-center gap-2 text-body-strong text-ink-strong">
                    {l.name}
                    {l.isDefault ? <Badge variant="neutral">{copy.defaultBadge}</Badge> : null}
                  </span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {l.stateName ?? copy.noState}
                </TableCell>
                <TableCell>
                  {l.stateUnregistered ? (
                    <span className="flex items-center gap-1.5 text-caption text-warning-foreground dark:text-warning">
                      <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
                      {copy.unregistered(l.stateName ?? '')}
                    </span>
                  ) : (
                    <span className="font-mono text-body text-muted-foreground">
                      {gstinOf(l) ?? copy.notChosen}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  {pickupOf(l)}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={<Link href={`/settings/locations/${l.id}`} />}
                  >
                    {copy.open}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <AddLocationDialog open={adding} onOpenChange={setAdding} onCreated={handleCreated} />
    </div>
  )
}

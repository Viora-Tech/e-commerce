'use client'

import type { BusinessGstView, LocationBillingView } from '@commerce/core'
import { Plus, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import AddLocationDialog from '@/components/inventory/add-location-dialog'
import StatusChip from '@/components/layout/status-chip'
import SettingsPageHeader from '@/components/settings/settings-page-header'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import RowActionsCell from '@/components/table/row-actions-cell'
import { businessGstContent } from '@/data/business-gst'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type LocationsSettingsProps = {
  view: BusinessGstView
}

/** Settings › Locations & warehouses: every place stock sits, its state, and the GST number it bills under. */
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
      <SettingsPageHeader
        title={copy.title}
        subtitle={copy.intro}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            {copy.add}
          </Button>
        }
      />
      <SettingsTable
        heading={copy.heading}
        actions
        total={view.locations.length}
        columns={[
          { label: copy.columns.name },
          { label: copy.columns.state, className: 'hidden sm:table-cell' },
          { label: copy.columns.billsUnder },
          { label: copy.columns.pickup, className: 'hidden md:table-cell' },
        ]}
      >
        {view.locations.map((l) => (
          <SettingsTableRow key={l.id}>
            <SettingsTableCell>
              <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">
                {l.name}
                {l.isDefault ? <StatusChip>{copy.defaultBadge}</StatusChip> : null}
              </span>
            </SettingsTableCell>
            <SettingsTableCell className="hidden text-muted-foreground sm:table-cell">
              {l.stateName ?? copy.noState}
            </SettingsTableCell>
            <SettingsTableCell>
              {l.stateUnregistered ? (
                <span className="flex items-center gap-1.5 text-caption text-warning-foreground dark:text-warning">
                  <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
                  {copy.unregistered(l.stateName ?? '')}
                </span>
              ) : (
                <span className="font-mono text-muted-foreground">
                  {gstinOf(l) ?? copy.notChosen}
                </span>
              )}
            </SettingsTableCell>
            <SettingsTableCell className="hidden text-muted-foreground md:table-cell">
              {pickupOf(l)}
            </SettingsTableCell>
            <SettingsTableCell className="w-16 p-0 last:pr-2 md:last:pr-2">
              <RowActionsCell href={routes.settings.location(l.id)} />
            </SettingsTableCell>
          </SettingsTableRow>
        ))}
      </SettingsTable>
      <AddLocationDialog open={adding} onOpenChange={setAdding} onCreated={handleCreated} />
    </div>
  )
}

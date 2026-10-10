'use client'

import type { BusinessGstView, LocationBillingView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { ArrowDown, ArrowUp, Plus, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import AddLocationDialog from '@/components/inventory/add-location-dialog'
import StatusChip from '@/components/layout/status-chip'
import SettingsPageHeader from '@/components/settings/settings-page-header'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import RowActionsCell from '@/components/table/row-actions-cell'
import { businessGstContent } from '@/data/business-gst'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import LocationsRoutingCard from './locations-routing-card'

type LocationsSettingsProps = {
  view: BusinessGstView
}

/** The list with the item at `index` moved one place up (-1) or down (+1). */
function moved<T>(list: readonly T[], index: number, step: -1 | 1): T[] {
  const next = [...list]
  const [item] = next.splice(index, 1)
  if (item !== undefined) next.splice(index + step, 0, item)
  return next
}

/**
 * Settings › Locations & warehouses: every place stock sits, its state, the GST number it bills
 * under, whether it ships online orders, and the order checkout tries them in.
 */
export default function LocationsSettings({ view }: LocationsSettingsProps) {
  // Hooks
  const { locations: copy } = useCopy(businessGstContent)
  const { hasPermission } = usePermissions()
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [order, setOrder] = useState(view.locations.map((l) => l.id))
  const [moving, setMoving] = useState(false)

  // Helpers
  /** The list in the order shown: the saved order, then any location added since. */
  const currentIds = () => [
    ...order.filter((id) => view.locations.some((l) => l.id === id)),
    ...view.locations.filter((l) => !order.includes(l.id)).map((l) => l.id),
  ]
  const gstinOf = (l: LocationBillingView) =>
    view.registrations.find((r) => r.id === l.gstRegistrationId)?.gstin ?? null
  const pickupOf = (l: LocationBillingView) =>
    l.courierPickup
      ? copy.pickupHere([l.city, l.pincode].filter(Boolean).join(' '))
      : copy.pickupShipping

  // Event handlers
  const handleCreated = () => router.refresh()
  const handleMove = async (index: number, step: -1 | 1) => {
    const previous = order
    const next = moved(currentIds(), index, step)
    setOrder(next)
    setMoving(true)
    try {
      await api.businessGst.reorderLocations({ locationIds: next })
      toast.success(copy.reordered)
      router.refresh()
    } catch (err) {
      setOrder(previous)
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setMoving(false)
    }
  }

  // Render logic
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const rows = currentIds().flatMap((id) => view.locations.filter((l) => l.id === id))

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
          ...(canManage ? [{ label: copy.columns.order, className: 'w-20' }] : []),
          { label: copy.columns.name },
          { label: copy.columns.ships, className: 'hidden sm:table-cell' },
          { label: copy.columns.state, className: 'hidden lg:table-cell' },
          { label: copy.columns.billsUnder },
          { label: copy.columns.pickup, className: 'hidden 2xl:table-cell' },
        ]}
      >
        {rows.map((l, index) => (
          <SettingsTableRow key={l.id}>
            {canManage ? (
              <SettingsTableCell>
                <span className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={copy.moveUp(l.name)}
                    disabled={moving || index === 0}
                    onClick={() => handleMove(index, -1)}
                  >
                    <ArrowUp aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={copy.moveDown(l.name)}
                    disabled={moving || index === rows.length - 1}
                    onClick={() => handleMove(index, 1)}
                  >
                    <ArrowDown aria-hidden="true" />
                  </Button>
                </span>
              </SettingsTableCell>
            ) : null}
            <SettingsTableCell>
              <span className="flex flex-wrap items-center gap-2 font-semibold text-ink-strong">
                {l.name}
                {l.isDefault ? <StatusChip>{copy.defaultBadge}</StatusChip> : null}
              </span>
            </SettingsTableCell>
            <SettingsTableCell className="hidden sm:table-cell">
              {l.fulfilsOnlineOrders ? (
                <StatusChip tone="info">{copy.ships}</StatusChip>
              ) : (
                <StatusChip>{copy.stockOnly}</StatusChip>
              )}
            </SettingsTableCell>
            <SettingsTableCell className="hidden text-muted-foreground lg:table-cell">
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
            <SettingsTableCell className="hidden text-muted-foreground 2xl:table-cell">
              {pickupOf(l)}
            </SettingsTableCell>
            <SettingsTableCell className="w-16 p-0 last:pr-2 md:last:pr-2">
              <RowActionsCell href={routes.settings.location(l.id)} />
            </SettingsTableCell>
          </SettingsTableRow>
        ))}
      </SettingsTable>
      <LocationsRoutingCard maxParcels={view.maxParcels} canManage={canManage} />
      <AddLocationDialog open={adding} onOpenChange={setAdding} onCreated={handleCreated} />
    </div>
  )
}

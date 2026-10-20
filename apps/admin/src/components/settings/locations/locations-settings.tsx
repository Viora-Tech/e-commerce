'use client'

import type { BusinessGstView, LocationBillingView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { Plus, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useDndSensors } from '@commerce/ui/sortable'
import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useReducedMotion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import AddLocationDialog from '@/components/inventory/add-location-dialog'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import RowActionsCell from '@/components/table/row-actions-cell'
import { businessGstContent } from '@/data/business-gst'
import { reorderLabels } from '@/data/common'
import { SETTINGS_BACK } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import LocationOrderRow from './location-order-row'
import LocationsRoutingCard from './locations-routing-card'

type LocationsSettingsProps = {
  view: BusinessGstView
}

/** Rows only move up and down the table. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/**
 * Settings › Locations & warehouses: every place stock sits, its state, the GST number it bills
 * under, whether it ships online orders, and the order checkout tries them in.
 */
export default function LocationsSettings({ view }: LocationsSettingsProps) {
  // Hooks
  const { locations: copy } = useCopy(businessGstContent)
  const sortLabels = useCopy(reorderLabels)
  const { hasPermission } = usePermissions()
  const router = useRouter()
  const sensors = useDndSensors()
  const prefersReducedMotion = useReducedMotion()
  /* A stable id keeps dnd-kit's aria-describedby the same on the server and the client. */
  const dndId = useId()
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
  const nameOf = (id: unknown) => view.locations.find((l) => l.id === id)?.name ?? ''
  const positionOf = (id: unknown) => currentIds().indexOf(String(id)) + 1

  // Event handlers
  const handleCreated = () => router.refresh()
  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const ids = currentIds()
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from === -1 || to === -1) return
    const previous = order
    const next = arrayMove(ids, from, to)
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
  const announcements: Announcements = {
    onDragStart: (e) => sortLabels.picked(nameOf(e.active.id)),
    onDragOver: (e) =>
      e.over ? sortLabels.moved(nameOf(e.active.id), positionOf(e.over.id), rows.length) : '',
    onDragEnd: (e) =>
      e.over ? sortLabels.dropped(nameOf(e.active.id), positionOf(e.over.id), rows.length) : '',
    onDragCancel: (e) => sortLabels.cancelled(nameOf(e.active.id)),
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            {copy.add}
          </Button>
        }
        back={SETTINGS_BACK}
      />
      <SettingsTable
        heading={copy.heading}
        actions
        total={view.locations.length}
        columns={[
          ...(canManage ? [{ label: copy.columns.order, className: 'w-14' }] : []),
          { label: copy.columns.name },
          { label: copy.columns.ships, className: 'hidden sm:table-cell' },
          { label: copy.columns.state, className: 'hidden lg:table-cell' },
          { label: copy.columns.billsUnder },
          { label: copy.columns.pickup, className: 'hidden 2xl:table-cell' },
        ]}
      >
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[verticalOnly]}
          accessibility={{
            announcements,
            screenReaderInstructions: { draggable: sortLabels.instructions },
          }}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={rows.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            {rows.map((l) => (
              <LocationOrderRow
                key={l.id}
                id={l.id}
                handleLabel={sortLabels.handle(l.name)}
                sortable={canManage}
                disabled={moving}
                reduced={prefersReducedMotion === true}
              >
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
              </LocationOrderRow>
            ))}
          </SortableContext>
        </DndContext>
      </SettingsTable>
      <LocationsRoutingCard maxParcels={view.maxParcels} canManage={canManage} />
      <AddLocationDialog open={adding} onOpenChange={setAdding} onCreated={handleCreated} />
    </div>
  )
}

'use client'

import type { GstRegistrationView, LocationBillingView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { MapPinLineIcon, Pencil, Plus, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import PageHeader from '@/components/layout/page-header'
import SettingsCard from '@/components/settings/settings-card'
import { businessGstContent } from '@/data/business-gst'
import { locationsContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import EditLocationDialog from './edit-location-dialog'
import LocationLocalDeliveryCard from './location-local-delivery-card'
import LocationPickupCard from './location-pickup-card'
import LocationSellingCard from './location-selling-card'
import LocationStorePickupCard from './location-store-pickup-card'

type LocationDetailProps = {
  location: LocationBillingView
  registrations: GstRegistrationView[]
}

/** The select's value for "not chosen"; the server takes null. */
const NONE = 'none'

/** One location: its address and "Bills under: [state · GSTIN]". */
export default function LocationDetail({ location, registrations }: LocationDetailProps) {
  // Hooks
  const { location: copy } = useCopy(businessGstContent)
  const { edit: editLabel } = useCopy(locationsContent)
  const { hasPermission } = usePermissions()
  const router = useRouter()
  const [value, setValue] = useState(location.gstRegistrationId ?? NONE)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)

  // Event handlers
  const handleEdited = (gstRegistrationId: string | null) => {
    // A new state can pick or drop the GST number on the server; show what it chose.
    setValue(gstRegistrationId ?? NONE)
    router.refresh()
  }

  const handleChange = async (next: string) => {
    const previous = value
    setValue(next)
    setSaving(true)
    try {
      await api.businessGst.linkLocation({
        locationId: location.id,
        gstRegistrationId: next === NONE ? null : next,
      })
      toast.success(copy.saved)
      router.refresh()
    } catch (err) {
      setValue(previous)
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const canEdit = hasPermission(permissions.INVENTORY_WRITE)
  // A location with a state bills only under that state's GSTIN (the server refuses others).
  const eligible = registrations.filter(
    (r) => r.active && (location.stateCode === null || r.state === location.stateCode),
  )
  const options = [
    { value: NONE, label: copy.notChosen },
    ...eligible.map((r) => ({ value: r.id, label: `${r.stateName} · ${r.gstin}` })),
  ]
  const address = [
    location.line1,
    location.line2,
    location.city,
    location.stateName,
    location.pincode,
  ]
    .filter(Boolean)
    .join(', ')
  const current = registrations.find((r) => r.id === value)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={location.name}
        back={{ label: copy.back, href: routes.settings.locations() }}
      />
      <SettingsCard title={copy.address}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="flex items-start gap-2 text-body text-foreground">
              <MapPinLineIcon
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
              {address || copy.noAddress}
            </p>
            {location.phone ? (
              <p className="pl-6 text-body text-muted-foreground">{location.phone}</p>
            ) : null}
          </div>
          {canEdit ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil aria-hidden="true" />
              {editLabel}
            </Button>
          ) : null}
        </div>
      </SettingsCard>
      {canEdit ? (
        <EditLocationDialog
          location={location}
          open={editing}
          onOpenChange={setEditing}
          onSaved={handleEdited}
        />
      ) : null}
      <SettingsCard
        title={copy.billingHeading}
        description={copy.billingHelp}
        bodyClassName="flex flex-col gap-4"
      >
        {location.stateUnregistered ? (
          <div className="flex flex-col items-start gap-2 rounded-lg bg-warning/20 px-3 py-2 text-body text-warning-foreground dark:text-warning">
            <p className="flex items-start gap-2">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {copy.unregistered(location.stateName ?? '')}
            </p>
            {canManage ? (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`${routes.settings.taxes()}?open=gst-numbers`} />}
                nativeButton={false}
              >
                <Plus aria-hidden="true" />
                {copy.addGst}
              </Button>
            ) : null}
          </div>
        ) : null}
        {canManage ? (
          <ChoiceField
            id="location-bills-under"
            label={copy.billsUnder}
            value={value}
            options={options}
            onChange={(next) => (saving ? undefined : handleChange(next))}
            help={location.stateCode ? copy.otherStates : undefined}
          />
        ) : (
          <p className="text-body">
            {copy.billsUnder}:{' '}
            <span className="font-mono">
              {current ? `${current.stateName} · ${current.gstin}` : copy.notChosen}
            </span>
          </p>
        )}
      </SettingsCard>
      <LocationSellingCard location={location} canManage={canManage} />
      <LocationPickupCard location={location} canManage={canManage} />
      <LocationLocalDeliveryCard location={location} canManage={canManage} />
      <LocationStorePickupCard location={location} canManage={canManage} />
    </div>
  )
}

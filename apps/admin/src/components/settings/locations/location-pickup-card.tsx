'use client'

import type { LocationBillingView } from '@commerce/core'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import TextField from '@/components/apps/gst-invoices/text-field'
import ToggleRow from '@/components/apps/gst-invoices/toggle-row'
import SettingsCard from '@/components/settings/settings-card'
import { businessGstContent } from '@/data/business-gst'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type LocationPickupCardProps = {
  location: LocationBillingView
  canManage: boolean
}

/** What a courier needs to find the place (the server refuses pickup without it). */
const hasFullAddress = (l: LocationBillingView) =>
  Boolean(l.line1?.trim() && l.city?.trim() && l.stateCode && l.pincode?.trim())

/** Courier pickup for one location: on with the courier's pickup name, or off (Shipping settings). */
export default function LocationPickupCard({ location, canManage }: LocationPickupCardProps) {
  // Hooks
  const {
    location: { pickup: copy },
  } = useCopy(businessGstContent)
  const router = useRouter()
  const [on, setOn] = useState(location.courierPickup !== null)
  const [pickupName, setPickupName] = useState(location.courierPickup?.pickupName ?? '')
  const [contactName, setContactName] = useState(location.courierPickup?.contactName ?? '')
  const [phone, setPhone] = useState(location.courierPickup?.phone ?? '')
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.businessGst.setLocationPickup({
        locationId: location.id,
        pickup: on ? { pickupName, contactName, phone } : null,
      })
      toast.success(copy.saved)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const addressReady = hasFullAddress(location)
  const disabled = !canManage || saving

  return (
    <SettingsCard title={copy.heading} description={copy.help} bodyClassName="flex flex-col gap-4">
      {addressReady ? (
        <ToggleRow
          id="location-pickup"
          label={copy.toggle}
          checked={on}
          onChange={(next) => (disabled ? undefined : setOn(next))}
        />
      ) : (
        <p className="text-body text-muted-foreground">{copy.needsAddress}</p>
      )}
      {addressReady && on ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <TextField
              id="pickup-name"
              label={copy.pickupName}
              value={pickupName}
              onChange={setPickupName}
              help={copy.pickupNameHelp}
              maxLength={80}
            />
          </div>
          <TextField
            id="pickup-contact"
            label={copy.contactName}
            value={contactName}
            onChange={setContactName}
            help={copy.contactNameHelp}
            maxLength={80}
          />
          <TextField
            id="pickup-phone"
            label={copy.phone}
            value={phone}
            onChange={setPhone}
            help={copy.phoneHelp}
            inputMode="tel"
            maxLength={20}
          />
        </div>
      ) : null}
      {addressReady && !on ? (
        <p className="text-caption text-muted-foreground">{copy.off}</p>
      ) : null}
      {canManage && addressReady ? (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={disabled}>
            {copy.save}
          </Button>
        </div>
      ) : null}
    </SettingsCard>
  )
}

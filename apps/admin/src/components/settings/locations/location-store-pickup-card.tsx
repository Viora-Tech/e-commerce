'use client'

import type { LocationBillingView } from '@commerce/core'
import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import TextField from '@/components/apps/gst-invoices/text-field'
import ToggleRow from '@/components/apps/gst-invoices/toggle-row'
import SettingsCard from '@/components/settings/settings-card'
import { localDeliveryContent } from '@/data/local-delivery'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type LocationStorePickupCardProps = {
  location: LocationBillingView
  canManage: boolean
}

/**
 * Pickup in store at one location (audit #163): when an order is usually ready and how to
 * collect it. Checkout offers it free to every address in India (core `local-options.ts`).
 */
export default function LocationStorePickupCard({
  location,
  canManage,
}: LocationStorePickupCardProps) {
  // Hooks
  const { pickup: copy } = useCopy(localDeliveryContent)
  const router = useRouter()
  const [on, setOn] = useState(location.storePickup?.enabled ?? false)
  const [readyIn, setReadyIn] = useState(location.storePickup?.readyIn ?? '')
  const [instructions, setInstructions] = useState(location.storePickup?.instructions ?? '')
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      const keep = on || location.storePickup !== null
      await api.businessGst.setLocationStorePickup({
        locationId: location.id,
        storePickup: keep ? { enabled: on, readyIn, instructions } : null,
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
  const disabled = !canManage || saving

  return (
    <SettingsCard title={copy.heading} description={copy.help} bodyClassName="flex flex-col gap-4">
      <ToggleRow
        id="location-store-pickup"
        label={copy.toggle}
        checked={on}
        onChange={(next) => (disabled ? undefined : setOn(next))}
      />
      {on ? (
        <fieldset disabled={disabled} className="grid gap-4">
          <TextField
            id="pickup-ready-in"
            label={copy.readyIn}
            value={readyIn}
            onChange={setReadyIn}
            help={copy.readyInHelp}
            maxLength={120}
          />
          <TextField
            id="pickup-instructions"
            label={copy.instructions}
            value={instructions}
            onChange={setInstructions}
            help={copy.instructionsHelp}
            maxLength={500}
            multiline
          />
        </fieldset>
      ) : (
        <p className="text-caption text-muted-foreground">{copy.off}</p>
      )}
      {canManage ? (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={disabled}>
            <Save aria-hidden="true" />
            {copy.save}
          </Button>
        </div>
      ) : null}
    </SettingsCard>
  )
}

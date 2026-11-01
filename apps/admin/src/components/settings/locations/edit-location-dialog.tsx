'use client'

import type { LocationBillingView } from '@commerce/core'
import { useState } from 'react'
import { toast } from 'sonner'
import LocationAddressFields, {
  type LocationDraft,
  locationPayload,
  pincodeValid,
} from '@/components/inventory/location-address-fields'
import FormDialog from '@/components/layout/form-dialog'
import { locationsContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { focusField } from '@/lib/api-errors'

type EditLocationDialogProps = {
  location: LocationBillingView
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The GST number the location bills under after the save (it follows a new state). */
  onSaved: (gstRegistrationId: string | null) => void
}

const draftOf = (l: LocationBillingView): LocationDraft => ({
  name: l.name,
  line1: l.line1 ?? '',
  city: l.city ?? '',
  stateCode: l.stateCode ?? '',
  pincode: l.pincode ?? '',
  phone: l.phone ?? '',
})

/** Name, address, state and phone of an existing location (Settings › Locations › one location). */
export default function EditLocationDialog({
  location,
  open,
  onOpenChange,
  onSaved,
}: EditLocationDialogProps) {
  // Hooks
  const copy = useCopy(locationsContent)
  const [draft, setDraft] = useState(() => draftOf(location))
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    // Closing without saving drops the edits, so the next open starts from what is stored.
    if (!next) setDraft(draftOf(location))
    onOpenChange(next)
  }

  const handleSave = async () => {
    if (!pincodeValid(draft)) {
      toast.error(copy.invalidPincode)
      focusField('location-pincode')
      return
    }
    setBusy(true)
    try {
      const saved = await api.inventory.updateLocation({
        id: location.id,
        ...locationPayload(draft, ''),
      })
      toast.success(copy.editSaved)
      onOpenChange(false)
      onSaved(saved.gstRegistrationId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.editFailed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title={copy.editTitle}
      description={copy.editBody}
      submitLabel={busy ? copy.saving : copy.editSave}
      cancelLabel={copy.cancel}
      busy={busy}
      submitDisabled={draft.name.trim() === ''}
      onSubmit={handleSave}
      size="md"
    >
      <LocationAddressFields draft={draft} onChange={setDraft} />
    </FormDialog>
  )
}

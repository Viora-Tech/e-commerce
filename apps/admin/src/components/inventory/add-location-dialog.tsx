'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { locationsContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import LocationAddressFields, {
  EMPTY_LOCATION_DRAFT,
  type LocationDraft,
  locationPayload,
  pincodeValid,
} from './location-address-fields'
import type { StoreLocation } from './location-select'

type AddLocationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (location: StoreLocation) => void
}

/** Name and address of a new stock location; it does not sell online by default. */
export default function AddLocationDialog({
  open,
  onOpenChange,
  onCreated,
}: AddLocationDialogProps) {
  // Hooks
  const copy = useCopy(locationsContent)
  const [draft, setDraft] = useState<LocationDraft>(EMPTY_LOCATION_DRAFT)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSave = async () => {
    if (!pincodeValid(draft)) {
      toast.error(copy.invalidPincode)
      return
    }
    setBusy(true)
    try {
      const created = await api.inventory.createLocation(locationPayload(draft, undefined))
      toast.success(copy.created(created.name))
      setDraft(EMPTY_LOCATION_DRAFT)
      onOpenChange(false)
      onCreated(created)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.title}
      description={copy.body}
      submitLabel={busy ? copy.saving : copy.save}
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

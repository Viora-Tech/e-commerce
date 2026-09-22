'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import { locationsContent as copy } from '@/data/inventory'
import { api } from '@/lib/api-client'
import type { StoreLocation } from './location-select'

type AddLocationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (location: StoreLocation) => void
}

type Draft = { name: string; line1: string; city: string; stateCode: string; pincode: string }

const EMPTY: Draft = { name: '', line1: '', city: '', stateCode: '', pincode: '' }

const FIELDS = [
  { key: 'line1', label: copy.line1, span: true },
  { key: 'city', label: copy.city, span: false },
  { key: 'stateCode', label: copy.stateCode, span: false },
  { key: 'pincode', label: copy.pincode, span: false },
] as const

/** Name and address of a new stock location; it does not sell online by default. */
export default function AddLocationDialog({
  open,
  onOpenChange,
  onCreated,
}: AddLocationDialogProps) {
  // Hooks
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSave = async () => {
    if (draft.pincode && !/^\d{6}$/.test(draft.pincode)) {
      toast.error(copy.invalidPincode)
      return
    }
    setBusy(true)
    try {
      const created = await api.inventory.createLocation({
        name: draft.name,
        line1: draft.line1 || undefined,
        city: draft.city || undefined,
        stateCode: draft.stateCode || undefined,
        pincode: draft.pincode || undefined,
      })
      toast.success(copy.created(created.name))
      setDraft(EMPTY)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Field className="col-span-2">
            <FieldLabel htmlFor="location-name">{copy.name}</FieldLabel>
            <Input
              id="location-name"
              value={draft.name}
              placeholder={copy.namePlaceholder}
              autoComplete="off"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>
          {FIELDS.map((f) => (
            <Field key={f.key} className={f.span ? 'col-span-2' : undefined}>
              <FieldLabel htmlFor={`location-${f.key}`}>{f.label}</FieldLabel>
              <Input
                id={`location-${f.key}`}
                value={draft[f.key]}
                inputMode={f.key === 'pincode' ? 'numeric' : undefined}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              />
            </Field>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button onClick={handleSave} disabled={busy || draft.name.trim() === ''}>
            {busy ? copy.saving : copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

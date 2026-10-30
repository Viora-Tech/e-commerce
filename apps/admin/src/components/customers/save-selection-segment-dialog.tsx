'use client'

import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { customersContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type SaveSelectionSegmentDialogProps = {
  /** The ticked customers; the dialog is open while this is non-empty. */
  ids: string[]
  onClose: () => void
  /** After the segment was saved: clear the selection and reload. */
  onDone: () => void
}

/** `customers.tagMany` takes at most this many ids per call (the API's BULK_MAX). */
const BATCH = 200
/** A tag is at most 40 characters, and the segment's name doubles as its tag. */
const TAG_MAX = 40

/**
 * "Save as segment" on the Customers bulk bar (#998). A segment is a saved rule, so a fixed
 * selection becomes one through a tag: every ticked customer gets the tag, and the new segment
 * lists everyone with it.
 */
export default function SaveSelectionSegmentDialog({
  ids,
  onClose,
  onDone,
}: SaveSelectionSegmentDialogProps) {
  // Hooks
  const { bulk } = useCopy(customersContent)
  const router = useRouter()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async () => {
    const tag = name.trim()
    if (!tag || tag.length > TAG_MAX) return
    setSaving(true)
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        await api.customers.tagMany({ ids: ids.slice(i, i + BATCH), tag, action: 'add' })
      }
      const segment = await api.customers.saveSegment({
        name: tag,
        rules: { match: 'all', conditions: [{ field: 'tag', op: 'contains', value: tag }] },
      })
      toast.success(bulk.saveSelection.saved(tag), {
        action: segment
          ? {
              label: bulk.saveSelection.open,
              onClick: () => router.push(routes.customers.segment(segment.id)),
            }
          : undefined,
      })
      setName('')
      onDone()
      onClose()
    } catch {
      toast.error(bulk.saveSelection.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const tooLong = name.trim().length > TAG_MAX
  const canSave = !saving && name.trim().length > 0 && !tooLong

  return (
    <Dialog open={ids.length > 0} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{bulk.saveSelection.title(ids.length)}</DialogTitle>
          <DialogDescription>{bulk.saveSelection.body}</DialogDescription>
        </DialogHeader>
        <Field data-invalid={tooLong || undefined}>
          <FieldLabel htmlFor="save-selection-segment">{bulk.saveSelection.name}</FieldLabel>
          <Input
            id="save-selection-segment"
            size="lg"
            autoFocus
            value={name}
            placeholder={bulk.saveSelection.placeholder}
            aria-invalid={tooLong || undefined}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canSave && handleSave()}
          />
          {tooLong ? <FieldError>{bulk.saveSelection.tooLong}</FieldError> : null}
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {bulk.saveSelection.cancel}
          </Button>
          <Button onClick={handleSave} disabled={!canSave} loading={saving}>
            <Save aria-hidden="true" />
            {bulk.saveSelection.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

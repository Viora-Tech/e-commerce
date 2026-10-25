'use client'

import { Tag, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import { customersContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type TagCustomersDialogProps = {
  ids: string[]
  action: 'add' | 'remove' | null
  onClose: () => void
  onDone: () => void
}

/** Asks for one tag, then adds or removes it across the selection. */
export default function TagCustomersDialog({
  ids,
  action,
  onClose,
  onDone,
}: TagCustomersDialogProps) {
  // Hooks
  const { bulk: copy } = useCopy(customersContent)
  const [tag, setTag] = useState('')
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleApply = async () => {
    if (!action) return
    const value = tag.trim()
    if (!value) return
    setSaving(true)
    try {
      const { updated } = await api.customers.tagMany({ ids, tag: value, action })
      toast.success(updated === 0 ? copy.noChange : copy.tagged(updated))
      setTag('')
      onDone()
      onClose()
    } catch {
      toast.error(copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  return (
    <Dialog open={action !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{copy.tagHeading}</DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="bulk-tag">{copy.tagLabel}</FieldLabel>
          <Input
            id="bulk-tag"
            size="lg"
            autoFocus
            value={tag}
            placeholder={copy.tagPlaceholder}
            onChange={(e) => setTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button onClick={handleApply} disabled={saving || tag.trim().length === 0}>
            {action === 'remove' ? <Trash2 aria-hidden="true" /> : <Tag aria-hidden="true" />}
            {action === 'remove' ? copy.removeTag : copy.addTag}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

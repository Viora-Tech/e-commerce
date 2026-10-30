'use client'

import { Plus } from '@commerce/ui/icons'
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
import { productCollectionsContent } from '@/data/collections'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { CollectionOption } from './product-collections-field'

type NewCollectionDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The collection just created, for the picker to add and select. */
  onCreated: (collection: CollectionOption) => void
}

/** Collection titles are at most 200 characters (`CollectionWriteSchema`). */
const TITLE_MAX = 200

/**
 * "Create collection" from the product page's collection picker (#982): a title is enough for
 * a manual collection, which the picker then selects.
 */
export default function NewCollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: NewCollectionDialogProps) {
  // Hooks
  const { create: copy } = useCopy(productCollectionsContent)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleCreate = async () => {
    const value = title.trim()
    if (!value || value.length > TITLE_MAX) return
    setSaving(true)
    try {
      const { id } = await api.collections.create({ title: value, kind: 'manual' })
      onCreated({ id, title: value })
      setTitle('')
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const canCreate = !saving && title.trim().length > 0 && title.trim().length <= TITLE_MAX

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.body}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="new-collection-title">{copy.name}</FieldLabel>
          <Input
            id="new-collection-title"
            size="lg"
            autoFocus
            value={title}
            maxLength={TITLE_MAX}
            placeholder={copy.placeholder}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canCreate && handleCreate()}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate} loading={saving}>
            <Plus aria-hidden="true" />
            {copy.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

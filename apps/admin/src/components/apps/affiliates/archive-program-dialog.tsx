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
import { Label } from '@commerce/ui/shadcn/label'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useState } from 'react'
import { toast } from 'sonner'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type ArchiveProgramDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  programId: string
  /** Open programs the affiliates can move to (this one left out). */
  targets: { id: string; name: string; isDefault: boolean }[]
  onArchived: () => void
}

/** Archiving asks where the program's affiliates go. */
export default function ArchiveProgramDialog({
  open,
  onOpenChange,
  programId,
  targets,
  onArchived,
}: ArchiveProgramDialogProps) {
  // Hooks
  const { program: copy, failed } = useCopy(affiliatesContent)
  const [moveTo, setMoveTo] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleArchive = async () => {
    const target = moveTo || targets.find((t) => t.isDefault)?.id || targets[0]?.id
    if (!target) return
    setBusy(true)
    try {
      const r = await api.affiliates.programs.archive({ id: programId, moveTo: target })
      toast.success(copy.archivedDone(r.moved))
      onOpenChange(false)
      onArchived()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const selected = moveTo || targets.find((t) => t.isDefault)?.id || targets[0]?.id || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.archiveTitle}</DialogTitle>
          <DialogDescription>{copy.archiveBody}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="aff-move-to">{copy.moveTo}</Label>
          <NativeSelect
            id="aff-move-to"
            value={selected}
            onChange={(e) => setMoveTo(e.target.value)}
          >
            {targets.map((t) => (
              <NativeSelectOption key={t.id} value={t.id}>
                {t.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {copy.cancel}
          </Button>
          <Button onClick={handleArchive} disabled={busy || !selected}>
            {copy.archiveConfirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

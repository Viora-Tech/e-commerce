'use client'

import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { type MenuListItem, menusContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type RenameMenuDialogProps = {
  menu: MenuListItem
  onClose: () => void
}

/**
 * Renames one menu. There is no rename procedure, so the row is read back first
 * and saved whole: the handle and the items travel through untouched.
 */
export default function RenameMenuDialog({ menu, onClose }: RenameMenuDialogProps) {
  // Hooks
  const { rename: copy } = useCopy(menusContent)
  const router = useRouter()
  const [title, setTitle] = useState(menu.title)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleRename = async () => {
    setBusy(true)
    try {
      const current = await api.navigation.get({ id: menu.id })
      if (!current) throw new Error(copy.failed)
      await api.navigation.save({
        id: menu.id,
        title: title.trim(),
        handle: current.handle,
        items: current.items,
      })
      toast.success(copy.saved)
      onClose()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const canSave = !busy && title.trim().length > 0

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`menu-title-${menu.id}`}>{copy.label}</FieldLabel>
            <Input
              id={`menu-title-${menu.id}`}
              size="lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoComplete="off"
              autoFocus
            />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {copy.cancel}
          </Button>
          <Button type="button" disabled={!canSave} onClick={handleRename}>
            {busy ? <Spinner /> : null}
            {busy ? copy.saving : copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

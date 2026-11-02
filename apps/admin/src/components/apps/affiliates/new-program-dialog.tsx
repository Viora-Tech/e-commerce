'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type NewProgramDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Names a new program, made as a copy of the default one, then opens its editor. */
export default function NewProgramDialog({ open, onOpenChange }: NewProgramDialogProps) {
  // Hooks
  const { programs, failed } = useCopy(affiliatesContent)
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const all = await api.affiliates.programs.list()
      const base = all.find((p) => p.isDefault)
      if (!base) throw new Error(failed)
      const made = await api.affiliates.programs.create({ name, rules: base.rules })
      toast.success(programs.newDialog.created)
      onOpenChange(false)
      setName('')
      router.push(routes.apps.page('affiliates', 'programs', made.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const copy = programs.newDialog

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="aff-program-name">{copy.name}</Label>
            <Input
              id="aff-program-name"
              required
              maxLength={80}
              placeholder={copy.namePlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {copy.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

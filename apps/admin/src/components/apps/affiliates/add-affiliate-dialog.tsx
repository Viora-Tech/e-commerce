'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type AddAffiliateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}

/** The merchant adds a creator they already work with; approved at once by default. */
export default function AddAffiliateDialog({
  open,
  onOpenChange,
  onAdded,
}: AddAffiliateDialogProps) {
  // Hooks
  const { addDialog: copy, failed } = useCopy(affiliatesContent)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [social, setSocial] = useState('')
  const [approve, setApprove] = useState(true)
  const [programId, setProgramId] = useState('')
  const [programs, setPrograms] = useState<{ id: string; name: string; isDefault: boolean }[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    api.affiliates.programs.list().then((all) => {
      if (cancelled) return
      setPrograms(all.filter((p) => !p.archivedAt))
    })
    return () => {
      cancelled = true
    }
  }, [open])

  // Event handlers
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.affiliates.add({ name, email, social, approve, programId: programId || undefined })
      toast.success(copy.added)
      setName('')
      setEmail('')
      setSocial('')
      onOpenChange(false)
      onAdded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="aff-name">{copy.name}</Label>
            <Input id="aff-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="aff-email">{copy.email}</Label>
            <Input
              id="aff-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="aff-social">{copy.social}</Label>
            <Input id="aff-social" value={social} onChange={(e) => setSocial(e.target.value)} />
          </div>
          {programs.length > 1 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="aff-add-program">{copy.program}</Label>
              <NativeSelect
                id="aff-add-program"
                value={programId || programs.find((p) => p.isDefault)?.id || ''}
                onChange={(e) => setProgramId(e.target.value)}
              >
                {programs.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          <div className="flex items-center gap-3">
            <Switch id="aff-approve" checked={approve} onCheckedChange={setApprove} />
            <Label htmlFor="aff-approve">{copy.approve}</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {copy.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

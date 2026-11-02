'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { toast } from 'sonner'
import DialogContent from '@/components/layout/dialog-content'
import DialogFooter from '@/components/layout/dialog-footer'
import DialogHeader from '@/components/layout/dialog-header'
import { pixelsContent } from '@/data/pixels'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type TokenDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The `pixel_connection` id. */
  pixelId: string
  onSaved: () => void
}

/** Paste a new Conversions API token: Meta checks it first; it is never shown again. */
export default function TokenDialog({ open, onOpenChange, pixelId, onSaved }: TokenDialogProps) {
  // Hooks
  const { tokenDialog: copy, failed } = useCopy(pixelsContent)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.pixels.setToken({ id: pixelId, token: token.trim() })
      toast.success(copy.saved)
      setToken('')
      onOpenChange(false)
      onSaved()
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
            <Label htmlFor="px-new-token">{copy.token}</Label>
            <Input
              id="px-new-token"
              type="password"
              autoComplete="off"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={busy || token.trim().length === 0}>
              {busy ? copy.saving : copy.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

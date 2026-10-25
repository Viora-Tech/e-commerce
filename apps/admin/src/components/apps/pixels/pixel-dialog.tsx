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
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { toast } from 'sonner'
import { pixelsContent } from '@/data/pixels'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Pixel = Awaited<ReturnType<typeof api.pixels.list>>[number]

type PixelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Null adds a new pixel; a pixel edits its name and test code (the token has its own dialog). */
  pixel: Pixel | null
  onSaved: () => void
}

const PLATFORMS = ['meta', 'tiktok', 'google'] as const

/** Add a Meta pixel (ID, optional Conversions API token, test code), or edit one. */
export default function PixelDialog({ open, onOpenChange, pixel, onSaved }: PixelDialogProps) {
  // Hooks
  const { dialog: copy, card, failed } = useCopy(pixelsContent)
  const [name, setName] = useState(pixel?.name ?? '')
  const [pixelId, setPixelId] = useState(pixel?.pixelId ?? '')
  const [token, setToken] = useState('')
  const [testCode, setTestCode] = useState(pixel?.testEventCode ?? '')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (pixel) {
        await api.pixels.update({ id: pixel.id, name, testEventCode: testCode })
        toast.success(card.saved)
      } else {
        const r = await api.pixels.create({
          platform: 'meta',
          pixelId,
          name,
          testEventCode: testCode,
          ...(token.trim() ? { token: token.trim() } : {}),
        })
        toast.success(copy.added(r.metaName))
        setName('')
        setPixelId('')
        setTestCode('')
      }
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
  const platformLabel = { meta: copy.meta, tiktok: copy.tiktok, google: copy.google }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{pixel ? copy.editTitle : copy.addTitle}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          {pixel ? null : (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-body font-medium">{copy.platform}</legend>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={p === 'meta' ? 'default' : 'outline'}
                    disabled={p !== 'meta'}
                    aria-pressed={p === 'meta'}
                  >
                    {platformLabel[p]}
                    {p === 'meta' ? null : (
                      <span className="text-caption text-muted-foreground">{copy.soon}</span>
                    )}
                  </Button>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="px-name">{copy.name}</Label>
            <Input
              id="px-name"
              value={name}
              placeholder={copy.namePlaceholder}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {pixel ? null : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="px-id">{copy.pixelId}</Label>
              <Input
                id="px-id"
                required
                inputMode="numeric"
                pattern="[0-9]{10,20}"
                value={pixelId}
                placeholder={copy.pixelIdPlaceholder}
                onChange={(e) => setPixelId(e.target.value.trim())}
              />
            </div>
          )}
          {pixel ? null : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="px-token">{copy.token}</Label>
              <Input
                id="px-token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <p className="text-caption text-muted-foreground">{copy.tokenHelp}</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="px-test">{copy.testCode}</Label>
            <Input
              id="px-test"
              value={testCode}
              maxLength={40}
              onChange={(e) => setTestCode(e.target.value.trim())}
            />
            <p className="text-caption text-muted-foreground">{copy.testCodeHelp}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {copy.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? copy.saving : copy.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

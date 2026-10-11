'use client'

import { normaliseHostname, wwwCounterpart } from '@commerce/core/domains'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { domainsContent as copy } from '@/data/domains'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'

type ConnectDomainDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Step one of connecting: the hostname, then on to its DNS records. */
export default function ConnectDomainDialog({ open, onOpenChange }: ConnectDomainDialogProps) {
  // Hooks
  const announceSetup = useSetupNext()
  const router = useRouter()
  const [value, setValue] = useState('')
  const [includeTwin, setIncludeTwin] = useState(true)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setValue('')
    setIncludeTwin(true)
    setTouched(false)
  }, [open])

  // Event handlers
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    const parsed = normaliseHostname(value)
    if (!parsed.ok) return
    setSaving(true)
    try {
      const rows = await api.domains.connect({
        hostname: parsed.hostname,
        includeWwwTwin: includeTwin && wwwCounterpart(parsed.hostname) !== null,
      })
      const first = rows[0]
      toast.success(copy.dialog.connected(parsed.hostname))
      void announceSetup('domain')
      onOpenChange(false)
      if (first) router.push(`/settings/domains/${first.id}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.dialog.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const parsed = normaliseHostname(value)
  const twin = parsed.ok ? wwwCounterpart(parsed.hostname) : null
  const error = touched && !parsed.ok ? parsed.error : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{copy.dialog.title}</DialogTitle>
            <DialogDescription>{copy.dialog.body}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="domain-hostname">{copy.dialog.label}</Label>
            <Input
              id="domain-hostname"
              value={value}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder={copy.dialog.placeholder}
              aria-invalid={error ? true : undefined}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setTouched(value.trim().length > 0)}
            />
            {error ? <p className="text-caption text-destructive">{error}</p> : null}
          </div>
          {twin ? (
            <Label className="flex items-start gap-2 font-normal text-body">
              <Checkbox
                checked={includeTwin}
                onCheckedChange={(checked) => setIncludeTwin(checked === true)}
                className="mt-0.5"
              />
              <span>{copy.dialog.twin(twin)}</span>
            </Label>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {copy.dialog.cancel}
            </DialogClose>
            <Button type="submit" disabled={saving || !value.trim()}>
              {copy.dialog.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import { normaliseHostname, wwwCounterpart } from '@commerce/core/domains'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
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
  const handleSubmit = async () => {
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={copy.dialog.title}
      description={copy.dialog.body}
      submitLabel={copy.dialog.submit}
      cancelLabel={copy.dialog.cancel}
      busy={saving}
      submitDisabled={!value.trim()}
      onSubmit={handleSubmit}
      size="md"
    >
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
    </FormDialog>
  )
}

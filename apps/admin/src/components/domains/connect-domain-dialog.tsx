'use client'

import {
  type DomainTargets,
  isApex,
  normaliseHostname,
  wwwCounterpart,
} from '@commerce/core/domains'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { domainEdgeContent, domainsContent } from '@/data/domains'
import { useCopy } from '@/hooks/use-copy'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'
import BareDomainGuide from './bare-domain-guide'

type ConnectDomainDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** An apex only redirects on this server: its www always comes with it. */
  apexRedirectOnly: boolean
  /** Where records point, so a bare domain sees its A and www CNAME before the next screen. */
  targets: DomainTargets
}

/** Step one of connecting: the hostname, then on to its DNS records. */
export default function ConnectDomainDialog({
  open,
  onOpenChange,
  apexRedirectOnly,
  targets,
}: ConnectDomainDialogProps) {
  // Hooks
  const copy = useCopy(domainsContent)
  const announceSetup = useSetupNext()
  const edge = useCopy(domainEdgeContent)
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
      void announceSetup('domain')
      onOpenChange(false)
      // Stay on the list so it shows the new rows straight away; the toast leads to the records.
      router.refresh()
      toast.success(copy.dialog.connected(parsed.hostname), {
        action: first
          ? {
              label: copy.list.viewRecords,
              onClick: () => router.push(routes.settings.domain(first.id)),
            }
          : undefined,
      })
    } catch (err) {
      toast.error(errorText(err, copy.dialog.failed))
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const parsed = normaliseHostname(value)
  const twin = parsed.ok ? wwwCounterpart(parsed.hostname) : null
  const bare = parsed.ok && isApex(parsed.hostname)
  const twinRequired = apexRedirectOnly && bare
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
    >
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor="domain-hostname">{copy.dialog.label}</FieldLabel>
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
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
      {twin && twinRequired ? (
        <p className="text-body text-muted-foreground">{edge.apexDialog(twin)}</p>
      ) : twin ? (
        <Label className="flex items-start gap-2 font-normal text-body">
          <Checkbox
            checked={includeTwin}
            onCheckedChange={(checked) => setIncludeTwin(checked === true)}
            className="mt-0.5"
          />
          <span>{copy.dialog.twin(twin)}</span>
        </Label>
      ) : null}
      {bare && parsed.ok ? (
        <BareDomainGuide
          apex={parsed.hostname}
          targets={targets}
          apexRedirectOnly={apexRedirectOnly}
        />
      ) : null}
    </FormDialog>
  )
}

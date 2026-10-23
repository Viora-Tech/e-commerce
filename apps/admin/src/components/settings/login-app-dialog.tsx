'use client'

import type { LoginProvider } from '@commerce/core/customer-accounts'
import { Copy, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import FormDialog from '@/components/layout/form-dialog'
import { customerAccountsContent, PROVIDER_COPY } from '@/data/customer-accounts'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type LoginAppDialogProps = {
  provider: LoginProvider | null
  onOpenChange: (open: boolean) => void
  /** The fields each provider's app needs, from the API. */
  fields: Record<LoginProvider, { key: string; secret?: boolean; multiline?: boolean }[]>
  /** The merchant's saved app for this provider, secrets masked. */
  saved: Record<string, string> | undefined
  /** The address to add in the provider's console. */
  redirectUrl: string
  onSaved: () => void
}

/**
 * Guided setup for the merchant's own sign-in app, in a centred dialog: short steps, the one
 * address to paste into the provider's console, then the few values to copy back.
 */
export default function LoginAppDialog({
  provider,
  onOpenChange,
  fields,
  saved,
  redirectUrl,
  onSaved,
}: LoginAppDialogProps) {
  // Hooks
  const content = useCopy(customerAccountsContent)
  const providers = useCopy(PROVIDER_COPY)
  const [values, setValues] = useState<Record<string, string>>(saved ?? {})
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    await navigator.clipboard.writeText(redirectUrl)
    setCopied(true)
  }

  const handleSave = async () => {
    if (!provider) return
    setBusy(true)
    try {
      await api.customerAccounts.saveApp({ provider, fields: values })
      toast.success(content.sheet.saved)
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : content.sheet.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!provider) return
    setBusy(true)
    try {
      await api.customerAccounts.removeApp({ provider })
      toast.success(content.sheet.removed)
      onSaved()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (!provider) return null

  // Render logic
  const text = providers[provider]
  const complete = fields[provider].every((f) => (values[f.key] ?? '').trim() !== '')

  return (
    <FormDialog
      open
      onOpenChange={onOpenChange}
      title={text.setupTitle}
      description={text.hint}
      submitLabel={busy ? content.sheet.saving : content.sheet.save}
      busy={busy}
      submitDisabled={!complete}
      onSubmit={handleSave}
      size="lg"
      secondaryAction={
        saved ? (
          <Button type="button" variant="ghost" onClick={handleRemove} disabled={busy}>
            <Trash2 aria-hidden="true" />
            {content.sheet.remove}
          </Button>
        ) : null
      }
    >
      <div className="-mx-4 flex max-h-[60dvh] flex-col gap-5 overflow-y-auto px-4">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-body">
          {text.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <Field>
          <FieldLabel htmlFor="login-redirect">{content.sheet.redirectLabel}</FieldLabel>
          <div className="flex gap-2">
            <Input id="login-redirect" readOnly value={redirectUrl} className="font-mono" />
            <Button type="button" variant="outline" onClick={handleCopy}>
              <Copy aria-hidden="true" />
              {copied ? content.sheet.copied : content.sheet.copy}
            </Button>
          </div>
        </Field>
        <FieldGroup>
          {fields[provider].map((f) => {
            const label = text.fields[f.key]
            const id = `login-app-${f.key}`
            const value = values[f.key] ?? ''
            const kept = f.secret && value.startsWith('••••')
            return (
              <Field key={f.key}>
                <FieldLabel htmlFor={id}>{label?.label ?? f.key}</FieldLabel>
                {f.multiline ? (
                  <Textarea
                    id={id}
                    rows={5}
                    className="font-mono"
                    value={value}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                ) : (
                  <Input
                    id={id}
                    type={f.secret && !kept ? 'password' : 'text'}
                    autoComplete="off"
                    value={value}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                )}
                {kept ? (
                  <FieldDescription>{content.sheet.secretKept}</FieldDescription>
                ) : label?.help ? (
                  <FieldDescription>{label.help}</FieldDescription>
                ) : null}
              </Field>
            )
          })}
        </FieldGroup>
      </div>
    </FormDialog>
  )
}

'use client'

import type { LoginProvider } from '@commerce/core/customer-accounts'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@commerce/ui/shadcn/sheet'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import { customerAccountsContent, PROVIDER_COPY } from '@/data/customer-accounts'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type LoginAppSheetProps = {
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
 * Guided setup for the merchant's own sign-in app: short steps, the one address to paste
 * into the provider's console, then the few values to copy back.
 */
export default function LoginAppSheet({
  provider,
  onOpenChange,
  fields,
  saved,
  redirectUrl,
  onSaved,
}: LoginAppSheetProps) {
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

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{text.setupTitle}</SheetTitle>
          <SheetDescription>{text.hint}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-body">
            {text.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <Field>
            <FieldLabel htmlFor="login-redirect">{content.sheet.redirectLabel}</FieldLabel>
            <div className="flex gap-2">
              <Input id="login-redirect" readOnly value={redirectUrl} className="font-mono" />
              <Button variant="outline" onClick={handleCopy}>
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
        <SheetFooter className="flex-row justify-between gap-2">
          {saved ? (
            <Button variant="ghost" onClick={handleRemove} disabled={busy}>
              {content.sheet.remove}
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={handleSave} disabled={busy}>
            {busy ? content.sheet.saving : content.sheet.save}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

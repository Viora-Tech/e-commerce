'use client'

import { type StoreGeneral, StoreGeneralSchema } from '@commerce/core/store-settings'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { settingsContent } from '@/data/settings'
import { api } from '@/lib/api-client'

type Loaded = NonNullable<Awaited<ReturnType<typeof api.store.getGeneral>>>
type Errors = Partial<Record<string, string>>

const copy = settingsContent.general
const timezoneItems = Object.fromEntries(copy.timezones.map((t) => [t.value, t.label]))

/** Zod issues keyed by dotted path, e.g. `address.pincode`. */
function validate(form: StoreGeneral): Errors {
  const r = StoreGeneralSchema.safeParse(form)
  if (r.success) return {}
  return Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]))
}

type TextFieldProps = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string | undefined
  help?: string | undefined
  type?: 'text' | 'email' | 'tel'
  autoComplete?: string
}

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  help,
  type,
  autoComplete,
}: TextFieldProps) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        size="lg"
        id={id}
        type={type ?? 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete ?? 'off'}
      />
      {error ? (
        <FieldError>{error}</FieldError>
      ) : help ? (
        <FieldDescription>{help}</FieldDescription>
      ) : null}
    </Field>
  )
}

function LoadingCards() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="gap-4 p-6">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </Card>
      ))}
    </>
  )
}

/** Settings › General: store name, contact, address, GSTIN, timezone. Currency is read-only. */
export default function GeneralSettings() {
  // Hooks
  const [form, setForm] = useState<Loaded | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempted, setAttempted] = useState(false)
  useEffect(() => {
    api.store.getGeneral().then((g) => {
      if (!g) return
      setForm(g)
      setSaved(JSON.stringify(g))
    })
  }, [])

  // Helpers
  const patch = (p: Partial<Loaded>) => setForm((f) => (f ? { ...f, ...p } : f))
  const patchAddress = (p: Partial<Loaded['address']>) =>
    setForm((f) => (f ? { ...f, address: { ...f.address, ...p } } : f))

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    setAttempted(true)
    if (Object.keys(validate(form)).length) return
    setBusy(true)
    try {
      const { currency: _c, ...input } = form
      const result = await api.store.updateGeneral(input)
      if (!result) throw new Error(copy.failed)
      setForm(result)
      setSaved(JSON.stringify(result))
      setAttempted(false)
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (saved) setForm(JSON.parse(saved) as Loaded)
    setAttempted(false)
  }

  // Render logic
  const dirty = form !== null && saved !== null && JSON.stringify(form) !== saved
  const errors = form && attempted ? validate(form) : {}

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader title={copy.title} subtitle={copy.intro} />
      {!form ? (
        <LoadingCards />
      ) : (
        <>
          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.details.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <TextField
                  id="store-name"
                  label={copy.details.name}
                  value={form.name}
                  onChange={(name) => patch({ name })}
                  error={errors.name}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    id="store-email"
                    type="email"
                    label={copy.details.email}
                    value={form.contactEmail}
                    onChange={(contactEmail) => patch({ contactEmail })}
                    error={errors.contactEmail}
                    help={copy.details.emailHelp}
                    autoComplete="email"
                  />
                  <TextField
                    id="store-phone"
                    type="tel"
                    label={copy.details.phone}
                    value={form.contactPhone}
                    onChange={(contactPhone) => patch({ contactPhone })}
                    error={errors.contactPhone}
                    autoComplete="tel"
                  />
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.address.heading}</CardTitle>
              <CardDescription>{copy.address.help}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <TextField
                  id="addr-line1"
                  label={copy.address.line1}
                  value={form.address.line1}
                  onChange={(line1) => patchAddress({ line1 })}
                  autoComplete="address-line1"
                />
                <TextField
                  id="addr-line2"
                  label={copy.address.line2}
                  value={form.address.line2}
                  onChange={(line2) => patchAddress({ line2 })}
                  autoComplete="address-line2"
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <TextField
                    id="addr-city"
                    label={copy.address.city}
                    value={form.address.city}
                    onChange={(city) => patchAddress({ city })}
                  />
                  <TextField
                    id="addr-state"
                    label={copy.address.state}
                    value={form.address.state}
                    onChange={(state) => patchAddress({ state })}
                  />
                  <TextField
                    id="addr-pincode"
                    label={copy.address.pincode}
                    value={form.address.pincode}
                    onChange={(pincode) => patchAddress({ pincode })}
                    error={errors['address.pincode']}
                    autoComplete="postal-code"
                  />
                </div>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.locale.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="store-currency">{copy.locale.currency}</FieldLabel>
                    <Input size="lg" id="store-currency" value={form.currency} readOnly disabled />
                    <FieldDescription>{copy.locale.currencyHelp}</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="store-timezone">{copy.locale.timezone}</FieldLabel>
                    <Select
                      items={timezoneItems}
                      value={form.timezone}
                      onValueChange={(timezone) => timezone && patch({ timezone })}
                    >
                      <SelectTrigger size="lg" id="store-timezone" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {copy.timezones.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <TextField
                  id="store-gstin"
                  label={copy.locale.gstin}
                  value={form.gstin}
                  onChange={(gstin) => patch({ gstin: gstin.toUpperCase() })}
                  error={errors.gstin}
                  help={copy.locale.gstinHelp}
                />
                <TextField
                  id="store-gst-rate"
                  label={copy.locale.gstRate}
                  value={String(form.gstRatePercent)}
                  onChange={(rate) => patch({ gstRatePercent: Number(rate) || 0 })}
                  error={errors.gstRatePercent}
                  help={copy.locale.gstRateHelp}
                />
              </FieldGroup>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

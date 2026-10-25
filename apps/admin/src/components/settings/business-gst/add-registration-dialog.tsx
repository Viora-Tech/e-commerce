'use client'

import type { Business, GstRegistrationErrorCode } from '@commerce/core'
import { RegistrationInputSchema } from '@commerce/core/gst-registrations'
import { gstinStateOf } from '@commerce/core/tax-settings'
import { CheckIcon, MapPinLineIcon } from '@commerce/ui/icons'
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
import { FieldGroup, FieldLegend, FieldSet } from '@commerce/ui/shadcn/field'
import { Label } from '@commerce/ui/shadcn/label'
import { useRouter } from 'next/navigation'
import { type FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import GeneralTextField from '@/components/settings/general-text-field'
import { businessGstContent } from '@/data/business-gst'
import { useCopy } from '@/hooks/use-copy'
import { useSetupNext } from '@/hooks/use-setup-next'
import { api } from '@/lib/api-client'

type AddRegistrationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  businesses: Business[]
  /** The PAN did not match: offer to add the GSTIN's business instead. */
  onAnotherBusiness: () => void
}

const EMPTY = {
  gstin: '',
  businessId: '',
  legalName: '',
  tradeName: '',
  composition: false,
  invoicePrefix: '',
  line1: '',
  line2: '',
  city: '',
  pincode: '',
  makeDefault: false,
}

/** The refusal code the server put on an error (`data.code`), if any. */
function refusalCode(err: unknown): GstRegistrationErrorCode | null {
  if (typeof err !== 'object' || err === null || !('data' in err)) return null
  const data = (err as { data?: { code?: unknown } }).data
  return typeof data?.code === 'string' ? (data.code as GstRegistrationErrorCode) : null
}

/** "Add GST number": the GSTIN (state read from it), which business, and optional details. */
export default function AddRegistrationDialog({
  open,
  onOpenChange,
  businesses,
  onAnotherBusiness,
}: AddRegistrationDialogProps) {
  // Hooks
  const announceSetup = useSetupNext()
  const { dialog: copy } = useCopy(businessGstContent)
  const router = useRouter()
  const [form, setForm] = useState(EMPTY)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [refused, setRefused] = useState<{ code: string | null; message: string } | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(EMPTY)
    setTouched(false)
    setRefused(null)
  }, [open])

  // Helpers
  const patch = (p: Partial<typeof EMPTY>) => {
    setForm((f) => ({ ...f, ...p }))
    setRefused(null)
  }

  const input = () => ({
    gstin: form.gstin,
    ...(form.businessId ? { businessId: form.businessId } : {}),
    legalName: form.legalName,
    tradeName: form.tradeName,
    registrationType: form.composition ? ('composition' as const) : ('regular' as const),
    invoicePrefix: form.invoicePrefix,
    legalAddress: { line1: form.line1, line2: form.line2, city: form.city, pincode: form.pincode },
    makeDefault: form.makeDefault,
  })

  const errorAt = (key: string) => {
    if (!touched) return undefined
    const parsed = RegistrationInputSchema.safeParse(input())
    return parsed.success
      ? undefined
      : parsed.error.issues.find((i) => i.path.join('.') === key)?.message
  }

  // Event handlers
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!RegistrationInputSchema.safeParse(input()).success) return
    setSaving(true)
    try {
      await api.businessGst.addRegistration(input())
      toast.success(copy.added)
      void announceSetup('taxes')
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      setRefused({
        code: refusalCode(err),
        message: err instanceof Error ? err.message : copy.failed,
      })
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const state = gstinStateOf(form.gstin)
  const businessOptions = businesses.map((b) => ({
    value: b.id,
    label: `${b.legalName} · ${b.pan}`,
  }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.body}</DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <div className="flex flex-col gap-2">
              <GeneralTextField
                id="gst-reg-gstin"
                label={copy.gstin}
                value={form.gstin}
                onChange={(gstin) => patch({ gstin: gstin.toUpperCase().replace(/\s/g, '') })}
                error={errorAt('gstin')}
              />
              {state ? (
                <p
                  aria-live="polite"
                  className="flex items-center gap-1.5 text-caption font-medium text-foreground"
                >
                  <MapPinLineIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                  {copy.registeredIn(state.name)}
                </p>
              ) : null}
            </div>
            {businesses.length > 1 ? (
              <ChoiceField
                id="gst-reg-business"
                label={copy.business}
                value={form.businessId || (businesses[0]?.id ?? '')}
                options={businessOptions}
                onChange={(businessId) => patch({ businessId })}
              />
            ) : null}
            {businesses.length === 0 ? (
              <GeneralTextField
                id="gst-reg-legal-name"
                label={copy.legalName}
                value={form.legalName}
                onChange={(legalName) => patch({ legalName })}
                help={copy.legalNameHelp}
                autoComplete="organization"
              />
            ) : null}
            <GeneralTextField
              id="gst-reg-trade-name"
              label={copy.tradeName}
              value={form.tradeName}
              onChange={(tradeName) => patch({ tradeName })}
              help={copy.tradeNameHelp}
            />
            <Label className="flex items-start gap-2 font-normal text-body">
              <Checkbox
                checked={form.composition}
                onCheckedChange={(checked) => patch({ composition: checked === true })}
                className="mt-0.5"
              />
              <span>{copy.composition}</span>
            </Label>
            <GeneralTextField
              id="gst-reg-prefix"
              label={copy.prefix}
              value={form.invoicePrefix}
              onChange={(invoicePrefix) => patch({ invoicePrefix: invoicePrefix.toUpperCase() })}
              error={errorAt('invoicePrefix')}
              help={copy.prefixHelp}
            />
            <FieldSet>
              <FieldLegend variant="label">{copy.addressHeading}</FieldLegend>
              <GeneralTextField
                id="gst-reg-line1"
                label={copy.line1}
                value={form.line1}
                onChange={(line1) => patch({ line1 })}
                autoComplete="address-line1"
              />
              <GeneralTextField
                id="gst-reg-line2"
                label={copy.line2}
                value={form.line2}
                onChange={(line2) => patch({ line2 })}
                autoComplete="address-line2"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <GeneralTextField
                  id="gst-reg-city"
                  label={copy.city}
                  value={form.city}
                  onChange={(city) => patch({ city })}
                  autoComplete="address-level2"
                />
                <GeneralTextField
                  id="gst-reg-pincode"
                  label={copy.pincode}
                  value={form.pincode}
                  onChange={(pincode) => patch({ pincode })}
                  error={errorAt('legalAddress.pincode')}
                  autoComplete="postal-code"
                  inputMode="numeric"
                />
              </div>
            </FieldSet>
            {businesses.length > 0 ? (
              <Label className="flex items-start gap-2 font-normal text-body">
                <Checkbox
                  checked={form.makeDefault}
                  onCheckedChange={(checked) => patch({ makeDefault: checked === true })}
                  className="mt-0.5"
                />
                <span>{copy.makeDefault}</span>
              </Label>
            ) : null}
          </FieldGroup>
          {refused ? (
            <div
              role="alert"
              className="flex flex-col items-start gap-2 text-body text-destructive"
            >
              <p>{refused.message}</p>
              {refused.code === 'PAN_MISMATCH' ? (
                <Button type="button" variant="outline" size="sm" onClick={onAnotherBusiness}>
                  {copy.anotherBusiness}
                </Button>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" />}>
              {copy.cancel}
            </DialogClose>
            <Button type="submit" disabled={saving || !form.gstin}>
              <CheckIcon aria-hidden="true" />
              {copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

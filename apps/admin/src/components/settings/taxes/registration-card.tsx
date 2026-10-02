'use client'

import { gstinStateOf } from '@commerce/core/tax-settings'
import { MapPinLineIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { FieldDescription, FieldGroup, FieldLegend, FieldSet } from '@commerce/ui/shadcn/field'
import Link from 'next/link'
import GeneralTextField from '@/components/settings/general-text-field'
import { taxesContent } from '@/data/taxes'
import type { TaxesErrors, TaxesFormState } from './taxes-form'

type RegistrationCardProps = {
  form: TaxesFormState
  errors: TaxesErrors
  onPatch: (p: Partial<TaxesFormState>) => void
  /** The GST numbers tab owns the GSTIN: show it, do not edit it here. */
  managed: boolean
}

const copy = taxesContent.registration

/** GSTIN (with the state its first two digits name), legal name and registered address. */
export default function RegistrationCard({
  form,
  errors,
  onPatch,
  managed,
}: RegistrationCardProps) {
  // Helpers
  const patchAddress = (p: Partial<TaxesFormState['address']>) =>
    onPatch({ address: { ...form.address, ...p } })

  // Render logic
  const state = gstinStateOf(form.gstin)

  return (
    <Card size="form" id="registration" className="scroll-mt-6">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
        <CardDescription>{copy.help}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="flex flex-col gap-2">
            {managed ? (
              <div className="flex flex-col items-start gap-1">
                <span className="text-body-strong text-ink-strong">{copy.gstin}</span>
                <span className="font-mono text-body">{form.gstin}</span>
                <span className="text-caption text-muted-foreground">{copy.managed}</span>
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href="/settings/taxes" />}
                  nativeButton={false}
                >
                  {copy.manage}
                </Button>
              </div>
            ) : (
              <GeneralTextField
                id="tax-gstin"
                label={copy.gstin}
                value={form.gstin}
                onChange={(gstin) => onPatch({ gstin: gstin.toUpperCase().replace(/\s/g, '') })}
                error={errors.gstin}
                help={copy.gstinHelp}
              />
            )}
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
          <GeneralTextField
            id="tax-legal-name"
            label={copy.legalName}
            value={form.legalName}
            onChange={(legalName) => onPatch({ legalName })}
            error={errors.legalName}
            help={copy.legalNameHelp}
            autoComplete="organization"
          />
          <FieldSet>
            <FieldLegend variant="label">{copy.addressHeading}</FieldLegend>
            <FieldDescription>{copy.addressHelp}</FieldDescription>
            <GeneralTextField
              id="tax-addr-line1"
              label={copy.line1}
              value={form.address.line1}
              onChange={(line1) => patchAddress({ line1 })}
              autoComplete="address-line1"
            />
            <GeneralTextField
              id="tax-addr-line2"
              label={copy.line2}
              value={form.address.line2}
              onChange={(line2) => patchAddress({ line2 })}
              autoComplete="address-line2"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <GeneralTextField
                id="tax-addr-city"
                label={copy.city}
                value={form.address.city}
                onChange={(city) => patchAddress({ city })}
                autoComplete="address-level2"
              />
              <GeneralTextField
                id="tax-addr-pincode"
                label={copy.pincode}
                value={form.address.pincode}
                onChange={(pincode) => patchAddress({ pincode })}
                error={errors['address.pincode']}
                autoComplete="postal-code"
                inputMode="numeric"
              />
            </div>
          </FieldSet>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

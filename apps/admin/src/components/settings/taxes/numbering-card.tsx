'use client'

import { financialYear, formatSeriesNumber } from '@commerce/invoices'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { FieldGroup } from '@commerce/ui/shadcn/field'
import Link from 'next/link'
import GeneralTextField from '@/components/settings/general-text-field'
import SwitchField from '@/components/themes/switch-field'
import { taxesContent } from '@/data/taxes'
import type { TaxesErrors, TaxesFormState } from './taxes-form'

type Numbering = TaxesFormState['numbering']

type NumberingCardProps = {
  numbering: Numbering
  /** Numbers below this are already used this financial year. */
  lowest: number
  pad: number
  installed: boolean
  errors: TaxesErrors
  onChange: (numbering: Numbering) => void
}

const copy = taxesContent.numbering

/**
 * Prefix, next number and the yearly restart of the domestic tax-invoice
 * series the GST invoices app numbers from, with a live preview.
 */
export default function NumberingCard({
  numbering,
  lowest,
  pad,
  installed,
  errors,
  onChange,
}: NumberingCardProps) {
  // Helpers
  const patch = (p: Partial<Numbering>) => onChange({ ...numbering, ...p })

  // Render logic
  const next = Number(numbering.nextNumber)
  const sample = formatSeriesNumber(
    { pattern: numbering.prefix.toUpperCase(), pad },
    financialYear(new Date()),
    Number.isInteger(next) && next > 0 ? next : lowest,
  )

  return (
    <Card size="form" id="invoice-numbers" className="scroll-mt-6">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
        <CardDescription>{copy.help}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {installed ? null : (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-3 sm:flex-row sm:items-center">
              <p className="flex-1 text-caption text-foreground">{copy.appMissing}</p>
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/apps" />}
                nativeButton={false}
              >
                {copy.goToApps}
              </Button>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <GeneralTextField
              id="tax-invoice-prefix"
              label={copy.prefix}
              value={numbering.prefix}
              onChange={(prefix) => patch({ prefix: prefix.toUpperCase().replace(/\s/g, '') })}
              error={errors['numbering.prefix']}
              help={copy.prefixHelp}
            />
            <GeneralTextField
              id="tax-invoice-next"
              label={copy.next}
              value={String(numbering.nextNumber)}
              onChange={(v) => patch({ nextNumber: Number(v.replace(/\D/g, '')) || 0 })}
              error={errors['numbering.nextNumber']}
              help={copy.nextHelp(lowest)}
              inputMode="numeric"
            />
          </div>
          <SwitchField
            label={copy.reset}
            help={copy.resetHelp}
            checked={numbering.resetEachYear}
            onChange={(resetEachYear) => patch({ resetEachYear })}
          />
          <p aria-live="polite" className="text-body font-medium text-foreground">
            {copy.preview(sample)}
          </p>
          {installed ? (
            <p className="text-caption text-muted-foreground">
              {copy.moreSeries}{' '}
              <Link href="/apps/gst-invoices/settings" className="font-medium underline">
                {copy.openApp}
              </Link>
            </p>
          ) : null}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

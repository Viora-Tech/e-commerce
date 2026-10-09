'use client'

import { financialYear, formatSeriesNumber } from '@commerce/invoices'
import { Button } from '@commerce/ui/shadcn/button'
import { FieldGroup } from '@commerce/ui/shadcn/field'
import Link from 'next/link'
import SettingsCard from '@/components/settings/settings-card'
import SettingsTextRow from '@/components/settings/settings-text-row'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { taxesContent } from '@/data/taxes'
import { routes } from '@/lib/routes'
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
    <SettingsCard
      id="invoice-numbers"
      className="scroll-mt-6"
      title={copy.heading}
      description={copy.help}
    >
      <FieldGroup>
        {installed ? null : (
          <div className="mb-5 flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-3 sm:flex-row sm:items-center">
            <p className="flex-1 text-caption text-foreground">{copy.appMissing}</p>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={routes.apps.list()} />}
              nativeButton={false}
            >
              {copy.goToApps}
            </Button>
          </div>
        )}
        <SettingsTextRow
          id="tax-invoice-prefix"
          label={copy.prefix}
          description={copy.prefixHelp}
          value={numbering.prefix}
          onChange={(prefix) => patch({ prefix: prefix.toUpperCase().replace(/\s/g, '') })}
          error={errors['numbering.prefix']}
        />
        <SettingsTextRow
          id="tax-invoice-next"
          label={copy.next}
          description={copy.nextHelp(lowest)}
          value={String(numbering.nextNumber)}
          onChange={(v) => patch({ nextNumber: Number(v.replace(/\D/g, '')) || 0 })}
          error={errors['numbering.nextNumber']}
          inputMode="numeric"
        />
        <SettingsToggleRow
          id="tax-reset-year"
          label={copy.reset}
          description={copy.resetHelp}
          checked={numbering.resetEachYear}
          onChange={(resetEachYear) => patch({ resetEachYear })}
        />
        <p aria-live="polite" className="pt-5 text-body font-semibold text-ink-strong">
          {copy.preview(sample)}
        </p>
        {installed ? (
          <p className="pt-2 text-caption text-muted-foreground">
            {copy.moreSeries}{' '}
            <Link href={routes.apps.settings('gst-invoices')} className="font-medium underline">
              {copy.openApp}
            </Link>
          </p>
        ) : null}
      </FieldGroup>
    </SettingsCard>
  )
}

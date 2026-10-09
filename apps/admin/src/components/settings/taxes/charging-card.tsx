'use client'

import { GST_RATE_OPTIONS } from '@commerce/core/tax-settings'
import { InfoIcon } from '@commerce/ui/icons'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import SettingsTextRow from '@/components/settings/settings-text-row'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { taxesContent } from '@/data/taxes'
import type { TaxesErrors, TaxesFormState } from './taxes-form'

type ChargingCardProps = {
  form: TaxesFormState
  errors: TaxesErrors
  onPatch: (p: Partial<TaxesFormState>) => void
}

type NoteProps = { children: string }

const copy = taxesContent.charging

/** Rates on offer, plus the saved one if it is an older slab no longer listed. */
function rateOptions(current: number): number[] {
  const list: number[] = [...GST_RATE_OPTIONS]
  return list.includes(current) ? list : [...list, current].sort((a, b) => a - b)
}

/**
 * Composition scheme first (it switches GST off entirely), then whether
 * prices include GST, the default rate and the default HSN code.
 */
export default function ChargingCard({ form, errors, onPatch }: ChargingCardProps) {
  // Render logic
  const rates = rateOptions(form.gstRatePercent)
  const rateItems = Object.fromEntries(rates.map((r) => [String(r), copy.rateLabel(r)]))

  return (
    <SettingsCard
      id="charging"
      className="scroll-mt-6"
      title={copy.heading}
      description={copy.help}
    >
      <SettingsToggleRow
        id="tax-composition"
        label={copy.composition}
        description={copy.compositionHelp}
        checked={form.composition}
        onChange={(composition) => onPatch({ composition })}
      />
      {form.composition ? (
        <Note>{copy.compositionOn}</Note>
      ) : (
        <>
          <SettingsToggleRow
            id="tax-prices-include"
            label={copy.pricesInclude}
            description={copy.pricesIncludeHelp}
            checked={form.pricesIncludeGst}
            onChange={(pricesIncludeGst) => onPatch({ pricesIncludeGst })}
          />
          {form.pricesIncludeGst ? null : <Note>{copy.pricesExcludeNote}</Note>}
        </>
      )}
      <SettingsRow
        label={copy.rate}
        description={copy.rateHelp}
        htmlFor="tax-rate"
        error={errors.gstRatePercent}
      >
        <Select
          items={rateItems}
          value={String(form.gstRatePercent)}
          onValueChange={(v) => v !== null && onPatch({ gstRatePercent: Number(v) })}
        >
          <SelectTrigger size="lg" id="tax-rate" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rates.map((r) => (
              <SelectItem key={r} value={String(r)}>
                {copy.rateLabel(r)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>
      <SettingsTextRow
        id="tax-hsn"
        label={copy.hsn}
        description={copy.hsnHelp}
        value={form.defaultHsn}
        onChange={(defaultHsn) => onPatch({ defaultHsn: defaultHsn.replace(/\D/g, '') })}
        error={errors.defaultHsn}
        inputMode="numeric"
      />
      <p className="pt-5 text-caption text-muted-foreground">{copy.perProduct}</p>
    </SettingsCard>
  )
}

function Note({ children }: NoteProps) {
  return (
    <p className="flex gap-2 rounded-lg border border-border bg-muted/50 p-3 text-caption text-foreground">
      <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      {children}
    </p>
  )
}

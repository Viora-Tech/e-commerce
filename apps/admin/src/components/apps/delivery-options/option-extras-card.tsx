'use client'

import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import SettingsCard from '@/components/settings/settings-card'
import { deliveryOptionSectionsContent } from '@/data/delivery-option-sections'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import CodFeeField from './cod-fee-field'
import type { OptionForm as Form } from './option-form-state'
import RupeeField from './rupee-field'

type OptionExtrasCardProps = {
  form: Form
  onChange: (next: Form) => void
}

/**
 * "Insurance and cash on delivery" on an option's page (owner, 21 Nov 2026): parcel insurance
 * at checkout (and from which order value), then cash on delivery and how its fee shows.
 */
export default function OptionExtrasCard({ form, onChange }: OptionExtrasCardProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)
  const sections = useCopy(deliveryOptionSectionsContent)

  // Helpers
  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) =>
      onChange({ ...form, [key]: value })

  // Render logic
  const i = copy.option.insurance
  const c = copy.option.cod
  const s = sections.sections.extras
  const express = form.speed === 'express'

  return (
    <SettingsCard title={s.title} description={s.help} bodyClassName="gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ChoiceField
          id="opt-insurance"
          label={i.default}
          value={form.insurance}
          options={[
            { value: 'on', label: i.on },
            { value: 'off', label: i.off },
          ]}
          onChange={(v) => set('insurance')(v === 'on' ? 'on' : 'off')}
        />
        {form.insurance === 'on' ? (
          <RupeeField
            id="opt-insurance-above"
            label={i.onlyAbove}
            help={i.onlyAboveHelp}
            value={form.insuranceAbove}
            onChange={set('insuranceAbove')}
          />
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 border-t border-hairline pt-4 sm:grid-cols-2">
        {express ? (
          <p className="text-body text-muted-foreground">{c.expressNote}</p>
        ) : (
          <ChoiceField
            id="opt-cod"
            label={c.mode}
            value={form.cod}
            options={[
              { value: 'allowed', label: c.allowed },
              { value: 'prepaid_only', label: c.prepaidOnly },
            ]}
            onChange={(v) => set('cod')(v === 'prepaid_only' ? 'prepaid_only' : 'allowed')}
          />
        )}
        {express || form.cod === 'prepaid_only' ? null : (
          <CodFeeField id="opt-cod-fee" value={form.codFee} onChange={set('codFee')} />
        )}
      </div>
    </SettingsCard>
  )
}

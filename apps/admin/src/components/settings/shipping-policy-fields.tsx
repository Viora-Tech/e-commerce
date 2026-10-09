'use client'

import type { ShippingPolicySettings } from '@commerce/core'
import { ChevronDown, ChevronRight } from '@commerce/ui/icons'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { shippingSettingsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import SettingsCard from './settings-card'
import SettingsRow from './settings-row'
import SettingsTextRow from './settings-text-row'
import SettingsToggleRow from './settings-toggle-row'

type ShippingPolicyFieldsProps = {
  value: ShippingPolicySettings
  onChange: (next: ShippingPolicySettings) => void
}

type Warehouse = ShippingPolicySettings['warehouse']

const toDays = (selected: number[]) =>
  [...new Set(selected)].filter((n) => n >= 1 && n <= 7).sort((a, b) => a - b)

const clampDays = (raw: string, fallback: number) => {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 1 && n <= 30 ? n : fallback
}

const clampRupees = (raw: string, fallback: number) => {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

type WeekdayPickerProps = {
  name: string
  legend: string
  description?: string | undefined
  selected: number[]
  onChange: (days: number[]) => void
}

/** Seven checkboxes in a row. */
function WeekdayPicker({ name, legend, description, selected, onChange }: WeekdayPickerProps) {
  // Hooks
  const copy = useCopy(shippingSettingsContent)

  // Helpers
  const toggle = (day: number, on: boolean) =>
    onChange(toDays(on ? [...selected, day] : selected.filter((d) => d !== day)))

  return (
    <SettingsRow label={legend} description={description}>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {copy.weekdays.map((d) => {
          const id = `${name}-${d.value}`
          return (
            <Field key={d.value} orientation="horizontal" className="w-auto">
              <Checkbox
                id={id}
                checked={selected.includes(d.value)}
                onCheckedChange={(v) => toggle(d.value, Boolean(v))}
              />
              <FieldLabel htmlFor={id} className="font-normal">
                {d.label}
              </FieldLabel>
            </Field>
          )
        })}
      </div>
    </SettingsRow>
  )
}

type TextFieldProps = {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  help?: string | undefined
  type?: 'text' | 'number'
}

function TextField({ id, label, value, onChange, help, type = 'text' }: TextFieldProps) {
  return (
    <SettingsTextRow
      id={id}
      label={label}
      description={help}
      value={value}
      onChange={onChange}
      type={type}
    />
  )
}

/** "When orders go out" on Settings › Shipping: the everyday dispatch fields, the rest under More options. */
export default function ShippingPolicyFields({ value, onChange }: ShippingPolicyFieldsProps) {
  // Hooks
  const { policy: p } = useCopy(shippingSettingsContent)

  // Helpers
  const set = <K extends keyof ShippingPolicySettings>(k: K, v: ShippingPolicySettings[K]) =>
    onChange({ ...value, [k]: v })
  const setWarehouse = (k: keyof Warehouse, v: string) =>
    onChange({ ...value, warehouse: { ...value.warehouse, [k]: v } })

  return (
    <SettingsCard title={p.heading} description={p.intro}>
      <TextField
        id="policy-origin"
        label={p.originPincode}
        value={value.originPincode}
        onChange={(v) => set('originPincode', v)}
      />
      <TextField
        id="policy-cutoff"
        label={p.cutoff}
        value={value.cutoff}
        onChange={(v) => set('cutoff', v)}
        help={p.cutoffHelp}
      />
      <WeekdayPicker
        name="working"
        legend={p.workingDays}
        selected={value.workingDays}
        onChange={(d) => set('workingDays', d)}
      />
      <SettingsRow label={p.holidays} description={p.holidaysHelp} htmlFor="policy-holidays">
        <Textarea
          size="lg"
          id="policy-holidays"
          rows={3}
          value={value.holidays.join('\n')}
          onChange={(e) =>
            set(
              'holidays',
              e.target.value
                .split('\n')
                .map((h) => h.trim())
                .filter(Boolean),
            )
          }
        />
      </SettingsRow>
      <SettingsToggleRow
        id="policy-cod"
        label={p.codAllowed}
        checked={value.codAllowed}
        onChange={(codAllowed) => set('codAllowed', codAllowed)}
      />
      <Collapsible>
        <CollapsibleTrigger className="group flex w-fit items-center gap-1.5 text-body font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ChevronDown aria-hidden="true" className="hidden size-4 group-data-[panel-open]:block" />
          <ChevronRight aria-hidden="true" className="size-4 group-data-[panel-open]:hidden" />
          {p.more}
          <span className="font-normal text-muted-foreground">· {p.moreHelp}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-4 flex flex-col">
            <WeekdayPicker
              name="delivery"
              legend={p.deliveryDays}
              description={p.deliveryDaysHelp}
              selected={value.deliveryDays}
              onChange={(d) => set('deliveryDays', d)}
            />
            <TextField
              id="policy-min-transit"
              type="number"
              label={p.minTransit}
              value={String(value.defaultMinTransitDays)}
              onChange={(v) =>
                set('defaultMinTransitDays', clampDays(v, value.defaultMinTransitDays))
              }
            />
            <TextField
              id="policy-max-transit"
              type="number"
              label={p.maxTransit}
              value={String(value.defaultMaxTransitDays)}
              onChange={(v) =>
                set('defaultMaxTransitDays', clampDays(v, value.defaultMaxTransitDays))
              }
              help={p.transitHelp}
            />
            <h3 className="text-body font-bold text-ink-strong">{p.warehouse}</h3>
            <TextField
              id="wh-name"
              label={p.warehouseName}
              value={value.warehouse.name}
              onChange={(v) => setWarehouse('name', v)}
            />
            <TextField
              id="wh-line1"
              label={p.line1}
              value={value.warehouse.line1}
              onChange={(v) => setWarehouse('line1', v)}
            />
            <TextField
              id="wh-line2"
              label={p.line2}
              value={value.warehouse.line2}
              onChange={(v) => setWarehouse('line2', v)}
            />
            <TextField
              id="wh-city"
              label={p.city}
              value={value.warehouse.city}
              onChange={(v) => setWarehouse('city', v)}
            />
            <TextField
              id="wh-state"
              label={p.state}
              value={value.warehouse.state}
              onChange={(v) => setWarehouse('state', v)}
            />
            <TextField
              id="wh-phone"
              label={p.phone}
              value={value.warehouse.phone}
              onChange={(v) => setWarehouse('phone', v)}
            />
            <TextField
              id="policy-insurance"
              type="number"
              label={p.insuranceThreshold}
              value={String(Math.round(value.insuranceThresholdPaise / 100))}
              onChange={(v) => set('insuranceThresholdPaise', clampRupees(v, 0) * 100)}
              help={p.insuranceThresholdHelp}
            />
            <TextField
              id="policy-low-wallet"
              type="number"
              label={p.lowWalletBalance}
              value={String(Math.round(value.lowWalletBalancePaise / 100))}
              onChange={(v) => set('lowWalletBalancePaise', clampRupees(v, 500) * 100)}
              help={p.lowWalletBalanceHelp}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </SettingsCard>
  )
}

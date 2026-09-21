'use client'

import type { ShippingPolicySettings } from '@commerce/core'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { shippingSettingsContent as copy } from '@/data/shipping'

type ShippingPolicyFieldsProps = {
  value: ShippingPolicySettings
  onChange: (next: ShippingPolicySettings) => void
}

type Warehouse = ShippingPolicySettings['warehouse']

const p = copy.policy

const toDays = (selected: number[]) =>
  [...new Set(selected)].filter((n) => n >= 1 && n <= 7).sort((a, b) => a - b)

const clampDays = (raw: string, fallback: number) => {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 1 && n <= 30 ? n : fallback
}

type WeekdayPickerProps = {
  name: string
  legend: string
  selected: number[]
  onChange: (days: number[]) => void
}

/** Seven checkboxes in a row. */
function WeekdayPicker({ name, legend, selected, onChange }: WeekdayPickerProps) {
  // Helpers
  const toggle = (day: number, on: boolean) =>
    onChange(toDays(on ? [...selected, day] : selected.filter((d) => d !== day)))

  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
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
    </FieldSet>
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
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        size="lg"
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
      {help ? <FieldDescription>{help}</FieldDescription> : null}
    </Field>
  )
}

/** The store-wide dispatch calendar and return address, edited on Settings › Shipping. */
export default function ShippingPolicyFields({ value, onChange }: ShippingPolicyFieldsProps) {
  // Helpers
  const set = <K extends keyof ShippingPolicySettings>(k: K, v: ShippingPolicySettings[K]) =>
    onChange({ ...value, [k]: v })
  const setWarehouse = (k: keyof Warehouse, v: string) =>
    onChange({ ...value, warehouse: { ...value.warehouse, [k]: v } })

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{p.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>
          <WeekdayPicker
            name="working"
            legend={p.workingDays}
            selected={value.workingDays}
            onChange={(d) => set('workingDays', d)}
          />
          <div className="flex flex-col gap-2">
            <WeekdayPicker
              name="delivery"
              legend={p.deliveryDays}
              selected={value.deliveryDays}
              onChange={(d) => set('deliveryDays', d)}
            />
            <FieldDescription>{p.deliveryDaysHelp}</FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="policy-holidays">{p.holidays}</FieldLabel>
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
            <FieldDescription>{p.holidaysHelp}</FieldDescription>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>
          <Field orientation="horizontal">
            <Checkbox
              id="policy-cod"
              checked={value.codAllowed}
              onCheckedChange={(v) => set('codAllowed', Boolean(v))}
            />
            <FieldLabel htmlFor="policy-cod" className="font-normal">
              {p.codAllowed}
            </FieldLabel>
          </Field>
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
          <div className="grid gap-4 md:grid-cols-3">
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
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

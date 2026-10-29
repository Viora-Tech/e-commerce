'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import MoneyInput from '@/components/fields/money-input'
import SettingsCard from '@/components/settings/settings-card'
import SettingsToggleRow from '@/components/settings/settings-toggle-row'
import { deliveryOptionsContent } from '@/data/delivery-options'
import { useCopy } from '@/hooks/use-copy'
import type { OptionForm as Form } from './option-form-state'
import RouteSelectorRow from './route-selector-row'

type OptionFormProps = {
  form: Form
  onChange: (next: Form) => void
}

/** A number field without the ₹ sign (days, %). */
function NumberField(props: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor={props.id}>{props.label}</FieldLabel>
      <MoneyInput
        id={props.id}
        value={props.value}
        onChange={props.onChange}
        currency={false}
        suffix={props.suffix}
      />
    </Field>
  )
}

/** A money field in rupees. */
function RupeeField(props: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  help?: string
}) {
  return (
    <Field>
      <FieldLabel htmlFor={props.id}>{props.label}</FieldLabel>
      <MoneyInput id={props.id} value={props.value} onChange={props.onChange} />
      {props.help ? <FieldDescription>{props.help}</FieldDescription> : null}
    </Field>
  )
}

/** The option page's cards: display, routes and strategy, price, insurance, arrival, COD. */
export default function OptionForm({ form, onChange }: OptionFormProps) {
  // Hooks
  const copy = useCopy(deliveryOptionsContent)

  // Helpers
  const set =
    <K extends keyof Form>(key: K) =>
    (value: Form[K]) =>
      onChange({ ...form, [key]: value })

  // Render logic
  const o = copy.option
  const express = form.speed === 'express'

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard title={o.display.title}>
        <Field>
          <FieldLabel htmlFor="opt-name">{o.display.name}</FieldLabel>
          <Input
            id="opt-name"
            value={form.name}
            placeholder={o.display.namePlaceholder}
            onChange={(e) => set('name')(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="opt-description">{o.display.description}</FieldLabel>
          <Input
            id="opt-description"
            value={form.description}
            placeholder={o.display.descriptionPlaceholder}
            onChange={(e) => set('description')(e.target.value)}
          />
        </Field>
      </SettingsCard>

      <SettingsCard title={o.routing.title}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ChoiceField
            id="opt-speed"
            label={o.routing.speed}
            value={form.speed}
            options={(['standard', 'express'] as const).map((v) => ({
              value: v,
              label: o.routing.speeds[v],
            }))}
            onChange={(v) => onChange({ ...form, speed: v === 'express' ? 'express' : 'standard' })}
          />
          <ChoiceField
            id="opt-strategy"
            label={o.routing.strategy}
            value={form.strategy}
            options={(['cheapest', 'fastest'] as const).map((v) => ({
              value: v,
              label: o.routing.strategies[v],
            }))}
            onChange={(v) => set('strategy')(v === 'fastest' ? 'fastest' : 'cheapest')}
          />
        </div>
        <RupeeField
          id="opt-prefer-direct"
          label={o.routing.preferDirect}
          help={o.routing.preferDirectHelp}
          value={form.preferDirect}
          onChange={set('preferDirect')}
        />
        <ChoiceField
          id="opt-route-mode"
          label={o.routing.routes}
          value={form.routeMode}
          options={(['any', 'allow', 'exclude'] as const).map((v) => ({
            value: v,
            label: o.routing.routeModes[v],
          }))}
          onChange={(v) => set('routeMode')(v as Form['routeMode'])}
        />
        {form.routeMode === 'any' ? null : (
          <div className="flex flex-col gap-2">
            {form.selectors.map((s, i) => (
              <RouteSelectorRow
                // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity of their own.
                key={i}
                id={`opt-route-${i}`}
                value={s}
                onChange={(next) =>
                  set('selectors')(form.selectors.map((x, j) => (j === i ? next : x)))
                }
                onRemove={() => set('selectors')(form.selectors.filter((_, j) => j !== i))}
              />
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() =>
                set('selectors')([
                  ...form.selectors,
                  { carrier: 'delhivery', channel: 'any', speed: 'any' },
                ])
              }
            >
              <Plus aria-hidden />
              {copy.ruleDialog.addRoute}
            </Button>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title={o.price.title}>
        <ChoiceField
          id="opt-price-source"
          label={o.price.source}
          value={form.priceSource}
          options={(['route', 'zone'] as const).map((v) => ({
            value: v,
            label: o.price.sources[v],
          }))}
          onChange={(v) => set('priceSource')(v === 'zone' ? 'zone' : 'route')}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {form.priceSource === 'route' ? (
            <>
              <RupeeField
                id="opt-markup"
                label={o.price.markup}
                value={form.markup}
                onChange={set('markup')}
              />
              <NumberField
                id="opt-markup-pct"
                label={o.price.markupPercent}
                value={form.markupPercent}
                onChange={set('markupPercent')}
                suffix="%"
              />
            </>
          ) : null}
          <RupeeField
            id="opt-free-above"
            label={o.price.freeAbove}
            value={form.freeAbove}
            onChange={set('freeAbove')}
          />
          <RupeeField id="opt-min" label={o.price.min} value={form.min} onChange={set('min')} />
          <RupeeField id="opt-max" label={o.price.max} value={form.max} onChange={set('max')} />
        </div>
      </SettingsCard>

      <SettingsCard title={o.insurance.title}>
        <ChoiceField
          id="opt-insurance"
          label={o.insurance.default}
          value={form.insurance}
          options={[
            { value: 'on', label: o.insurance.on },
            { value: 'off', label: o.insurance.off },
          ]}
          onChange={(v) => set('insurance')(v === 'on' ? 'on' : 'off')}
        />
        {form.insurance === 'on' ? (
          <RupeeField
            id="opt-insurance-above"
            label={o.insurance.onlyAbove}
            value={form.insuranceAbove}
            onChange={set('insuranceAbove')}
          />
        ) : null}
      </SettingsCard>

      <SettingsCard title={o.arrival.title}>
        <ChoiceField
          id="opt-eta"
          label={o.arrival.source}
          value={form.etaSource}
          options={(['route', 'fixed'] as const).map((v) => ({
            value: v,
            label: o.arrival.sources[v],
          }))}
          onChange={(v) => set('etaSource')(v === 'fixed' ? 'fixed' : 'route')}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {form.etaSource === 'fixed' ? (
            <>
              <NumberField
                id="opt-fixed-min"
                label={o.arrival.fixedMin}
                value={form.fixedMin}
                onChange={set('fixedMin')}
              />
              <NumberField
                id="opt-fixed-max"
                label={o.arrival.fixedMax}
                value={form.fixedMax}
                onChange={set('fixedMax')}
              />
            </>
          ) : null}
          <NumberField
            id="opt-buffer"
            label={o.arrival.buffer}
            value={form.buffer}
            onChange={set('buffer')}
          />
          <NumberField
            id="opt-processing"
            label={o.arrival.processing}
            value={form.processing}
            onChange={set('processing')}
          />
          <NumberField
            id="opt-max-days"
            label={o.arrival.maxDays}
            value={form.maxDays}
            onChange={set('maxDays')}
          />
        </div>
      </SettingsCard>

      <SettingsCard title={o.cod.title}>
        {express ? (
          <p className="text-body text-muted-foreground">{o.cod.expressNote}</p>
        ) : (
          <ChoiceField
            id="opt-cod"
            label={o.cod.mode}
            value={form.cod}
            options={[
              { value: 'allowed', label: o.cod.allowed },
              { value: 'prepaid_only', label: o.cod.prepaidOnly },
            ]}
            onChange={(v) => set('cod')(v === 'prepaid_only' ? 'prepaid_only' : 'allowed')}
          />
        )}
      </SettingsCard>

      <SettingsCard title={o.availability.title}>
        <SettingsToggleRow
          id="opt-enabled"
          label={o.availability.enabled}
          checked={form.enabled}
          onChange={set('enabled')}
        />
      </SettingsCard>
    </div>
  )
}

'use client'

import type { ShippingPolicySettings } from '@commerce/core'
import {
  BlockStack,
  Card,
  Checkbox,
  ChoiceList,
  FormLayout,
  Text,
  TextField,
} from '@shopify/polaris'
import { shippingSettingsContent as copy } from '@/data/shipping'

type ShippingPolicyFieldsProps = {
  value: ShippingPolicySettings
  onChange: (next: ShippingPolicySettings) => void
}

const choices = copy.weekdays.map((d) => ({ label: d.label, value: String(d.value) }))

const toDays = (selected: string[]) =>
  selected
    .map(Number)
    .filter((n) => n >= 1 && n <= 7)
    .sort((a, b) => a - b)

const clampDays = (raw: string, fallback: number) => {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 1 && n <= 30 ? n : fallback
}

/** The store-wide dispatch calendar and return address, edited on Settings › Shipping. */
export function ShippingPolicyFields({ value, onChange }: ShippingPolicyFieldsProps) {
  const p = copy.policy
  const set = <K extends keyof ShippingPolicySettings>(k: K, v: ShippingPolicySettings[K]) =>
    onChange({ ...value, [k]: v })
  const setWarehouse = (k: keyof ShippingPolicySettings['warehouse'], v: string) =>
    onChange({ ...value, warehouse: { ...value.warehouse, [k]: v } })

  return (
    <Card>
      <BlockStack gap="400">
        <Text as="h2" variant="headingSm">
          {p.heading}
        </Text>
        <FormLayout>
          <FormLayout.Group>
            <TextField
              label={p.originPincode}
              value={value.originPincode}
              onChange={(v) => set('originPincode', v)}
              autoComplete="off"
            />
            <TextField
              label={p.cutoff}
              value={value.cutoff}
              onChange={(v) => set('cutoff', v)}
              helpText={p.cutoffHelp}
              autoComplete="off"
            />
          </FormLayout.Group>
          <ChoiceList
            allowMultiple
            title={p.workingDays}
            choices={choices}
            selected={value.workingDays.map(String)}
            onChange={(s) => set('workingDays', toDays(s))}
          />
          <ChoiceList
            allowMultiple
            title={p.deliveryDays}
            choices={choices}
            selected={value.deliveryDays.map(String)}
            onChange={(s) => set('deliveryDays', toDays(s))}
          />
          <Text as="p" tone="subdued" variant="bodySm">
            {p.deliveryDaysHelp}
          </Text>
          <TextField
            label={p.holidays}
            multiline={3}
            value={value.holidays.join('\n')}
            onChange={(v) =>
              set(
                'holidays',
                v
                  .split('\n')
                  .map((h) => h.trim())
                  .filter(Boolean),
              )
            }
            helpText={p.holidaysHelp}
            autoComplete="off"
          />
          <FormLayout.Group>
            <TextField
              label={p.minTransit}
              type="number"
              value={String(value.defaultMinTransitDays)}
              onChange={(v) =>
                set('defaultMinTransitDays', clampDays(v, value.defaultMinTransitDays))
              }
              autoComplete="off"
            />
            <TextField
              label={p.maxTransit}
              type="number"
              value={String(value.defaultMaxTransitDays)}
              onChange={(v) =>
                set('defaultMaxTransitDays', clampDays(v, value.defaultMaxTransitDays))
              }
              helpText={p.transitHelp}
              autoComplete="off"
            />
          </FormLayout.Group>
          <Checkbox
            label={p.codAllowed}
            checked={value.codAllowed}
            onChange={(v) => set('codAllowed', v)}
          />
          <Text as="h3" variant="headingXs">
            {p.warehouse}
          </Text>
          <TextField
            label={p.warehouseName}
            value={value.warehouse.name}
            onChange={(v) => setWarehouse('name', v)}
            autoComplete="off"
          />
          <TextField
            label={p.line1}
            value={value.warehouse.line1}
            onChange={(v) => setWarehouse('line1', v)}
            autoComplete="off"
          />
          <TextField
            label={p.line2}
            value={value.warehouse.line2}
            onChange={(v) => setWarehouse('line2', v)}
            autoComplete="off"
          />
          <FormLayout.Group>
            <TextField
              label={p.city}
              value={value.warehouse.city}
              onChange={(v) => setWarehouse('city', v)}
              autoComplete="off"
            />
            <TextField
              label={p.state}
              value={value.warehouse.state}
              onChange={(v) => setWarehouse('state', v)}
              autoComplete="off"
            />
            <TextField
              label={p.phone}
              value={value.warehouse.phone}
              onChange={(v) => setWarehouse('phone', v)}
              autoComplete="off"
            />
          </FormLayout.Group>
        </FormLayout>
      </BlockStack>
    </Card>
  )
}

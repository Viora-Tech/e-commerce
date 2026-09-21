'use client'

import type { InventoryReason } from '@commerce/core/catalog'
import { BlockStack, Card, Checkbox, FormLayout, Select, Text, TextField } from '@shopify/polaris'
import { productFormContent } from '@/data/products'
import type { VariantRow } from './form-state'

type InventoryCardProps = {
  variant: VariantRow
  /** Quantity differs from what is saved, so a reason is needed. */
  quantityChanged: boolean
  reason: InventoryReason
  onChange: (patch: Partial<VariantRow>) => void
  onReason: (reason: InventoryReason) => void
}

const copy = productFormContent.inventory

export function InventoryCard({
  variant,
  quantityChanged,
  reason,
  onChange,
  onReason,
}: InventoryCardProps) {
  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">
          {copy.heading}
        </Text>
        <FormLayout>
          <FormLayout.Group>
            <TextField
              label={copy.sku}
              value={variant.sku}
              onChange={(sku) => onChange({ sku })}
              autoComplete="off"
            />
            <TextField
              label={copy.barcode}
              value={variant.barcode}
              onChange={(barcode) => onChange({ barcode })}
              autoComplete="off"
            />
          </FormLayout.Group>
          <Checkbox
            label={copy.track}
            checked={variant.trackInventory}
            onChange={(trackInventory) => onChange({ trackInventory })}
          />
          {variant.trackInventory ? (
            <FormLayout.Group>
              <TextField
                label={copy.quantity}
                type="number"
                min={0}
                value={variant.quantity}
                onChange={(quantity) => onChange({ quantity })}
                autoComplete="off"
              />
              {quantityChanged ? (
                <Select
                  label={copy.reason}
                  options={[...copy.reasons]}
                  value={reason}
                  onChange={(r) => onReason(r as InventoryReason)}
                />
              ) : null}
            </FormLayout.Group>
          ) : null}
          <TextField
            label={copy.weight}
            type="number"
            min={0}
            suffix="g"
            value={variant.weight}
            onChange={(weight) => onChange({ weight })}
            helpText={copy.weightHelp}
            autoComplete="off"
          />
        </FormLayout>
      </BlockStack>
    </Card>
  )
}

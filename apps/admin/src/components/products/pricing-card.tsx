'use client'

import { BlockStack, Card, Checkbox, FormLayout, Text, TextField } from '@shopify/polaris'
import { productFormContent } from '@/data/products'
import { formatPaise } from '@/lib/money'
import { margin, type VariantRow } from './form-state'

type PricingCardProps = {
  variant: VariantRow
  onChange: (patch: Partial<VariantRow>) => void
}

const copy = productFormContent.pricing

/** Shown for single-variant products; the variants table carries these fields otherwise. */
export function PricingCard({ variant, onChange }: PricingCardProps) {
  const m = margin(variant.price, variant.cost)

  return (
    <Card>
      <BlockStack gap="300">
        <Text as="h2" variant="headingSm">
          {copy.heading}
        </Text>
        <FormLayout>
          <FormLayout.Group>
            <TextField
              label={copy.price}
              prefix="₹"
              type="number"
              min={0}
              value={variant.price}
              onChange={(price) => onChange({ price })}
              autoComplete="off"
              requiredIndicator
            />
            <TextField
              label={copy.mrp}
              prefix="₹"
              type="number"
              min={0}
              value={variant.mrp}
              onChange={(mrp) => onChange({ mrp })}
              autoComplete="off"
            />
          </FormLayout.Group>
          <Checkbox
            label={copy.taxable}
            checked={variant.taxable}
            onChange={(taxable) => onChange({ taxable })}
          />
          <FormLayout.Group>
            <TextField
              label={copy.cost}
              prefix="₹"
              type="number"
              min={0}
              value={variant.cost}
              onChange={(cost) => onChange({ cost })}
              autoComplete="off"
              helpText={m ? copy.margin(`${m.pct}%`, formatPaise(m.profitPaise)) : copy.costHelp}
            />
          </FormLayout.Group>
        </FormLayout>
      </BlockStack>
    </Card>
  )
}

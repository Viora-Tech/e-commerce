'use client'

import { variantTitle } from '@commerce/core/catalog'
import {
  BlockStack,
  Button,
  Card,
  Divider,
  FormLayout,
  IndexTable,
  InlineStack,
  Text,
  TextField,
} from '@shopify/polaris'
import { useState } from 'react'
import { productFormContent } from '@/data/products'
import { MAX_OPTIONS, type OptionRow, type VariantRow } from './form-state'

type VariantsCardProps = {
  options: OptionRow[]
  variants: VariantRow[]
  error?: string | undefined
  onOptions: (options: OptionRow[]) => void
  onVariant: (index: number, patch: Partial<VariantRow>) => void
}

const copy = productFormContent.variants

/** "Small, Medium , Large" → ["Small", "Medium", "Large"], duplicates dropped. */
function parseValues(text: string): string[] {
  const seen = new Set<string>()
  return text
    .split(',')
    .map((v) => v.trim())
    .filter((v) => {
      const k = v.toLowerCase()
      if (!v || seen.has(k)) return false
      seen.add(k)
      return true
    })
}

export function VariantsCard({
  options,
  variants,
  error,
  onOptions,
  onVariant,
}: VariantsCardProps) {
  // Raw comma text per option, so a trailing comma survives typing.
  const [valueText, setValueText] = useState<string[]>(() =>
    options.map((o) => o.values.join(', ')),
  )

  const setOption = (i: number, patch: Partial<OptionRow>) =>
    onOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)))

  const handleValues = (i: number, text: string) => {
    setValueText((t) => t.map((x, j) => (j === i ? text : x)))
    setOption(i, { values: parseValues(text) })
  }

  const addOption = () => {
    setValueText((t) => [...t, ''])
    onOptions([...options, { name: '', values: [] }])
  }

  const removeOption = (i: number) => {
    setValueText((t) => t.filter((_, j) => j !== i))
    onOptions(options.filter((_, j) => j !== i))
  }

  const hasOptions = options.length > 0

  return (
    <Card padding="0">
      <BlockStack gap="0">
        <div style={{ padding: 'var(--p-space-400)' }}>
          <BlockStack gap="300">
            <Text as="h2" variant="headingSm">
              {copy.heading}
            </Text>
            {options.map((o, i) => (
              <FormLayout key={o.id ?? `new-${i}`}>
                <FormLayout.Group>
                  <TextField
                    label={copy.optionName}
                    value={o.name}
                    onChange={(name) => setOption(i, { name })}
                    placeholder={copy.optionNamePlaceholder}
                    autoComplete="off"
                  />
                  <TextField
                    label={copy.optionValues}
                    value={valueText[i] ?? ''}
                    onChange={(text) => handleValues(i, text)}
                    placeholder={copy.optionValuesPlaceholder}
                    helpText={copy.optionValuesHelp}
                    autoComplete="off"
                    connectedRight={
                      <Button tone="critical" onClick={() => removeOption(i)}>
                        {copy.remove}
                      </Button>
                    }
                  />
                </FormLayout.Group>
              </FormLayout>
            ))}
            <InlineStack gap="200" blockAlign="center">
              <Button onClick={addOption} disabled={options.length >= MAX_OPTIONS}>
                {hasOptions ? copy.addAnother : copy.addOption}
              </Button>
              {options.length >= MAX_OPTIONS ? (
                <Text as="span" tone="subdued" variant="bodySm">
                  {copy.maxOptions}
                </Text>
              ) : null}
            </InlineStack>
            {error ? (
              <Text as="p" tone="critical" variant="bodySm">
                {error}
              </Text>
            ) : null}
            {variants.length > 30 ? (
              <Text as="p" tone="subdued" variant="bodySm">
                {copy.tooMany(variants.length)}
              </Text>
            ) : null}
          </BlockStack>
        </div>
        {hasOptions ? (
          <>
            <Divider />
            <IndexTable
              itemCount={variants.length}
              selectable={false}
              headings={[
                { title: copy.columns.variant },
                { title: copy.columns.price },
                { title: copy.columns.mrp },
                { title: copy.columns.sku },
                { title: copy.columns.available },
              ]}
            >
              {variants.map((v, i) => (
                <IndexTable.Row
                  id={v.id ?? variantTitle(v.optionValues)}
                  key={v.id ?? variantTitle(v.optionValues)}
                  position={i}
                >
                  <IndexTable.Cell>
                    <Text as="span" fontWeight="semibold">
                      {variantTitle(v.optionValues)}
                    </Text>
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <TextField
                      label={copy.columns.price}
                      labelHidden
                      prefix="₹"
                      type="number"
                      min={0}
                      value={v.price}
                      onChange={(price) => onVariant(i, { price })}
                      autoComplete="off"
                    />
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <TextField
                      label={copy.columns.mrp}
                      labelHidden
                      prefix="₹"
                      type="number"
                      min={0}
                      value={v.mrp}
                      onChange={(mrp) => onVariant(i, { mrp })}
                      autoComplete="off"
                    />
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <TextField
                      label={copy.columns.sku}
                      labelHidden
                      value={v.sku}
                      onChange={(sku) => onVariant(i, { sku })}
                      autoComplete="off"
                    />
                  </IndexTable.Cell>
                  <IndexTable.Cell>
                    <TextField
                      label={copy.columns.available}
                      labelHidden
                      type="number"
                      min={0}
                      value={v.quantity}
                      disabled={!v.trackInventory}
                      onChange={(quantity) => onVariant(i, { quantity })}
                      autoComplete="off"
                    />
                  </IndexTable.Cell>
                </IndexTable.Row>
              ))}
            </IndexTable>
          </>
        ) : null}
      </BlockStack>
    </Card>
  )
}

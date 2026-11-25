'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { useState } from 'react'
import MoneyInput from '@/components/fields/money-input'
import DataCard from '@/components/layout/data-card'
import ResourcePickDialog from '@/components/pickers/resource-pick-dialog'
import type { PickPage } from '@/components/pickers/resource-pick-types'
import { loyaltyRewardContent } from '@/data/loyalty-reward'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import type { RewardForm } from '@/lib/loyalty-reward-form'

type RewardDetailsCardProps = {
  form: RewardForm
  onChange: (patch: Partial<RewardForm>) => void
}

const PAGE = 30

/** "Reward": the value (₹ off, ₹ per step, percent, store credit) or the free product. */
export default function RewardDetailsCard({ form, onChange }: RewardDetailsCardProps) {
  // Hooks
  const copy = useCopy(loyaltyRewardContent)
  const fmt = useFormat()
  const [picking, setPicking] = useState(false)

  // Helpers
  const loadProducts = async ({
    page,
    search,
  }: {
    page: number
    search: string
  }): Promise<PickPage> => {
    const r = await api.products.list({ page, perPage: PAGE, search: search || undefined })
    return {
      items: r.items.map((item) => ({
        id: item.id,
        title: item.title,
        imageUrl: item.imageUrl,
        thumb: 'image' as const,
        meta: item.minPricePaise === null ? undefined : fmt.money(item.minPricePaise),
      })),
      total: r.total,
    }
  }

  // Early returns
  if (form.type === 'free_shipping') return null

  // Render logic
  const valueLabel = copy.value[form.type]

  return (
    <DataCard title={copy.reward}>
      {valueLabel ? (
        <Field>
          <FieldLabel htmlFor="reward-value">{valueLabel}</FieldLabel>
          {form.type === 'percent_off' ? (
            <InputGroup className="w-48">
              <InputGroupInput
                id="reward-value"
                inputMode="decimal"
                value={form.value}
                onChange={(e) => onChange({ value: e.target.value })}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          ) : (
            <MoneyInput
              id="reward-value"
              size="lg"
              className="w-48"
              value={form.value}
              onChange={(value) => onChange({ value })}
            />
          )}
        </Field>
      ) : null}
      {form.type === 'free_product' ? (
        <Field>
          <FieldLabel>{copy.product}</FieldLabel>
          <div className="flex items-center gap-3">
            {form.productTitle ? (
              <span className="text-body text-foreground">{form.productTitle}</span>
            ) : null}
            <Button variant="outline" onClick={() => setPicking(true)}>
              {form.productId ? copy.productChange : copy.productPick}
            </Button>
          </div>
        </Field>
      ) : null}
      {picking ? (
        <ResourcePickDialog
          open
          single
          title={copy.productDialog}
          selected={{ tab: 'products', ids: form.productId ? [form.productId] : [] }}
          tabs={[
            {
              key: 'products',
              label: copy.productTab,
              search: copy.productSearch,
              empty: copy.productEmpty,
              load: loadProducts,
            },
          ]}
          onClose={() => setPicking(false)}
          onDone={(result) => {
            const item = result.items[0]
            if (item) onChange({ productId: item.id, productTitle: item.title })
            setPicking(false)
          }}
        />
      ) : null}
    </DataCard>
  )
}

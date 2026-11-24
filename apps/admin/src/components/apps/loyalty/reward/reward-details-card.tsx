'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import MoneyInput from '@/components/fields/money-input'
import DataCard from '@/components/layout/data-card'
import ResourcePickDialog from '@/components/pickers/resource-pick-dialog'
import type { PickPage } from '@/components/pickers/resource-pick-types'
import { loyaltyRewardContent } from '@/data/loyalty-reward'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { amountText, fillTitle, type RewardForm } from '@/lib/loyalty-reward-form'

type RewardDetailsCardProps = {
  form: RewardForm
  onChange: (patch: Partial<RewardForm>) => void
}

const PAGE = 30

/** What members see: the title with its {amount} and a preview line, the description, the value or product. */
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

  // Render logic
  const preview = fillTitle(form.title, amountText(form, fmt.money))
  const valueLabel = copy.value[form.type]
  const money = form.type !== 'percent_off'

  return (
    <DataCard title={copy.details}>
      <div className="flex flex-col gap-5">
        {valueLabel ? (
          <Field>
            <FieldLabel htmlFor="reward-value">{valueLabel}</FieldLabel>
            {money ? (
              <MoneyInput
                id="reward-value"
                size="lg"
                className="w-48"
                value={form.value}
                onChange={(value) => onChange({ value })}
              />
            ) : (
              <Input
                id="reward-value"
                size="lg"
                inputMode="decimal"
                className="w-48"
                value={form.value}
                onChange={(e) => onChange({ value: e.target.value })}
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
        <Field>
          <FieldLabel htmlFor="reward-title">{copy.title}</FieldLabel>
          <Input
            id="reward-title"
            size="lg"
            maxLength={120}
            value={form.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
          <FieldDescription>{copy.titleHelp}</FieldDescription>
          {preview ? (
            <p className="rounded-md bg-muted px-3 py-2 text-body text-ink-strong">
              {copy.titlePreview(preview)}
            </p>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="reward-description">{copy.description}</FieldLabel>
          <Textarea
            id="reward-description"
            rows={2}
            maxLength={500}
            value={form.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
          <FieldDescription>{copy.descriptionHelp}</FieldDescription>
        </Field>
      </div>
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
